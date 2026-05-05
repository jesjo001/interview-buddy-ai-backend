"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateNextReview = calculateNextReview;
// services/spacedRepetitionService.ts
const types_1 = require("../types");
/**
 * Calculates the next review date and schedule parameters using the SM-2 algorithm.
 *
 * @param rating The user's rating of the flashcard (again, hard, good, easy).
 * @param currentSchedule The current review schedule for the flashcard.
 * @returns The updated review schedule.
 */
function calculateNextReview(rating, currentSchedule) {
    let { interval, repetitions, easeFactor } = currentSchedule;
    const qualityMap = {
        [types_1.FlashcardRating.AGAIN]: 0, // Treated as incorrect/forgotten
        [types_1.FlashcardRating.HARD]: 3,
        [types_1.FlashcardRating.GOOD]: 4,
        [types_1.FlashcardRating.EASY]: 5,
    };
    const quality = qualityMap[rating];
    if (quality < 3) {
        // If answer was incorrect (quality < 3), reset repetitions and interval
        repetitions = 0;
        interval = 1;
    }
    else {
        // If answer was correct (quality >= 3)
        if (repetitions === 0) {
            interval = 1;
        }
        else if (repetitions === 1) {
            interval = 6;
        }
        else {
            interval = Math.round(interval * easeFactor);
        }
        repetitions++;
        // Update ease factor (EF)
        // EF = EF + (0.1 - (5 - Q) * (0.08 + (5 - Q) * 0.02))
        easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        easeFactor = Math.max(1.3, easeFactor); // EF should not be less than 1.3
    }
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    return { nextReview, interval, repetitions, easeFactor };
}
