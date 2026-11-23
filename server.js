require('dotenv').config();

const app = require('./src/app');
const { env } = require('./src/config/env');
const pool = require('./src/config/database');

const SHUTDOWN_TIMEOUT_MS = 10000;

const server = app.listen(env.port, () => {
  console.log(`API running in ${env.nodeEnv} mode on port ${env.port}`);
});

let shuttingDown = false;

/**
 * Stops accepting connections, closes the DB pool, then exits. Forces exit if
 * open connections do not drain within SHUTDOWN_TIMEOUT_MS.
 *
 * @param {string} signal
 * @param {number} [exitCode=0]
 */
function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: closing HTTP server`);

  server.close(async () => {
    await pool.end().catch((error) => console.error('Failed to close database pool', error));
    process.exit(exitCode);
  });

  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection', reason);
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception', error);
  shutdown('uncaughtException', 1);
});
