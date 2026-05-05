"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSubscription = exports.authenticate = void 0;
const jwt_1 = require("../utils/jwt");
const User_1 = __importDefault(require("../models/User"));
const types_1 = require("../types");
const authenticate = async (req, res, next) => {
    try {
        let token;
        // Check for token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        else if (req.cookies && req.cookies.accessToken) { // Check for token in cookies (if using httpOnly cookies)
            token = req.cookies.accessToken;
        }
        if (!token) {
            return res.status(401).json({ error: 'No authentication token, authorization denied' });
        }
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        if (!decoded) {
            return res.status(401).json({ error: 'Token is not valid' });
        }
        const user = await User_1.default.findById(decoded.userId).select('-passwordHash -refreshTokens');
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error('Authentication error:', error.message);
        res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};
exports.authenticate = authenticate;
const requireSubscription = (minPlan) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const planHierarchy = {
            [types_1.SubscriptionPlan.FREE]: 0,
            [types_1.SubscriptionPlan.PRO]: 1,
            [types_1.SubscriptionPlan.ENTERPRISE]: 2
        };
        if (planHierarchy[req.user.subscription.plan] < planHierarchy[minPlan]) {
            return res.status(403).json({ error: `Upgrade to ${minPlan} plan required` });
        }
        next();
    };
};
exports.requireSubscription = requireSubscription;
