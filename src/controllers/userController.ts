import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { updatePreferencesSchema, registerSchema } from '../utils/validators'; // Re-using registerSchema for update validation example

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    // req.user is already populated by the authenticate middleware
    res.status(200).json(req.user);
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const { name, avatar } = req.body;

    // Basic validation (can use a dedicated schema for update if needed)
    if (name) req.user.name = name;
    if (avatar) req.user.avatar = avatar; // In a real app, handle avatar uploads separately

    await req.user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updatePreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const { error, value } = updatePreferencesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    Object.assign(req.user.preferences, value);
    await req.user.save();

    res.status(200).json({
      message: 'Preferences updated successfully',
      preferences: req.user.preferences,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    // In a real application, consider a soft delete (e.g., setting an 'isActive' flag to false)
    // or anonymizing user data rather than a hard delete, especially if you need to retain
    // data for analytics or legal reasons. For now, we perform a hard delete.
    await User.findByIdAndDelete(req.user._id);

    // Also delete associated data (InterviewPreps, Topics, Flashcards, UserProgress)
    // This would typically be handled by Mongoose middleware (pre/post hooks) or a dedicated service
    // For now, simple logging placeholder
    console.log(`User ${req.user._id} deleted. Associated data should also be handled.`);

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.status(200).json({ message: 'Account deleted successfully.' });
  } catch (err) {
    next(err);
  }
};
