"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoundStatus = void 0;
const mongoose_1 = require("mongoose");
const CompanyProfile_1 = require("./CompanyProfile");
var RoundStatus;
(function (RoundStatus) {
    RoundStatus["NOT_STARTED"] = "not-started";
    RoundStatus["IN_PROGRESS"] = "in-progress";
    RoundStatus["COMPLETED"] = "completed";
})(RoundStatus || (exports.RoundStatus = RoundStatus = {}));
const RoundProgressSchema = new mongoose_1.Schema({
    round: {
        type: String,
        enum: Object.values(CompanyProfile_1.InterviewRound),
        required: true
    },
    status: {
        type: String,
        enum: Object.values(RoundStatus),
        default: RoundStatus.NOT_STARTED,
        required: true
    },
    completedMockInterviews: { type: Number, default: 0 },
    averageScore: { type: Number, min: 0, max: 100, default: 0 },
    lastPracticed: { type: Date },
    targetScore: { type: Number, min: 0, max: 100, default: 80 },
    notes: { type: String },
});
const CompanyPrepPathSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CompanyProfile', required: true, index: true },
    prepId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'InterviewPrep', required: true, index: true },
    targetRole: { type: String, required: true },
    targetLevel: {
        type: String,
        enum: Object.values(CompanyProfile_1.UserLevel),
        required: true
    },
    progressByRound: [RoundProgressSchema],
    completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
    estimatedReadiness: { type: Number, min: 0, max: 100, default: 0 },
    startedAt: { type: Date, default: Date.now },
    targetCompletionDate: { type: Date },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Indexes
CompanyPrepPathSchema.index({ userId: 1, prepId: 1 });
CompanyPrepPathSchema.index({ companyId: 1, targetRole: 1 });
exports.default = (0, mongoose_1.model)('CompanyPrepPath', CompanyPrepPathSchema);
