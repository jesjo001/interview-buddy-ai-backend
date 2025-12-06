import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../utils/validators';
import { sendEmail } from '../services/emailService';
import crypto from 'crypto';
import { Types } from 'mongoose';

// Helper to set tokens in HTTP-only cookies
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email, password } = value;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    user = await User.create({
      name,
      email,
      passwordHash,
      emailVerified: false,
    });

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to user document
    user.refreshTokens.push(refreshToken);
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);

    // Send verification email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    // In a real app, save this token to the user document and include it in the verification link
    // For now, just logging it
    console.log(`Verification Token for ${user.email}: ${verificationToken}`);
    await sendEmail({
      to: user.email,
      subject: 'Verify your email',
      html: `<p>Please verify your email by clicking <a href="${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}">here</a></p>`
    });

    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      accessToken, // Sending accessToken in body for easier frontend integration, but primarily via cookie
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // if (!user.emailVerified) {
    //   return res.status(401).json({ message: 'Please verify your email to log in.' });
    // }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Add new refresh token and clean up old ones (optional: limit number of refresh tokens)
    user.refreshTokens.push(refreshToken);
    // Keep only a certain number of refresh tokens if needed
    // user.refreshTokens = user.refreshTokens.slice(-5); // Keep last 5
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
      message: 'Logged in successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferences: user.preferences,
        subscription: user.subscription,
      },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(200).json({ message: 'Already logged out' });
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (decoded) {
      const user = await User.findById(decoded.userId);
      if (user) {
        user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
        await user.save();
      }
    }

    res.clearCookie('accessToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const oldRefreshToken = req.cookies.refreshToken;
    if (!oldRefreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const decoded = verifyRefreshToken(oldRefreshToken);

    if (!decoded) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokens.includes(oldRefreshToken)) {
      // If refresh token is found in DB but not linked to user or is tampered with, revoke all tokens
      if (user) {
        user.refreshTokens = [];
        await user.save();
      }
      return res.status(403).json({ error: 'Invalid refresh token. Please log in again.' });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // Replace old refresh token with new one
    user.refreshTokens = user.refreshTokens.filter(token => token !== oldRefreshToken);
    user.refreshTokens.push(newRefreshToken);
    await user.save();

    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.status(200).json({
      message: 'Tokens refreshed successfully',
      accessToken: newAccessToken,
    });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const { email } = value;

    const user = await User.findOne({ email });
    if (!user) {
      // For security, don't reveal if the email exists or not
      return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Please go to this link to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`
    });

    res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const { token, newPassword } = value;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = []; // Invalidate all refresh tokens for security
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully. Please log in with your new password.' });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query; // Assuming token is passed as query parameter
    if (!token) {
      return res.status(400).json({ message: 'Verification token is missing.' });
    }

    // In a real application, you'd find the user by a verificationToken field
    // For now, let's assume we get the userId from the token directly if it was a JWT
    // Or, more realistically, the token would be stored in the User model
    // For this example, I'll simulate finding a user by a simple token check (not secure for prod)
    // Replace this with actual token-to-user mapping logic

    const user = await User.findOne({ email: 'user@example.com' }); // Placeholder: replace with actual token lookup
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }

    user.emailVerified = true;
    await user.save();

    res.status(200).json({ message: 'Email successfully verified!' });
  } catch (err) {
    next(err);
  }
};
