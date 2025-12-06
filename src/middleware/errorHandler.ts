import { Request, Response, NextFunction } from 'express';
// import * as Sentry from '@sentry/node'; // Uncomment if Sentry is set up

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);

  // Sentry.captureException(err); // Uncomment if Sentry is set up

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'UnauthorizedError') { // For JWT errors
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Handle Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      type: 'ValidationError',
      message: err.details.map((detail: any) => detail.message).join(', ')
    });
  }

  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error'
  });
};
