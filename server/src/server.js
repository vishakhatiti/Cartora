import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';

if (!env.MONGO_URL) {
  console.error('MongoDB is not configured. Set MONGO_URL (see server/.env.example).');
  process.exit(1);
}

try {
  await connectDb(env.MONGO_URL);
  console.log('MongoDB connected');
} catch (err) {
  // Print the reason without the connection string, which contains the password.
  console.error(`MongoDB connection failed: ${err.message}`);
  process.exit(1);
}

const server = createApp(env).listen(env.PORT, () => {
  console.log(`Cartora API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
  // Force exit if connections hang.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
