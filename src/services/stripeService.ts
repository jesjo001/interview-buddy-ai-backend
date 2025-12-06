import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20', // Use the latest API version
});

export const createCheckoutSession = async (
  userId: string,
  priceId: string,
  quantity: number = 1
) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.FRONTEND_URL) {
    console.warn('Stripe or Frontend URL not configured. Using mock checkout session.');
    return {
      id: 'mock_session_id',
      url: `${process.env.FRONTEND_URL}/success?session_id=mock_session_id`,
    };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      mode: 'subscription', // or 'payment' depending on your product
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      customer_email: 'customer@example.com', // Will be replaced with actual user email
      client_reference_id: userId, // Link to your user in your database
      metadata: {
        userId: userId,
        plan: 'pro', // Example: will be dynamic
      },
    });
    return session;
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    throw new Error('Failed to create checkout session');
  }
};

export const handleStripeWebhook = async (payload: string, signature: string) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('Stripe webhook secret not configured. Skipping webhook verification.');
    return null;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    throw new Error(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      console.log('Checkout session completed:', checkoutSession);
      // Fulfill the purchase...
      // await fulfillOrder(checkoutSession.metadata?.userId, checkoutSession.metadata?.plan);
      break;
    case 'customer.subscription.updated':
      const subscriptionUpdated = event.data.object as Stripe.Subscription;
      console.log('Subscription updated:', subscriptionUpdated);
      // Update user's subscription status in your DB
      break;
    case 'customer.subscription.deleted':
      const subscriptionDeleted = event.data.object as Stripe.Subscription;
      console.log('Subscription deleted:', subscriptionDeleted);
      // Mark user's subscription as canceled/expired in your DB
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return event;
};
