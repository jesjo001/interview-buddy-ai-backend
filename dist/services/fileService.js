"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromDOCX = exports.extractTextFromPDF = exports.uploadToS3 = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const client_s3_1 = require("@aws-sdk/client-s3");
// pdf-parse has an unusual default export shape; require and cast to avoid TS issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');
const mammoth_1 = __importDefault(require("mammoth"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Configure multer for in-memory storage (to process files before uploading to S3)
const storage = multer_1.default.memoryStorage();
exports.upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF and DOCX files are allowed!'));
        }
    },
});
// Configure AWS S3 Client
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const uploadToS3 = async (file) => {
    if (!process.env.S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.warn('AWS S3 credentials or bucket not configured. Skipping S3 upload and returning mock URL.');
        return `MOCK_S3_URL_FOR_${file.originalname}`;
    }
    const key = `uploads/${Date.now()}-${file.originalname}`;
    try {
        await s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        }));
        return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
    }
    catch (error) {
        console.error('Error uploading file to S3:', error);
        throw new Error('Failed to upload file to S3');
    }
};
exports.uploadToS3 = uploadToS3;
const extractTextFromPDF = async (buffer) => {
    try {
        const parser = pdf.default || pdf;
        const data = await parser(buffer);
        return data?.text || '';
    }
    catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error('Failed to extract text from PDF');
    }
};
exports.extractTextFromPDF = extractTextFromPDF;
const extractTextFromDOCX = async (buffer) => {
    try {
        const result = await mammoth_1.default.extractRawText({ buffer });
        return result.value;
    }
    catch (error) {
        console.error('Error extracting text from DOCX:', error);
        throw new Error('Failed to extract text from DOCX');
    }
};
exports.extractTextFromDOCX = extractTextFromDOCX;
