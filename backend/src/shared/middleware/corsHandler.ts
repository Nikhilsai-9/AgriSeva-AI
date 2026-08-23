import cors from 'cors';
import {Request, Response, NextFunction} from 'express';
import { appConfig } from '../config/app.js';

// Configure CORS options — origins are driven by APP_ORIGINS env var.
// Set APP_ORIGINS in .env for local dev, and as a deployment env var in production.
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, desktop apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = appConfig.origins;

    if (allowedOrigins.includes(origin as string)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'x-internal-api-key',
  ],
  exposedHeaders: ['set-cookie'],
};

// Export the configured CORS middleware
export const corsHandler = cors(corsOptions);

// Alternative: Export a function that can be customized per module
export function createCorsHandler(additionalOrigins: string[] = []) {
  const customOptions = {
    ...corsOptions,
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        ...appConfig.origins,
        ...additionalOrigins,
      ];

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
  };

  return cors(customOptions);
}
