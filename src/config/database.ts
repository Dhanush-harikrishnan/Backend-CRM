import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

// Create a single Prisma Client instance with optimized settings
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Transaction settings
  transactionOptions: {
    maxWait: 10000, // 10 seconds max wait to start transaction
    timeout: 15000, // 15 seconds transaction timeout
    isolationLevel: 'ReadCommitted',
  },
});

// Log database queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e: any) => {
    logger.debug(`Query: ${e.query}`);
    logger.debug(`Duration: ${e.duration}ms`);
  });
}

prisma.$on('error', (e: any) => {
  logger.error(`Prisma Error: ${e.message}`);
});

prisma.$on('warn', (e: any) => {
  logger.warn(`Prisma Warning: ${e.message}`);
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Prisma disconnected');
});

// Connection health check with auto-reconnect
export async function ensureConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    logger.warn('Database connection lost, reconnecting...');
    await prisma.$connect();
    logger.info('Database reconnected successfully');
  }
}

export default prisma;
