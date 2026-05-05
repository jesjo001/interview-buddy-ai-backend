import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import MockInterview, { IMockInterview, InterviewStatus, InterviewType, InterviewDifficulty } from '../models/MockInterview';
import BehavioralFeedback from '../models/BehavioralFeedback';
import InterviewPrep from '../models/InterviewPrep';
import UserReadinessTimeline from '../models/UserReadinessTimeline';
import { generateMockInterviewQuestions, analyzeUserResponse, calculateInterviewScore } from '../services/mockInterviewService';

const logger = { info: console.info, error: console.error, warn: console.warn };

/**
 * Start a new mock interview session
 * POST /api/mock-interviews/start
 */
export const startMockInterview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { prepId, interviewType = InterviewType.TECHNICAL, difficulty = InterviewDifficulty.MEDIUM, duration = 45 } = req.body;

    // Validate prepId
    if (!prepId || !Types.ObjectId.isValid(prepId)) {
      return res.status(400).json({ error: 'Invalid prep ID' });
    }

    // Verify the prep belongs to the user
    const prep = await InterviewPrep.findOne({ _id: prepId, userId: req.user._id });
    if (!prep) {
      return res.status(404).json({ error: 'Preparation session not found' });
    }

    // Create new mock interview
    const mockInterview = await MockInterview.create({
      userId: req.user._id,
      prepId: prepId,
      interviewType,
      difficulty,
      duration,
      status: InterviewStatus.IN_PROGRESS,
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
    
    const firstQuestion = await generateMockInterviewQuestions(
      interviewType,
      difficulty,
      jobTitle,
      requiredSkills,
      1
    );

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
  } catch (error) {
    logger.error('Error starting mock interview:', error);
    next(error);
  }
};

/**
 * Submit a question response
 * POST /api/mock-interviews/:id/respond
 */
export const submitResponse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const { questionId, question, userResponse, responseDuration, transcript, audioUrl, videoUrl } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid interview ID' });
    }

    // Find interview
    const mockInterview = await MockInterview.findOne({ _id: id, userId: req.user._id });
    if (!mockInterview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    if (mockInterview.status !== InterviewStatus.IN_PROGRESS) {
      return res.status(400).json({ error: 'Interview is not in progress' });
    }

    // Analyze the response with AI
    const aiAnalysis = await analyzeUserResponse(
      question,
      userResponse,
      mockInterview.interviewType,
      mockInterview.difficulty
    );

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

    mockInterview.questions.push(responseRecord as any);
    mockInterview.fullTranscript += `\n\nQ: ${question}\nA: ${transcript || userResponse}`;

    // Update completion percentage
    mockInterview.completionPercentage = Math.round((mockInterview.questions.length / 5) * 100); // Assume 5 questions per interview

    // Update average response time
    const totalTime = mockInterview.questions.reduce((sum, q) => sum + q.responseDuration, 0);
    mockInterview.averageResponseTime = Math.round(totalTime / mockInterview.questions.length);

    await mockInterview.save();

    // Generate next question
    const nextQuestions = await generateMockInterviewQuestions(
      mockInterview.interviewType,
      mockInterview.difficulty,
      '', // jobTitle not needed for next question - could be fetched from prep
      [],
      1,
      mockInterview.questions.length // To avoid duplicates
    );

    logger.info(`Response submitted for interview ${id}`);

    return res.status(200).json({
      success: true,
      analysis: aiAnalysis,
      nextQuestion: nextQuestions && nextQuestions.length > 0 ? nextQuestions[0] : null,
      completionPercentage: mockInterview.completionPercentage,
    });
  } catch (error) {
    logger.error('Error submitting response:', error);
    next(error);
  }
};

/**
 * End interview and calculate final score
 * PUT /api/mock-interviews/:id/end
 */
export const endInterview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const { videoRecordingUrl } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid interview ID' });
    }

    const mockInterview = await MockInterview.findOne({ _id: id, userId: req.user._id });
    if (!mockInterview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Calculate overall score
    const overallScore = calculateInterviewScore(mockInterview.questions);
    
    mockInterview.status = InterviewStatus.COMPLETED;
    mockInterview.completedAt = new Date();
    mockInterview.overallScore = overallScore;
    mockInterview.videoRecordingUrl = videoRecordingUrl;
    
    // Generate summary
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

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
      await BehavioralFeedback.create({
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
  } catch (error) {
    logger.error('Error ending interview:', error);
    next(error);
  }
};

/**
 * Get interview details and full analysis
 * GET /api/mock-interviews/:id
 */
export const getInterview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid interview ID' });
    }

    const mockInterview = await MockInterview.findOne({ _id: id, userId: req.user._id });
    if (!mockInterview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const behavioralFeedback = await BehavioralFeedback.findOne({ mockInterviewId: id });

    return res.status(200).json({
      success: true,
      interview: mockInterview,
      behavioralFeedback: behavioralFeedback || null,
    });
  } catch (error) {
    logger.error('Error getting interview:', error);
    next(error);
  }
};

/**
 * Get user's interview history with pagination
 * GET /api/mock-interviews
 */
export const getInterviewHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { page = 1, limit = 10, prepId, status } = req.query;

    const query: any = { userId: req.user._id };
    
    if (prepId && Types.ObjectId.isValid(prepId as string)) {
      query.prepId = prepId;
    }
    
    if (status && Object.values(InterviewStatus).includes(status as InterviewStatus)) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const interviews = await MockInterview.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('_id interviewType difficulty overallScore createdAt completedAt duration');

    const total = await MockInterview.countDocuments(query);

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
  } catch (error) {
    logger.error('Error fetching interview history:', error);
    next(error);
  }
};

/**
 * Delete/Archive an interview
 * DELETE /api/mock-interviews/:id
 */
export const deleteInterview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid interview ID' });
    }

    const result = await MockInterview.findOneAndDelete({ _id: id, userId: req.user._id });
    
    if (!result) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Also delete associated behavioral feedback
    await BehavioralFeedback.deleteOne({ mockInterviewId: id });

    logger.info(`Interview ${id} deleted`);

    return res.status(200).json({
      success: true,
      message: 'Interview deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting interview:', error);
    next(error);
  }
};

/**
 * Get readiness score and predictions
 * GET /api/mock-interviews/:prepId/readiness
 */
export const getReadinessScore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { prepId } = req.params;

    if (!Types.ObjectId.isValid(prepId)) {
      return res.status(400).json({ error: 'Invalid prep ID' });
    }

    // Get latest readiness timeline entry
    const latest = await UserReadinessTimeline.findOne({ userId: req.user._id, prepId })
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
  } catch (error) {
    logger.error('Error getting readiness score:', error);
    next(error);
  }
};
