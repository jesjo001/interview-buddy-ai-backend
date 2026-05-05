import dotenv from 'dotenv';
import connectDB from '../config/database';
import InterviewPrep from '../models/InterviewPrep';

dotenv.config();

(async () => {
  try {
    await connectDB();
    const preps = await InterviewPrep.find({}).lean();
    console.log(`Found ${preps.length} InterviewPrep documents`);
    preps.forEach((p) => {
      console.log('--- Prep ID:', p._id);
      console.log('UserId:', p.userId?.toString());
      console.log('Status:', p.status);
      console.log('StudyPlan startDate:', p.studyPlan?.startDate);
      const totalTopics = (p.studyPlan?.dailySchedule || []).flatMap((d: any) => d.topics || []).length;
      console.log('Total topics in studyPlan:', totalTopics);
    });
  } catch (err) {
    console.error('Error checking preps:', err);
  } finally {
    process.exit(0);
  }
})();
