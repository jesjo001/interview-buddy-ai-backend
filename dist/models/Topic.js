"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const types_1 = require("../types");
const TopicSchema = new mongoose_1.Schema({
    interviewPrepId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'InterviewPrep', required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    difficulty: { type: String, enum: Object.values(types_1.TopicDifficulty), default: types_1.TopicDifficulty.INTERMEDIATE },
    content: {
        summary: { type: String },
        keyPoints: [{ type: String }],
        deepDive: { type: String },
        resources: [{
                type: { type: String, enum: Object.values(types_1.ResourceType) },
                url: { type: String },
                title: { type: String }
            }],
    },
    mindMap: {
        nodes: [{ type: mongoose_1.Schema.Types.Mixed }], // JSON structure
        edges: [{ type: mongoose_1.Schema.Types.Mixed }]
    },
    masteryLevel: { type: Number, default: 0, min: 0, max: 100 },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Indexes for faster lookups
TopicSchema.index({ interviewPrepId: 1 });
TopicSchema.index({ title: 'text' });
exports.default = (0, mongoose_1.model)('Topic', TopicSchema);
