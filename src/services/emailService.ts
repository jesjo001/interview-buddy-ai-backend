import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transporter using your email service provider details
// For SendGrid, you would typically use an SMTP transporter
const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net", // Example for SendGrid
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: "apikey", // For SendGrid, user is 'apikey'
    pass: process.env.SENDGRID_API_KEY,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions) => {
  try {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@interviewprepai.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to', options.to);
  } catch (error) {
    console.error('Error sending email:', error);
    // In a production environment, you might want to log this error to Sentry or similar
    throw new Error('Failed to send email');
  }
};
