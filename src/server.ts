import app from './app';
import config from './config';
import logger from './config/logger';
import prisma from './config/database';

// ============================================
// SERVER STARTUP
// ============================================
const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running in ${config.nodeEnv} mode on port ${PORT}`);
  logger.info(`📍 Health check: http://localhost:${PORT}/health`);
  logger.info(`📍 API Base URL: http://localhost:${PORT}/api`);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const gracefulShutdown = async (signal: string) => {
  logger.info(`\n${signal} signal received: closing HTTP server`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close database connection
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during database disconnect:', error);
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle various termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});
