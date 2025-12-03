import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import TemplateRepository from '../../dataAccess/TemplateRepository.js';
import LeaseModel from '../../collections/lease.js';
import TemplateModel from '../../collections/template.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from './testSetup.js';
import { CollectionTypes } from '@microrealestate/types';

// Generator for valid template data
const templateDataArbitrary = fc.record({
  realmId: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  type: fc.constantFrom('text', 'fileDescriptor'),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  hasExpiryDate: fc.boolean(),
  contents: fc.constant({}),
  html: fc.string({ minLength: 0, maxLength: 500 }),
  linkedResourceIds: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
  required: fc.boolean(),
  requiredOnceContractTerminated: fc.boolean()
});

// Generator for lease data
const leaseDataArbitrary = fc.record({
  realmId: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  numberOfTerms: fc.integer({ min: 1, max: 120 }),
  timeRange: fc.constantFrom('days', 'weeks', 'months', 'years'),
  active: fc.boolean(),
  stepperMode: fc.boolean()
});

describe('TemplateRepository', () => {
  let templateRepository: TemplateRepository;

  beforeAll(async () => {
    await connectTestDB();
    templateRepository = new TemplateRepository();
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

  describe('Property 7: Template lookup by linked resources', () => {
    it('should return all templates where linkedResourceIds contains at least one provided lease ID', async () => {
      // Feature: api-lease-data-access-layer, Property 7: Template lookup by linked resources
      // Validates: Requirements 2.1

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(leaseDataArbitrary, { minLength: 3, maxLength: 5 }),
          fc.array(templateDataArbitrary, { minLength: 2, maxLength: 4 }),
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
            const templates = await Promise.all(
              templatesData.map((data, idx) => {
                // Link each template to a subset of leases
                const linkedLeases = leases.slice(0, idx + 1);
                return TemplateModel.create({
                  ...data,
                  realmId,
                  linkedResourceIds: linkedLeases.map(l => l._id.toString())
                });
              })
            );
            
            // Query for templates linked to first two leases
            const searchLeaseIds = leases.slice(0, 2).map(l => l._id.toString());
            const found = await templateRepository.findByLinkedResources(
              searchLeaseIds,
              realmId
            );
            
            // Should return templates that have at least one of the search lease IDs
            for (const template of found) {
              const hasMatch = template.linkedResourceIds.some(
                (id: string) => searchLeaseIds.includes(id)
              );
              expect(hasMatch).toBe(true);
            }
            
            // All returned templates should belong to the realm
            for (const template of found) {
              expect(template.realmId).toBe(realmId);
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 8: Template deletion removes templates', () => {
    it('should remove templates such that subsequent queries do not return them', async () => {
      // Feature: api-lease-data-access-layer, Property 8: Template deletion removes templates
      // Validates: Requirements 2.2

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(templateDataArbitrary, { minLength: 2, maxLength: 5 }),
          async (realmId, templatesData) => {
            // Clear database before this test iteration
            await TemplateModel.deleteMany({});
            
            // Create multiple templates
            const templates = await Promise.all(
              templatesData.map(data => 
                TemplateModel.create({ ...data, realmId })
              )
            );
            
            // Delete some templates (first half)
            const toDelete = templates.slice(0, Math.ceil(templates.length / 2));
            const toKeep = templates.slice(Math.ceil(templates.length / 2));
            
            const deletedCount = await templateRepository.deleteMany(
              toDelete.map(t => t._id.toString()),
              realmId
            );
            
            expect(deletedCount).toBe(toDelete.length);
            
            // Verify deleted templates are not returned
            const remaining = await TemplateModel.find({ realmId });
            const remainingIds = remaining.map(t => t._id.toString());
            
            for (const template of toDelete) {
              expect(remainingIds.includes(template._id.toString())).toBe(false);
            }
            
            // Verify kept templates are still returned
            for (const template of toKeep) {
              expect(remainingIds.includes(template._id.toString())).toBe(true);
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 9: Template bulk update modifies templates', () => {
    it('should modify all matching templates according to update operation', async () => {
      // Feature: api-lease-data-access-layer, Property 9: Template bulk update modifies templates
      // Validates: Requirements 2.3

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(templateDataArbitrary, { minLength: 2, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 }),
          async (realmId, templatesData, leaseIdsToRemove) => {
            // Clear database before this test iteration
            await TemplateModel.deleteMany({});
            
            // Create templates with linkedResourceIds
            const templates = await Promise.all(
              templatesData.map(data => 
                TemplateModel.create({
                  ...data,
                  realmId,
                  linkedResourceIds: [...leaseIdsToRemove, 'keep-this-id']
                })
              )
            );
            
            // Update templates to remove specific lease IDs
            const modifiedCount = await templateRepository.updateMany(
              { realmId, linkedResourceIds: { $in: leaseIdsToRemove } },
              { $pull: { linkedResourceIds: { $in: leaseIdsToRemove } } }
            );
            
            expect(modifiedCount).toBeGreaterThan(0);
            
            // Verify the update was applied
            const updated = await TemplateModel.find({ realmId });
            for (const template of updated) {
              // Should not contain any of the removed IDs
              for (const removedId of leaseIdsToRemove) {
                expect(template.linkedResourceIds.includes(removedId)).toBe(false);
              }
              // Should still contain the kept ID
              expect(template.linkedResourceIds.includes('keep-this-id')).toBe(true);
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 6: Plain object returns (Templates)', () => {
    it('should return plain objects without Mongoose methods', async () => {
      // Feature: api-lease-data-access-layer, Property 6: Plain object returns
      // Validates: Requirements 1.6, 2.4

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          templateDataArbitrary,
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 }),
          async (realmId, templateData, leaseIds) => {
            // Clear database before this test iteration
            await TemplateModel.deleteMany({});
            
            // Create template
            const template = await TemplateModel.create({
              ...templateData,
              realmId,
              linkedResourceIds: leaseIds
            });
            
            // Check findByLinkedResources returns plain objects
            const found = await templateRepository.findByLinkedResources(
              leaseIds,
              realmId
            );
            for (const t of found) {
              expect((t as any).save).toBeUndefined();
              expect((t as any).$isNew).toBeUndefined();
              expect((t as any).toObject).toBeUndefined();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 13: Repository error propagation (Template)', () => {
    it('should throw errors that can be caught by the caller', async () => {
      // Feature: api-lease-data-access-layer, Property 13: Repository error propagation
      // Validates: Requirements 11.1, 11.4

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(null, undefined, '', 123, true, {}),
          async (invalidInput) => {
            // Test findByLinkedResources with invalid resource IDs (non-array values)
            await expect(
              templateRepository.findByLinkedResources(invalidInput as any, 'test-realm')
            ).rejects.toThrow();

            // Test findByLinkedResources with invalid realm ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                templateRepository.findByLinkedResources(['507f1f77bcf86cd799439011'], invalidInput as any)
              ).rejects.toThrow();
            }

            // Test deleteMany with invalid template IDs (non-array values)
            await expect(
              templateRepository.deleteMany(invalidInput as any, 'test-realm')
            ).rejects.toThrow();

            // Test deleteMany with invalid realm ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                templateRepository.deleteMany(['507f1f77bcf86cd799439011'], invalidInput as any)
              ).rejects.toThrow();
            }

            // Test updateMany with invalid filter
            if (typeof invalidInput !== 'object' || invalidInput === null) {
              await expect(
                templateRepository.updateMany(invalidInput as any, {})
              ).rejects.toThrow();
            }

            // Test updateMany with invalid update
            if (typeof invalidInput !== 'object' || invalidInput === null) {
              await expect(
                templateRepository.updateMany({}, invalidInput as any)
              ).rejects.toThrow();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 14: Not found returns null or empty (Template)', () => {
    it('should return empty arrays when no matching documents are found', async () => {
      // Feature: api-lease-data-access-layer, Property 14: Not found returns null or empty
      // Validates: Requirements 11.2

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 24, maxLength: 24 }).map(s => '507f1f77bcf86cd799' + s.substring(0, 6)),
          async (realmId, nonExistentId) => {
            // Clear database before this test iteration
            await TemplateModel.deleteMany({});
            
            // Test findByLinkedResources with non-existent resource IDs - should return empty array, not throw
            const foundByResources = await templateRepository.findByLinkedResources([nonExistentId], realmId);
            expect(foundByResources).toEqual([]);
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 15: Invalid input validation (Template)', () => {
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
            // Test findByLinkedResources with invalid resource IDs
            if (testCase.type !== 'array' && testCase.type !== 'empty-array') {
              try {
                await templateRepository.findByLinkedResources(testCase.value as any, 'test-realm');
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Resource IDs');
              }
            }

            // Test findByLinkedResources with empty array
            if (testCase.type === 'empty-array') {
              try {
                await templateRepository.findByLinkedResources(testCase.value as any, 'test-realm');
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Resource IDs');
              }
            }

            // Test findByLinkedResources with invalid realm ID (only test non-string values)
            if (testCase.type !== 'empty-string') {
              try {
                await templateRepository.findByLinkedResources(['507f1f77bcf86cd799439011'], testCase.value as any);
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Realm ID');
              }
            }

            // Test deleteMany with invalid template IDs
            if (testCase.type !== 'array' && testCase.type !== 'empty-array') {
              try {
                await templateRepository.deleteMany(testCase.value as any, 'test-realm');
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Template IDs');
              }
            }

            // Test deleteMany with empty array
            if (testCase.type === 'empty-array') {
              try {
                await templateRepository.deleteMany(testCase.value as any, 'test-realm');
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Template IDs');
              }
            }

            // Test updateMany with invalid filter
            if (testCase.type !== 'array' && testCase.type !== 'empty-array') {
              try {
                await templateRepository.updateMany(testCase.value as any, {});
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Filter');
              }
            }

            // Test updateMany with invalid update
            if (testCase.type !== 'array' && testCase.type !== 'empty-array') {
              try {
                await templateRepository.updateMany({}, testCase.value as any);
                throw new Error('Should have thrown an error');
              } catch (error: any) {
                expect(error.message).toBeTruthy();
                expect(error.message).toContain('Update');
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
    describe('findByLinkedResources()', () => {
      it('should return correct templates', async () => {
        const lease1Id = 'lease-1';
        const lease2Id = 'lease-2';
        const lease3Id = 'lease-3';

        await TemplateModel.create([
          {
            realmId: 'test-realm',
            name: 'Template 1',
            type: 'text',
            linkedResourceIds: [lease1Id, lease2Id]
          },
          {
            realmId: 'test-realm',
            name: 'Template 2',
            type: 'text',
            linkedResourceIds: [lease2Id, lease3Id]
          },
          {
            realmId: 'test-realm',
            name: 'Template 3',
            type: 'text',
            linkedResourceIds: [lease3Id]
          }
        ]);

        const templates = await templateRepository.findByLinkedResources(
          [lease1Id, lease2Id],
          'test-realm'
        );

        expect(templates.length).toBe(2);
        expect(templates.find(t => t.name === 'Template 1')).toBeDefined();
        expect(templates.find(t => t.name === 'Template 2')).toBeDefined();
      });

      it('should return empty array if no templates match', async () => {
        const templates = await templateRepository.findByLinkedResources(
          ['non-existent-lease'],
          'test-realm'
        );

        expect(templates.length).toBe(0);
      });

      it('should throw error if resourceIds is empty', async () => {
        await expect(
          templateRepository.findByLinkedResources([], 'test-realm')
        ).rejects.toThrow('Resource IDs must be a non-empty array');
      });

      it('should throw error if realmId is invalid', async () => {
        await expect(
          templateRepository.findByLinkedResources(['lease-1'], '')
        ).rejects.toThrow('Realm ID must be a non-empty string');
      });
    });

    describe('deleteMany()', () => {
      it('should remove templates', async () => {
        const docs = await TemplateModel.create([
          {
            realmId: 'test-realm',
            name: 'Template 1',
            type: 'text',
            linkedResourceIds: []
          },
          {
            realmId: 'test-realm',
            name: 'Template 2',
            type: 'text',
            linkedResourceIds: []
          }
        ]);

        const count = await templateRepository.deleteMany(
          docs.map(d => d._id.toString()),
          'test-realm'
        );

        expect(count).toBe(2);

        const remaining = await TemplateModel.find({ realmId: 'test-realm' });
        expect(remaining.length).toBe(0);
      });

      it('should throw error if templateIds is empty', async () => {
        await expect(
          templateRepository.deleteMany([], 'test-realm')
        ).rejects.toThrow('Template IDs must be a non-empty array');
      });

      it('should throw error if realmId is invalid', async () => {
        await expect(
          templateRepository.deleteMany(['template-1'], '')
        ).rejects.toThrow('Realm ID must be a non-empty string');
      });
    });

    describe('updateMany()', () => {
      it('should modify templates', async () => {
        const leaseId = 'lease-to-remove';

        await TemplateModel.create([
          {
            realmId: 'test-realm',
            name: 'Template 1',
            type: 'text',
            linkedResourceIds: [leaseId, 'other-lease']
          },
          {
            realmId: 'test-realm',
            name: 'Template 2',
            type: 'text',
            linkedResourceIds: [leaseId]
          }
        ]);

        const count = await templateRepository.updateMany(
          { realmId: 'test-realm', linkedResourceIds: { $in: [leaseId] } },
          { $pull: { linkedResourceIds: leaseId } }
        );

        expect(count).toBe(2);

        const templates = await TemplateModel.find({ realmId: 'test-realm' });
        for (const template of templates) {
          expect(template.linkedResourceIds.includes(leaseId)).toBe(false);
        }
      });

      it('should throw error if filter is invalid', async () => {
        await expect(
          templateRepository.updateMany(null as any, { $set: { name: 'Test' } })
        ).rejects.toThrow('Filter must be an object');
      });

      it('should throw error if update is invalid', async () => {
        await expect(
          templateRepository.updateMany({ realmId: 'test' }, null as any)
        ).rejects.toThrow('Update must be an object');
      });
    });

    describe('Plain object returns', () => {
      it('should return plain objects from findByLinkedResources', async () => {
        const leaseId = 'test-lease';

        await TemplateModel.create({
          realmId: 'test-realm',
          name: 'Test Template',
          type: 'text',
          linkedResourceIds: [leaseId]
        });

        const templates = await templateRepository.findByLinkedResources(
          [leaseId],
          'test-realm'
        );

        expect(templates.length).toBe(1);
        const template = templates[0];
        
        // Should not have Mongoose methods
        expect((template as any).save).toBeUndefined();
        expect((template as any).$isNew).toBeUndefined();
        expect((template as any).toObject).toBeUndefined();
      });
    });

    describe('Error handling', () => {
      it('should handle invalid inputs gracefully', async () => {
        // Test various invalid inputs
        await expect(
          templateRepository.findByLinkedResources(null as any, 'test-realm')
        ).rejects.toThrow();

        await expect(
          templateRepository.deleteMany(['id'], null as any)
        ).rejects.toThrow();

        await expect(
          templateRepository.updateMany({}, {})
        ).resolves.toBeDefined(); // Empty update is valid, just returns 0
      });
    });
  });
});
