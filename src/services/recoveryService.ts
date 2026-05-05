// services/recoveryService.ts
// On startup, find any InterviewPrep records whose AI analysis was interrupted
// by a crash or restart and re-queue them so they complete.

import InterviewPrep from '../models/InterviewPrep';
import Topic from '../models/Topic';
import Flashcard from '../models/Flashcard';
import User from '../models/User';
import { jobQueueService } from './queueService';
import { AnalysisStatus } from '../types';

/**
 * Scans MongoDB for preps stuck in PENDING or PROCESSING state and re-enqueues
 * their analysis job. Safe to call every restart — preps already COMPLETED are
 * skipped.
 *
 * A prep is considered "stuck" if:
 *   - Its analysisStatus is 'pending' or 'processing'  (set by queueService)
 *   - AND it was created more than 60 seconds ago (grace period avoids
 *     re-queuing a job that was just created in the same process boot)
 */
export const recoverIncompletePreps = async (): Promise<void> => {
  try {
    const gracePeriodMs = 60_000; // 60 s
    const cutoff = new Date(Date.now() - gracePeriodMs);

    const stuckPreps = await InterviewPrep.find({
      analysisStatus: { $in: [AnalysisStatus.PENDING, AnalysisStatus.PROCESSING] },
      createdAt: { $lt: cutoff },
    });

    if (stuckPreps.length === 0) {
      console.log('[Recovery] No incomplete preps found. Nothing to recover.');
      return;
    }

    console.log(`[Recovery] Found ${stuckPreps.length} incomplete prep(s). Re-queuing…`);

    for (const prep of stuckPreps) {
      try {
        const user = await User.findById(prep.userId);
        if (!user) {
          console.warn(`[Recovery] User ${prep.userId} not found for prep ${prep._id} — skipping.`);
          continue;
        }

        // Remove any partial topics / flashcards that may have been written
        // mid-job before the crash so we start clean.
        const existingTopicIds = prep.studyPlan.dailySchedule
          .flatMap((day) => day.topics.map((t) => t.topicId));

        if (existingTopicIds.length > 0) {
          await Flashcard.deleteMany({ topicId: { $in: existingTopicIds } });
          await Topic.deleteMany({ _id: { $in: existingTopicIds } });
        }

        // Reset prep to a clean pre-analysis state
        prep.studyPlan.dailySchedule = [];
        prep.progress.totalTopics = 0;
        prep.progress.topicsCompleted = 0;
        prep.progress.overallPercentage = 0;
        prep.jobDescription.parsedData = undefined;
        prep.analysisStatus = AnalysisStatus.PENDING;
        await prep.save();

        // Re-enqueue with original data stored in the document
        jobQueueService.add(
          'analyze-job-description',
          {
            prepId: prep._id,
            userId: prep.userId,
            jobDescription: {
              rawText: prep.jobDescription.rawText,
              fileUrl: prep.jobDescription.fileUrl,
            },
            interviewDate: prep.interviewDate,
            dailyStudyTime: user.preferences.dailyStudyTime ?? 60,
            learningStyle: user.preferences.learningStyle ?? 'visual',
          },
          3 // maxRetries
        );

        console.log(`[Recovery] Re-queued analysis for prep ${prep._id} (user: ${user.email})`);
      } catch (innerErr: any) {
        console.error(
          `[Recovery] Failed to recover prep ${prep._id}:`,
          innerErr?.message || innerErr
        );
        // Continue with next prep — don't let one failure block others
      }
    }

    console.log('[Recovery] Recovery pass complete.');
  } catch (err: any) {
    // Non-fatal — log and continue server startup
    console.error('[Recovery] Unexpected error during startup recovery:', err?.message || err);
  }
};
