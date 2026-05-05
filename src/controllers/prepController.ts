import { Request, Response, NextFunction } from 'express';
import InterviewPrep from '../models/InterviewPrep';
import User from '../models/User';
import Topic from '../models/Topic';
import Flashcard from '../models/Flashcard';
import { createInterviewPrepSchema, updateInterviewPrepSchema } from '../utils/validators';
import { analyzeJobDescription, generateStudyPlanTopics, generateTopicContent, generateFlashcards } from '../services/aiService';
import { jobQueueService } from '../services/queueService';
import { calculateDaysBetween, getFutureDate } from '../utils/helpers';
import { IDailyScheduleTopic } from '../models/InterviewPrep';
import { Types } from 'mongoose';
import { PrepStatus, TopicDifficulty } from '../types';
import { extractTextFromDOCX, extractTextFromPDF, upload, uploadToS3 } from '../services/fileService';


// Helper function for study plan generation (can be moved to a service)
const generateStudyPlan = async (
  prepId: Types.ObjectId,
  userId: Types.ObjectId,
  parsedData: any, // JobParsedData
  interviewDate: Date,
  dailyStudyTime: number,
  learningStyle: string // Assuming 'visual', 'auditory', 'kinesthetic'
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  const totalDays = calculateDaysBetween(today, interviewDate);

  if (totalDays <= 0) {
    throw new Error('Interview date must be in the future.');
  }

  // Get topics from AI (or pre-defined)
  const skillTopics = await generateStudyPlanTopics(parsedData, TopicDifficulty.INTERMEDIATE);
  const behavioralTopics = ['Tell me about yourself', 'Why this role/company?', 'Strength/Weakness', 'Conflict resolution'];

  const allTopicsToCover = [...new Set([...skillTopics, ...behavioralTopics])]; // Unique topics

  const dailySchedule: { day: number; date: Date; topics: IDailyScheduleTopic[] }[] = [];
  let topicIndex = 0;
  let currentDay = 0;

  while (topicIndex < allTopicsToCover.length && currentDay < totalDays) {
    const dayDate = getFutureDate(today, currentDay);
    const dayTopics: IDailyScheduleTopic[] = [];
    let estimatedTimeForDay = 0;

    // Distribute topics roughly evenly, respecting daily study time
    while (estimatedTimeForDay < dailyStudyTime && topicIndex < allTopicsToCover.length) {
      const topicTitle = allTopicsToCover[topicIndex];
      const estimatedTopicTime = 30; // Assume 30 min per topic for now

      if (estimatedTimeForDay + estimatedTopicTime <= dailyStudyTime) {
        // Generate content for the topic
        const aiTopicContent = await generateTopicContent(topicTitle, TopicDifficulty.INTERMEDIATE);

        const { mindMap, ...content } = aiTopicContent;
        // Create the topic in DB
        //@ts-ignore
        const newTopic = await (Topic as any).create({
          interviewPrepId: prepId,
          title: topicTitle,
          category: skillTopics.includes(topicTitle) ? 'Technical Skills' : 'Behavioral',
          difficulty: TopicDifficulty.INTERMEDIATE,
          content,
          mindMap,
          masteryLevel: 0,
        });

        // Generate flashcards for the topic
        const aiFlashcards = await generateFlashcards(aiTopicContent.deepDive || aiTopicContent.summary, 5); // Generate 5 flashcards
        await Flashcard.insertMany(aiFlashcards.map(card => ({
          //@ts-ignore
          topicId: newTopic?._id,
          userId: userId,
          front: card.front,
          back: card.back,
          difficulty: 'medium', // Default difficulty
          reviewSchedule: {
            nextReview: today, // Due today
            interval: 1,
            repetitions: 0,
            easeFactor: 2.5,
          },
          reviewHistory: [],
        })));


        dayTopics.push({
          //@ts-ignore
          topicId: newTopic?._id,
          estimatedTime: estimatedTopicTime,
          completed: false,
        });
        estimatedTimeForDay += estimatedTopicTime;
        topicIndex++;
      } else {
        break; // Move to next day if current topic won't fit
      }
    }

    dailySchedule.push({
      day: currentDay + 1,
      date: dayDate,
      topics: dayTopics,
    });
    currentDay++;
  }

  return {
    startDate: today,
    totalDays: totalDays,
    dailySchedule: dailySchedule,
  };
};


export const createInterviewPrep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    // Handle file upload separately or ensure req.body contains text
    let jobDescriptionText = req.body.jobDescription;
    let fileUrl: string | undefined = undefined;

    if (req.file) {
      fileUrl = await uploadToS3(req.file);
      if (req.file.mimetype === 'application/pdf') {
        jobDescriptionText = await extractTextFromPDF(req.file.buffer);
      } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        jobDescriptionText = await extractTextFromDOCX(req.file.buffer);
      }
    }

    const { error, value } = createInterviewPrepSchema.validate({
      jobDescription: jobDescriptionText,
      interviewDate: req.body.interviewDate,
      preferences: req.body.preferences,
    });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { interviewDate, preferences } = value;

    const newPrep = await InterviewPrep.create({
      userId: req.user._id,
      jobDescription: {
        rawText: jobDescriptionText,
        fileUrl: fileUrl,
      },
      interviewDate,
      studyPlan: { // Placeholder, will be generated by AI
        startDate: new Date(),
        totalDays: calculateDaysBetween(new Date(), interviewDate),
        dailySchedule: [],
      },
      progress: {}, // Default empty progress
      status: PrepStatus.ACTIVE,
    });

    // Add job to queue for AI processing
    jobQueueService.add('analyze-job-description', {
      prepId: newPrep._id,
      jobDescription: { rawText: jobDescriptionText, fileUrl: fileUrl },
      interviewDate: interviewDate,
      userId: req.user._id,
      dailyStudyTime: preferences?.dailyStudyTime || req.user.preferences.dailyStudyTime,
      learningStyle: preferences?.learningStyle || req.user.preferences.learningStyle,
    });


    res.status(201).json({
      message: 'Interview prep created. AI analysis and study plan generation started in background.',
      prepId: newPrep._id,
    });
  } catch (err) {
    next(err);
  }
};


export const getInterviewPreps = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const preps = await InterviewPrep.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(preps);
  } catch (err) {
    next(err);
  }
};

export const getInterviewPrepById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const prep = await InterviewPrep.findOne({ _id: id, userId: req.user._id })
      .populate({
        path: 'studyPlan.dailySchedule.topics.topicId',
        model: 'Topic',
        select: 'title category difficulty masteryLevel content.summary' // Populate only necessary fields
      });

    if (!prep) {
      return res.status(404).json({ message: 'Interview prep not found' });
    }
    res.status(200).json(prep);
  } catch (err) {
    next(err);
  }
};

export const updateInterviewPrep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const { error, value } = updateInterviewPrepSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { interviewDate, preferences, status } = value;

    const prep = await InterviewPrep.findOne({ _id: id, userId: req.user._id });
    if (!prep) {
      return res.status(404).json({ message: 'Interview prep not found' });
    }

    if (interviewDate) prep.interviewDate = interviewDate;
    if (status) prep.status = status;
    if (preferences) {
      // Update preferences directly in user model or store in prep if it's prep-specific
      // For now, let's assume prep-specific overrides user preferences
      // Or update user preferences based on this prep if it's the primary prep
      if (preferences.dailyStudyTime) {
        // Potentially update user's default dailyStudyTime
        req.user.preferences.dailyStudyTime = preferences.dailyStudyTime;
        await req.user.save();
      }
      if (preferences.learningStyle) {
        req.user.preferences.learningStyle = preferences.learningStyle;
        await req.user.save();
      }
    }

    await prep.save();
    res.status(200).json({ message: 'Interview prep updated successfully', prep });
  } catch (err) {
    next(err);
  }
};

export const deleteInterviewPrep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const prep = await InterviewPrep.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!prep) {
      return res.status(404).json({ message: 'Interview prep not found' });
    }

    // Cascade delete: Remove associated Topics, Flashcards, and UserProgress
    await Topic.deleteMany({ interviewPrepId: id });
    await Flashcard.deleteMany({ topicId: { $in: prep.studyPlan.dailySchedule.flatMap(day => day.topics.map(t => t.topicId)) } });
    // await UserProgress.deleteMany({ interviewPrepId: id }); // Uncomment when UserProgress is fully implemented

    res.status(200).json({ message: 'Interview prep and associated data deleted successfully' });
  } catch (err) {
    next(err);
  }
};

export const analyzeJobDescriptionManually = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const prep = await InterviewPrep.findOne({ _id: id, userId: req.user._id });

    if (!prep) {
      return res.status(404).json({ message: 'Interview prep not found' });
    }

    // Clear existing topics and flashcards before re-analysis
    await Topic.deleteMany({ interviewPrepId: id });
    // This will require getting all topicIds linked to this prep first before deleting flashcards
    // For now, simplify and assume flashcards are deleted with topics
    const topicIdsToDelete = prep.studyPlan.dailySchedule.flatMap(day => day.topics.map(t => t.topicId));
    await Flashcard.deleteMany({ topicId: { $in: topicIdsToDelete } });

    // Trigger AI analysis and study plan generation again
    jobQueueService.add('analyze-job-description', {
      prepId: prep._id,
      jobDescription: { rawText: prep.jobDescription.rawText, fileUrl: prep.jobDescription.fileUrl },
      interviewDate: prep.interviewDate,
      userId: req.user._id,
      dailyStudyTime: req.user.preferences.dailyStudyTime,
      learningStyle: req.user.preferences.learningStyle,
    });

    res.status(202).json({ message: 'Re-analysis of job description started in background.' });
  } catch (err) {
    next(err);
  }
};

export const adjustStudyPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const { newInterviewDate } = req.body; // Expecting a new interview date

    const prep = await InterviewPrep.findOne({ _id: id, userId: req.user._id });
    if (!prep) {
      return res.status(404).json({ message: 'Interview prep not found' });
    }

    if (!newInterviewDate) {
      return res.status(400).json({ message: 'newInterviewDate is required' });
    }

    // Update the interview date
    prep.interviewDate = new Date(newInterviewDate);

    if (!prep.jobDescription.parsedData) {
      return res.status(400).json({ message: 'Job description has not been analyzed yet. Cannot adjust study plan.' });
    }

    // Trigger study plan regeneration in background
    jobQueueService.add('adjust-study-plan', {
      prepId: prep._id,
      jobDescription: prep.jobDescription.parsedData, // Use parsed data
      interviewDate: prep.interviewDate,
      userId: req.user._id,
      dailyStudyTime: req.user.preferences.dailyStudyTime,
      learningStyle: req.user.preferences.learningStyle,
    });

    await prep.save();
    res.status(202).json({ message: 'Study plan adjustment started in background.' });
  } catch (err) {
    next(err);
  }
};
