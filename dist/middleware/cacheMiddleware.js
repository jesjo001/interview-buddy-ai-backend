"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCache = exports.cacheMiddleware = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const cache = new node_cache_1.default({ stdTTL: 60 * 5 }); // Cache for 5 minutes
const cacheMiddleware = (req, res, next) => {
    const { originalUrl } = req;
    // Only cache GET requests
    if (req.method !== 'GET') {
        return next();
    }
    const cachedBody = cache.get(originalUrl);
    if (cachedBody) {
        console.log(`Cache hit for ${originalUrl}`);
        // Indicate cached response and set cache-control for client/CDN
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json');
        return res.send(cachedBody);
    }
    // If not in cache, send the request to the original handler
    // and then cache the response
    const originalSend = res.send;
    res.send = (body) => {
        cache.set(originalUrl, body);
        console.log(`Caching response for ${originalUrl}`);
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
        res.setHeader('X-Cache', 'MISS');
        return originalSend.call(res, body);
    };
    next();
};
exports.cacheMiddleware = cacheMiddleware;
const clearCache = (key) => {
    if (key) {
        cache.del(key);
        console.log(`Cache cleared for key: ${key}`);
    }
    else {
        cache.flushAll();
        console.log('All cache cleared');
    }
};
exports.clearCache = clearCache;
