"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const mockInterviewController_1 = require("../controllers/mockInterviewController");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * Mock Interview Routes
 */
// Start a new mock interview
router.post('/start', mockInterviewController_1.startMockInterview);
// Submit a response to a question
router.post('/:id/respond', mockInterviewController_1.submitResponse);
// End interview and calculate score
router.put('/:id/end', mockInterviewController_1.endInterview);
// Get specific interview details
router.get('/:id', mockInterviewController_1.getInterview);
// Get interview history (with pagination)
router.get('/', mockInterviewController_1.getInterviewHistory);
// Delete an interview
router.delete('/:id', mockInterviewController_1.deleteInterview);
// Get readiness score for a prep session
router.get('/:prepId/readiness', mockInterviewController_1.getReadinessScore);
exports.default = router;
