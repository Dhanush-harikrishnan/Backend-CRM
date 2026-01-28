import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import config from './config';
import logger from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestId, requestTimeout } from './middleware/request.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import organizationRoutes from './routes/organization.routes';
import customerRoutes from './routes/customer.routes';
import productRoutes from './routes/product.routes';
import invoiceRoutes from './routes/invoice.routes';
import estimateRoutes from './routes/estimate.routes';
import creditNoteRoutes from './routes/creditNote.routes';
import paymentRoutes from './routes/payment.routes';
import expenseRoutes from './routes/expense.routes';
import reportRoutes from './routes/report.routes';
import interactionRoutes from './routes/interaction.routes';
import vendorRoutes from './routes/vendor.routes';
import purchaseRoutes from './routes/purchase.routes';

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
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
    exposedHeaders: ['Content-Length', 'Content-Type', 'X-Request-ID'],
  })
);

// 3. COMPRESSION - Compress all responses
app.use(compression());

// 4. REQUEST ID - Add unique ID to each request for tracking
app.use(requestId);

// 5. REQUEST TIMEOUT - Prevent hanging requests (30 seconds)
app.use(requestTimeout(30000));

// 6. RATE LIMITING - Prevent DDoS and brute force attacks
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (config.nodeEnv === 'development' && req.ip === '127.0.0.1') {
      return true;
    }
    return false;
  },
});

app.use(limiter);

// ============================================
// BODY PARSING MIDDLEWARE
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// LOGGING MIDDLEWARE
// ============================================
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
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
    uptime: process.uptime(),
  });
});

// ============================================
// API ROUTES
// ============================================
const API_PREFIX = '/api/v1';

// Auth & Organization
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/organizations`, organizationRoutes);

// Master Data
app.use(`${API_PREFIX}/customers`, customerRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/interactions`, interactionRoutes);

// Transactions
app.use(`${API_PREFIX}/invoices`, invoiceRoutes);
app.use(`${API_PREFIX}/estimates`, estimateRoutes);
app.use(`${API_PREFIX}/credit-notes`, creditNoteRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/expenses`, expenseRoutes);
app.use(`${API_PREFIX}/vendors`, vendorRoutes);
app.use(`${API_PREFIX}/purchases`, purchaseRoutes);

// Reports & Dashboard
app.use(`${API_PREFIX}/reports`, reportRoutes);

// Backward compatibility - also support /api without version
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/credit-notes', creditNoteRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/reports', reportRoutes);

// ============================================
// ROOT ENDPOINT
// ============================================
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'SaaS Invoice Management API',
    version: '2.0.0',
    apiVersion: 'v1',
    features: [
      'Multi-tenant organization support',
      'Full GST compliance (CGST/SGST/IGST)',
      'Invoice, Estimate, Credit Note management',
      'Cash payment tracking',
      'Expense tracking with categories',
      'Comprehensive reports & dashboard',
      'Product inventory management',
      'Customer management with groups',
      'Vendor & purchase order management',
      'CRM interactions tracking',
    ],
    endpoints: {
      health: '/health',
      apiV1: '/api/v1',
      apiLegacy: '/api',
    },
  });
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
