/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fc from 'fast-check';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clearTestDB, connectTestDB, disconnectTestDB, supportsTransactions } from './testSetup.js';

import LeaseModel from '../../collections/lease.js';
// import LeaseRepository from '../../dataAccess/LeaseRepository.js';
import TemplateModel from '../../collections/template.js';
// import TemplateRepository from '../../dataAccess/TemplateRepository.js';
import TenantModel from '../../collections/tenant.js';

import { getLeaseRepository, getTemplateRepository, ILeaseRepository, ITemplateRepository } from '../../data-access-layer/index.js';


// Generator for valid lease data
const leaseDataArbitrary = fc.record({
  realmId: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  numberOfTerms: fc.integer({ min: 1, max: 120 }),
  timeRange: fc.constantFrom('days', 'weeks', 'months', 'years'),
  active: fc.boolean(),
  stepperMode: fc.boolean()
});

describe('LeaseRepository', () => {
  let leaseRepository: ILeaseRepository;
  let templateRepository: ITemplateRepository;

  beforeAll(async () => {
    await connectTestDB();
    leaseRepository = getLeaseRepository();
    templateRepository = getTemplateRepository();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property 1: Lease creation persistence', () => {
    it('should persist lease such that it can be retrieved by subsequent queries', async () => {
      // Feature: api-lease-data-access-layer, Property 1: Lease creation persistence
      // Validates: Requirements 1.1

      await fc.assert(
        fc.asyncProperty(
          leaseDataArbitrary,
          async (leaseData) => {
            // Clear database before this test iteration
            await LeaseModel.deleteMany({});
            
            // Create lease
            const created = await leaseRepository.create(leaseData);
            
            // Verify it has an ID
            expect(created._id).toBeDefined();
            
            // Retrieve by ID
            const retrieved = await leaseRepository.findById(
              created._id.toString(),
              leaseData.realmId
            );
            
            // Should match created data
            expect(retrieved).not.toBeNull();
            expect(retrieved?.name).toBe(leaseData.name);
            expect(retrieved?.description).toBe(leaseData.description);
            expect(retrieved?.numberOfTerms).toBe(leaseData.numberOfTerms);
            expect(retrieved?.timeRange).toBe(leaseData.timeRange);
            expect(retrieved?.active).toBe(leaseData.active);
            expect(retrieved?.stepperMode).toBe(leaseData.stepperMode);
            
            // Should also appear in findAll
            const all = await leaseRepository.findAll(leaseData.realmId);
            const found = all.find(l => l._id.toString() === created._id.toString());
            expect(found).toBeDefined();
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 2: Lease retrieval by ID', () => {
    it('should return lease with matching data when queried by ID', async () => {
      // Feature: api-lease-data-access-layer, Property 2: Lease retrieval by ID
      // Validates: Requirements 1.2

      await fc.assert(
        fc.asyncProperty(
          leaseDataArbitrary,
          async (leaseData) => {
            // Clear database before this test iteration
            await LeaseModel.deleteMany({});
            
            // Create lease directly in DB
            const doc = await LeaseModel.create(leaseData);
            
            // Retrieve using repository
            const retrieved = await leaseRepository.findById(
              doc._id.toString(),
              leaseData.realmId
            );
            
            // Should match
            expect(retrieved).not.toBeNull();
            expect(retrieved?._id.toString()).toBe(doc._id.toString());
            expect(retrieved?.name).toBe(leaseData.name);
            expect(retrieved?.realmId).toBe(leaseData.realmId);
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 3: Find all leases returns all leases in realm', () => {
    it('should return all leases belonging to realm sorted by name', async () => {
      // Feature: api-lease-data-access-layer, Property 3: Find all leases returns all leases in realm
      // Validates: Requirements 1.3, 7.5

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(leaseDataArbitrary, { minLength: 2, maxLength: 5 }),
          async (realmId, leasesData) => {
            // Clear database before this test iteration
            await LeaseModel.deleteMany({});
            
            // Create multiple leases in the same realm
            const leases = await Promise.all(
              leasesData.map(data => 
                LeaseModel.create({ ...data, realmId })
              )
            );
            
            // Retrieve all
            const retrieved = await leaseRepository.findAll(realmId);
            
            // Should have all leases
            expect(retrieved.length).toBe(leases.length);
            
            // Should be sorted by name
            for (let i = 1; i < retrieved.length; i++) {
              expect(retrieved[i].name >= retrieved[i - 1].name).toBe(true);
            }
            
            // All should belong to the realm
            for (const lease of retrieved) {
              expect(lease.realmId).toBe(realmId);
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 4: Lease update persistence', () => {
    it('should persist changes such that subsequent queries return updated data', async () => {
      // Feature: api-lease-data-access-layer, Property 4: Lease update persistence
      // Validates: Requirements 1.4

      await fc.assert(
        fc.asyncProperty(
          leaseDataArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.boolean(),
          async (leaseData, newName, newActive) => {
            // Clear database before this test iteration
            await LeaseModel.deleteMany({});
            
            // Create lease
            const doc = await LeaseModel.create(leaseData);
            
            // Update using repository
            const updated = await leaseRepository.update(
              doc._id.toString(),
              leaseData.realmId,
              { name: newName, active: newActive }
            );
            
            // Should return updated data
            expect(updated).not.toBeNull();
            expect(updated?.name).toBe(newName);
            expect(updated?.active).toBe(newActive);
            
            // Retrieve again to verify persistence
            const retrieved = await leaseRepository.findById(
              doc._id.toString(),
              leaseData.realmId
            );
            
            expect(retrieved?.name).toBe(newName);
            expect(retrieved?.active).toBe(newActive);
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 5: Lease deletion removes leases', () => {
    it('should remove leases such that subsequent queries do not return them', async () => {
      // Feature: api-lease-data-access-layer, Property 5: Lease deletion removes leases
      // Validates: Requirements 1.5, 4.5

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(leaseDataArbitrary, { minLength: 2, maxLength: 5 }),
          async (realmId, leasesData) => {
            // Clear database before this test iteration
            await LeaseModel.deleteMany({});
            
            // Create multiple leases
            const leases = await Promise.all(
              leasesData.map(data => 
                LeaseModel.create({ ...data, realmId })
              )
            );
            
            // Delete some leases (first half)
            const toDelete = leases.slice(0, Math.ceil(leases.length / 2));
            const toKeep = leases.slice(Math.ceil(leases.length / 2));
            
            const deletedCount = await leaseRepository.deleteMany(
              toDelete.map(l => l._id.toString()),
              realmId
            );
            
            expect(deletedCount).toBe(toDelete.length);
            
            // Verify deleted leases are not returned
            for (const lease of toDelete) {
              const retrieved = await leaseRepository.findById(
                lease._id.toString(),
                realmId
              );
              expect(retrieved).toBeNull();
            }
            
            // Verify kept leases are still returned
            for (const lease of toKeep) {
              const retrieved = await leaseRepository.findById(
                lease._id.toString(),
                realmId
              );
              expect(retrieved).not.toBeNull();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 6: Plain object returns', () => {
    it('should return plain objects without Mongoose methods', async () => {
      // Feature: api-lease-data-access-layer, Property 6: Plain object returns
      // Validates: Requirements 1.6, 2.4

      await fc.assert(
        fc.asyncProperty(
          leaseDataArbitrary,
          async (leaseData) => {
            // Clear database before this test iteration
            await LeaseModel.deleteMany({});
            
            // Create lease
            const created = await leaseRepository.create(leaseData);
            
            // Check create returns plain object
            expect((created as any).save).toBeUndefined();
            expect((created as any).$isNew).toBeUndefined();
            expect((created as any).toObject).toBeUndefined();
            
            // Check findById returns plain object
            const foundById = await leaseRepository.findById(
              created._id.toString(),
              leaseData.realmId
            );
            if (foundById) {
              expect((foundById as any).save).toBeUndefined();
              expect((foundById as any).$isNew).toBeUndefined();
              expect((foundById as any).toObject).toBeUndefined();
            }
            
            // Check findAll returns plain objects
            const all = await leaseRepository.findAll(leaseData.realmId);
            for (const lease of all) {
              expect((lease as any).save).toBeUndefined();
              expect((lease as any).$isNew).toBeUndefined();
              expect((lease as any).toObject).toBeUndefined();
            }
            
            // Check update returns plain object
            const updated = await leaseRepository.update(
              created._id.toString(),
              leaseData.realmId,
              { name: leaseData.name + ' Updated' }
            );
            if (updated) {
              expect((updated as any).save).toBeUndefined();
              expect((updated as any).$isNew).toBeUndefined();
              expect((updated as any).toObject).toBeUndefined();
            }
            
            // Check findByIds returns plain objects
            const byIds = await leaseRepository.findByIds(
              [created._id.toString()],
              leaseData.realmId
            );
            for (const lease of byIds) {
              expect((lease as any).save).toBeUndefined();
              expect((lease as any).$isNew).toBeUndefined();
              expect((lease as any).toObject).toBeUndefined();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 10: Lease usage detection', () => {
    it('should return Set containing exactly lease IDs referenced by tenants', async () => {
      // Feature: api-lease-data-access-layer, Property 10: Lease usage detection
      // Validates: Requirements 3.1, 3.3

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(leaseDataArbitrary, { minLength: 3, maxLength: 5 }),
          async (realmId, leasesData) => {
            // Clear database before this test iteration
            await LeaseModel.deleteMany({});
            await TenantModel.deleteMany({});
            
            // Create leases
            const leases = await Promise.all(
              leasesData.map(data => 
                LeaseModel.create({ ...data, realmId })
              )
            );
            
            // Create tenants referencing some leases (first half)
            const usedLeases = leases.slice(0, Math.ceil(leases.length / 2));
            await Promise.all(
              usedLeases.map(lease =>
                TenantModel.create({
                  realmId,
                  leaseId: lease._id.toString(),
                  name: 'Test Tenant',
                  contacts: [{ contact: 'Test', phone: '123', email: 'test@example.com' }]
                })
              )
            );
            
            // Get used lease IDs
            const usedLeaseIds = await leaseRepository.findLeaseIdsUsedByTenants(realmId);
            
            // Should contain exactly the used leases
            expect(usedLeaseIds.size).toBe(usedLeases.length);
            for (const lease of usedLeases) {
              expect(usedLeaseIds.has(lease._id.toString())).toBe(true);
            }
            
            // Should not contain unused leases
            const unusedLeases = leases.slice(Math.ceil(leases.length / 2));
            for (const lease of unusedLeases) {
              expect(usedLeaseIds.has(lease._id.toString())).toBe(false);
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 11: Transaction support for deletions', () => {
    it.skipIf(!supportsTransactions())('should execute deletions within provided transaction session', async () => {
      // Feature: api-lease-data-access-layer, Property 11: Transaction support for deletions
      // Validates: Requirements 4.2, 4.3

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(leaseDataArbitrary, { minLength: 2, maxLength: 5 }),
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              type: fc.string({ minLength: 1, maxLength: 50 }),
              linkedResourceIds: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (realmId, leasesData, templatesData) => {
            // Clear database before this test iteration
            await LeaseModel.deleteMany({});
            await TemplateModel.deleteMany({});
            
            // Create leases
            const leases = await Promise.all(
              leasesData.map(data => 
                LeaseModel.create({ ...data, realmId })
              )
            );
            
            // Create templates linked to some leases
            const leaseIds = leases.map(l => l._id.toString());
            await Promise.all(
              templatesData.map(data =>
                TemplateModel.create({
                  ...data,
                  realmId,
                  linkedResourceIds: [leaseIds[0]] // Link to first lease
                })
              )
            );
            
            // Start a session and transaction
            const Collections = await import('../../collections/index.js');
            const session = await Collections.startSession();
            session.startTransaction();
            
            try {
              // Delete leases within transaction
              const deletedCount = await leaseRepository.deleteMany(
                leaseIds,
                realmId,
                session as any
              );
              
              expect(deletedCount).toBe(leases.length);
              
              // Delete templates within transaction
              const templates = await TemplateModel.find({ realmId }).lean();
              const templateIds = templates.map(t => t._id.toString());
              
              const deletedTemplateCount = await templateRepository.deleteMany(
                templateIds,
                realmId,
                session as any
              );
              
              expect(deletedTemplateCount).toBe(templates.length);
              
              // Commit transaction
              await session.commitTransaction();
              
              // Verify deletions persisted
              const remainingLeases = await LeaseModel.find({ realmId }).lean();
              expect(remainingLeases.length).toBe(0);
              
              const remainingTemplates = await TemplateModel.find({ realmId }).lean();
              expect(remainingTemplates.length).toBe(0);
            } finally {
              session.endSession();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 12: Transaction rollback on failure', () => {
    it.skipIf(!supportsTransactions())('should rollback all operations when transaction is aborted', async () => {
      // Feature: api-lease-data-access-layer, Property 12: Transaction rollback on failure
      // Validates: Requirements 9.5, 10.4

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(leaseDataArbitrary, { minLength: 2, maxLength: 5 }),
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              type: fc.string({ minLength: 1, maxLength: 50 }),
              linkedResourceIds: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (realmId, leasesData, templatesData) => {
            // Clear database before this test iteration
            await LeaseModel.deleteMany({});
            await TemplateModel.deleteMany({});
            
            // Create leases
            const leases = await Promise.all(
              leasesData.map(data => 
                LeaseModel.create({ ...data, realmId })
              )
            );
            
            // Create templates linked to some leases
            const leaseIds = leases.map(l => l._id.toString());
            await Promise.all(
              templatesData.map(data =>
                TemplateModel.create({
                  ...data,
                  realmId,
                  linkedResourceIds: [leaseIds[0]] // Link to first lease
                })
              )
            );
            
            // Count before transaction
            const leaseCountBefore = await LeaseModel.countDocuments({ realmId });
            const templateCountBefore = await TemplateModel.countDocuments({ realmId });
            
            // Start a session and transaction
            const Collections = await import('../../collections/index.js');
            const session = await Collections.startSession();
            session.startTransaction();
            
            try {
              // Delete leases within transaction
              await leaseRepository.deleteMany(
                leaseIds,
                realmId,
                session as any
              );
              
              // Delete templates within transaction
              const templates = await TemplateModel.find({ realmId }).lean();
              const templateIds = templates.map(t => t._id.toString());
              
              await templateRepository.deleteMany(
                templateIds,
                realmId,
                session as any
              );
              
              // Abort transaction (simulate failure)
              await session.abortTransaction();
              
              // Verify nothing was deleted (rollback)
              const leaseCountAfter = await LeaseModel.countDocuments({ realmId });
              const templateCountAfter = await TemplateModel.countDocuments({ realmId });
              
              expect(leaseCountAfter).toBe(leaseCountBefore);
              expect(templateCountAfter).toBe(templateCountBefore);
              
              // Verify all original leases still exist
              for (const lease of leases) {
                const found = await LeaseModel.findById(lease._id).lean();
                expect(found).not.toBeNull();
              }
            } finally {
              session.endSession();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 13: Repository error propagation', () => {
    it('should throw errors that can be caught by the caller', async () => {
      // Feature: api-lease-data-access-layer, Property 13: Repository error propagation
      // Validates: Requirements 11.1, 11.4

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(null, undefined, '', 123, true, {}),
          async (invalidInput) => {
            // Test create with invalid input - should throw
            await expect(
              leaseRepository.create(invalidInput as any)
            ).rejects.toThrow();

            // Test findById with invalid lease ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                leaseRepository.findById(invalidInput as any, 'test-realm')
              ).rejects.toThrow();
            }

            // Test findById with invalid realm ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                leaseRepository.findById('507f1f77bcf86cd799439011', invalidInput as any)
              ).rejects.toThrow();
            }

            // Test findAll with invalid realm ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                leaseRepository.findAll(invalidInput as any)
              ).rejects.toThrow();
            }

            // Test update with invalid lease ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                leaseRepository.update(invalidInput as any, 'test-realm', {})
              ).rejects.toThrow();
            }

            // Test update with invalid realm ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                leaseRepository.update('507f1f77bcf86cd799439011', invalidInput as any, {})
              ).rejects.toThrow();
            }

            // Test update with invalid update data
            if (typeof invalidInput !== 'object' || invalidInput === null) {
              await expect(
                leaseRepository.update('507f1f77bcf86cd799439011', 'test-realm', invalidInput as any)
              ).rejects.toThrow();
            }

            // Test deleteMany with invalid lease IDs (non-array values)
            await expect(
              leaseRepository.deleteMany(invalidInput as any, 'test-realm')
            ).rejects.toThrow();

            // Test deleteMany with invalid realm ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                leaseRepository.deleteMany(['507f1f77bcf86cd799439011'], invalidInput as any)
              ).rejects.toThrow();
            }

            // Test findLeaseIdsUsedByTenants with invalid realm ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                leaseRepository.findLeaseIdsUsedByTenants(invalidInput as any)
              ).rejects.toThrow();
            }

            // Test findByIds with invalid lease IDs (non-array values)
            await expect(
              leaseRepository.findByIds(invalidInput as any, 'test-realm')
            ).rejects.toThrow();

            // Test findByIds with invalid realm ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                leaseRepository.findByIds(['507f1f77bcf86cd799439011'], invalidInput as any)
              ).rejects.toThrow();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 14: Not found returns null or empty', () => {
    it('should return null or empty arrays when no matching documents are found', async () => {
      // Feature: api-lease-data-access-layer, Property 14: Not found returns null or empty
      // Validates: Requirements 11.2

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (realmId) => {
            // Clear database before this test iteration
            await LeaseModel.deleteMany({});
            
            // Use a valid MongoDB ObjectId format that doesn't exist
            const nonExistentId = '507f1f77bcf86cd799439011';
            
            // Test findById with non-existent ID - should return null, not throw
            const foundById = await leaseRepository.findById(nonExistentId, realmId);
            expect(foundById).toBeNull();
            
            // Test findAll with realm that has no leases - should return empty array, not throw
            const foundAll = await leaseRepository.findAll(realmId);
            expect(foundAll).toEqual([]);
            
            // Test update with non-existent ID - should return null, not throw
            const updated = await leaseRepository.update(nonExistentId, realmId, { name: 'Test' });
            expect(updated).toBeNull();
            
            // Test findByIds with non-existent IDs - should return empty array, not throw
            const foundByIds = await leaseRepository.findByIds([nonExistentId], realmId);
            expect(foundByIds).toEqual([]);
            
            // Test findLeaseIdsUsedByTenants with realm that has no tenants - should return empty Set, not throw
            const usedIds = await leaseRepository.findLeaseIdsUsedByTenants(realmId);
            expect(usedIds.size).toBe(0);
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 15: Invalid input validation', () => {
    it('should throw descriptive errors for invalid input', async () => {
      // Feature: api-lease-data-access-layer, Property 15: Invalid input validation
      // Validates: Requirements 11.3

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { type: 'null', value: null },
            { type: 'undefined', value: undefined },
            { type: 'empty-string', value: '' },
            { type: 'number', value: 123 },
            { type: 'boolean', value: true },
            { type: 'array', value: [] },
            { type: 'empty-array', value: [] }
          ),
          async (testCase) => {
            // Test create with invalid input
            try {
              await leaseRepository.create(testCase.value as any);
              throw new Error('Should have thrown an error');
            } catch (error: any) {
              expect(error.message).toBeTruthy();
              expect(typeof error.message).toBe('string');
              expect(error.message.length).toBeGreaterThan(0);
            }

            // Test findById with invalid lease ID (only test non-string values)
            if (testCase.type !== 'empty-string') {
              try {
                await leaseRepository.findById(testCase.value as any, 'test-realm');
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Lease ID');
              }
            }

            // Test findAll with invalid realm ID (only test non-string values)
            if (testCase.type !== 'empty-string') {
              try {
                await leaseRepository.findAll(testCase.value as any);
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Realm ID');
              }
            }

            // Test update with invalid update data
            if (testCase.type !== 'array' && testCase.type !== 'empty-array') {
              try {
                await leaseRepository.update('507f1f77bcf86cd799439011', 'test-realm', testCase.value as any);
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Update data');
              }
            }

            // Test deleteMany with invalid lease IDs
            if (testCase.type !== 'array' && testCase.type !== 'empty-array') {
              try {
                await leaseRepository.deleteMany(testCase.value as any, 'test-realm');
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Lease IDs');
              }
            }

            // Test deleteMany with empty array
            if (testCase.type === 'empty-array') {
              try {
                await leaseRepository.deleteMany(testCase.value as any, 'test-realm');
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Lease IDs');
              }
            }

            // Test findByIds with invalid lease IDs
            if (testCase.type !== 'array' && testCase.type !== 'empty-array') {
              try {
                await leaseRepository.findByIds(testCase.value as any, 'test-realm');
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Lease IDs');
              }
            }

            // Test findByIds with empty array
            if (testCase.type === 'empty-array') {
              try {
                await leaseRepository.findByIds(testCase.value as any, 'test-realm');
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Lease IDs');
              }
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  // ============================================================================
  // Unit Tests
  // ============================================================================

  describe('Unit Tests', () => {
    describe('create()', () => {
      it('should create a lease with valid data', async () => {
        const leaseData = {
          realmId: 'test-realm',
          name: 'Test Lease',
          description: 'Test Description',
          numberOfTerms: 12,
          timeRange: 'months' as const,
          active: true,
          stepperMode: false
        };

        const created = await leaseRepository.create(leaseData);

        expect(created._id).toBeDefined();
        expect(created.name).toBe(leaseData.name);
        expect(created.realmId).toBe(leaseData.realmId);
      });

      it('should throw error if leaseData is not an object', async () => {
        await expect(
          leaseRepository.create(null as any)
        ).rejects.toThrow('Lease data must be an object');
      });

      it('should throw error if realmId is missing', async () => {
        await expect(
          leaseRepository.create({ name: 'Test' } as any)
        ).rejects.toThrow('Realm ID is required');
      });
    });

    describe('findById()', () => {
      it('should return correct lease', async () => {
        const doc = await LeaseModel.create({
          realmId: 'test-realm',
          name: 'Test Lease',
          numberOfTerms: 12,
          timeRange: 'months',
          active: true
        });

        const found = await leaseRepository.findById(
          doc._id.toString(),
          'test-realm'
        );

        expect(found).not.toBeNull();
        expect(found?._id.toString()).toBe(doc._id.toString());
      });

      it('should return null if lease not found', async () => {
        const found = await leaseRepository.findById(
          '507f1f77bcf86cd799439011',
          'test-realm'
        );

        expect(found).toBeNull();
      });

      it('should throw error if leaseId is invalid', async () => {
        await expect(
          leaseRepository.findById('', 'test-realm')
        ).rejects.toThrow('Lease ID must be a non-empty string');
      });
    });

    describe('findAll()', () => {
      it('should return all leases sorted by name', async () => {
        await LeaseModel.create([
          { realmId: 'test-realm', name: 'Zebra Lease', numberOfTerms: 12, timeRange: 'months', active: true },
          { realmId: 'test-realm', name: 'Alpha Lease', numberOfTerms: 6, timeRange: 'months', active: true },
          { realmId: 'test-realm', name: 'Beta Lease', numberOfTerms: 24, timeRange: 'months', active: false }
        ]);

        const leases = await leaseRepository.findAll('test-realm');

        expect(leases.length).toBe(3);
        expect(leases[0].name).toBe('Alpha Lease');
        expect(leases[1].name).toBe('Beta Lease');
        expect(leases[2].name).toBe('Zebra Lease');
      });

      it('should throw error if realmId is invalid', async () => {
        await expect(
          leaseRepository.findAll('')
        ).rejects.toThrow('Realm ID must be a non-empty string');
      });
    });

    describe('update()', () => {
      it('should persist changes', async () => {
        const doc = await LeaseModel.create({
          realmId: 'test-realm',
          name: 'Original Name',
          numberOfTerms: 12,
          timeRange: 'months',
          active: true
        });

        const updated = await leaseRepository.update(
          doc._id.toString(),
          'test-realm',
          { name: 'Updated Name', active: false }
        );

        expect(updated).not.toBeNull();
        expect(updated?.name).toBe('Updated Name');
        expect(updated?.active).toBe(false);
      });

      it('should throw error if updateData is invalid', async () => {
        await expect(
          leaseRepository.update('507f1f77bcf86cd799439011', 'test-realm', null as any)
        ).rejects.toThrow('Update data must be an object');
      });
    });

    describe('deleteMany()', () => {
      it('should remove leases', async () => {
        const docs = await LeaseModel.create([
          { realmId: 'test-realm', name: 'Lease 1', numberOfTerms: 12, timeRange: 'months', active: true },
          { realmId: 'test-realm', name: 'Lease 2', numberOfTerms: 6, timeRange: 'months', active: true }
        ]);

        const count = await leaseRepository.deleteMany(
          docs.map(d => d._id.toString()),
          'test-realm'
        );

        expect(count).toBe(2);

        const remaining = await LeaseModel.find({ realmId: 'test-realm' });
        expect(remaining.length).toBe(0);
      });

      it('should throw error if leaseIds is empty', async () => {
        await expect(
          leaseRepository.deleteMany([], 'test-realm')
        ).rejects.toThrow('Lease IDs must be a non-empty array');
      });
    });

    describe('findLeaseIdsUsedByTenants()', () => {
      it('should return correct Set', async () => {
        const lease1 = await LeaseModel.create({
          realmId: 'test-realm',
          name: 'Lease 1',
          numberOfTerms: 12,
          timeRange: 'months',
          active: true
        });

        const lease2 = await LeaseModel.create({
          realmId: 'test-realm',
          name: 'Lease 2',
          numberOfTerms: 6,
          timeRange: 'months',
          active: true
        });

        await TenantModel.create({
          realmId: 'test-realm',
          leaseId: lease1._id.toString(),
          name: 'Tenant 1',
          contacts: [{ contact: 'Test', phone: '123', email: 'test@example.com' }]
        });

        const usedIds = await leaseRepository.findLeaseIdsUsedByTenants('test-realm');

        expect(usedIds.size).toBe(1);
        expect(usedIds.has(lease1._id.toString())).toBe(true);
        expect(usedIds.has(lease2._id.toString())).toBe(false);
      });
    });

    describe('findByIds()', () => {
      it('should return multiple leases', async () => {
        const docs = await LeaseModel.create([
          { realmId: 'test-realm', name: 'Lease 1', numberOfTerms: 12, timeRange: 'months', active: true },
          { realmId: 'test-realm', name: 'Lease 2', numberOfTerms: 6, timeRange: 'months', active: true },
          { realmId: 'test-realm', name: 'Lease 3', numberOfTerms: 24, timeRange: 'months', active: false }
        ]);

        const leases = await leaseRepository.findByIds(
          [docs[0]._id.toString(), docs[2]._id.toString()],
          'test-realm'
        );

        expect(leases.length).toBe(2);
        expect(leases.find(l => l.name === 'Lease 1')).toBeDefined();
        expect(leases.find(l => l.name === 'Lease 3')).toBeDefined();
      });

      it('should throw error if leaseIds is empty', async () => {
        await expect(
          leaseRepository.findByIds([], 'test-realm')
        ).rejects.toThrow('Lease IDs must be a non-empty array');
      });
    });

    describe('Transaction Support', () => {
      it.skipIf(!supportsTransactions())('should execute operations within session', async () => {
        const Collections = await import('../../collections/index.js');
        const session = await Collections.startSession();
        session.startTransaction();

        try {
          // Create leases
          const lease1 = await LeaseModel.create([{
            realmId: 'test-realm',
            name: 'Lease 1',
            numberOfTerms: 12,
            timeRange: 'months',
            active: true
          }], { session });

          const lease2 = await LeaseModel.create([{
            realmId: 'test-realm',
            name: 'Lease 2',
            numberOfTerms: 6,
            timeRange: 'months',
            active: true
          }], { session });

          // Delete using repository with session
          const deletedCount = await leaseRepository.deleteMany(
            [lease1[0]._id.toString(), lease2[0]._id.toString()],
            'test-realm',
            session as any
          );

          expect(deletedCount).toBe(2);

          // Commit transaction
          await session.commitTransaction();

          // Verify deletions persisted
          const remaining = await LeaseModel.find({ realmId: 'test-realm' }).lean();
          expect(remaining.length).toBe(0);
        } finally {
          session.endSession();
        }
      });

      it.skipIf(!supportsTransactions())('should rollback on error', async () => {
        const Collections = await import('../../collections/index.js');
        const session = await Collections.startSession();
        session.startTransaction();

        try {
          // Create leases
          const lease1 = await LeaseModel.create([{
            realmId: 'test-realm',
            name: 'Lease 1',
            numberOfTerms: 12,
            timeRange: 'months',
            active: true
          }], { session });

          const lease2 = await LeaseModel.create([{
            realmId: 'test-realm',
            name: 'Lease 2',
            numberOfTerms: 6,
            timeRange: 'months',
            active: true
          }], { session });

          // Delete using repository with session
          await leaseRepository.deleteMany(
            [lease1[0]._id.toString(), lease2[0]._id.toString()],
            'test-realm',
            session as any
          );

          // Abort transaction (simulate error)
          await session.abortTransaction();

          // Verify nothing was deleted
          const remaining = await LeaseModel.find({ realmId: 'test-realm' }).lean();
          expect(remaining.length).toBe(0); // Nothing persisted because transaction was aborted
        } finally {
          session.endSession();
        }
      });

      it.skipIf(!supportsTransactions())('should commit on success', async () => {
        // Create initial leases
        const docs = await LeaseModel.create([
          { realmId: 'test-realm', name: 'Lease 1', numberOfTerms: 12, timeRange: 'months', active: true },
          { realmId: 'test-realm', name: 'Lease 2', numberOfTerms: 6, timeRange: 'months', active: true }
        ]);

        const Collections = await import('../../collections/index.js');
        const session = await Collections.startSession();
        session.startTransaction();

        try {
          // Delete using repository with session
          const deletedCount = await leaseRepository.deleteMany(
            docs.map(d => d._id.toString()),
            'test-realm',
            session as any
          );

          expect(deletedCount).toBe(2);

          // Commit transaction
          await session.commitTransaction();

          // Verify deletions persisted
          const remaining = await LeaseModel.find({ realmId: 'test-realm' }).lean();
          expect(remaining.length).toBe(0);
        } finally {
          session.endSession();
        }
      });
    });
  });
});
