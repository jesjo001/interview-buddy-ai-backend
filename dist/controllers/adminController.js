"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserRole = exports.listUsers = exports.getAnalytics = void 0;
const User_1 = __importDefault(require("../models/User"));
const types_1 = require("../types");
const getAnalytics = async (req, res, next) => {
    try {
        const [totalUsers, freeUsers, proUsers, enterpriseUsers, activeSubscriptions, canceledSubscriptions, recentUsers, newUsersLast30Days,] = await Promise.all([
            User_1.default.countDocuments(),
            User_1.default.countDocuments({ 'subscription.plan': types_1.SubscriptionPlan.FREE }),
            User_1.default.countDocuments({ 'subscription.plan': types_1.SubscriptionPlan.PRO }),
            User_1.default.countDocuments({ 'subscription.plan': types_1.SubscriptionPlan.ENTERPRISE }),
            User_1.default.countDocuments({ 'subscription.status': types_1.SubscriptionStatus.ACTIVE }),
            User_1.default.countDocuments({ 'subscription.status': types_1.SubscriptionStatus.CANCELED }),
            User_1.default.find()
                .select('name email subscription.plan subscription.status role createdAt emailVerified')
                .sort({ createdAt: -1 })
                .limit(50)
                .lean(),
            User_1.default.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
        ]);
        // Growth: users registered per day for the last 14 days
        const now = new Date();
        const growthStartDate = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
        growthStartDate.setHours(0, 0, 0, 0);
        const growthRaw = await User_1.default.aggregate([
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
        const growthMap = {};
        growthRaw.forEach((d) => { growthMap[d._id] = d.count; });
        const growth = [];
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
    }
    catch (error) {
        next(error);
    }
};
exports.getAnalytics = getAnalytics;
const listUsers = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            User_1.default.find()
                .select('-passwordHash -refreshTokens -resetPasswordToken')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User_1.default.countDocuments(),
        ]);
        res.json({ users, total, page, pages: Math.ceil(total / limit) });
    }
    catch (error) {
        next(error);
    }
};
exports.listUsers = listUsers;
const updateUserRole = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        if (!Object.values(types_1.UserRole).includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        // Prevent removing your own admin role
        if (req.user && req.user._id.toString() === userId && role !== types_1.UserRole.ADMIN) {
            return res.status(400).json({ error: 'Cannot remove your own admin role' });
        }
        const user = await User_1.default.findByIdAndUpdate(userId, { role }, { new: true, select: '-passwordHash -refreshTokens -resetPasswordToken' });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUserRole = updateUserRole;
