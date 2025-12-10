import { beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import EnvironmentConfig from '@microrealestate/common/dist/utils/environmentconfig.js';
import Service from '@microrealestate/common/dist/utils/service.js';

let mongoServer;

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect mongoose
  await mongoose.connect(mongoUri);

  // Initialize Service singleton with test config
  const envConfig = new EnvironmentConfig({
    UPLOADS_DIRECTORY: '/tmp/test-uploads',
    TEMPLATES_DIRECTORY: './templates',
    MONGO_URL: mongoUri
  });
  Service.getInstance(envConfig);
});

afterEach(async () => {
  // Clean up all collections after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  // Disconnect and stop MongoDB
  await mongoose.disconnect();
  await mongoServer.stop();
});
