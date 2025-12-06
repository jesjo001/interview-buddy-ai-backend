import { Request, Response, NextFunction } from 'express';
import { synthesizeSpeech } from '../services/ttsService';
import UserProgress from '../models/UserProgress';
import { ActivityType } from '../types';
import { logActivitySchema } from '../utils/validators';

export const synthesizeContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { text, voiceSettings } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text content is required for synthesis' });
    }

    const audioContent = await synthesizeSpeech(text, voiceSettings);

    res.status(200).json({ audioContent });
  } catch (err) {
    next(err);
  }
};

export const logVoiceStudySession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { error, value } = logActivitySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { prepId, duration, topicsListened } = value; // topicsListened can be part of metadata

    await UserProgress.create({
      userId: req.user._id,
      interviewPrepId: prepId,
      date: new Date(),
      activities: [{
        type: ActivityType.VOICE_SESSION,
        duration: duration,
        metadata: { topicsListened: topicsListened }
      }],
      dailyGoalMet: false, // Will be calculated by a separate service or cron
      streakCount: 0,     // Will be calculated by a separate service or cron
    });

    res.status(200).json({ message: 'Voice study session logged successfully' });
  } catch (err) {
    next(err);
  }
};
