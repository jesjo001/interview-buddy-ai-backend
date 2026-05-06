import OpenAI from 'openai';
import { Types } from 'mongoose';
import InterviewPrep from '../models/InterviewPrep';
import UserProgress from '../models/UserProgress';
import MockInterview from '../models/MockInterview';

export type ChatbotPersona = 'coach' | 'recruiter' | 'study-buddy';

export interface ChatbotContextSnapshot {
  prepId: string;
  jobTitle: string;
  company: string;
  daysUntilInterview: number;
  progressPercentage: number;
  topicsCompleted: number;
  totalTopics: number;
  totalStudyMinutesLast14Days: number;
  latestInterviewScore: number | null;
  latestStrengths: string[];
  latestWeaknesses: string[];
}

export interface ReminderSuggestion {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  dueInHours: number;
}

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const getPersonaInstruction = (persona: ChatbotPersona): string => {
  if (persona === 'recruiter') {
    return 'You are a senior recruiter. Be concise, direct, practical, and interview-focused.';
  }

  if (persona === 'study-buddy') {
    return 'You are a friendly study buddy. Keep things encouraging, simple, and motivating.';
  }

  return 'You are an interview coach. Be encouraging, specific, and action-oriented.';
};

export const getContextSnapshot = async (
  userId: Types.ObjectId,
  prepId: string
): Promise<ChatbotContextSnapshot | null> => {
  const prep = await InterviewPrep.findOne({ _id: prepId, userId });
  if (!prep) return null;

  const now = new Date();
  const daysUntilInterview = Math.max(
    0,
    Math.ceil((new Date(prep.interviewDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const progressRows = await UserProgress.find({
    userId,
    interviewPrepId: prep._id,
    date: { $gte: fourteenDaysAgo },
  });

  const totalStudyMinutesLast14Days = progressRows.reduce((sum, row) => {
    return (
      sum +
      row.activities.reduce((activitySum, activity) => {
        return activitySum + (activity.duration || 0);
      }, 0)
    );
  }, 0);

  const latestInterview = await MockInterview.findOne({
    userId,
    prepId: prep._id,
    status: 'completed',
  }).sort({ completedAt: -1, createdAt: -1 });

  return {
    prepId: prep._id.toString(),
    jobTitle: prep.jobDescription?.parsedData?.jobTitle || 'Software Engineer',
    company: prep.jobDescription?.parsedData?.company || 'Target Company',
    daysUntilInterview,
    progressPercentage: prep.progress?.overallPercentage || 0,
    topicsCompleted: prep.progress?.topicsCompleted || 0,
    totalTopics: prep.progress?.totalTopics || 0,
    totalStudyMinutesLast14Days,
    latestInterviewScore: latestInterview?.overallScore ?? null,
    latestStrengths: latestInterview?.summary?.strengths || [],
    latestWeaknesses: latestInterview?.summary?.weaknesses || [],
  };
};

export const buildReminderSuggestions = (
  context: ChatbotContextSnapshot
): ReminderSuggestion[] => {
  const reminders: ReminderSuggestion[] = [];

  if (context.daysUntilInterview <= 3) {
    reminders.push({
      id: 'countdown-focus',
      title: 'Final 72h prep sprint',
      message: 'Prioritize high-yield mock interview practice and behavioral stories today.',
      priority: 'high',
      dueInHours: 4,
    });
  }

  if (context.progressPercentage < 60) {
    reminders.push({
      id: 'progress-catchup',
      title: 'Progress catch-up',
      message: 'Complete one pending core topic and one flashcard session to close gaps.',
      priority: 'high',
      dueInHours: 12,
    });
  }

  if (context.latestInterviewScore !== null && context.latestInterviewScore < 75) {
    reminders.push({
      id: 'mock-interview-repeat',
      title: 'Do one focused mock interview',
      message: 'Run another mock interview focused on your weakest scoring dimension.',
      priority: 'medium',
      dueInHours: 24,
    });
  }

  if (reminders.length === 0) {
    reminders.push({
      id: 'maintenance',
      title: 'Keep momentum',
      message: 'Maintain your pace with a 20-minute review block and one confidence drill.',
      priority: 'low',
      dueInHours: 24,
    });
  }

  return reminders;
};

export const generateChatbotReply = async (params: {
  message: string;
  persona: ChatbotPersona;
  context: ChatbotContextSnapshot | null;
}): Promise<string> => {
  const { message, persona, context } = params;

  if (!openaiClient) {
    const contextHint = context
      ? `You are ${context.daysUntilInterview} day(s) away from your ${context.jobTitle} interview.`
      : 'I can still guide you without prep context.';
    return `${contextHint} Next best step: do one mock answer now, then review your weakest area for 20 minutes.`;
  }

  const contextText = context
    ? `
Prep Context:
- Job Title: ${context.jobTitle}
- Company: ${context.company}
- Days Until Interview: ${context.daysUntilInterview}
- Progress: ${context.progressPercentage}%
- Topics: ${context.topicsCompleted}/${context.totalTopics}
- Study Minutes Last 14 Days: ${context.totalStudyMinutesLast14Days}
- Latest Interview Score: ${context.latestInterviewScore ?? 'N/A'}
- Strengths: ${context.latestStrengths.join(', ') || 'N/A'}
- Weaknesses: ${context.latestWeaknesses.join(', ') || 'N/A'}
`
    : 'Prep Context: not provided.';

  const systemPrompt = `
${getPersonaInstruction(persona)}
You are Interview Copilot for a SaaS interview prep app.
Rules:
- Keep responses practical and concise.
- Offer clear next steps.
- If the user asks an interview question, provide a direct answer plus a better interview-style version.
- If context shows weak progress, suggest a short recovery plan.
`;

  const response = await openaiClient.chat.completions.create({
    model: openaiModel,
    temperature: 0.5,
    max_tokens: 450,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: contextText },
      { role: 'user', content: message },
    ],
  });

  return response.choices?.[0]?.message?.content?.trim() || 'I could not generate a response right now.';
};
