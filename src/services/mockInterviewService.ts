import OpenAI from 'openai';
import { InterviewType, InterviewDifficulty } from '../models/MockInterview';
const logger = { info: console.info, error: console.error, warn: console.warn };

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * Generate mock interview questions based on type, difficulty, and job title
 */
export const generateMockInterviewQuestions = async (
  interviewType: InterviewType,
  difficulty: InterviewDifficulty,
  jobTitle: string,
  skills: string[],
  count: number = 1,
  questionNumber: number = 1
): Promise<string[]> => {
  try {
    const skillsText = skills && skills.length > 0 ? skills.join(', ') : 'general software engineering';
    
    let prompt = '';
    
    if (interviewType === InterviewType.TECHNICAL) {
      prompt = `Generate ${count} technical interview question(s) for the position of ${jobTitle}.
Skills needed: ${skillsText}.
Difficulty level: ${difficulty} (easy = basic concepts, medium = intermediate problem solving, hard = advanced algorithms/system design).
Question number: ${questionNumber} (make it progressively more challenging).

Return ONLY the question(s), no numbering, one per line. Make questions specific and realistic.`;
    } else if (interviewType === InterviewType.BEHAVIORAL) {
      prompt = `Generate ${count} behavioral interview question(s) following the STAR method (Situation, Task, Action, Result) for the position of ${jobTitle}.
Skills/competencies to assess: ${skillsText}.
Difficulty level: ${difficulty}.

Return ONLY the question(s), no numbering, one per line. Format: "Tell me about a time when..." type questions.`;
    } else if (interviewType === InterviewType.SYSTEM_DESIGN) {
      prompt = `Generate ${count} system design interview question(s) for the position of ${jobTitle}.
Skills: ${skillsText}.
Difficulty level: ${difficulty} (easy = basic scaling, medium = moderate complexity, hard = large-scale design).

Return ONLY the question(s), no numbering, one per line. Make questions progressively more complex.`;
    } else {
      prompt = `Generate ${count} mixed interview question(s) for the position of ${jobTitle}.
Mix of technical and behavioral questions.
Skills: ${skillsText}.
Difficulty level: ${difficulty}.

Return ONLY the question(s), no numbering, one per line.`;
    }

    const response = await openaiClient.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';
    const questions = content
      .split('\n')
      .map((q: string) => q.trim())
      .filter((q: string) => q.length > 10);

    logger.info(`Generated ${questions.length} questions for ${interviewType} interview`);
    return questions.slice(0, count);
  } catch (error) {
    logger.error('Error generating interview questions:', error);
    // Fallback questions
    const fallbackQuestions = {
      [InterviewType.TECHNICAL]: [
        'How would you optimize a database query that\'s running slowly on a large dataset?',
        'Explain the difference between synchronous and asynchronous programming.',
        'Design a URL shortening service like Bit.ly. How would you handle scalability?',
      ],
      [InterviewType.BEHAVIORAL]: [
        'Tell me about a time when you had to meet a tight deadline. How did you manage it?',
        'Describe a situation where you had to work with a difficult team member. How did you resolve it?',
        'Give an example of when you took initiative to solve a problem.',
      ],
      [InterviewType.SYSTEM_DESIGN]: [
        'Design Instagram\'s feed system.',
        'How would you design a real-time notification system?',
        'Design a distributed cache system.',
      ],
      [InterviewType.MIXED]: [
        'Tell me about your most challenging project.',
        'How would you design a search engine?',
        'What\'s your approach to debugging complex issues?',
      ],
    };

    return fallbackQuestions[interviewType]?.slice(0, count) || fallbackQuestions[InterviewType.TECHNICAL].slice(0, count);
  }
};

/**
 * Analyze user's response to an interview question
 */
export const analyzeUserResponse = async (
  question: string,
  userResponse: string,
  interviewType: InterviewType,
  difficulty: InterviewDifficulty
): Promise<{
  clarity: number;
  completeness: number;
  technicalAccuracy: number;
  communicationSkill: number;
  relevance: number;
  feedback: string;
  suggestedImprovement: string;
}> => {
  try {
    const prompt = `Analyze this interview response and provide detailed feedback.

Question: ${question}
Response: ${userResponse}

Interview Type: ${interviewType}
Difficulty Level: ${difficulty}

Analyze on these dimensions (0-100):
1. Clarity: Is the response clear and well-structured?
2. Completeness: Does it fully address the question?
3. Technical Accuracy: Is the technical content correct? (N/A if behavioral, rate as 100)
4. Communication Skill: How well is it communicated?
5. Relevance: How well does it address the question?

Respond in JSON format ONLY:
{
  "clarity": <number 0-100>,
  "completeness": <number 0-100>,
  "technicalAccuracy": <number 0-100>,
  "communicationSkill": <number 0-100>,
  "relevance": <number 0-100>,
  "feedback": "<2-3 sentences of constructive feedback>",
  "suggestedImprovement": "<specific actionable improvement>"
}`;

    const response = await openaiClient.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      clarity: Math.min(100, Math.max(0, parsed.clarity || 70)),
      completeness: Math.min(100, Math.max(0, parsed.completeness || 70)),
      technicalAccuracy: Math.min(100, Math.max(0, parsed.technicalAccuracy || 70)),
      communicationSkill: Math.min(100, Math.max(0, parsed.communicationSkill || 70)),
      relevance: Math.min(100, Math.max(0, parsed.relevance || 70)),
      feedback: parsed.feedback || 'Good response.',
      suggestedImprovement: parsed.suggestedImprovement || 'Continue practicing this type of question.',
    };
  } catch (error) {
    logger.error('Error analyzing response:', error);
    // Return default analysis
    return {
      clarity: 75,
      completeness: 75,
      technicalAccuracy: 75,
      communicationSkill: 75,
      relevance: 75,
      feedback: 'Good response. Keep practicing.',
      suggestedImprovement: 'Try to be more concise while covering all key points.',
    };
  }
};

/**
 * Calculate overall interview score from individual question analyses
 */
export const calculateInterviewScore = (questions: any[]): number => {
  if (questions.length === 0) return 0;

  const weights = {
    clarity: 0.15,
    completeness: 0.25,
    technicalAccuracy: 0.25,
    communicationSkill: 0.20,
    relevance: 0.15,
  };

  let totalScore = 0;

  questions.forEach((question) => {
    const analysis = question.aiAnalysis;
    const questionScore =
      analysis.clarity * weights.clarity +
      analysis.completeness * weights.completeness +
      analysis.technicalAccuracy * weights.technicalAccuracy +
      analysis.communicationSkill * weights.communicationSkill +
      analysis.relevance * weights.relevance;

    totalScore += questionScore;
  });

  return Math.round(totalScore / questions.length);
};

/**
 * Calculate readiness score for an interview prep session
 */
export const calculateReadinessScore = async (
  mockInterviewScores: number[],
  flashcardAccuracy: number,
  topicsCompleted: number,
  topicsTotal: number,
  daysRemaining: number,
  hoursInvested: number,
  consistencyStreak: number
): Promise<{
  readinessScore: number;
  confidence: number;
  passLikelihood: number;
  estimatedScore: number;
  recommendation: string;
  focusAreas: string[];
}> => {
  try {
    // Calculate component scores
    const mockInterviewScore = mockInterviewScores.length > 0
      ? mockInterviewScores.reduce((a, b) => a + b, 0) / mockInterviewScores.length
      : 0;

    const topicCompletion = topicsTotal > 0 ? (topicsCompleted / topicsTotal) * 100 : 0;

    // Weighted calculation
    const weights = {
      mockInterview: 0.35,
      flashcard: 0.25,
      topicCompletion: 0.25,
      consistency: 0.15,
    };

    let readinessScore =
      mockInterviewScore * weights.mockInterview +
      flashcardAccuracy * weights.flashcard +
      topicCompletion * weights.topicCompletion +
      Math.min(100, consistencyStreak * 5) * weights.consistency;

    readinessScore = Math.round(Math.min(100, readinessScore));

    // Calculate confidence interval
    const dataPoints = mockInterviewScores.length;
    let confidence = Math.min(95, 40 + dataPoints * 10); // More data = more confidence

    // Pass likelihood prediction
    let passLikelihood = readinessScore;
    if (daysRemaining < 7) passLikelihood -= 15; // Less time = lower likelihood
    if (hoursInvested < 20) passLikelihood -= 10; // Not enough practice

    passLikelihood = Math.max(0, Math.min(100, passLikelihood));

    // Estimated final score
    const estimatedScore = Math.round(readinessScore * 0.85 + (Math.random() * 10)); // Some variance

    // Generate recommendation
    let recommendation = '';
    let focusAreas: string[] = [];

    if (readinessScore >= 80) {
      recommendation = `You're well prepared! Focus on final review and maintaining your momentum. You have ${daysRemaining} days left.`;
    } else if (readinessScore >= 60) {
      recommendation = `Good progress. Dedicate 3-4 hours daily to interview prep over the next ${daysRemaining} days to boost your score.`;
      focusAreas = ['Practice mock interviews', 'Review weak areas'];
    } else {
      recommendation = `You need more preparation time. Aim for 4-5 hours daily. Consider extending your interview date if possible.`;
      focusAreas = ['Complete all topics', 'Take more mock interviews', 'Review fundamentals'];
    }

    if (mockInterviewScores.length < 3) {
      focusAreas.push('Take more mock interviews for better predictions');
    }

    return {
      readinessScore,
      confidence,
      passLikelihood,
      estimatedScore,
      recommendation,
      focusAreas,
    };
  } catch (error) {
    logger.error('Error calculating readiness score:', error);
    throw error;
  }
};
