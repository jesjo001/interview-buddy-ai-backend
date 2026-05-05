import NodeCache from 'node-cache';
import { Request, Response, NextFunction } from 'express';

const cache = new NodeCache({ stdTTL: 60 * 5 }); // Cache for 5 minutes

export const cacheMiddleware = (req: Request, res: Response, next: NextFunction) => {
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
  res.send = (body: any) => {
    cache.set(originalUrl, body);
    console.log(`Caching response for ${originalUrl}`);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.setHeader('X-Cache', 'MISS');
    return originalSend.call(res, body);
  };

  next();
};

export const clearCache = (key?: string) => {
  if (key) {
    cache.del(key);
    console.log(`Cache cleared for key: ${key}`);
  } else {
    cache.flushAll();
    console.log('All cache cleared');
  }
};
