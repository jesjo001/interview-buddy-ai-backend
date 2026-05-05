"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewOutcome = exports.UserLevel = exports.InterviewRound = void 0;
const mongoose_1 = require("mongoose");
var InterviewRound;
(function (InterviewRound) {
    InterviewRound["PHONE_SCREEN"] = "phone-screen";
    InterviewRound["CODING"] = "coding";
    InterviewRound["SYSTEM_DESIGN"] = "system-design";
    InterviewRound["BEHAVIORAL"] = "behavioral";
    InterviewRound["ONSITE"] = "onsite";
    InterviewRound["EXECUTIVE"] = "executive";
})(InterviewRound || (exports.InterviewRound = InterviewRound = {}));
var UserLevel;
(function (UserLevel) {
    UserLevel["JUNIOR"] = "junior";
    UserLevel["MID"] = "mid";
    UserLevel["SENIOR"] = "senior";
    UserLevel["STAFF"] = "staff";
})(UserLevel || (exports.UserLevel = UserLevel = {}));
var InterviewOutcome;
(function (InterviewOutcome) {
    InterviewOutcome["OFFER"] = "offer";
    InterviewOutcome["REJECTED"] = "rejected";
    InterviewOutcome["CONTINUING"] = "continuing";
})(InterviewOutcome || (exports.InterviewOutcome = InterviewOutcome = {}));
const RoundDetailSchema = new mongoose_1.Schema({
    round: {
        type: String,
        enum: Object.values(InterviewRound),
        required: true
    },
    duration: { type: Number, required: true },
    focus: { type: String, required: true },
    tips: [{ type: String }],
    averageTimeToAnswer: { type: Number },
    successRate: { type: Number, min: 0, max: 100 },
});
const RoleBreakdownSchema = new mongoose_1.Schema({
    requiredSkills: [{ type: String }],
    commonSkills: [{ type: String }],
    averagePrepTime: { type: Number, required: true },
    typicalRoundsCount: { type: Number, required: true },
    roundDetails: [RoundDetailSchema],
    estimatedSalary: {
        junior: { min: { type: Number }, max: { type: Number } },
        mid: { min: { type: Number }, max: { type: Number } },
        senior: { min: { type: Number }, max: { type: Number } },
        staff: { min: { type: Number }, max: { type: Number } },
    },
});
const RealInterviewSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true },
    round: {
        type: String,
        enum: Object.values(InterviewRound),
        required: true
    },
    questions: [{ type: String }],
    outcome: {
        type: String,
        enum: Object.values(InterviewOutcome),
        required: true
    },
    tips: { type: String },
    rating: { type: Number, min: 1, max: 5, required: true },
    timestamp: { type: Date, default: Date.now },
});
const CompanyProfileSchema = new mongoose_1.Schema({
    company: { type: String, required: true, unique: true, lowercase: true, index: true },
    website: { type: String },
    industry: { type: String, index: true },
    culturalAttributes: {
        leadershipPrinciples: [{ type: String }],
        values: [{ type: String }],
        interviewStyle: { type: String, default: '' },
        cultureFit: { type: String, default: '' },
    },
    byRole: {
        type: Map,
        of: RoleBreakdownSchema,
        default: new Map(),
    },
    realInterviews: [RealInterviewSchema],
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    totalReviews: { type: Number, default: 0 },
    tags: [{ type: String, lowercase: true, index: true }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Indexes for search and filtering
CompanyProfileSchema.index({ company: 'text', tags: 1 });
CompanyProfileSchema.index({ averageRating: -1, totalReviews: -1 });
exports.default = (0, mongoose_1.model)('CompanyProfile', CompanyProfileSchema);
