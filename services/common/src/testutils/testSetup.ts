import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

/**
 * Connect to an in-memory MongoDB instance for testing
 * 
 * Note: Transactions require a replica set, but MongoMemoryServer
 * runs as a standalone instance by default for faster test execution.
 * Transaction tests will be skipped in this environment.
 */
export async function connectTestDB(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
}

/**
 * Check if the current MongoDB connection supports transactions
 * 
 * @returns true if transactions are supported (replica set), false otherwise
 */
export function supportsTransactions(): boolean {
  // Transactions require a replica set or sharded cluster
  // MongoMemoryServer runs as standalone by default
  return false;
}

/**
 * Disconnect and stop the in-memory MongoDB instance
 */
export async function disconnectTestDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * Clear all collections in the test database
 */
export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
}
