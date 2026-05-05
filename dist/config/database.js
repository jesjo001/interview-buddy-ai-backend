"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopInMemoryMongo = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Optional in-memory MongoDB for smoke tests / CI when real Mongo not available
let mongoMemoryServer = null;
const connectDB = async () => {
    try {
        let mongoUri = process.env.MONGODB_URI;
        const useInMemory = (process.env.USE_IN_MEMORY_DB || '').toLowerCase() === 'true';
        if (!mongoUri || useInMemory) {
            // Try to start an in-memory MongoDB instance for local smoke tests
            // This keeps production behavior unchanged when MONGODB_URI is present
            // and allows CI/local smoke runs without external dependencies.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { MongoMemoryServer } = require('mongodb-memory-server');
            mongoMemoryServer = await MongoMemoryServer.create();
            mongoUri = mongoMemoryServer.getUri();
            console.log('[Database] Using in-memory MongoDB for testing at', mongoUri);
        }
        if (!mongoUri)
            throw new Error('MONGODB_URI is not defined and in-memory Mongo failed to start');
        await mongoose_1.default.connect(mongoUri, {
            maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 20,
            minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 0,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4,
        });
        console.log('MongoDB Connected...');
    }
    catch (err) {
        console.error('[Database] Connection error:', err?.message || err);
        // For local smoke runs we don't want to crash the process if DB can't start — rethrow so caller can decide.
        throw err;
    }
};
const stopInMemoryMongo = async () => {
    try {
        await mongoose_1.default.disconnect();
        if (mongoMemoryServer)
            await mongoMemoryServer.stop();
    }
    catch (err) {
        console.warn('[Database] Error stopping in-memory Mongo:', err?.message || err);
    }
};
exports.stopInMemoryMongo = stopInMemoryMongo;
exports.default = connectDB;
