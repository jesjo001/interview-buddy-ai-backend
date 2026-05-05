import { Request, Response, NextFunction } from 'express';
import Topic from '../models/Topic';
import InterviewPrep from '../models/InterviewPrep';
import Flashcard from '../models/Flashcard';
import { updateTopicMasterySchema } from '../utils/validators';
import { Types } from 'mongoose';

export const getTopicsByPrepId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { prepId } = req.params;

    // Ensure the prep belongs to the user
    const prep = await InterviewPrep.findOne({ _id: prepId, userId: req.user._id });
    if (!prep) {
      return res.status(404).json({ message: 'Interview prep not found or not authorized' });
    }

    const topics = await Topic.find({ interviewPrepId: prepId }).sort({ createdAt: 1 });
    res.status(200).json(topics);
  } catch (err) {
    next(err);
  }
};

export const getTopicById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const topic = await Topic.findById(id);

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    // Ensure the topic belongs to a prep that belongs to the user
    const prep = await InterviewPrep.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
    if (!prep) {
      return res.status(401).json({ message: 'Unauthorized to access this topic' });
    }

    res.status(200).json(topic);
  } catch (err) {
    next(err);
  }
};

export const markTopicAsComplete = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params; // topic ID

    const topic = await Topic.findById(id);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const prep = await InterviewPrep.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
    if (!prep) {
      return res.status(401).json({ message: 'Unauthorized to modify this topic' });
    }

    // Find the topic in the prep's daily schedule and mark it as completed
    let topicFoundAndUpdated = false;
    for (const day of prep.studyPlan.dailySchedule) {
      const scheduleTopic = day.topics.find(t => t.topicId.equals(id));
      if (scheduleTopic) {
        if (!scheduleTopic.completed) {
          scheduleTopic.completed = true;
          scheduleTopic.completedAt = new Date();
          topicFoundAndUpdated = true;
          break;
        } else {
          // Already completed, no change needed
          return res.status(200).json({ message: 'Topic already marked as complete', topic });
        }
      }
    }

    if (!topicFoundAndUpdated) {
      return res.status(400).json({ message: 'Topic not found in study plan schedule' });
    }

    // Update prep's progress
    prep.progress.topicsCompleted = (prep.progress.topicsCompleted || 0) + 1;
    prep.progress.overallPercentage = Math.round(
      (prep.progress.topicsCompleted / prep.progress.totalTopics) * 100
    );

    await prep.save();
    // await topic.save(); // No need to save topic itself, only prep.

    res.status(200).json({ message: 'Topic marked as complete and prep progress updated', prepProgress: prep.progress });
  } catch (err) {
    next(err);
  }
};

export const updateTopicMasteryLevel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params; // topic ID
    const { error, value } = updateTopicMasterySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { masteryLevel } = value;

    const topic = await Topic.findById(id);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    // Ensure the topic belongs to a prep that belongs to the user
    const prep = await InterviewPrep.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
    if (!prep) {
      return res.status(401).json({ message: 'Unauthorized to modify this topic' });
    }

    topic.masteryLevel = masteryLevel;
    await topic.save();

    res.status(200).json({ message: 'Topic mastery level updated', topic });
  } catch (err) {
    next(err);
  }
};

export const updateTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const { notes } = req.body;

    const topic = await Topic.findById(id);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const prep = await InterviewPrep.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
    if (!prep) {
      return res.status(401).json({ message: 'Unauthorized to modify this topic' });
    }

    if (notes !== undefined) {
      topic.notes = notes;
    }

    await topic.save();
    res.status(200).json({ message: 'Topic updated successfully', topic });
  } catch (err) {
    next(err);
  }
}

