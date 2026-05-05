"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeSpeech = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const openai_1 = __importDefault(require("openai"));
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = require("crypto");
dotenv_1.default.config();
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiClient = openaiApiKey ? new openai_1.default({ apiKey: openaiApiKey }) : null;
const s3Bucket = process.env.S3_BUCKET || '';
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const localCache = new Map();
const streamToBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
};
const makeKey = (text, voiceSettings) => {
    const hash = (0, crypto_1.createHash)('sha256')
        .update(JSON.stringify({ text, voiceSettings }))
        .digest('hex');
    return `tts/${hash}.mp3`;
};
const getFromS3 = async (key) => {
    if (!s3Bucket)
        return null;
    try {
        const result = await s3Client.send(new client_s3_1.GetObjectCommand({ Bucket: s3Bucket, Key: key }));
        if (!result.Body)
            return null;
        return await streamToBuffer(result.Body);
    }
    catch (error) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
            return null;
        }
        throw error;
    }
};
const saveToS3 = async (key, buffer) => {
    if (!s3Bucket)
        return;
    await s3Client.send(new client_s3_1.PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: 'audio/mpeg',
        ACL: 'public-read',
    }));
};
const synthesizeViaOpenAI = async (text, voiceSettings) => {
    if (!openaiClient) {
        throw new Error('OPENAI_API_KEY is not set');
    }
    const preferredVoice = voiceSettings?.voice || 'alloy';
    const speed = voiceSettings?.speed ?? 1.0;
    const response = await openaiClient.audio.speech.create({
        model: 'gpt-4o-mini-tts',
        voice: preferredVoice,
        input: text,
        format: 'mp3',
        ...(speed && { speed }),
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
};
const synthesizeSpeech = async (text, voiceSettings) => {
    const key = makeKey(text, voiceSettings);
    if (localCache.has(key)) {
        return localCache.get(key);
    }
    let audioBuffer = null;
    // Check S3 first
    try {
        audioBuffer = await getFromS3(key);
    }
    catch (error) {
        console.warn('S3 fetch failed, will re-synthesize with OpenAI:', error?.message || error);
        audioBuffer = null;
    }
    if (!audioBuffer) {
        try {
            audioBuffer = await synthesizeViaOpenAI(text, voiceSettings);
            try {
                await saveToS3(key, audioBuffer);
            }
            catch (saveError) {
                console.warn('Failed to write TTS to S3 cache:', saveError?.message || saveError);
            }
        }
        catch (err) {
            console.error('Error synthesizing speech with OpenAI TTS:', err?.message || err);
            if (!openaiClient) {
                return `data:audio/mpeg;base64,${Buffer.from(`MOCK_AUDIO: ${text}`).toString('base64')}`;
            }
            throw new Error('Failed to synthesize speech with OpenAI TTS');
        }
    }
    const base64 = audioBuffer.toString('base64');
    const contentUrl = `data:audio/mpeg;base64,${base64}`;
    localCache.set(key, contentUrl);
    return contentUrl;
};
exports.synthesizeSpeech = synthesizeSpeech;
