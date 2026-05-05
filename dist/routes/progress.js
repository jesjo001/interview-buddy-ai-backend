"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const progressController_1 = require("../controllers/progressController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate); // All progress routes are protected
router.get('/dashboard/:prepId', progressController_1.getDashboardStats);
router.get('/stats', progressController_1.getUserLevelStats);
router.post('/activity', progressController_1.logActivity);
exports.default = router;
