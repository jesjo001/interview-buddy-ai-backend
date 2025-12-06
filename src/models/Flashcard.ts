import { Schema, model, Document, Types } from 'mongoose';
import { FlashcardRating } from '../types';

export interface IReviewHistory {
  reviewedAt: Date;
  rating: FlashcardRating;
  timeSpent?: number; // seconds
}

export interface IFlashcard extends Document {
  topicId: Types.ObjectId;
  userId: Types.ObjectId;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  reviewSchedule: {
    nextReview: Date;
    interval: number; // days
    repetitions: number;
    easeFactor: number; // SM-2 algorithm
  };
  reviewHistory: IReviewHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const FlashcardSchema = new Schema<IFlashcard>({
  topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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
      rating: { type: String, enum: Object.values(FlashcardRating) },
      timeSpent: { type: Number }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes to quickly fetch due flashcards and by user
FlashcardSchema.index({ userId: 1, 'reviewSchedule.nextReview': 1 });
FlashcardSchema.index({ topicId: 1 });

export default model<IFlashcard>('Flashcard', FlashcardSchema);
