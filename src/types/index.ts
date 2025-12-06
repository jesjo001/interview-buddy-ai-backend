// types/index.ts

export enum SubscriptionPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  EXPIRED = 'expired'
}

export enum LearningStyle {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  KINESTHETIC = 'kinesthetic'
}

export enum ActivityType {
  FLASHCARD_REVIEW = 'flashcard_review',
  TOPIC_COMPLETE = 'topic_complete',
  VOICE_SESSION = 'voice_session',
  MOCK_INTERVIEW = 'mock_interview'
}

export enum TopicDifficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export enum ResourceType {
  ARTICLE = 'article',
  VIDEO = 'video',
  DOCUMENTATION = 'documentation'
}

export enum FlashcardRating {
  AGAIN = 'again',
  HARD = 'hard',
  GOOD = 'good',
  EASY = 'easy'
}

export enum PrepStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

// AI Service related types
export interface JobParsedData {
  jobTitle?: string;
  company?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  qualifications: string[];
}

export interface TopicContent {
  summary: string;
  keyPoints: string[];
  deepDive: string;
  resources: Array<{ type: ResourceType; url: string; title: string }>;
  mindMap: { nodes: any[]; edges: any[] };
}

export interface Flashcard {
  front: string;
  back: string;
}
