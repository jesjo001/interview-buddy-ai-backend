import { Request, Response, NextFunction } from 'express';
import InterviewPrep from '../models/InterviewPrep';
import UserProgress from '../models/UserProgress';
import Flashcard from '../models/Flashcard';
import { updateOverallProgress, logUserActivity } from '../services/progressService';
import { logActivitySchema } from '../utils/validators';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { prepId } = req.params;
    const userId = req.user._id;

    const prep = await InterviewPrep.findOne({ _id: prepId, userId })
      .populate({
        path: 'studyPlan.dailySchedule.topics.topicId',
        model: 'Topic',
        select: 'title category difficulty'
      });

    if (!prep) {
      return res.status(404).json({ message: 'Interview prep not found or not authorized' });
    }

    // Ensure progress is up-to-date (can be done periodically or on demand)
    await updateOverallProgress(prep._id);
    const updatedPrep = await InterviewPrep.findById(prep._id);

    // Fetch daily activities for charting
    const dailyActivities = await UserProgress.find({ userId, interviewPrepId: prepId })
      .sort({ date: 1 })
      .limit(30); // Last 30 days

    // Calculate days until interview
    const now = new Date();
    const interviewDate = new Date(updatedPrep!.interviewDate);
    const timeDiff = interviewDate.getTime() - now.getTime();
    const daysUntilInterview = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    // Combine data for dashboard
    res.status(200).json({
      prep: updatedPrep,
      dailyActivities,
      daysUntilInterview: daysUntilInterview > 0 ? daysUntilInterview : 0,
    });
  } catch (err) {
    next(err);
  }
};

export const getUserLevelStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const userId = req.user._id;

    const totalPreps = await InterviewPrep.countDocuments({ userId });
    const completedPreps = await InterviewPrep.countDocuments({ userId, status: 'completed' });

    // Aggregate total time spent across all preps
    const totalTimeResult = await UserProgress.aggregate([
      { $match: { userId } },
      { $unwind: '$activities' },
      {
        $group: {
          _id: null,
          totalDuration: { $sum: '$activities.duration' },
        },
      },
    ]);
    const totalTimeSpent = totalTimeResult.length > 0 ? totalTimeResult[0].totalDuration : 0; // minutes

    // Calculate overall streak (this can be complex, for simplicity, get max streak)
    // A proper streak calculation would require iterating through daily progress
    const maxStreakResult = await UserProgress.aggregate([
      { $match: { userId } },
      { $sort: { date: 1 } },
      // Complex aggregation for streak calculation would go here
      // For now, let's use a simpler approach if available or just return a mock
      { $group: { _id: null, maxStreak: { $max: '$streakCount' } } } // Assuming streakCount is updated elsewhere
    ]);
    const maxStreak = maxStreakResult.length > 0 ? maxStreakResult[0].maxStreak : 0;


    res.status(200).json({
      totalPreps,
      completedPreps,
      totalTimeSpent,
      maxStreak,
      // Add other user-level aggregates as needed
    });
  } catch (err) {
    next(err);
  }
};

export const logActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { error, value } = logActivitySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { prepId, activityType, duration, metadata } = value;

    await logUserActivity(req.user._id, prepId, activityType, duration, metadata);

    res.status(201).json({ message: 'Activity logged successfully' });
  } catch (err) {
    next(err);
  }
};
