import { Request, Response, NextFunction } from 'express';
import Flashcard from '../models/Flashcard';
import Topic from '../models/Topic';
import InterviewPrep from '../models/InterviewPrep';
import { calculateNextReview } from '../services/spacedRepetitionService';
import { createFlashcardSchema, reviewFlashcardSchema, updateFlashcardSchema } from '../utils/validators';

export const getFlashcardsDueForReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { limit = 10, prepId } = req.query;
    const userId = req.user._id;
    const now = new Date();

    let query: any = {
      userId,
      'reviewSchedule.nextReview': { $lte: now },
    };

    if (prepId) {
      // Ensure prepId is valid and belongs to the user
      const prep = await InterviewPrep.findOne({ _id: prepId, userId });
      if (!prep) {
        return res.status(404).json({ message: 'Interview prep not found or not authorized' });
      }

      // Find all topics associated with this prep
      const topicIds = await Topic.find({ interviewPrepId: prepId }).select('_id');
      query.topicId = { $in: topicIds.map(topic => topic._id) };
    }

    const flashcards = await Flashcard.find(query)
      .limit(Number(limit))
      .sort({ 'reviewSchedule.nextReview': 1 }); // Oldest due first

    res.status(200).json(flashcards);
  } catch (err) {
    next(err);
  }
};

export const getFlashcardsByTopicId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { topicId } = req.params;
    const userId = req.user._id;

    // Ensure topic belongs to a prep that belongs to the user
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    const prep = await InterviewPrep.findOne({ _id: topic.interviewPrepId, userId });
    if (!prep) {
      return res.status(401).json({ message: 'Unauthorized to access this topic' });
    }

    const flashcards = await Flashcard.find({ topicId, userId }).sort({ createdAt: 1 });
    res.status(200).json(flashcards);
  } catch (err) {
    next(err);
  }
};

export const createCustomFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { error, value } = createFlashcardSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { topicId, front, back } = value;
    const userId = req.user._id;

    // Ensure topic belongs to a prep that belongs to the user
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    const prep = await InterviewPrep.findOne({ _id: topic.interviewPrepId, userId });
    if (!prep) {
      return res.status(401).json({ message: 'Unauthorized to add flashcards to this topic' });
    }

    const newFlashcard = await Flashcard.create({
      topicId,
      userId,
      front,
      back,
      difficulty: 'medium', // Default for new cards
      reviewSchedule: {
        nextReview: new Date(), // Due immediately
        interval: 1,
        repetitions: 0,
        easeFactor: 2.5,
      },
      reviewHistory: [],
    });

    // Optionally update InterviewPrep.progress.totalFlashcards here
    prep.progress.totalFlashcards = (prep.progress.totalFlashcards || 0) + 1;
    await prep.save();

    res.status(201).json(newFlashcard);
  } catch (err) {
    next(err);
  }
};

export const updateFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const userId = req.user._id;

    const { error, value } = updateFlashcardSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const flashcard = await Flashcard.findOne({ _id: id, userId });
    if (!flashcard) {
      return res.status(404).json({ message: 'Flashcard not found or not authorized' });
    }

    Object.assign(flashcard, value);
    await flashcard.save();

    res.status(200).json(flashcard);
  } catch (err) {
    next(err);
  }
};


export const reviewFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params; // Flashcard ID
    const userId = req.user._id;

    const { error, value } = reviewFlashcardSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { rating, timeSpent } = value;

    const flashcard = await Flashcard.findOne({ _id: id, userId });
    if (!flashcard) {
      return res.status(404).json({ message: 'Flashcard not found or not authorized' });
    }

    // Update review schedule using SM-2 algorithm
    flashcard.reviewSchedule = calculateNextReview(rating, flashcard.reviewSchedule);

    // Add to review history
    flashcard.reviewHistory.push({
      reviewedAt: new Date(),
      rating,
      timeSpent,
    });

    await flashcard.save();

    // Update interview prep progress
    const topic = await Topic.findById(flashcard.topicId);
    if (topic) {
      const prep = await InterviewPrep.findById(topic.interviewPrepId);
      if (prep) {
        prep.progress.flashcardsReviewed = (prep.progress.flashcardsReviewed || 0) + 1;
        await prep.save();
      }
    }


    res.status(200).json({ message: 'Flashcard reviewed successfully', flashcard });
  } catch (err) {
    next(err);
  }
};

export const deleteFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const userId = req.user._id;

    const flashcard = await Flashcard.findOneAndDelete({ _id: id, userId });

    if (!flashcard) {
      return res.status(404).json({ message: 'Flashcard not found or not authorized' });
    }

    // Optionally update InterviewPrep.progress.totalFlashcards here
    const topic = await Topic.findById(flashcard.topicId);
    if (topic) {
      const prep = await InterviewPrep.findById(topic.interviewPrepId);
      if (prep) {
        prep.progress.totalFlashcards = Math.max(0, (prep.progress.totalFlashcards || 0) - 1);
        await prep.save();
      }
    }

    res.status(200).json({ message: 'Flashcard deleted successfully' });
  } catch (err) {
    next(err);
  }
};
