import { Schema, model, Document, Types } from 'mongoose';
import { ResourceType, TopicDifficulty, TopicContent } from '../types';

export interface ITopic extends Document {
  // _id: Types.ObjectId;
  interviewPrepId: Types.ObjectId;
  title: string;
  category: string; // e.g., 'Technical Skills', 'Behavioral'
  difficulty: TopicDifficulty;
  content: TopicContent;
  mindMap: {
    nodes: any[]; // JSON structure for visualization
    edges: any[];
  };
  masteryLevel: number; // 0-100
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const TopicSchema = new Schema<ITopic>({
  interviewPrepId: { type: Schema.Types.ObjectId, ref: 'InterviewPrep', required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  difficulty: { type: String, enum: Object.values(TopicDifficulty), default: TopicDifficulty.INTERMEDIATE },
  content: {
    summary: { type: String },
    keyPoints: [{ type: String }],
    deepDive: { type: String },
    resources: [{
      type: { type: String, enum: Object.values(ResourceType) },
      url: { type: String },
      title: { type: String }
    }],
  },
  mindMap: {
    nodes: [{ type: Schema.Types.Mixed }], // JSON structure
    edges: [{ type: Schema.Types.Mixed }]
  },
  masteryLevel: { type: Number, default: 0, min: 0, max: 100 },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for faster lookups
TopicSchema.index({ interviewPrepId: 1 });
TopicSchema.index({ title: 'text' });

export default model<ITopic>('Topic', TopicSchema);
