"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReadinessScore = exports.deleteInterview = exports.getInterviewHistory = exports.getInterview = exports.endInterview = exports.submitResponse = exports.startMockInterview = void 0;
const mongoose_1 = require("mongoose");
const MockInterview_1 = __importStar(require("../models/MockInterview"));
const BehavioralFeedback_1 = __importDefault(require("../models/BehavioralFeedback"));
const InterviewPrep_1 = __importDefault(require("../models/InterviewPrep"));
const UserReadinessTimeline_1 = __importDefault(require("../models/UserReadinessTimeline"));
const mockInterviewService_1 = require("../services/mockInterviewService");
const logger = { info: console.info, error: console.error, warn: console.warn };
/**
 * Start a new mock interview session
 * POST /api/mock-interviews/start
 */
const startMockInterview = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { prepId, interviewType = MockInterview_1.InterviewType.TECHNICAL, difficulty = MockInterview_1.InterviewDifficulty.MEDIUM, duration = 45 } = req.body;
        // Validate prepId
        if (!prepId || !mongoose_1.Types.ObjectId.isValid(prepId)) {
            return res.status(400).json({ error: 'Invalid prep ID' });
        }
        // Verify the prep belongs to the user
        const prep = await InterviewPrep_1.default.findOne({ _id: prepId, userId: req.user._id });
        if (!prep) {
            return res.status(404).json({ error: 'Preparation session not found' });
        }
        // Create new mock interview
        const mockInterview = await MockInterview_1.default.create({
            userId: req.user._id,
            prepId: prepId,
            interviewType,
            difficulty,
            duration,
            status: MockInterview_1.InterviewStatus.IN_PROGRESS,
            startedAt: new Date(),
            questions: [],
            fullTranscript: '',
            overallScore: 0,
            completionPercentage: 0,
            averageResponseTime: 0,
            summary: {
                strengths: [],
                weaknesses: [],
                recommendations: []
            }
        });
        // Generate first question
        const jobTitle = prep.jobDescription?.parsedData?.jobTitle || 'Software Engineer';
        const requiredSkills = prep.jobDescription?.parsedData?.requiredSkills || [];
        const firstQuestion = await (0, mockInterviewService_1.generateMockInterviewQuestions)(interviewType, difficulty, jobTitle, requiredSkills, 1);
        if (!firstQuestion || firstQuestion.length === 0) {
            throw new Error('Failed to generate interview question');
        }
        logger.info(`Mock interview started: ${mockInterview._id}`);
        return res.status(200).json({
            success: true,
            interviewId: mockInterview._id,
            sessionId: mockInterview._id, // Same as interviewId for this implementation
            firstQuestion: firstQuestion[0],
            duration: mockInterview.duration,
        });
    }
    catch (error) {
        logger.error('Error starting mock interview:', error);
        next(error);
    }
};
exports.startMockInterview = startMockInterview;
/**
 * Submit a question response
 * POST /api/mock-interviews/:id/respond
 */
const submitResponse = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        const { questionId, question, userResponse, responseDuration, transcript, audioUrl, videoUrl } = req.body;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid interview ID' });
        }
        // Find interview
        const mockInterview = await MockInterview_1.default.findOne({ _id: id, userId: req.user._id });
        if (!mockInterview) {
            return res.status(404).json({ error: 'Interview not found' });
        }
        if (mockInterview.status !== MockInterview_1.InterviewStatus.IN_PROGRESS) {
            return res.status(400).json({ error: 'Interview is not in progress' });
        }
        // Analyze the response with AI
        const aiAnalysis = await (0, mockInterviewService_1.analyzeUserResponse)(question, userResponse, mockInterview.interviewType, mockInterview.difficulty);
        // Add response to questions array
        const responseRecord = {
            questionId: questionId || `q_${mockInterview.questions.length + 1}`,
            question,
            askedAt: new Date(),
            userResponse,
            responseAudioUrl: audioUrl,
            responseVideoUrl: videoUrl,
            responseDuration,
            transcript: transcript || userResponse,
            aiAnalysis,
            timestamp: new Date(),
        };
        mockInterview.questions.push(responseRecord);
        mockInterview.fullTranscript += `\n\nQ: ${question}\nA: ${transcript || userResponse}`;
        // Update completion percentage
        mockInterview.completionPercentage = Math.round((mockInterview.questions.length / 5) * 100); // Assume 5 questions per interview
        // Update average response time
        const totalTime = mockInterview.questions.reduce((sum, q) => sum + q.responseDuration, 0);
        mockInterview.averageResponseTime = Math.round(totalTime / mockInterview.questions.length);
        await mockInterview.save();
        // Generate next question
        const nextQuestions = await (0, mockInterviewService_1.generateMockInterviewQuestions)(mockInterview.interviewType, mockInterview.difficulty, '', // jobTitle not needed for next question - could be fetched from prep
        [], 1, mockInterview.questions.length // To avoid duplicates
        );
        logger.info(`Response submitted for interview ${id}`);
        return res.status(200).json({
            success: true,
            analysis: aiAnalysis,
            nextQuestion: nextQuestions && nextQuestions.length > 0 ? nextQuestions[0] : null,
            completionPercentage: mockInterview.completionPercentage,
        });
    }
    catch (error) {
        logger.error('Error submitting response:', error);
        next(error);
    }
};
exports.submitResponse = submitResponse;
/**
 * End interview and calculate final score
 * PUT /api/mock-interviews/:id/end
 */
const endInterview = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        const { videoRecordingUrl } = req.body;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid interview ID' });
        }
        const mockInterview = await MockInterview_1.default.findOne({ _id: id, userId: req.user._id });
        if (!mockInterview) {
            return res.status(404).json({ error: 'Interview not found' });
        }
        // Calculate overall score
        const overallScore = (0, mockInterviewService_1.calculateInterviewScore)(mockInterview.questions);
        mockInterview.status = MockInterview_1.InterviewStatus.COMPLETED;
        mockInterview.completedAt = new Date();
        mockInterview.overallScore = overallScore;
        mockInterview.videoRecordingUrl = videoRecordingUrl;
        // Generate summary
        const strengths = [];
        const weaknesses = [];
        const recommendations = [];
        mockInterview.questions.forEach((q) => {
            if (q.aiAnalysis.communicationSkill > 80) {
                strengths.push(`Good communication in: "${q.question.substring(0, 50)}..."`);
            }
            if (q.aiAnalysis.clarity < 60) {
                weaknesses.push(`Could be clearer in: "${q.question.substring(0, 50)}..."`);
            }
            if (q.aiAnalysis.suggestedImprovement) {
                recommendations.push(q.aiAnalysis.suggestedImprovement);
            }
        });
        mockInterview.summary = {
            strengths: [...new Set(strengths)].slice(0, 3),
            weaknesses: [...new Set(weaknesses)].slice(0, 3),
            recommendations: [...new Set(recommendations)].slice(0, 3),
        };
        await mockInterview.save();
        // Create behavioral feedback if video was recorded
        if (videoRecordingUrl) {
            // In a real implementation, we'd process the video for behavioral analysis
            // For now, we'll create a placeholder behavioral feedback
            await BehavioralFeedback_1.default.create({
                userId: req.user._id,
                mockInterviewId: mockInterview._id,
                videoMetrics: {
                    eyeContactScore: 75,
                    fillerWordsCount: 0,
                    averagePauseDuration: 0,
                    speakingPace: 140,
                    confidenceScore: 78,
                    emotionTimeline: [],
                },
                starAnalysis: {
                    situation: { score: 75, feedback: 'Good context setting' },
                    task: { score: 80, feedback: 'Clear task understanding' },
                    action: { score: 78, feedback: 'Well-explained approach' },
                    result: { score: 75, feedback: 'Good results articulation' },
                    overallSTARScore: 77,
                },
                recommendations: [],
                overallCommunicationScore: 77,
                overallBehavioralScore: 77,
                keyStrengths: mockInterview.summary.strengths,
                areasForImprovement: mockInterview.summary.weaknesses,
            });
        }
        logger.info(`Interview ${id} completed with score ${overallScore}`);
        return res.status(200).json({
            success: true,
            interviewId: mockInterview._id,
            score: overallScore,
            summary: mockInterview.summary,
            transcript: mockInterview.fullTranscript,
            analysis: mockInterview.questions.map(q => q.aiAnalysis),
        });
    }
    catch (error) {
        logger.error('Error ending interview:', error);
        next(error);
    }
};
exports.endInterview = endInterview;
/**
 * Get interview details and full analysis
 * GET /api/mock-interviews/:id
 */
const getInterview = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid interview ID' });
        }
        const mockInterview = await MockInterview_1.default.findOne({ _id: id, userId: req.user._id });
        if (!mockInterview) {
            return res.status(404).json({ error: 'Interview not found' });
        }
        const behavioralFeedback = await BehavioralFeedback_1.default.findOne({ mockInterviewId: id });
        return res.status(200).json({
            success: true,
            interview: mockInterview,
            behavioralFeedback: behavioralFeedback || null,
        });
    }
    catch (error) {
        logger.error('Error getting interview:', error);
        next(error);
    }
};
exports.getInterview = getInterview;
/**
 * Get user's interview history with pagination
 * GET /api/mock-interviews
 */
const getInterviewHistory = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { page = 1, limit = 10, prepId, status } = req.query;
        const query = { userId: req.user._id };
        if (prepId && mongoose_1.Types.ObjectId.isValid(prepId)) {
            query.prepId = prepId;
        }
        if (status && Object.values(MockInterview_1.InterviewStatus).includes(status)) {
            query.status = status;
        }
        const skip = (Number(page) - 1) * Number(limit);
        const interviews = await MockInterview_1.default.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .select('_id interviewType difficulty overallScore createdAt completedAt duration');
        const total = await MockInterview_1.default.countDocuments(query);
        return res.status(200).json({
            success: true,
            data: interviews,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        logger.error('Error fetching interview history:', error);
        next(error);
    }
};
exports.getInterviewHistory = getInterviewHistory;
/**
 * Delete/Archive an interview
 * DELETE /api/mock-interviews/:id
 */
const deleteInterview = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid interview ID' });
        }
        const result = await MockInterview_1.default.findOneAndDelete({ _id: id, userId: req.user._id });
        if (!result) {
            return res.status(404).json({ error: 'Interview not found' });
        }
        // Also delete associated behavioral feedback
        await BehavioralFeedback_1.default.deleteOne({ mockInterviewId: id });
        logger.info(`Interview ${id} deleted`);
        return res.status(200).json({
            success: true,
            message: 'Interview deleted successfully',
        });
    }
    catch (error) {
        logger.error('Error deleting interview:', error);
        next(error);
    }
};
exports.deleteInterview = deleteInterview;
/**
 * Get readiness score and predictions
 * GET /api/mock-interviews/:prepId/readiness
 */
const getReadinessScore = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthorized' });
        const { prepId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(prepId)) {
            return res.status(400).json({ error: 'Invalid prep ID' });
        }
        // Get latest readiness timeline entry
        const latest = await UserReadinessTimeline_1.default.findOne({ userId: req.user._id, prepId })
            .sort({ snapshot_date: -1 });
        if (!latest) {
            return res.status(404).json({ error: 'No readiness data available' });
        }
        return res.status(200).json({
            success: true,
            readinessScore: latest.readinessScore,
            confidence: latest.confidence,
            recommendation: latest.recommendation,
            focusAreas: latest.focusAreas,
            predictedOutcome: latest.predictedOutcome,
            metrics: latest.metrics,
        });
    }
    catch (error) {
        logger.error('Error getting readiness score:', error);
        next(error);
    }
};
exports.getReadinessScore = getReadinessScore;
