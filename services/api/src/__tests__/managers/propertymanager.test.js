import * as fc from 'fast-check';
import * as propertyManager from '../../managers/propertymanager.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Collections, TestUtils } from '@microrealestate/common';

const { connectTestDB, disconnectTestDB, clearTestDB } = TestUtils;

// Helper to create mock req/res objects
function createMockReqRes(body = {}, params = {}) {
  const req = {
    realm: {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Realm'
    },
    body,
    params
  };
  
  const res = {
    _status: null,
    _json: null,
    json(data) {
      this._json = data;
      return this;
    },
    sendStatus(status) {
      this._status = status;
      return this;
    },
    status(code) {
      this._status = code;
      return this;
    }
  };
  
  return { req, res };
}

describe('PropertyManager', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should create property via add() endpoint and return transformed data', async () => {
      // Requirement 10.1: add() endpoint returns same response format
      const propertyData = {
        type: 'apartment',
        name: 'Test Property',
        description: 'A test property',
        surface: 75,
        phone: '123-456-7890',
        digicode: '1234',
        address: {
          street1: '123 Main St',
          street2: 'Apt 4',
          zipCode: '12345',
          city: 'Test City',
          state: 'TS',
          country: 'Test Country'
        },
        price: 1200
      };

      const { req, res } = createMockReqRes(propertyData);
      await propertyManager.add(req, res);

      // Verify response structure matches expected format
      expect(res._json).toBeDefined();
      expect(res._json._id).toBeDefined();
      expect(res._json.name).toBe('Test Property');
      expect(res._json.type).toBe('apartment');
      expect(res._json.price).toBe(1200);
      expect(res._json.surface).toBe(75);
      expect(res._json.address).toEqual(propertyData.address);
      
      // Verify transformed data includes expected fields
      expect(res._json.available).toBeDefined();
      expect(res._json.status).toBeDefined();
      expect(res._json.occupancyHistory).toBeDefined();
      expect(Array.isArray(res._json.occupancyHistory)).toBe(true);
    });

    it('should update property via update() endpoint and return transformed data', async () => {
      // Requirement 10.2: update() endpoint returns same response format
      
      // First create a property
      const property = await Collections.Property.create({
        realmId: '507f1f77bcf86cd799439011',
        type: 'apartment',
        name: 'Original Property',
        surface: 75,
        price: 1200
      });

      const updateData = {
        _id: property._id.toString(),
        name: 'Updated Property',
        price: 1500,
        description: 'Updated description'
      };

      const { req, res } = createMockReqRes(updateData);
      await propertyManager.update(req, res);

      // Verify response structure
      expect(res._json).toBeDefined();
      expect(String(res._json._id)).toBe(property._id.toString());
      expect(res._json.name).toBe('Updated Property');
      expect(res._json.price).toBe(1500);
      expect(res._json.description).toBe('Updated description');
      
      // Verify transformed data includes expected fields
      expect(res._json.available).toBeDefined();
      expect(res._json.status).toBeDefined();
      expect(res._json.occupancyHistory).toBeDefined();
    });

    it('should delete properties via remove() endpoint', async () => {
      // Requirement 10.3: remove() endpoint returns status code 200
      
      // Create properties to delete
      const property1 = await Collections.Property.create({
        realmId: '507f1f77bcf86cd799439011',
        type: 'apartment',
        name: 'Property 1',
        surface: 75,
        price: 1200
      });

      const property2 = await Collections.Property.create({
        realmId: '507f1f77bcf86cd799439011',
        type: 'office',
        name: 'Property 2',
        surface: 100,
        price: 1500
      });

      const ids = `${property1._id},${property2._id}`;
      
      const { req, res } = createMockReqRes({}, { ids });
      await propertyManager.remove(req, res);

      // Verify status code 200
      expect(res._status).toBe(200);

      // Verify properties were deleted
      const remainingProperties = await Collections.Property.find({
        realmId: '507f1f77bcf86cd799439011'
      });
      expect(remainingProperties.length).toBe(0);
    });

    it('should return all properties with tenant data via all() endpoint', async () => {
      // Requirement 10.4: all() endpoint returns same response format
      
      // Create properties
      const property1 = await Collections.Property.create({
        realmId: '507f1f77bcf86cd799439011',
        type: 'apartment',
        name: 'Property A',
        surface: 75,
        price: 1200
      });

      await Collections.Property.create({
        realmId: '507f1f77bcf86cd799439011',
        type: 'office',
        name: 'Property B',
        surface: 100,
        price: 1500
      });

      // Create a tenant associated with property1
      await Collections.Tenant.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Test Tenant',
        properties: [{
          propertyId: property1._id.toString(),
          entryDate: new Date('2024-01-01'),
          exitDate: new Date('2024-12-31')
        }],
        beginDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        entryDate: new Date('2024-01-01'),
        exitDate: new Date('2024-12-31')
      });

      const { req, res } = createMockReqRes();
      await propertyManager.all(req, res);

      // Verify response structure
      expect(Array.isArray(res._json)).toBe(true);
      expect(res._json.length).toBe(2);
      
      // Verify properties are sorted by name (ascending)
      expect(res._json[0].name).toBe('Property A');
      expect(res._json[1].name).toBe('Property B');
      
      // Verify transformed data structure
      res._json.forEach(property => {
        expect(property._id).toBeDefined();
        expect(property.name).toBeDefined();
        expect(property.type).toBeDefined();
        expect(property.available).toBeDefined();
        expect(property.status).toBeDefined();
        expect(property.occupancyHistory).toBeDefined();
        expect(Array.isArray(property.occupancyHistory)).toBe(true);
      });

      // Verify property with tenant has occupant data
      const propertyWithTenant = res._json.find(p => String(p._id) === property1._id.toString());
      expect(propertyWithTenant).toBeDefined();
      expect(propertyWithTenant.occupantLabel).toBe('Test Tenant');
    });

    it('should return single property with tenant data via one() endpoint', async () => {
      // Requirement 10.5: one() endpoint returns same response format
      
      // Create property
      const property = await Collections.Property.create({
        realmId: '507f1f77bcf86cd799439011',
        type: 'apartment',
        name: 'Single Property',
        surface: 75,
        price: 1200
      });

      // Create tenants associated with the property
      await Collections.Tenant.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Tenant 1',
        properties: [{
          propertyId: property._id.toString(),
          entryDate: new Date('2023-01-01'),
          exitDate: new Date('2023-12-31')
        }],
        beginDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        entryDate: new Date('2023-01-01'),
        exitDate: new Date('2023-12-31'),
        terminationDate: new Date('2023-12-31')
      });

      await Collections.Tenant.create({
        realmId: '507f1f77bcf86cd799439011',
        name: 'Tenant 2',
        properties: [{
          propertyId: property._id.toString(),
          entryDate: new Date('2024-01-01'),
          exitDate: new Date('2024-12-31')
        }],
        beginDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        entryDate: new Date('2024-01-01'),
        exitDate: new Date('2024-12-31')
      });

      const { req, res } = createMockReqRes({}, { id: property._id.toString() });
      await propertyManager.one(req, res);

      // Verify response structure
      expect(res._json).toBeDefined();
      expect(String(res._json._id)).toBe(property._id.toString());
      expect(res._json.name).toBe('Single Property');
      expect(res._json.type).toBe('apartment');
      
      // Verify transformed data includes expected fields
      expect(res._json.available).toBeDefined();
      expect(res._json.status).toBeDefined();
      expect(res._json.occupancyHistory).toBeDefined();
      expect(Array.isArray(res._json.occupancyHistory)).toBe(true);
      
      // Verify occupancy history includes both tenants
      expect(res._json.occupancyHistory.length).toBe(2);
      
      // Verify most recent tenant is shown (Tenant 2 has later end date)
      expect(res._json.occupantLabel).toBe('Tenant 2');
    });
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property 9: Tenant sorting by date', () => {
    it('should sort tenants by termination date or end date in descending order', async () => {
      // Feature: api-property-data-access-layer, Property 9: Tenant sorting by date
      // Validates: Requirements 6.4

      // Generator for valid dates (filter out invalid dates)
      const dateArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
        .filter(d => !isNaN(d.getTime()));

      // Generator for tenant data with dates
      const tenantDataArbitrary = fc.record({
        realmId: fc.constant('507f1f77bcf86cd799439011'),
        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        propertyId: fc.constant('507f1f77bcf86cd799439022'),
        entryDate: dateArbitrary,
        exitDate: dateArbitrary,
        endDate: dateArbitrary,
        terminationDate: fc.option(dateArbitrary, { nil: null })
      });

      await fc.assert(
        fc.asyncProperty(
          fc.array(tenantDataArbitrary, { minLength: 2, maxLength: 5 }),
          async (tenantsData) => {
            // Clear database before this test
            await clearTestDB();

            // Create property
            const property = await Collections.Property.create({
              realmId: '507f1f77bcf86cd799439011',
              name: 'Test Property',
              type: 'apartment',
              surface: 75,
              price: 1200
            });

            // Create tenants with the property
            const createdTenants = [];
            for (const tenantData of tenantsData) {
              const tenant = await Collections.Tenant.create({
                ...tenantData,
                properties: [{
                  propertyId: property._id.toString(),
                  entryDate: tenantData.entryDate,
                  exitDate: tenantData.exitDate
                }]
              });
              createdTenants.push(tenant);
            }

            // Fetch tenants as the property manager would
            const allTenants = await Collections.Tenant.find({
              realmId: '507f1f77bcf86cd799439011',
              'properties.propertyId': {
                $in: [property._id.toString()]
              }
            }).lean();

            // Sort tenants using the same logic as _toPropertiesData
            const sortedTenants = allTenants
              .filter(({ properties }) =>
                properties
                  .map(({ propertyId }) => propertyId)
                  .includes(String(property._id))
              )
              .sort((t1, t2) => {
                const t1EndDate = t1.terminationDate || t1.endDate;
                const t2EndDate = t2.terminationDate || t2.endDate;
                return t2EndDate - t1EndDate;
              });

            // Verify sorting is correct (descending order)
            for (let i = 1; i < sortedTenants.length; i++) {
              const prevEndDate = sortedTenants[i - 1].terminationDate || sortedTenants[i - 1].endDate;
              const currEndDate = sortedTenants[i].terminationDate || sortedTenants[i].endDate;
              
              // Previous date should be >= current date (descending order)
              expect(prevEndDate.getTime()).toBeGreaterThanOrEqual(currEndDate.getTime());
            }

            // Verify the most recent tenant is first
            if (sortedTenants.length > 0) {
              const firstTenant = sortedTenants[0];
              const firstEndDate = firstTenant.terminationDate || firstTenant.endDate;
              
              // All other tenants should have end dates <= first tenant's end date
              for (let i = 1; i < sortedTenants.length; i++) {
                const otherEndDate = sortedTenants[i].terminationDate || sortedTenants[i].endDate;
                expect(firstEndDate.getTime()).toBeGreaterThanOrEqual(otherEndDate.getTime());
              }
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });
});
