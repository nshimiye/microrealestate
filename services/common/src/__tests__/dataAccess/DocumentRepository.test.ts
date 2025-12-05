import * as fc from 'fast-check';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clearTestDB, connectTestDB, disconnectTestDB } from './testSetup.js';

import DocumentModel from '../../collections/document.js';
// import DocumentRepository from '../../dataAccess/DocumentRepository.js';
import { getDocumentRepository, IDocumentRepository } from '../../data-access-layer/index.js';

describe('DocumentRepository', () => {
  let documentRepository: IDocumentRepository;

  beforeAll(async () => {
    await connectTestDB();
    documentRepository = getDocumentRepository();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  // ============================================================================
  // Unit Tests
  // ============================================================================

  describe('findByTenantIds', () => {
    it('should find documents by multiple tenant IDs', async () => {
      const realmId = 'test-realm-123';
      const tenantId1 = 'tenant-1';
      const tenantId2 = 'tenant-2';

      // Create documents for tenant 1
      await DocumentModel.create({
        realmId,
        tenantId: tenantId1,
        leaseId: 'lease-1',
        templateId: 'template-1',
        type: 'file',
        name: 'Document 1',
        description: 'Test document 1'
      });

      await DocumentModel.create({
        realmId,
        tenantId: tenantId1,
        leaseId: 'lease-1',
        templateId: 'template-2',
        type: 'file',
        name: 'Document 2',
        description: 'Test document 2'
      });

      // Create document for tenant 2
      await DocumentModel.create({
        realmId,
        tenantId: tenantId2,
        leaseId: 'lease-2',
        templateId: 'template-1',
        type: 'file',
        name: 'Document 3',
        description: 'Test document 3'
      });

      // Query documents for both tenants
      const documents = await documentRepository.findByTenantIds(
        [tenantId1, tenantId2],
        realmId
      );

      expect(documents).toHaveLength(3);
      expect(documents.map(d => d.tenantId).sort()).toEqual([tenantId1, tenantId1, tenantId2].sort());
    });

    it('should work with projection parameter', async () => {
      const realmId = 'test-realm-456';
      const tenantId = 'tenant-1';

      // Create a document
      await DocumentModel.create({
        realmId,
        tenantId,
        leaseId: 'lease-1',
        templateId: 'template-1',
        type: 'file',
        name: 'Document 1',
        description: 'Test document',
        mimeType: 'application/pdf'
      });

      // Query with projection to get only _id
      const documents = await documentRepository.findByTenantIds(
        [tenantId],
        realmId,
        { _id: 1 }
      );

      expect(documents).toHaveLength(1);
      expect(documents[0]._id).toBeDefined();
      // Other fields should not be present (or be undefined)
      expect(documents[0].name).toBeUndefined();
      expect(documents[0].description).toBeUndefined();
      expect(documents[0].mimeType).toBeUndefined();
    });

    it('should filter by realm ID', async () => {
      const realmId1 = 'realm-1';
      const realmId2 = 'realm-2';
      const tenantId = 'tenant-1';

      // Create document in realm 1
      await DocumentModel.create({
        realmId: realmId1,
        tenantId,
        leaseId: 'lease-1',
        templateId: 'template-1',
        type: 'file',
        name: 'Document in Realm 1',
        description: 'Test'
      });

      // Create document in realm 2
      await DocumentModel.create({
        realmId: realmId2,
        tenantId,
        leaseId: 'lease-2',
        templateId: 'template-1',
        type: 'file',
        name: 'Document in Realm 2',
        description: 'Test'
      });

      // Query realm 1 only
      const documents = await documentRepository.findByTenantIds(
        [tenantId],
        realmId1
      );

      expect(documents).toHaveLength(1);
      expect(documents[0].realmId).toBe(realmId1);
      expect(documents[0].name).toBe('Document in Realm 1');
    });

    it('should return empty array when no documents found', async () => {
      const realmId = 'test-realm-789';
      const tenantId = 'non-existent-tenant';

      const documents = await documentRepository.findByTenantIds(
        [tenantId],
        realmId
      );

      expect(documents).toEqual([]);
    });

    it('should throw error for invalid tenant IDs', async () => {
      const realmId = 'test-realm';

      await expect(
        documentRepository.findByTenantIds([], realmId)
      ).rejects.toThrow('Tenant IDs must be a non-empty array');

      await expect(
        documentRepository.findByTenantIds(null as any, realmId)
      ).rejects.toThrow('Tenant IDs must be a non-empty array');
    });

    it('should throw error for invalid realm ID', async () => {
      const tenantIds = ['tenant-1'];

      await expect(
        documentRepository.findByTenantIds(tenantIds, '')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        documentRepository.findByTenantIds(tenantIds, null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property 9: Document query by tenant IDs', () => {
    it('should return all documents associated with specified tenant IDs in the realm', async () => {
      // Feature: api-occupant-data-access-layer, Property 9: Document query by tenant IDs
      // Validates: Requirements 15.2

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.array(
            fc.record({
              tenantId: fc.string({ minLength: 1, maxLength: 50 }),
              leaseId: fc.string({ minLength: 1, maxLength: 50 }),
              templateId: fc.string({ minLength: 1, maxLength: 50 }),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              description: fc.string({ minLength: 1, maxLength: 200 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (realmId, targetTenantIds, documents) => {
            // Clear database before each property test iteration
            await clearTestDB();

            // Create documents for target tenants
            const targetDocumentIds: string[] = [];
            for (const doc of documents) {
              // Randomly assign to one of the target tenant IDs
              const tenantId = targetTenantIds[Math.floor(Math.random() * targetTenantIds.length)];
              const created = await DocumentModel.create({
                realmId,
                tenantId,
                leaseId: doc.leaseId,
                templateId: doc.templateId,
                type: 'file',
                name: doc.name,
                description: doc.description
              });
              targetDocumentIds.push(created._id.toString());
            }

            // Create some documents for other tenants (not in target list)
            const otherTenantId = 'other-tenant-' + Math.random();
            await DocumentModel.create({
              realmId,
              tenantId: otherTenantId,
              leaseId: 'other-lease',
              templateId: 'other-template',
              type: 'file',
              name: 'Other Document',
              description: 'Should not be returned'
            });

            // Query documents by target tenant IDs
            const results = await documentRepository.findByTenantIds(
              targetTenantIds,
              realmId
            );

            // All returned documents should belong to one of the target tenant IDs
            for (const result of results) {
              expect(targetTenantIds).toContain(result.tenantId);
              expect(result.realmId).toBe(realmId);
            }

            // All created documents for target tenants should be returned
            expect(results.length).toBe(targetDocumentIds.length);

            // Verify all target document IDs are in the results
            const resultIds = results.map(r => r._id.toString());
            for (const targetId of targetDocumentIds) {
              expect(resultIds).toContain(targetId);
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });
});
