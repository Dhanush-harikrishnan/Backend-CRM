import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import config from './config';
import logger from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import customerRoutes from './routes/customer.routes';
import productRoutes from './routes/product.routes';
import invoiceRoutes from './routes/invoice.routes';
import paymentRoutes from './routes/payment.routes';

// ============================================
// EXPRESS APP SETUP
// ============================================
const app: Application = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// 1. HELMET - Sets various HTTP headers for security
app.use(helmet());

// 2. CORS - Configure Cross-Origin Resource Sharing
app.use(
  cors({
    origin: config.cors.origin, // Only allow requests from your frontend
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. RATE LIMITING - Prevent DDoS and brute force attacks
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip rate limiting for certain IPs (optional)
  skip: (req) => {
    // Example: Skip for localhost in development
    if (config.nodeEnv === 'development' && req.ip === '127.0.0.1') {
      return true;
    }
    return false;
  },
});

// Apply to all requests
app.use(limiter);

// ============================================
// BODY PARSING MIDDLEWARE
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// LOGGING MIDDLEWARE
// ============================================
// HTTP request logger
if (config.nodeEnv === 'development') {
  app.use(morgan('dev')); // Concise output for development
} else {
  // Production logging format
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );
}

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// ============================================
// API ROUTES
// ============================================
const API_PREFIX = '/api';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/customers`, customerRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/invoices`, invoiceRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);

// ============================================
// ROOT ENDPOINT
// ============================================
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Inventory & Billing API - PERN Stack',
    version: '1.0.0',
    documentation: '/api',
  });
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
// 404 Handler - Must be after all routes
app.use(notFoundHandler);

// Global Error Handler - Must be last
app.use(errorHandler);

export default app;
