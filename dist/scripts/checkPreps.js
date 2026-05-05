"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = __importDefault(require("../config/database"));
const InterviewPrep_1 = __importDefault(require("../models/InterviewPrep"));
dotenv_1.default.config();
(async () => {
    try {
        await (0, database_1.default)();
        const preps = await InterviewPrep_1.default.find({}).lean();
        console.log(`Found ${preps.length} InterviewPrep documents`);
        preps.forEach((p) => {
            console.log('--- Prep ID:', p._id);
            console.log('UserId:', p.userId?.toString());
            console.log('Status:', p.status);
            console.log('StudyPlan startDate:', p.studyPlan?.startDate);
            const totalTopics = (p.studyPlan?.dailySchedule || []).flatMap((d) => d.topics || []).length;
            console.log('Total topics in studyPlan:', totalTopics);
        });
    }
    catch (err) {
        console.error('Error checking preps:', err);
    }
    finally {
        process.exit(0);
    }
})();
