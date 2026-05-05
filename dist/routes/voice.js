"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const voiceController_1 = require("../controllers/voiceController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate); // All voice routes are protected
router.post('/synthesize', voiceController_1.synthesizeContent);
router.post('/session', voiceController_1.logVoiceStudySession);
exports.default = router;
