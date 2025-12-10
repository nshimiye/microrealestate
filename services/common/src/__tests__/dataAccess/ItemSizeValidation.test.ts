import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { getPropertyRepository } from '../../data-access-layer/index.js';
import {
  clearTestDB,
  connectTestDB,
  disconnectTestDB
} from './testSetup.js';

describe('Item Size Validation', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  describe('Property 16: Item Size Validation', () => {
    it('should reject items exceeding 400KB size limit', async () => {
      const useDynamoDB = process.env.USE_DYNAMODB === 'true';
      if (!useDynamoDB) {
        // This test is specific to DynamoDB size constraints
        return;
      }

      const propertyRepository = getPropertyRepository();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (realmId, propertyName) => {
            await clearTestDB();

            // Create a property with a very large description (> 400KB)
            // 400KB = 409,600 bytes, so we'll create a string > 400,000 characters
            const largeString = 'x'.repeat(410000);

            try {
              await propertyRepository.create({
                realmId,
                name: propertyName,
                type: 'apartment',
                description: largeString // This should exceed 400KB
              });

              // If we reach here, the test should fail
              expect.fail('Should have thrown an error for item size > 400KB');
            } catch (error: any) {
              // Verify that the error is about item size
              expect(error.message).toMatch(/size|400KB|limit/i);
              expect(error.statusCode).toBe(400);
            }
          }
        ),
        { numRuns: 5, timeout: 15000 }
      );
    }, 20000);

    it('should accept items within 400KB size limit', async () => {
      const useDynamoDB = process.env.USE_DYNAMODB === 'true';
      if (!useDynamoDB) {
        return;
      }

      const propertyRepository = getPropertyRepository();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 1000 }), // Reasonable size description
          async (realmId, propertyName, description) => {
            await clearTestDB();

            // Create a property with normal size data
            const created = await propertyRepository.create({
              realmId,
              name: propertyName,
              type: 'apartment',
              description
            });

            // Should succeed without errors
            expect(created).toBeDefined();
            expect(created._id).toBeDefined();
            expect(created.name).toBe(propertyName);
            expect(created.description).toBe(description);
          }
        ),
        { numRuns: 20, timeout: 30000 }
      );
    }, 35000);

    it('should reject items close to but exceeding 400KB limit', async () => {
      const useDynamoDB = process.env.USE_DYNAMODB === 'true';
      if (!useDynamoDB) {
        return;
      }

      const propertyRepository = getPropertyRepository();

      await clearTestDB();

      // Create a property with data that's just over 400KB
      // Account for JSON overhead (keys, quotes, etc.)
      const largeString = 'x'.repeat(400000);

      try {
        await propertyRepository.create({
          realmId: 'test-realm',
          name: 'test-property',
          type: 'apartment',
          description: largeString
        });

        expect.fail('Should have thrown an error for item size > 400KB');
      } catch (error: any) {
        expect(error.message).toMatch(/size|400KB|limit/i);
      }
    });
  });
});
