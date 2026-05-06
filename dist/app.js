"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const cacheMiddleware_1 = require("./middleware/cacheMiddleware");
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const interviewPreps_1 = __importDefault(require("./routes/interviewPreps"));
const topics_1 = __importDefault(require("./routes/topics"));
const mindMaps_1 = __importDefault(require("./routes/mindMaps"));
const flashcards_1 = __importDefault(require("./routes/flashcards"));
const voice_1 = __importDefault(require("./routes/voice"));
const progress_1 = __importDefault(require("./routes/progress"));
const mockInterviews_1 = __importDefault(require("./routes/mockInterviews")); // Import mock interview routes
const chatbot_1 = __importDefault(require("./routes/chatbot"));
const webhooks_1 = __importDefault(require("./routes/webhooks")); // Import webhook routes
dotenv_1.default.config();
const app = (0, express_1.default)();
// Security Middleware
app.use((0, helmet_1.default)());
// CORS Configuration
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:8082').split(',').map(url => url.trim());
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use((0, cors_1.default)(corsOptions));
// Request logging
app.use((0, morgan_1.default)('dev'));
// Compression for responses (improves bandwidth and perceived speed)
app.use((0, compression_1.default)());
// Rate Limiting
app.use(rateLimiter_1.apiLimiter);
// Webhook route - MUST be before express.json() to get raw body
app.use('/api/webhooks', webhooks_1.default);
// Body parser
// Body parsers with sensible limits
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// Cache middleware for GET requests (apply it before routes if it should be general)
app.use(cacheMiddleware_1.cacheMiddleware);
// Routes
app.get('/', (req, res) => {
    res.send('Interview Prep AI Backend API');
});
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/interview-preps', interviewPreps_1.default);
app.use('/api/topics', topics_1.default);
app.use('/api/mind-maps', mindMaps_1.default);
app.use('/api/flashcards', flashcards_1.default);
app.use('/api/voice', voice_1.default);
app.use('/api/progress', progress_1.default);
app.use('/api/mock-interviews', mockInterviews_1.default);
app.use('/api/chatbot', chatbot_1.default);
// Error handling middleware
app.use(errorHandler_1.errorHandler);
exports.default = app;
