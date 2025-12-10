import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import {
  getDocumentRepository,
  getPropertyRepository
} from '../../data-access-layer/index.js';
import {
  clearTestDB,
  connectTestDB,
  disconnectTestDB
} from './testSetup.js';

describe('Batch Operations', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  describe('Property 15: Batch Operation Splitting', () => {
    it('should split operations with more than 25 items into multiple batches', async () => {
      const useDynamoDB = process.env.USE_DYNAMODB === 'true';
      if (!useDynamoDB) {
        // This test is specific to DynamoDB batch operation behavior
        return;
      }

      const documentRepository = getDocumentRepository();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 26, max: 100 }), // Test with > 25 items
          async (realmId, itemCount) => {
            // Clear database before each property test iteration
            await clearTestDB();

            // Create documents
            const documentIds: string[] = [];
            for (let i = 0; i < itemCount; i++) {
              const created = await documentRepository.create({
                realmId,
                tenantId: `tenant-${i}`,
                leaseId: 'lease-1',
                type: 'file',
                name: `document-${i}`
              });
              documentIds.push(created._id);
            }

            // Test batch get with > 25 items - should handle splitting automatically
            const fetchedDocuments = await documentRepository.findByIds(
              documentIds,
              realmId
            );

            // All items should be retrieved despite being split into multiple batches
            expect(fetchedDocuments.length).toBe(itemCount);

            // Verify all document IDs are present
            const fetchedIds = fetchedDocuments.map((doc) => doc._id);
            for (const id of documentIds) {
              expect(fetchedIds).toContain(id);
            }

            // Test batch delete with > 25 items - should handle splitting automatically
            const deletedCount = await documentRepository.deleteMany(
              documentIds,
              realmId
            );

            // All items should be deleted despite being split into multiple batches
            expect(deletedCount).toBe(itemCount);

            // Verify all documents are deleted
            const remainingDocuments = await documentRepository.findByIds(
              documentIds,
              realmId
            );
            expect(remainingDocuments.length).toBe(0);
          }
        ),
        { numRuns: 10, timeout: 60000 } // Fewer runs due to large data volume
      );
    }, 65000);

    it('should handle batch operations with exactly 25 items', async () => {
      const useDynamoDB = process.env.USE_DYNAMODB === 'true';
      if (!useDynamoDB) {
        return;
      }

      const propertyRepository = getPropertyRepository();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (realmId) => {
            await clearTestDB();

            // Create exactly 25 properties
            const propertyIds: string[] = [];
            for (let i = 0; i < 25; i++) {
              const created = await propertyRepository.create({
                realmId,
                name: `property-${i}`,
                type: 'apartment'
              });
              propertyIds.push(created._id);
            }

            // Delete all 25 properties in one batch
            const deletedCount = await propertyRepository.deleteMany(
              propertyIds,
              realmId
            );

            expect(deletedCount).toBe(25);

            // Verify all are deleted
            const remaining = await propertyRepository.findAll(realmId);
            expect(remaining.length).toBe(0);
          }
        ),
        { numRuns: 10, timeout: 30000 }
      );
    }, 35000);

    it('should handle batch operations with less than 25 items', async () => {
      const useDynamoDB = process.env.USE_DYNAMODB === 'true';
      if (!useDynamoDB) {
        return;
      }

      const documentRepository = getDocumentRepository();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 24 }),
          async (realmId, itemCount) => {
            await clearTestDB();

            // Create documents
            const documentIds: string[] = [];
            for (let i = 0; i < itemCount; i++) {
              const created = await documentRepository.create({
                realmId,
                tenantId: `tenant-${i}`,
                leaseId: 'lease-1',
                type: 'file',
                name: `document-${i}`
              });
              documentIds.push(created._id);
            }

            // Batch get with < 25 items
            const fetched = await documentRepository.findByIds(
              documentIds,
              realmId
            );
            expect(fetched.length).toBe(itemCount);

            // Batch delete with < 25 items
            const deleted = await documentRepository.deleteMany(
              documentIds,
              realmId
            );
            expect(deleted).toBe(itemCount);
          }
        ),
        { numRuns: 20, timeout: 30000 }
      );
    }, 35000);
  });
});
