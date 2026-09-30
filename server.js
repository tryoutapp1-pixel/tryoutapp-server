require('dotenv').config();

const app = require('./src/app');
const { env } = require('./src/config/env');
const pool = require('./src/config/database');

const server = app.listen(env.port, () => {
  console.log(`API running on port ${env.port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
