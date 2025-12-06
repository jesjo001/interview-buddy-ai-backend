import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import User from '../models/User';
import { IUser } from '../models/User';
import { SubscriptionPlan } from '../types';

// Extend the Request type to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) { // Check for token in cookies (if using httpOnly cookies)
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({ error: 'No authentication token, authorization denied' });
    }

    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Token is not valid' });
    }

    const user = await User.findById(decoded.userId).select('-passwordHash -refreshTokens');

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error: any) {
    console.error('Authentication error:', error.message);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireSubscription = (minPlan: SubscriptionPlan) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const planHierarchy = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PRO]: 1,
      [SubscriptionPlan.ENTERPRISE]: 2
    };

    if (planHierarchy[req.user.subscription.plan] < planHierarchy[minPlan]) {
      return res.status(403).json({ error: `Upgrade to ${minPlan} plan required` });
    }
    next();
  };
};
