"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const types_1 = require("../types");
const FlashcardSchema = new mongoose_1.Schema({
    topicId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Topic', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    reviewSchedule: {
        nextReview: { type: Date, required: true },
        interval: { type: Number, default: 1 },
        repetitions: { type: Number, default: 0 },
        easeFactor: { type: Number, default: 2.5 }
    },
    reviewHistory: [
        {
            reviewedAt: { type: Date, default: Date.now },
            rating: { type: String, enum: Object.values(types_1.FlashcardRating) },
            timeSpent: { type: Number }
        }
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Indexes to quickly fetch due flashcards and by user
FlashcardSchema.index({ userId: 1, 'reviewSchedule.nextReview': 1 });
FlashcardSchema.index({ topicId: 1 });
exports.default = (0, mongoose_1.model)('Flashcard', FlashcardSchema);
