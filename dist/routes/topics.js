"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const topicController_1 = require("../controllers/topicController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate); // All topic routes are protected
router.get('/prep/:prepId', topicController_1.getTopicsByPrepId);
router.get('/:id', topicController_1.getTopicById);
router.put('/:id', topicController_1.updateTopic);
router.put('/:id/complete', topicController_1.markTopicAsComplete);
router.put('/:id/mastery-level', topicController_1.updateTopicMasteryLevel);
exports.default = router;
