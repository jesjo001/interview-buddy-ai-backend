import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import User from '../models/User';
import { SubscriptionPlan, SubscriptionStatus } from '../types';

dotenv.config();

interface FlutterwaveInitializeResponse {
  status: string;
  message: string;
  data: {
    link: string;
  };
}

interface FlutterwaveTransactionResponse {
  status: string;
  message: string;
  data: {
    id?: number | string;
    tx_ref?: string;
    status?: string;
    customer?: {
      id?: number | string;
    };
    meta?: {
      userId?: string;
      plan?: string;
    };
  };
}

const FLUTTERWAVE_API_BASE_URL = 'https://api.flutterwave.com/v3';

const parsePlan = (value?: string): SubscriptionPlan | null => {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === SubscriptionPlan.PRO) return SubscriptionPlan.PRO;
  if (normalized === SubscriptionPlan.ENTERPRISE) return SubscriptionPlan.ENTERPRISE;
  if (normalized === SubscriptionPlan.FREE) return SubscriptionPlan.FREE;
  return null;
};

const getPlanValidityDays = (plan: SubscriptionPlan): number => {
  const validityRaw = process.env.FLUTTERWAVE_PLAN_VALIDITY_DAYS_JSON;
  if (!validityRaw) {
    return plan === SubscriptionPlan.ENTERPRISE ? 365 : 30;
  }

  try {
    const validityByPlan = JSON.parse(validityRaw) as Record<string, number>;
    const planDays = Number(validityByPlan[plan]);
    if (Number.isFinite(planDays) && planDays > 0) {
      return planDays;
    }
  } catch {
    console.warn('Invalid FLUTTERWAVE_PLAN_VALIDITY_DAYS_JSON. Falling back to default validity.');
  }

  return plan === SubscriptionPlan.ENTERPRISE ? 365 : 30;
};

const resolveAmount = (planOrAmount: string, quantity: number): number => {
  const directAmount = Number(planOrAmount);
  if (Number.isFinite(directAmount) && directAmount > 0) {
    return directAmount * Math.max(1, quantity);
  }

  const planPricesRaw = process.env.FLUTTERWAVE_PLAN_AMOUNTS_JSON;
  if (!planPricesRaw) {
    return 1000 * Math.max(1, quantity);
  }

  try {
    const planPrices = JSON.parse(planPricesRaw) as Record<string, number>;
    const planAmount = Number(planPrices[planOrAmount]);
    if (Number.isFinite(planAmount) && planAmount > 0) {
      return planAmount * Math.max(1, quantity);
    }
  } catch {
    console.warn('Invalid FLUTTERWAVE_PLAN_AMOUNTS_JSON. Falling back to default amount.');
  }

  return 1000 * Math.max(1, quantity);
};

const resolvePlanAmount = (plan: SubscriptionPlan): number => {
  const planPricesRaw = process.env.FLUTTERWAVE_PLAN_AMOUNTS_JSON;
  if (!planPricesRaw) {
    return plan === SubscriptionPlan.ENTERPRISE ? 99 : 29;
  }

  try {
    const planPrices = JSON.parse(planPricesRaw) as Record<string, number>;
    const planAmount = Number(planPrices[plan]);
    if (Number.isFinite(planAmount) && planAmount > 0) {
      return planAmount;
    }
  } catch {
    console.warn('Invalid FLUTTERWAVE_PLAN_AMOUNTS_JSON. Falling back to default plan amounts.');
  }

  return plan === SubscriptionPlan.ENTERPRISE ? 99 : 29;
};

const activateSubscriptionFromTransaction = async (
  userId: string,
  transactionData: {
    id?: number | string;
    customer?: { id?: number | string };
    meta?: { plan?: string; userId?: string };
  },
  planHint?: string
) => {
  const selectedPlan = parsePlan(transactionData.meta?.plan) || parsePlan(planHint) || SubscriptionPlan.PRO;
  const validForDays = getPlanValidityDays(selectedPlan);

  await User.findByIdAndUpdate(userId, {
    subscription: {
      plan: selectedPlan,
      status: SubscriptionStatus.ACTIVE,
      validUntil: new Date(Date.now() + validForDays * 24 * 60 * 60 * 1000),
      flutterwaveCustomerId: transactionData.customer?.id ? String(transactionData.customer.id) : undefined,
      flutterwaveSubscriptionId: transactionData.id ? String(transactionData.id) : undefined,
    },
  });

  return selectedPlan;
};

export const createFlutterwaveCheckoutSession = async (
  userId: string,
  planOrAmount: string,
  quantity: number = 1
) => {
  const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const frontendUrl = process.env.FRONTEND_URL?.split(',')[0]?.trim();

  if (!secretKey || !frontendUrl || !publicKey) {
    console.warn('Flutterwave keys or frontend URL not configured. Using mock checkout session.');
    return {
      id: 'mock_flw_tx_ref',
      url: `${frontendUrl || ''}/success?status=mock`,
    };
  }

  const user = await User.findById(userId).select('email name').lean();
  if (!user?.email) {
    throw new Error('User email is required to initialize Flutterwave payment');
  }

  const selectedPlan = parsePlan(planOrAmount);
  if (selectedPlan === SubscriptionPlan.FREE) {
    throw new Error('Free plan does not require checkout');
  }

  const chosenPlan = selectedPlan || SubscriptionPlan.PRO;
  const amount = resolveAmount(chosenPlan || planOrAmount, quantity);
  const txRef = `ipai-${userId}-${Date.now()}`;

  try {
    const response = await axios.post<FlutterwaveInitializeResponse>(
      `${FLUTTERWAVE_API_BASE_URL}/payments`,
      {
        tx_ref: txRef,
        amount,
        currency: process.env.FLUTTERWAVE_CURRENCY || 'USD',
        redirect_url: `${frontendUrl}/settings?billing=success&tx_ref=${encodeURIComponent(txRef)}`,
        customer: {
          email: user.email,
          name: user.name || 'Customer',
        },
        customizations: {
          title: 'Interview Prep AI',
          description: `Subscription checkout (${selectedPlan || planOrAmount})`,
        },
        meta: {
          userId,
          plan: chosenPlan,
          quantity,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'X-FLW-API-KEY': publicKey,
        },
      }
    );

    return {
      id: txRef,
      tx_ref: txRef,
      url: response.data.data.link,
      plan: chosenPlan,
      amount,
    };
  } catch (error) {
    console.error('Error creating Flutterwave checkout session:', error);
    throw new Error('Failed to create Flutterwave checkout session');
  }
};

export const handleFlutterwaveWebhook = async (payload: string, signature?: string) => {
  const webhookHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!webhookHash) {
    console.warn('Flutterwave webhook hash not configured. Skipping webhook verification.');
    return null;
  }

  const isValidHmacSignature = (rawPayload: string, incomingSignature: string, secretHash: string) => {
    const expected = crypto
      .createHmac('sha256', secretHash)
      .update(rawPayload)
      .digest('base64');

    const expectedBuffer = Buffer.from(expected);
    const incomingBuffer = Buffer.from(incomingSignature);
    if (expectedBuffer.length !== incomingBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, incomingBuffer);
  };

  // Current docs: use flutterwave-signature (HMAC-SHA256 base64).
  // Legacy compatibility: some older integrations pass verif-hash directly.
  if (!signature) {
    throw new Error('Missing Flutterwave webhook signature');
  }

  const signatureLooksLikeHmac = signature.length > 40;
  const isValid = signatureLooksLikeHmac
    ? isValidHmacSignature(payload, signature, webhookHash)
    : signature === webhookHash;

  if (!isValid) {
    throw new Error('Invalid Flutterwave webhook signature');
  }

  const event = JSON.parse(payload) as {
    event?: string;
    type?: string;
    data?: {
      id?: number | string;
      status?: string;
      customer?: { id?: number | string };
      meta?: { userId?: string; user_id?: string; plan?: string };
    };
  };

  const eventType = event.type || event.event;
  if (eventType !== 'charge.completed') {
    return event;
  }

  const transactionData = event.data;
  if (!transactionData) {
    return event;
  }

  const paymentStatus = (transactionData.status || '').toLowerCase();
  if (!['successful', 'succeeded'].includes(paymentStatus)) {
    return event;
  }

  const userId = transactionData.meta?.userId || transactionData.meta?.user_id;
  if (!userId) {
    return event;
  }

  await activateSubscriptionFromTransaction(userId, {
    id: transactionData.id,
    customer: transactionData.customer,
    meta: {
      plan: transactionData.meta?.plan,
      userId,
    },
  });

  return event;
};

export const verifyFlutterwaveTransaction = async (
  userId: string,
  options: { txRef?: string; transactionId?: string; plan?: string }
) => {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Flutterwave secret key is not configured');
  }

  if (!options.txRef && !options.transactionId) {
    throw new Error('Either txRef or transactionId is required for verification');
  }

  let response;

  const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error('Flutterwave public key is not configured');
  }

  if (options.transactionId) {
    response = await axios.get<FlutterwaveTransactionResponse>(
      `${FLUTTERWAVE_API_BASE_URL}/transactions/${encodeURIComponent(options.transactionId)}/verify`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'X-FLW-API-KEY': publicKey,
        },
      }
    );
  } else {
    response = await axios.get<FlutterwaveTransactionResponse>(
      `${FLUTTERWAVE_API_BASE_URL}/transactions/verify_by_reference`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'X-FLW-API-KEY': publicKey,
        },
        params: { tx_ref: options.txRef },
      }
    );
  }

  const tx = response.data.data;
  const status = (tx?.status || '').toLowerCase();
  if (!['successful', 'succeeded'].includes(status)) {
    throw new Error('Transaction has not been completed successfully');
  }

  if (tx.meta?.userId && tx.meta.userId !== userId) {
    throw new Error('Verified transaction does not belong to current user');
  }

  const appliedPlan = await activateSubscriptionFromTransaction(userId, tx, options.plan);

  return {
    verified: true,
    plan: appliedPlan,
    txRef: tx.tx_ref,
    transactionId: tx.id ? String(tx.id) : undefined,
  };
};

export const getBillingPlanCatalog = () => {
  const currency = process.env.FLUTTERWAVE_CURRENCY || 'USD';
  return [
    {
      plan: SubscriptionPlan.PRO,
      amount: resolvePlanAmount(SubscriptionPlan.PRO),
      validityDays: getPlanValidityDays(SubscriptionPlan.PRO),
      currency,
    },
    {
      plan: SubscriptionPlan.ENTERPRISE,
      amount: resolvePlanAmount(SubscriptionPlan.ENTERPRISE),
      validityDays: getPlanValidityDays(SubscriptionPlan.ENTERPRISE),
      currency,
    },
  ];
};

export const createCheckoutSession = createFlutterwaveCheckoutSession;
export const handleStripeWebhook = handleFlutterwaveWebhook;
