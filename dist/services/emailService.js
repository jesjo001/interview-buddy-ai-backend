"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Create a transporter using SMTP configuration via environment variables.
// If SMTP vars are not provided, fall back to SendGrid SMTP settings (existing behavior).
const smtpHost = process.env.SMTP_HOST || 'smtp.sendgrid.net';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER || 'apikey';
const smtpPass = process.env.SMTP_PASS || process.env.SENDGRID_API_KEY;
const transporter = nodemailer_1.default.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
});
const sendEmail = async (options) => {
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
    }
    catch (error) {
        console.error('Error sending email (non-fatal):', error?.message || error);
        // Do not block critical flows (e.g., registration) if email fails — log and continue.
        // In production you may want to rethrow or surface this via monitoring.
        return;
    }
};
exports.sendEmail = sendEmail;
