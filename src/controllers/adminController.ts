import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { SubscriptionPlan, SubscriptionStatus, UserRole } from '../types';

export const getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      freeUsers,
      proUsers,
      enterpriseUsers,
      activeSubscriptions,
      canceledSubscriptions,
      recentUsers,
      newUsersLast30Days,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ 'subscription.plan': SubscriptionPlan.FREE }),
      User.countDocuments({ 'subscription.plan': SubscriptionPlan.PRO }),
      User.countDocuments({ 'subscription.plan': SubscriptionPlan.ENTERPRISE }),
      User.countDocuments({ 'subscription.status': SubscriptionStatus.ACTIVE }),
      User.countDocuments({ 'subscription.status': SubscriptionStatus.CANCELED }),
      User.find()
        .select('name email subscription.plan subscription.status role createdAt emailVerified')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
    ]);

    // Growth: users registered per day for the last 14 days
    const now = new Date();
    const growthStartDate = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
    growthStartDate.setHours(0, 0, 0, 0);

    const growthRaw = await User.aggregate([
      { $match: { createdAt: { $gte: growthStartDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill in zeros for missing days
    const growthMap: Record<string, number> = {};
    growthRaw.forEach((d) => { growthMap[d._id] = d.count; });
    const growth: { date: string; users: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(growthStartDate.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      growth.push({ date: key, users: growthMap[key] ?? 0 });
    }

    res.json({
      overview: {
        totalUsers,
        freeUsers,
        proUsers,
        enterpriseUsers,
        activeSubscriptions,
        canceledSubscriptions,
        newUsersLast30Days,
      },
      growth,
      recentUsers,
    });
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .select('-passwordHash -refreshTokens -resetPasswordToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent removing your own admin role
    if (req.user && req.user._id.toString() === userId && role !== UserRole.ADMIN) {
      return res.status(400).json({ error: 'Cannot remove your own admin role' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, select: '-passwordHash -refreshTokens -resetPasswordToken' }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
};
