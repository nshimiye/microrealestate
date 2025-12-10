/**
 * Integration tests for tenant authentication flows
 * 
 * These tests verify that the authenticator service works correctly
 * with the new repository pattern for tenant authentication, testing
 * complete flows including OTP generation, validation, and session management.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Service, ServiceError } from '@microrealestate/common';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import tenantRoutes from '../routes/tenant.js';

// mock axios for OTP email sending
vi.mock('axios');

describe('Tenant Authentication Integration Tests', () => {
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
        EMAILER_URL: 'http://localhost:8400',
        PRODUCTION: false,
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

    // Create Express app with tenant routes
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    // Add rawLocale middleware (required by tenant routes)
    app.use((req, res, next) => {
      req.rawLocale = { code: 'en-US' };
      next();
    });
    
    app.use('/tenant', tenantRoutes());
    
    // Add error handling middleware
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

  describe('Tenant Signin Flow', () => {
    beforeEach(async () => {
      // Create test tenants with contact emails
      const mongoose = await import('mongoose');
      await mongoose.connection.db.collection('occupants').insertMany([
        {
          realmId: 'realm1',
          name: 'John Tenant',
          contacts: [
            {
              contact: 'John Tenant',
              email: 'john.tenant@example.com',
              phone: '555-0100'
            }
          ]
        },
        {
          realmId: 'realm1',
          name: 'Jane Tenant',
          contacts: [
            {
              contact: 'Jane Tenant',
              email: 'jane.tenant@example.com',
              phone: '555-0101'
            }
          ]
        }
      ]);
    });

    it('should generate OTP for valid tenant email', async () => {
      const axios = await import('axios');
      axios.default.post = vi.fn().mockResolvedValue({ status: 200 });

      const response = await request(app)
        .post('/tenant/signin')
        .send({
          email: 'john.tenant@example.com'
        });

      expect(response.status).toBe(204);

      // Verify OTP was created in Redis
      const otpKeys = Array.from(redisClient.data.keys());
      expect(otpKeys.length).toBe(1);
      
      const otpKey = otpKeys[0];
      expect(otpKey).toMatch(/^\d{6}$/); // 6-digit OTP
      
      const otpData = await redisClient.get(otpKey);
      expect(otpData).toContain('email=john.tenant@example.com');
      expect(otpData).toContain('createdAt=');
      expect(otpData).toContain('expiresAt=');

      // Verify email was sent
      expect(axios.default.post).toHaveBeenCalledWith(
        'http://localhost:8400/otp',
        expect.objectContaining({
          templateName: 'otp',
          recordId: 'john.tenant@example.com',
          params: {
            otp: otpKey
          }
        }),
        expect.objectContaining({
          headers: {
            'Accept-Language': 'en-US'
          }
        })
      );
    });

    it('should return 204 for non-existent tenant email (avoid enumeration)', async () => {
      const axios = await import('axios');
      axios.default.post = vi.fn().mockResolvedValue({ status: 200 });

      const response = await request(app)
        .post('/tenant/signin')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(response.status).toBe(204);

      // Verify no OTP was created
      const otpKeys = Array.from(redisClient.data.keys());
      expect(otpKeys.length).toBe(0);

      // Verify no email was sent
      expect(axios.default.post).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive email', async () => {
      const axios = await import('axios');
      axios.default.post = vi.fn().mockResolvedValue({ status: 200 });

      const response = await request(app)
        .post('/tenant/signin')
        .send({
          email: 'JOHN.TENANT@EXAMPLE.COM'
        });

      expect(response.status).toBe(204);

      // Verify OTP was created
      const otpKeys = Array.from(redisClient.data.keys());
      expect(otpKeys.length).toBe(1);
    });

    it('should return 422 for missing email', async () => {
      const response = await request(app)
        .post('/tenant/signin')
        .send({});

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 422 for email with unsupported characters', async () => {
      const response = await request(app)
        .post('/tenant/signin')
        .send({
          email: 'test;email@example.com'
        });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('OTP Validation and Session Creation', () => {
    let validOtp;

    beforeEach(async () => {
      // Create test tenant
      const mongoose = await import('mongoose');
      await mongoose.connection.db.collection('occupants').insertOne({
        realmId: 'realm1',
        name: 'John Tenant',
        contacts: [
          {
            contact: 'John Tenant',
            email: 'john.tenant@example.com',
            phone: '555-0100'
          }
        ]
      });

      // Generate OTP
      const axios = await import('axios');
      axios.default.post = vi.fn().mockResolvedValue({ status: 200 });

      await request(app)
        .post('/tenant/signin')
        .send({
          email: 'john.tenant@example.com'
        });

      // Get the generated OTP
      const otpKeys = Array.from(redisClient.data.keys());
      validOtp = otpKeys[0];
    });

    it('should validate OTP and create session token', async () => {
      const response = await request(app)
        .get('/tenant/signedin')
        .query({ otp: validOtp });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionToken');
      expect(typeof response.body.sessionToken).toBe('string');

      // Verify session token cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeTruthy();
      const sessionTokenCookie = cookies.find(cookie => cookie.startsWith('sessionToken='));
      expect(sessionTokenCookie).toBeTruthy();

      // Verify session is stored in Redis
      const sessionToken = response.body.sessionToken;
      const storedEmail = await redisClient.get(sessionToken);
      expect(storedEmail).toBe('john.tenant@example.com');

      // Verify OTP was deleted after use
      const otpData = await redisClient.get(validOtp);
      expect(otpData).toBeNull();
    });

    it('should return 401 for invalid OTP', async () => {
      const response = await request(app)
        .get('/tenant/signedin')
        .query({ otp: '999999' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for missing OTP', async () => {
      const response = await request(app)
        .get('/tenant/signedin');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for already used OTP', async () => {
      // Use OTP once
      await request(app)
        .get('/tenant/signedin')
        .query({ otp: validOtp });

      // Try to use it again
      const response = await request(app)
        .get('/tenant/signedin')
        .query({ otp: validOtp });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for expired OTP', async () => {
      // Manually create an expired OTP
      const expiredOtp = '123456';
      const now = new Date().getTime();
      const expiredTime = now - 10 * 60 * 1000; // 10 minutes ago
      await redisClient.set(
        expiredOtp,
        `createdAt=${expiredTime};expiresAt=${expiredTime + 5 * 60 * 1000};email=john.tenant@example.com`
      );

      const response = await request(app)
        .get('/tenant/signedin')
        .query({ otp: expiredOtp });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Session Management', () => {
    let sessionToken;

    beforeEach(async () => {
      // Create test tenant
      const mongoose = await import('mongoose');
      await mongoose.connection.db.collection('occupants').insertOne({
        realmId: 'realm1',
        name: 'John Tenant',
        contacts: [
          {
            contact: 'John Tenant',
            email: 'john.tenant@example.com',
            phone: '555-0100'
          }
        ]
      });

      // Generate OTP and create session
      const axios = await import('axios');
      axios.default.post = vi.fn().mockResolvedValue({ status: 200 });

      await request(app)
        .post('/tenant/signin')
        .send({
          email: 'john.tenant@example.com'
        });

      const otpKeys = Array.from(redisClient.data.keys());
      const otp = otpKeys[0];

      const signinResponse = await request(app)
        .get('/tenant/signedin')
        .query({ otp });

      sessionToken = signinResponse.body.sessionToken;
    });

    it('should retrieve session information', async () => {
      const response = await request(app)
        .get('/tenant/session')
        .set('Cookie', [`sessionToken=${sessionToken}`]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email');
      expect(response.body.email).toBe('john.tenant@example.com');
    });

    it('should return 401 for missing session token', async () => {
      const response = await request(app)
        .get('/tenant/session');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for invalid session token', async () => {
      const response = await request(app)
        .get('/tenant/session')
        .set('Cookie', ['sessionToken=invalid-token']);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should sign out and clear session', async () => {
      const response = await request(app)
        .delete('/tenant/signout')
        .set('Cookie', [`sessionToken=${sessionToken}`]);

      expect(response.status).toBe(204);

      // Verify session was deleted from Redis
      const storedEmail = await redisClient.get(sessionToken);
      expect(storedEmail).toBeNull();

      // Verify session cookie was cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeTruthy();
      const sessionTokenCookie = cookies.find(cookie => cookie.startsWith('sessionToken='));
      expect(sessionTokenCookie).toContain('sessionToken=;');
    });

    it('should handle signout without session token', async () => {
      const response = await request(app)
        .delete('/tenant/signout');

      expect(response.status).toBe(204);
    });
  });
});
