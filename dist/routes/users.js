"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const userController_1 = require("../controllers/userController");
const router = (0, express_1.Router)();
// All user routes are protected
router.use(auth_1.authenticate);
router.get('/me', userController_1.getMe);
router.put('/me', userController_1.updateMe);
router.put('/preferences', userController_1.updatePreferences);
router.delete('/me', userController_1.deleteMe);
exports.default = router;
