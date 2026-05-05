"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const mindMapController_1 = require("../controllers/mindMapController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate); // All mind map routes are protected
router.get('/topic/:topicId', mindMapController_1.getMindMapByTopicId);
router.get('/prep/:prepId', mindMapController_1.getMindMapByPrepId);
router.put('/topic/:topicId', mindMapController_1.updateMindMapByTopicId);
exports.default = router;
