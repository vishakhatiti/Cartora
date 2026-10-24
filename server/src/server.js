import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { getDefaultCatalog } from './services/catalog/catalog.js';

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

// Load the catalogue before accepting traffic. It is the biggest memory use of the API, so a problem shows up
// here, in the deploy log, instead of as a failed first request from a visitor.
try {
  const started = Date.now();
  const catalog = getDefaultCatalog();
  const rssMb = Math.round(process.memoryUsage().rss / 1048576);
  console.log(`Catalogue loaded: ${catalog.size} products in ${Date.now() - started} ms (process memory ${rssMb} MB)`);
} catch (err) {
  console.error(`Catalogue could not be loaded: ${err.message}`);
  process.exit(1);
}

const app = createApp(env);
try {
  const count = await app.locals.commerce.seller.hydrate();
  console.log(`Seller listings loaded: ${count}`);
} catch (err) {
  console.error(`Seller listings could not be loaded: ${err.message}`);
  process.exit(1);
}

const server = app.listen(env.PORT, () => {
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
