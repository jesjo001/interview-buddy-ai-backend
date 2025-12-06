import InterviewPrep from '../models/InterviewPrep';
import UserProgress from '../models/UserProgress';
import Flashcard from '../models/Flashcard';
import Topic from '../models/Topic';
import { Types } from 'mongoose';

/**
 * Calculates and updates the overall progress for a given InterviewPrep.
 * This function should be called after any activity (topic completion, flashcard review, etc.)
 * or on a scheduled basis.
 *
 * @param prepId The ID of the InterviewPrep document.
 * @returns The updated progress object for the InterviewPrep.
 */
export const updateOverallProgress = async (prepId: Types.ObjectId) => {
  const prep = await InterviewPrep.findById(prepId);

  if (!prep) {
    console.warn(`Attempted to update progress for non-existent prepId: ${prepId}`);
    return null;
  }

  // 1. Topics Progress
  const allScheduledTopics = prep.studyPlan.dailySchedule.flatMap(day => day.topics);
  const totalTopics = allScheduledTopics.length;
  const completedTopics = allScheduledTopics.filter(t => t.completed).length;

  // 2. Flashcards Progress (assuming all flashcards for all topics in this prep)
  // This can be optimized to only count flashcards directly related to the prep's topics
  const topicIds = prep.studyPlan.dailySchedule.flatMap(day => day.topics.map(t => t.topicId));
  const flashcards = await Flashcard.find({ topicId: { $in: topicIds }, userId: prep.userId });
  const totalFlashcards = flashcards.length;
  const reviewedFlashcards = flashcards.filter(card => card.reviewHistory && card.reviewHistory.length > 0).length;


  // 3. Time Spent
  const userActivities = await UserProgress.find({
    userId: prep.userId,
    interviewPrepId: prepId,
  });
  const timeSpent = userActivities.reduce((sum, day) =>
    sum + day.activities.reduce((s, a) => s + (a.duration || 0), 0), 0
  );

  // Calculate overall percentage (can be weighted)
  // For simplicity, let's say 50% topics, 30% flashcards, 20% time spent (example weights)
  let overallPercentage = 0;
  if (totalTopics > 0) {
    overallPercentage += (completedTopics / totalTopics) * 50;
  }
  if (totalFlashcards > 0) {
    overallPercentage += (reviewedFlashcards / totalFlashcards) * 30;
  }
  // No simple way to gauge progress from time spent directly, so let's
  // simplify for now or use timeSpent as a separate metric.
  // Or, a more complex approach: if timeSpent > X hours, add Y% to overall.

  // For now, simplify overall percentage to just topics and flashcards
  const totalProgressPoints = (totalTopics > 0 ? 50 : 0) + (totalFlashcards > 0 ? 50 : 0);
  if (totalProgressPoints > 0) {
    overallPercentage = (
      (completedTopics / (totalTopics || 1)) * (totalTopics > 0 ? 50 : 0) +
      (reviewedFlashcards / (totalFlashcards || 1)) * (totalFlashcards > 0 ? 50 : 0)
    ) / (totalProgressPoints / 100);
  } else {
    overallPercentage = 0; // No content, no progress
  }
  overallPercentage = Math.round(Math.min(100, overallPercentage));


  prep.progress = {
    overallPercentage: overallPercentage,
    topicsCompleted: completedTopics,
    totalTopics: totalTopics,
    flashcardsReviewed: reviewedFlashcards,
    totalFlashcards: totalFlashcards,
    timeSpent: timeSpent,
  };

  await prep.save();
  return prep.progress;
};

/**
 * Logs an activity for a user on a specific interview prep.
 * @param userId User's ID
 * @param interviewPrepId InterviewPrep ID
 * @param activityType Type of activity (e.g., 'flashcard_review')
 * @param duration Duration in minutes
 * @param metadata Additional data for the activity
 */
export const logUserActivity = async (
  userId: Types.ObjectId,
  interviewPrepId: Types.ObjectId,
  activityType: string,
  duration?: number,
  metadata?: any
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let userProgress = await UserProgress.findOneAndUpdate(
    { userId, interviewPrepId, date: today },
    {
      $push: {
        activities: {
          type: activityType,
          timestamp: new Date(),
          duration,
          metadata,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // You might want to recalculate daily goal met or streak here
  // For now, these are placeholders
  console.log(`Activity logged for user ${userId} on prep ${interviewPrepId}: ${activityType}`);

  // After logging activity, update overall progress for the prep
  await updateOverallProgress(interviewPrepId);

  return userProgress;
};
