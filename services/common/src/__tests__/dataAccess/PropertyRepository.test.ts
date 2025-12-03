import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import PropertyRepository from '../../dataAccess/PropertyRepository.js';
import PropertyModel from '../../collections/property.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from './testSetup.js';

// Generator for valid property data
const propertyDataArbitrary = fc.record({
  realmId: fc.string({ minLength: 24, maxLength: 24 }).map(s => s.replace(/[^0-9a-f]/g, '0').toLowerCase()),
  type: fc.constantFrom('apartment', 'house', 'office', 'parking', 'storage'),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.string({ minLength: 0, maxLength: 500 }),
  surface: fc.integer({ min: 1, max: 10000 }),
  phone: fc.string({ minLength: 0, maxLength: 20 }),
  digicode: fc.string({ minLength: 0, maxLength: 20 }),
  address: fc.record({
    street1: fc.string({ minLength: 0, maxLength: 100 }),
    street2: fc.string({ minLength: 0, maxLength: 100 }),
    zipCode: fc.string({ minLength: 0, maxLength: 20 }),
    city: fc.string({ minLength: 0, maxLength: 100 }),
    state: fc.string({ minLength: 0, maxLength: 100 }),
    country: fc.string({ minLength: 0, maxLength: 100 })
  }),
  price: fc.integer({ min: 0, max: 1000000 })
});

describe('PropertyRepository', () => {
  let propertyRepository: PropertyRepository;

  beforeAll(async () => {
    await connectTestDB();
    propertyRepository = new PropertyRepository();
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

  describe('Property 1: Plain object returns', () => {
    it('should return plain objects without Mongoose methods for all operations', async () => {
      // Feature: api-property-data-access-layer, Property 1: Plain object returns
      // Validates: Requirements 2.1

      await fc.assert(
        fc.asyncProperty(
          propertyDataArbitrary,
          async (propertyData) => {
            // Create property
            const created = await propertyRepository.create(propertyData);

            // Verify created property is plain object
            expect((created as any).save).toBeUndefined();
            expect((created as any).$isNew).toBeUndefined();
            expect((created as any).toObject).toBeUndefined();

            // Update property
            const updated = await propertyRepository.update(
              created._id.toString(),
              propertyData.realmId,
              { name: 'Updated Name' }
            );

            // Verify updated property is plain object
            expect(updated).toBeDefined();
            expect((updated as any).save).toBeUndefined();
            expect((updated as any).$isNew).toBeUndefined();
            expect((updated as any).toObject).toBeUndefined();

            // Find by ID
            const foundById = await propertyRepository.findById(
              created._id.toString(),
              propertyData.realmId
            );

            // Verify found property is plain object
            expect(foundById).toBeDefined();
            expect((foundById as any).save).toBeUndefined();
            expect((foundById as any).$isNew).toBeUndefined();
            expect((foundById as any).toObject).toBeUndefined();

            // Find all
            const foundAll = await propertyRepository.findAll(propertyData.realmId);

            // Verify all properties are plain objects
            expect(foundAll.length).toBeGreaterThan(0);
            foundAll.forEach(property => {
              expect((property as any).save).toBeUndefined();
              expect((property as any).$isNew).toBeUndefined();
              expect((property as any).toObject).toBeUndefined();
            });
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 2: RealmId persistence', () => {
    it('should persist realmId so it can be retrieved', async () => {
      // Feature: api-property-data-access-layer, Property 2: RealmId persistence
      // Validates: Requirements 3.1

      await fc.assert(
        fc.asyncProperty(
          propertyDataArbitrary,
          async (propertyData) => {
            // Create property with realmId
            const created = await propertyRepository.create(propertyData);

            // Verify realmId was persisted
            expect(created.realmId).toBe(propertyData.realmId);

            // Retrieve property and verify realmId
            const found = await propertyRepository.findById(
              created._id.toString(),
              propertyData.realmId
            );

            expect(found).toBeDefined();
            expect(found!.realmId).toBe(propertyData.realmId);

            // Verify in findAll
            const allProperties = await propertyRepository.findAll(propertyData.realmId);
            const foundInAll = allProperties.find(p => p._id.toString() === created._id.toString());
            expect(foundInAll).toBeDefined();
            expect(foundInAll!.realmId).toBe(propertyData.realmId);
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 3: Realm-scoped update security', () => {
    it('should not update property when realmId does not match', async () => {
      // Feature: api-property-data-access-layer, Property 3: Realm-scoped update security
      // Validates: Requirements 3.2

      await fc.assert(
        fc.asyncProperty(
          propertyDataArbitrary,
          fc.string({ minLength: 24, maxLength: 24 }).map(s => s.replace(/[^0-9a-f]/g, '0').toLowerCase()),
          async (propertyData, differentRealmId) => {
            // Ensure different realm IDs
            fc.pre(propertyData.realmId !== differentRealmId);

            // Create property in realm A
            const created = await propertyRepository.create(propertyData);

            // Try to update with realm B's ID
            const updated = await propertyRepository.update(
              created._id.toString(),
              differentRealmId,
              { name: 'Hacked Name' }
            );

            // Should return null (not found)
            expect(updated).toBeNull();

            // Verify original property was not modified
            const original = await propertyRepository.findById(
              created._id.toString(),
              propertyData.realmId
            );

            expect(original).toBeDefined();
            expect(original!.name).toBe(propertyData.name);
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 4: Realm-scoped delete security', () => {
    it('should not delete property when realmId does not match', async () => {
      // Feature: api-property-data-access-layer, Property 4: Realm-scoped delete security
      // Validates: Requirements 3.3

      await fc.assert(
        fc.asyncProperty(
          propertyDataArbitrary,
          fc.string({ minLength: 24, maxLength: 24 }).map(s => s.replace(/[^0-9a-f]/g, '0').toLowerCase()),
          async (propertyData, differentRealmId) => {
            // Ensure different realm IDs
            fc.pre(propertyData.realmId !== differentRealmId);

            // Create property in realm A
            const created = await propertyRepository.create(propertyData);

            // Try to delete with realm B's ID
            const deleteCount = await propertyRepository.delete(
              [created._id.toString()],
              differentRealmId
            );

            // Should not delete anything
            expect(deleteCount).toBe(0);

            // Verify property still exists
            const stillExists = await propertyRepository.findById(
              created._id.toString(),
              propertyData.realmId
            );

            expect(stillExists).toBeDefined();
            expect(stillExists!._id.toString()).toBe(created._id.toString());
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 5: Realm-scoped query security', () => {
    it('should not find property when realmId does not match', async () => {
      // Feature: api-property-data-access-layer, Property 5: Realm-scoped query security
      // Validates: Requirements 3.4

      await fc.assert(
        fc.asyncProperty(
          propertyDataArbitrary,
          fc.string({ minLength: 24, maxLength: 24 }).map(s => s.replace(/[^0-9a-f]/g, '0').toLowerCase()),
          async (propertyData, differentRealmId) => {
            // Ensure different realm IDs
            fc.pre(propertyData.realmId !== differentRealmId);

            // Create property in realm A
            const created = await propertyRepository.create(propertyData);

            // Try to find with realm B's ID
            const found = await propertyRepository.findById(
              created._id.toString(),
              differentRealmId
            );

            // Should return null
            expect(found).toBeNull();

            // Verify property exists in correct realm
            const foundInCorrectRealm = await propertyRepository.findById(
              created._id.toString(),
              propertyData.realmId
            );

            expect(foundInCorrectRealm).toBeDefined();
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 6: FindAll sorting', () => {
    it('should return properties sorted by name in ascending order', async () => {
      // Feature: api-property-data-access-layer, Property 6: FindAll sorting
      // Validates: Requirements 3.5

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 24, maxLength: 24 }).map(s => s.replace(/[^0-9a-f]/g, '0').toLowerCase()),
          fc.array(propertyDataArbitrary, { minLength: 2, maxLength: 5 }),
          async (realmId, propertiesData) => {
            // Clear database before this test
            await clearTestDB();

            // Create all properties in the same realm
            const propertiesWithSameRealm = propertiesData.map(p => ({
              ...p,
              realmId: realmId
            }));

            // Create all properties
            for (const propertyData of propertiesWithSameRealm) {
              await propertyRepository.create(propertyData);
            }

            // Find all properties
            const allProperties = await propertyRepository.findAll(realmId);

            // Verify we got all properties
            expect(allProperties.length).toBe(propertiesWithSameRealm.length);

            // Verify sorting by name ascending
            // MongoDB sorts using binary comparison, so we check that each name
            // is less than or equal to the next one
            for (let i = 1; i < allProperties.length; i++) {
              const prevName = allProperties[i - 1].name;
              const currName = allProperties[i].name;
              // Use <= comparison which matches MongoDB's sort behavior
              expect(prevName <= currName).toBe(true);
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 10: Invalid input error handling', () => {
    it('should throw errors for invalid inputs', async () => {
      // Feature: api-property-data-access-layer, Property 10: Invalid input error handling
      // Validates: Requirements 7.1

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(null, undefined, '', 123, [], true),
          async (invalidInput) => {
            // Test create with invalid input
            await expect(
              propertyRepository.create(invalidInput as any)
            ).rejects.toThrow();

            // Test update with invalid property ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                propertyRepository.update(invalidInput as any, '507f1f77bcf86cd799439011', {})
              ).rejects.toThrow();
            }

            // Test update with invalid realm ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                propertyRepository.update('507f1f77bcf86cd799439011', invalidInput as any, {})
              ).rejects.toThrow();
            }

            // Test delete with invalid property IDs
            if (!Array.isArray(invalidInput)) {
              await expect(
                propertyRepository.delete(invalidInput as any, '507f1f77bcf86cd799439011')
              ).rejects.toThrow();
            }

            // Test findById with invalid property ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                propertyRepository.findById(invalidInput as any, '507f1f77bcf86cd799439011')
              ).rejects.toThrow();
            }

            // Test findAll with invalid realm ID (only test non-string values)
            if (typeof invalidInput !== 'string') {
              await expect(
                propertyRepository.findAll(invalidInput as any)
              ).rejects.toThrow();
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 2: PropertyRepository.countByRealmId returns correct count', () => {
    it('should return the exact number of properties in a realm', async () => {
      // Feature: api-dashboard-data-access-layer, Property 2: PropertyRepository.countByRealmId returns correct count
      // Validates: Requirements 2.1, 2.2

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 24, maxLength: 24 }).map(s => s.replace(/[^0-9a-f]/g, '0').toLowerCase()),
          fc.array(propertyDataArbitrary, { minLength: 0, maxLength: 10 }),
          async (realmId, propertiesData) => {
            // Clear database before this test
            await clearTestDB();

            // Create all properties in the same realm
            const propertiesWithSameRealm = propertiesData.map(p => ({
              ...p,
              realmId: realmId
            }));

            // Create all properties
            for (const propertyData of propertiesWithSameRealm) {
              await propertyRepository.create(propertyData);
            }

            // Count properties using countByRealmId
            const count = await propertyRepository.countByRealmId(realmId);

            // Verify count matches the number of properties created
            expect(count).toBe(propertiesWithSameRealm.length);

            // Also verify against findAll for consistency
            const allProperties = await propertyRepository.findAll(realmId);
            expect(count).toBe(allProperties.length);
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  // ============================================================================
  // Unit Tests
  // ============================================================================

  describe('create', () => {
    it('should create property with valid data', async () => {
      const propertyData = {
        realmId: '507f1f77bcf86cd799439011',
        type: 'apartment',
        name: 'Apartment 101',
        description: 'Nice apartment',
        surface: 75,
        phone: '555-1234',
        digicode: '1234',
        address: {
          street1: '123 Main St',
          street2: 'Apt 101',
          zipCode: '12345',
          city: 'New York',
          state: 'NY',
          country: 'USA'
        },
        price: 1200
      };

      const created = await propertyRepository.create(propertyData);

      expect(created).toBeDefined();
      expect(created._id).toBeDefined();
      expect(created.realmId).toBe('507f1f77bcf86cd799439011');
      expect(created.name).toBe('Apartment 101');
      expect(created.type).toBe('apartment');
      expect(created.surface).toBe(75);
      expect(created.price).toBe(1200);

      // Verify it was persisted
      const found = await PropertyModel.findById(created._id).lean();
      expect(found).toBeDefined();
      expect(found!.name).toBe('Apartment 101');
    });

    it('should throw error for invalid data', async () => {
      await expect(propertyRepository.create(null as any)).rejects.toThrow(
        'Property data must be an object'
      );
      await expect(propertyRepository.create(undefined as any)).rejects.toThrow(
        'Property data must be an object'
      );
    });

    it('should throw error for missing realmId', async () => {
      const propertyData = {
        name: 'Test Property',
        type: 'apartment'
      };

      await expect(propertyRepository.create(propertyData as any)).rejects.toThrow(
        'Property data must include realmId'
      );
    });

    it('should return plain object without Mongoose methods', async () => {
      const propertyData = {
        realmId: '507f1f77bcf86cd799439011',
        name: 'Plain Object Property',
        type: 'apartment',
        surface: 50,
        price: 1000
      };

      const created = await propertyRepository.create(propertyData);

      expect(created).toBeDefined();
      expect((created as any).save).toBeUndefined();
      expect((created as any).$isNew).toBeUndefined();
      expect((created as any).toObject).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update property with valid data', async () => {
      const propertyData = {
        realmId: '507f1f77bcf86cd799439011',
        name: 'Original Name',
        type: 'apartment',
        surface: 75,
        price: 1200
      };

      const created = await PropertyModel.create(propertyData);
      const updated = await propertyRepository.update(
        created._id.toString(),
        '507f1f77bcf86cd799439011',
        { name: 'Updated Name', price: 1300 }
      );

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.price).toBe(1300);
      expect(updated!.surface).toBe(75); // Unchanged

      // Verify persistence
      const found = await PropertyModel.findById(created._id).lean();
      expect(found!.name).toBe('Updated Name');
      expect(found!.price).toBe(1300);
    });

    it('should return null for non-existent property', async () => {
      const updated = await propertyRepository.update(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        { name: 'Test' }
      );

      expect(updated).toBeNull();
    });

    it('should return null when realmId does not match', async () => {
      const propertyData = {
        realmId: '507f1f77bcf86cd799439011',
        name: 'Test Property',
        type: 'apartment',
        surface: 75,
        price: 1200
      };

      const created = await PropertyModel.create(propertyData);
      const updated = await propertyRepository.update(
        created._id.toString(),
        '507f1f77bcf86cd799439999', // Different realmId
        { name: 'Updated Name' }
      );

      expect(updated).toBeNull();

      // Verify original property was not updated
      const found = await PropertyModel.findById(created._id).lean();
      expect(found!.name).toBe('Test Property');
    });

    it('should throw error for invalid property ID', async () => {
      await expect(
        propertyRepository.update('', '507f1f77bcf86cd799439011', { name: 'Test' })
      ).rejects.toThrow('Property ID must be a non-empty string');

      await expect(
        propertyRepository.update(null as any, '507f1f77bcf86cd799439011', { name: 'Test' })
      ).rejects.toThrow('Property ID must be a non-empty string');
    });

    it('should throw error for invalid realm ID', async () => {
      await expect(
        propertyRepository.update('507f1f77bcf86cd799439011', '', { name: 'Test' })
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        propertyRepository.update('507f1f77bcf86cd799439011', null as any, { name: 'Test' })
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });

    it('should throw error for invalid update data', async () => {
      await expect(
        propertyRepository.update('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', null as any)
      ).rejects.toThrow('Update data must be an object');

      await expect(
        propertyRepository.update('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', undefined as any)
      ).rejects.toThrow('Update data must be an object');
    });

    it('should return plain object without Mongoose methods', async () => {
      const propertyData = {
        realmId: '507f1f77bcf86cd799439011',
        name: 'Test Property',
        type: 'apartment',
        surface: 75,
        price: 1200
      };

      const created = await PropertyModel.create(propertyData);
      const updated = await propertyRepository.update(
        created._id.toString(),
        '507f1f77bcf86cd799439011',
        { name: 'Updated' }
      );

      expect(updated).toBeDefined();
      expect((updated as any).save).toBeUndefined();
      expect((updated as any).$isNew).toBeUndefined();
      expect((updated as any).toObject).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete properties by IDs', async () => {
      const property1 = await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Property 1',
        type: 'apartment',
        surface: 75,
        price: 1200
      });

      const property2 = await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Property 2',
        type: 'house',
        surface: 150,
        price: 2000
      });

      const count = await propertyRepository.delete(
        [property1._id.toString(), property2._id.toString()],
        '507f1f77bcf86cd799439011'
      );

      expect(count).toBe(2);

      // Verify properties were deleted
      const found1 = await PropertyModel.findById(property1._id);
      const found2 = await PropertyModel.findById(property2._id);
      expect(found1).toBeNull();
      expect(found2).toBeNull();
    });

    it('should not delete properties from different realm', async () => {
      const property1 = await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Property 1',
        type: 'apartment',
        surface: 75,
        price: 1200
      });

      const property2 = await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439012', // Different realm
        name: 'Property 2',
        type: 'house',
        surface: 150,
        price: 2000
      });

      const count = await propertyRepository.delete(
        [property1._id.toString(), property2._id.toString()],
        '507f1f77bcf86cd799439011' // Only realm 1
      );

      expect(count).toBe(1); // Only property1 deleted

      // Verify property1 was deleted but property2 was not
      const found1 = await PropertyModel.findById(property1._id);
      const found2 = await PropertyModel.findById(property2._id);
      expect(found1).toBeNull();
      expect(found2).toBeDefined();
    });

    it('should return 0 when no properties match', async () => {
      const count = await propertyRepository.delete(
        ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        '507f1f77bcf86cd799439013'
      );

      expect(count).toBe(0);
    });

    it('should throw error for invalid property IDs', async () => {
      await expect(
        propertyRepository.delete([], '507f1f77bcf86cd799439011')
      ).rejects.toThrow('Property IDs must be a non-empty array');

      await expect(
        propertyRepository.delete(null as any, '507f1f77bcf86cd799439011')
      ).rejects.toThrow('Property IDs must be a non-empty array');

      await expect(
        propertyRepository.delete('not-an-array' as any, '507f1f77bcf86cd799439011')
      ).rejects.toThrow('Property IDs must be a non-empty array');
    });

    it('should throw error for invalid realm ID', async () => {
      await expect(
        propertyRepository.delete(['507f1f77bcf86cd799439011'], '')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        propertyRepository.delete(['507f1f77bcf86cd799439011'], null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });
  });

  describe('findById', () => {
    it('should find property by ID', async () => {
      const propertyData = {
        realmId: '507f1f77bcf86cd799439011',
        name: 'Test Property',
        type: 'apartment',
        surface: 75,
        price: 1200
      };

      const created = await PropertyModel.create(propertyData);
      const found = await propertyRepository.findById(
        created._id.toString(),
        '507f1f77bcf86cd799439011'
      );

      expect(found).toBeDefined();
      expect(found!._id.toString()).toBe(created._id.toString());
      expect(found!.name).toBe('Test Property');
      expect(found!.realmId).toBe('507f1f77bcf86cd799439011');
    });

    it('should return null for non-existent property', async () => {
      const found = await propertyRepository.findById(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012'
      );

      expect(found).toBeNull();
    });

    it('should return null when realmId does not match', async () => {
      const propertyData = {
        realmId: '507f1f77bcf86cd799439011',
        name: 'Test Property',
        type: 'apartment',
        surface: 75,
        price: 1200
      };

      const created = await PropertyModel.create(propertyData);
      const found = await propertyRepository.findById(
        created._id.toString(),
        '507f1f77bcf86cd799439999' // Different realmId
      );

      expect(found).toBeNull();
    });

    it('should throw error for invalid property ID', async () => {
      await expect(
        propertyRepository.findById('', '507f1f77bcf86cd799439011')
      ).rejects.toThrow('Property ID must be a non-empty string');

      await expect(
        propertyRepository.findById(null as any, '507f1f77bcf86cd799439011')
      ).rejects.toThrow('Property ID must be a non-empty string');
    });

    it('should throw error for invalid realm ID', async () => {
      await expect(
        propertyRepository.findById('507f1f77bcf86cd799439011', '')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        propertyRepository.findById('507f1f77bcf86cd799439011', null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });

    it('should return plain object without Mongoose methods', async () => {
      const propertyData = {
        realmId: '507f1f77bcf86cd799439011',
        name: 'Plain Object Property',
        type: 'apartment',
        surface: 75,
        price: 1200
      };

      const created = await PropertyModel.create(propertyData);
      const found = await propertyRepository.findById(
        created._id.toString(),
        '507f1f77bcf86cd799439011'
      );

      expect(found).toBeDefined();
      expect((found as any).save).toBeUndefined();
      expect((found as any).$isNew).toBeUndefined();
      expect((found as any).toObject).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should find all properties in a realm sorted by name', async () => {
      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Zebra Property',
        type: 'apartment',
        surface: 75,
        price: 1200
      });

      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Alpha Property',
        type: 'house',
        surface: 150,
        price: 2000
      });

      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Beta Property',
        type: 'office',
        surface: 100,
        price: 1500
      });

      const properties = await propertyRepository.findAll('507f1f77bcf86cd799439011');

      expect(properties).toHaveLength(3);
      expect(properties[0].name).toBe('Alpha Property');
      expect(properties[1].name).toBe('Beta Property');
      expect(properties[2].name).toBe('Zebra Property');
    });

    it('should only return properties from specified realm', async () => {
      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Property 1',
        type: 'apartment',
        surface: 75,
        price: 1200
      });

      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439012', // Different realm
        name: 'Property 2',
        type: 'house',
        surface: 150,
        price: 2000
      });

      const properties = await propertyRepository.findAll('507f1f77bcf86cd799439011');

      expect(properties).toHaveLength(1);
      expect(properties[0].name).toBe('Property 1');
      expect(properties[0].realmId).toBe('507f1f77bcf86cd799439011');
    });

    it('should return empty array when no properties found', async () => {
      const properties = await propertyRepository.findAll('507f1f77bcf86cd799439011');

      expect(properties).toEqual([]);
    });

    it('should throw error for invalid realm ID', async () => {
      await expect(
        propertyRepository.findAll('')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        propertyRepository.findAll(null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });

    it('should return plain objects without Mongoose methods', async () => {
      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Test Property',
        type: 'apartment',
        surface: 75,
        price: 1200
      });

      const properties = await propertyRepository.findAll('507f1f77bcf86cd799439011');

      expect(properties).toHaveLength(1);
      expect((properties[0] as any).save).toBeUndefined();
      expect((properties[0] as any).$isNew).toBeUndefined();
      expect((properties[0] as any).toObject).toBeUndefined();
    });
  });

  describe('countByRealmId', () => {
    it('should count properties in a realm with multiple properties', async () => {
      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Property 1',
        type: 'apartment',
        surface: 75,
        price: 1200
      });

      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Property 2',
        type: 'house',
        surface: 150,
        price: 2000
      });

      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Property 3',
        type: 'office',
        surface: 100,
        price: 1500
      });

      const count = await propertyRepository.countByRealmId('507f1f77bcf86cd799439011');

      expect(count).toBe(3);
    });

    it('should return 0 for empty realm', async () => {
      const count = await propertyRepository.countByRealmId('507f1f77bcf86cd799439011');

      expect(count).toBe(0);
    });

    it('should throw error for invalid realmId', async () => {
      await expect(
        propertyRepository.countByRealmId('')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        propertyRepository.countByRealmId(null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        propertyRepository.countByRealmId(undefined as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });

    it('should count only properties in specified realm', async () => {
      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Property 1',
        type: 'apartment',
        surface: 75,
        price: 1200
      });

      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Property 2',
        type: 'house',
        surface: 150,
        price: 2000
      });

      await PropertyModel.create({
        realmId: '507f1f77bcf86cd799439012', // Different realm
        name: 'Property 3',
        type: 'office',
        surface: 100,
        price: 1500
      });

      const count = await propertyRepository.countByRealmId('507f1f77bcf86cd799439011');

      expect(count).toBe(2);
    });

    it('should match count with actual number of properties', async () => {
      const propertyData = [
        {
          realmId: '507f1f77bcf86cd799439011',
          name: 'Property 1',
          type: 'apartment',
          surface: 75,
          price: 1200
        },
        {
          realmId: '507f1f77bcf86cd799439011',
          name: 'Property 2',
          type: 'house',
          surface: 150,
          price: 2000
        },
        {
          realmId: '507f1f77bcf86cd799439011',
          name: 'Property 3',
          type: 'office',
          surface: 100,
          price: 1500
        }
      ];

      for (const data of propertyData) {
        await PropertyModel.create(data);
      }

      const count = await propertyRepository.countByRealmId('507f1f77bcf86cd799439011');
      const allProperties = await propertyRepository.findAll('507f1f77bcf86cd799439011');

      expect(count).toBe(propertyData.length);
      expect(count).toBe(allProperties.length);
    });
  });
});
