/**
 * Integration tests for landlord authentication flows
 * 
 * These tests verify that the authenticator service works correctly
 * with the new repository pattern, testing complete authentication flows
 * including signup, signin, and password reset.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Service } from '@microrealestate/common';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import landlordRoutes from '../routes/landlord.js';

// mock axios for forgotpassword test
// We are only testing happy cases
// @TODO: we should test what happens if axios call fails
vi.mock('axios');

describe('Landlord Authentication Integration Tests', () => {
  let mongoServer;
  let app;
  let redisClient;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Create mock Redis client
    redisClient = {
      data: new Map(),
      async set(key, value) {
        this.data.set(key, value);
      },
      async get(key) {
        return this.data.get(key) || null;
      },
      async del(key) {
        this.data.delete(key);
      }
    };

    // Initialize Service with test configuration
    const envConfig = {
      getValues: () => ({
        MONGO_URL: mongoUri,
        ACCESS_TOKEN_SECRET: 'test-access-secret',
        REFRESH_TOKEN_SECRET: 'test-refresh-secret',
        RESET_TOKEN_SECRET: 'test-reset-secret',
        APPCREDZ_TOKEN_SECRET: 'test-appcredz-secret',
        EMAILER_URL: 'http://localhost:8400',
        PRODUCTION: false,
        SIGNUP: true,
        TOKEN_COOKIE_ATTRIBUTES: {
          httpOnly: true,
          secure: false,
          sameSite: 'strict'
        }
      }),
      getObfuscatedValues: () => ({
        MONGO_URL: 'mongodb://***'
      })
    };

    Service.getInstance = () => ({
      envConfig,
      redisClient
    });

    // Initialize MongoDB connection
    const mongoClient = MongoClient.getInstance(envConfig);
    await mongoClient.connect();

    // Create Express app with landlord routes
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/landlord', landlordRoutes());
    
    // Add error handling middleware
    const { ServiceError } = await import('@microrealestate/common');
    app.use((error, req, res, next) => {
      const responseBody = {
        error: error.message,
        statusCode: error instanceof ServiceError ? error.statusCode || 500 : 500
      };
      res.status(responseBody.statusCode).json(responseBody);
    });
  });

  afterAll(async () => {
    await MongoClient.getInstance().disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database between tests using mongoose connection
    const mongoose = await import('mongoose');
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
    // Clear Redis data
    redisClient.data.clear();
  });

  describe('Signup Flow', () => {
    it('should create a new account with repositories', async () => {
      const response = await request(app)
        .post('/landlord/signup')
        .send({
          firstname: 'John',
          lastname: 'Doe',
          email: 'john.doe@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);

      // Verify account was created in database
      const mongoose = await import('mongoose');
      const account = await mongoose.connection.db.collection('accounts').findOne({
        email: 'john.doe@example.com'
      });

      expect(account).toBeTruthy();
      expect(account.firstname).toBe('John');
      expect(account.lastname).toBe('Doe');
      expect(account.email).toBe('john.doe@example.com');
      // Password should be hashed
      expect(account.password).not.toBe('password123');
      expect(account.password.length).toBeGreaterThan(20);
    });

    it('should return 201 for duplicate email to avoid enumeration', async () => {
      // Create first account
      await request(app)
        .post('/landlord/signup')
        .send({
          firstname: 'John',
          lastname: 'Doe',
          email: 'john.doe@example.com',
          password: 'password123'
        });

      // Try to create duplicate
      const response = await request(app)
        .post('/landlord/signup')
        .send({
          firstname: 'Jane',
          lastname: 'Smith',
          email: 'john.doe@example.com',
          password: 'different'
        });

      expect(response.status).toBe(201);

      // Verify only one account exists
      const mongoose = await import('mongoose');
      const accounts = await mongoose.connection.db.collection('accounts').find({
        email: 'john.doe@example.com'
      }).toArray();

      expect(accounts.length).toBe(1);
      expect(accounts[0].firstname).toBe('John'); // Original account unchanged
    });

    it('should return 422 for missing fields', async () => {
      const response = await request(app)
        .post('/landlord/signup')
        .send({
          firstname: 'John',
          email: 'john.doe@example.com'
          // Missing lastname and password
        });

      expect(response.status).toBe(422);
    });
  });

  describe('Signin Flow', () => {
    beforeEach(async () => {
      // Create a test account
      await request(app)
        .post('/landlord/signup')
        .send({
          firstname: 'John',
          lastname: 'Doe',
          email: 'john.doe@example.com',
          password: 'password123'
        });
    });

    it('should sign in with correct credentials and generate tokens', async () => {
      const response = await request(app)
        .post('/landlord/signin')
        .send({
          email: 'john.doe@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');

      // Verify refresh token cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeTruthy();
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeTruthy();

      // Verify tokens are stored in Redis
      const refreshToken = refreshTokenCookie.split(';')[0].split('=')[1];
      const storedAccessToken = await redisClient.get(refreshToken);
      expect(storedAccessToken).toBeTruthy();
      expect(storedAccessToken).toBe(response.body.accessToken);
    });

    it('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/landlord/signin')
        .send({
          email: 'john.doe@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for non-existent account', async () => {
      const response = await request(app)
        .post('/landlord/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 422 for missing fields', async () => {
      const response = await request(app)
        .post('/landlord/signin')
        .send({
          email: 'john.doe@example.com'
          // Missing password
        });

      expect(response.status).toBe(422);
    });

    it('should handle case-insensitive email', async () => {
      const response = await request(app)
        .post('/landlord/signin')
        .send({
          email: 'JOHN.DOE@EXAMPLE.COM',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });
  });

  describe('Password Reset Flow', () => {
    beforeEach(async () => {
      // Create a test account
      await request(app)
        .post('/landlord/signup')
        .send({
          firstname: 'John',
          lastname: 'Doe',
          email: 'john.doe@example.com',
          password: 'password123'
        });
    });

    it('should complete password reset flow with repositories', async () => {
      // Step 1: Request password reset
      const forgotResponse = await request(app)
        .post('/landlord/forgotpassword')
        .send({
          email: 'john.doe@example.com'
        });

      expect(forgotResponse.status).toBe(204);

      // Get the reset token from Redis (simulating email link)
      const resetTokens = Array.from(redisClient.data.keys());
      expect(resetTokens.length).toBe(1);
      const resetToken = resetTokens[0];

      // Step 2: Reset password with token
      const resetResponse = await request(app)
        .patch('/landlord/resetpassword')
        .send({
          resetToken,
          password: 'newpassword456'
        });

      expect(resetResponse.status).toBe(200);

      // Step 3: Verify old password doesn't work
      const oldPasswordResponse = await request(app)
        .post('/landlord/signin')
        .send({
          email: 'john.doe@example.com',
          password: 'password123'
        });

      expect(oldPasswordResponse.status).toBe(401);

      // Step 4: Verify new password works
      const newPasswordResponse = await request(app)
        .post('/landlord/signin')
        .send({
          email: 'john.doe@example.com',
          password: 'newpassword456'
        });

      expect(newPasswordResponse.status).toBe(200);
      expect(newPasswordResponse.body).toHaveProperty('accessToken');
    });

    it('should return 204 for non-existent email (avoid enumeration)', async () => {
      const response = await request(app)
        .post('/landlord/forgotpassword')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(response.status).toBe(204);

      // Verify no reset token was created
      const resetTokens = Array.from(redisClient.data.keys());
      expect(resetTokens.length).toBe(0);
    });

    it('should return 403 for invalid reset token', async () => {
      const response = await request(app)
        .patch('/landlord/resetpassword')
        .send({
          resetToken: 'invalid-token',
          password: 'newpassword456'
        });

      expect(response.status).toBe(403);
    });

    it('should return 422 for missing fields', async () => {
      const response = await request(app)
        .patch('/landlord/resetpassword')
        .send({
          resetToken: 'some-token'
          // Missing password
        });

      expect(response.status).toBe(422);
    });
  });
});
