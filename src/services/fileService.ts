import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
// pdf-parse has an unusual default export shape; require and cast to avoid TS issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');
import mammoth from 'mammoth';
import dotenv from 'dotenv';

dotenv.config();

// Configure multer for in-memory storage (to process files before uploading to S3)
const storage = multer.memoryStorage();
export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed!'));
    }
  },
});

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export const uploadToS3 = async (file: Express.Multer.File): Promise<string> => {
  if (!process.env.S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn('AWS S3 credentials or bucket not configured. Skipping S3 upload and returning mock URL.');
    return `MOCK_S3_URL_FOR_${file.originalname}`;
  }

  const key = `uploads/${Date.now()}-${file.originalname}`;

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('Failed to upload file to S3');
  }
};

export const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
  try {
    const parser = (pdf as any).default || pdf;
    const data = await parser(buffer);
    return data?.text || '';
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

export const extractTextFromDOCX = async (buffer: Buffer): Promise<string> => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from DOCX');
  }
};
