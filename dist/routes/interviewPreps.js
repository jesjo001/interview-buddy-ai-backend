"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prepController_1 = require("../controllers/prepController");
const fileService_1 = require("../services/fileService"); // Import multer upload middleware
const router = (0, express_1.Router)();
// All interview prep routes are protected
router.use(auth_1.authenticate);
router.post('/', fileService_1.upload.single('jobDescriptionFile'), prepController_1.createInterviewPrep); // `jobDescriptionFile` is the field name for the file
router.get('/', prepController_1.getInterviewPreps);
router.get('/:id', prepController_1.getInterviewPrepById);
router.put('/:id', prepController_1.updateInterviewPrep);
router.delete('/:id', prepController_1.deleteInterviewPrep);
router.post('/:id/analyze', prepController_1.analyzeJobDescriptionManually); // Manual trigger to re-analyze JD
router.put('/:id/adjust-plan', prepController_1.adjustStudyPlan); // Adjust study plan (e.g., change interview date)
exports.default = router;
