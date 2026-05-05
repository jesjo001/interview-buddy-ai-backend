"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const flashcardController_1 = require("../controllers/flashcardController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate); // All flashcard routes are protected
router.get('/due', flashcardController_1.getFlashcardsDueForReview);
router.get('/topic/:topicId', flashcardController_1.getFlashcardsByTopicId);
router.get('/prep/:prepId', flashcardController_1.getFlashcardsByPrepId);
router.post('/', flashcardController_1.createCustomFlashcard);
router.put('/:id', flashcardController_1.updateFlashcard);
router.post('/:id/review', flashcardController_1.reviewFlashcard);
router.delete('/:id', flashcardController_1.deleteFlashcard);
exports.default = router;
