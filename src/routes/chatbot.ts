import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createScheduledReminder,
  dismissReminderItem,
  getChatbotContext,
  getCopilotPreferences,
  getPersonas,
  getReminderFeed,
  previewReminders,
  sendMessage,
  sendReminderNow,
  updateCopilotPreferences,
} from '../controllers/chatbotController';

const router = Router();

router.use(authenticate);

router.get('/personas', getPersonas);
router.get('/preferences', getCopilotPreferences);
router.put('/preferences', updateCopilotPreferences);
router.get('/context/:prepId', getChatbotContext);
router.get('/reminders/preview/:prepId', previewReminders);
router.get('/reminders', getReminderFeed);
router.post('/reminders', createScheduledReminder);
router.put('/reminders/:reminderId/dismiss', dismissReminderItem);
router.post('/reminders/:reminderId/send-now', sendReminderNow);
router.post('/message', sendMessage);

export default router;
