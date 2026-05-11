"use strict";
// types/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewOutcome = exports.UserLevel = exports.InterviewRound = exports.InterviewStatus = exports.InterviewDifficulty = exports.InterviewType = exports.AnalysisStatus = exports.PrepStatus = exports.FlashcardRating = exports.ResourceType = exports.TopicDifficulty = exports.ActivityType = exports.LearningStyle = exports.SubscriptionStatusV2 = exports.SubscriptionStatus = exports.SubscriptionPlan = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var SubscriptionPlan;
(function (SubscriptionPlan) {
    SubscriptionPlan["FREE"] = "free";
    SubscriptionPlan["PRO"] = "pro";
    SubscriptionPlan["ENTERPRISE"] = "enterprise";
})(SubscriptionPlan || (exports.SubscriptionPlan = SubscriptionPlan = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVE"] = "active";
    SubscriptionStatus["CANCELED"] = "canceled";
    SubscriptionStatus["EXPIRED"] = "expired";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var SubscriptionStatusV2;
(function (SubscriptionStatusV2) {
    SubscriptionStatusV2["ACTIVE"] = "active";
    SubscriptionStatusV2["PAUSED"] = "paused";
    SubscriptionStatusV2["CANCELLED"] = "cancelled";
    SubscriptionStatusV2["EXPIRED"] = "expired";
})(SubscriptionStatusV2 || (exports.SubscriptionStatusV2 = SubscriptionStatusV2 = {}));
var LearningStyle;
(function (LearningStyle) {
    LearningStyle["VISUAL"] = "visual";
    LearningStyle["AUDITORY"] = "auditory";
    LearningStyle["KINESTHETIC"] = "kinesthetic";
})(LearningStyle || (exports.LearningStyle = LearningStyle = {}));
var ActivityType;
(function (ActivityType) {
    ActivityType["FLASHCARD_REVIEW"] = "flashcard_review";
    ActivityType["TOPIC_COMPLETE"] = "topic_complete";
    ActivityType["VOICE_SESSION"] = "voice_session";
    ActivityType["MOCK_INTERVIEW"] = "mock_interview";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
var TopicDifficulty;
(function (TopicDifficulty) {
    TopicDifficulty["BEGINNER"] = "beginner";
    TopicDifficulty["INTERMEDIATE"] = "intermediate";
    TopicDifficulty["ADVANCED"] = "advanced";
})(TopicDifficulty || (exports.TopicDifficulty = TopicDifficulty = {}));
var ResourceType;
(function (ResourceType) {
    ResourceType["ARTICLE"] = "article";
    ResourceType["VIDEO"] = "video";
    ResourceType["DOCUMENTATION"] = "documentation";
})(ResourceType || (exports.ResourceType = ResourceType = {}));
var FlashcardRating;
(function (FlashcardRating) {
    FlashcardRating["AGAIN"] = "again";
    FlashcardRating["HARD"] = "hard";
    FlashcardRating["GOOD"] = "good";
    FlashcardRating["EASY"] = "easy";
})(FlashcardRating || (exports.FlashcardRating = FlashcardRating = {}));
var PrepStatus;
(function (PrepStatus) {
    PrepStatus["ACTIVE"] = "active";
    PrepStatus["COMPLETED"] = "completed";
    PrepStatus["ARCHIVED"] = "archived";
})(PrepStatus || (exports.PrepStatus = PrepStatus = {}));
var AnalysisStatus;
(function (AnalysisStatus) {
    AnalysisStatus["PENDING"] = "pending";
    AnalysisStatus["PROCESSING"] = "processing";
    AnalysisStatus["COMPLETED"] = "completed";
    AnalysisStatus["FAILED"] = "failed";
})(AnalysisStatus || (exports.AnalysisStatus = AnalysisStatus = {}));
// Mock Interview Enums
var InterviewType;
(function (InterviewType) {
    InterviewType["TECHNICAL"] = "technical";
    InterviewType["BEHAVIORAL"] = "behavioral";
    InterviewType["SYSTEM_DESIGN"] = "system-design";
    InterviewType["MIXED"] = "mixed";
})(InterviewType || (exports.InterviewType = InterviewType = {}));
var InterviewDifficulty;
(function (InterviewDifficulty) {
    InterviewDifficulty["EASY"] = "easy";
    InterviewDifficulty["MEDIUM"] = "medium";
    InterviewDifficulty["HARD"] = "hard";
})(InterviewDifficulty || (exports.InterviewDifficulty = InterviewDifficulty = {}));
var InterviewStatus;
(function (InterviewStatus) {
    InterviewStatus["IN_PROGRESS"] = "in-progress";
    InterviewStatus["COMPLETED"] = "completed";
    InterviewStatus["ABANDONED"] = "abandoned";
})(InterviewStatus || (exports.InterviewStatus = InterviewStatus = {}));
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
