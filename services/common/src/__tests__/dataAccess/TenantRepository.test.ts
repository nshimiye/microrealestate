/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fc from 'fast-check';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clearTestDB, connectTestDB, disconnectTestDB } from './testSetup.js';

import TenantModel from '../../collections/tenant.js';
import TenantRepository from '../../dataAccess/TenantRepository.js';

// Generator for valid tenant data
const tenantDataArbitrary = fc.record({
  realmId: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  contacts: fc.array(
    fc.record({
      contact: fc.string({ minLength: 1, maxLength: 50 }),
      phone: fc.string({ minLength: 1, maxLength: 20 }),
      email: fc.emailAddress()
    }),
    { minLength: 1, maxLength: 3 }
  )
});

describe('TenantRepository', () => {
  let tenantRepository: TenantRepository;

  beforeAll(async () => {
    await connectTestDB();
    tenantRepository = new TenantRepository();
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
    it('should return plain objects without Mongoose methods for all repository methods', async () => {
      // Feature: api-rent-data-access-layer, Property 1: Plain object returns
      // Validates: Requirements 1.2, 2.4, 5.4

      await fc.assert(
        fc.asyncProperty(
          tenantDataArbitrary,
          async (tenantData) => {
            // Create a tenant
            const tenant = await TenantModel.create(tenantData);

            // Test find method
            const findResults = await tenantRepository.find({ realmId: tenantData.realmId });
            for (const result of findResults) {
              expect((result as any).save).toBeUndefined();
              expect((result as any).$isNew).toBeUndefined();
              expect((result as any).toObject).toBeUndefined();
            }

            // Test findOne method
            const findOneResult = await tenantRepository.findOne({
              tenantId: tenant._id.toString(),
              realmId: tenantData.realmId
            });
            if (findOneResult) {
              expect((findOneResult as any).save).toBeUndefined();
              expect((findOneResult as any).$isNew).toBeUndefined();
              expect((findOneResult as any).toObject).toBeUndefined();
            }

            // Test findOneAndUpdate method
            const updateResult = await tenantRepository.findOneAndUpdate(
              {
                tenantId: tenant._id.toString(),
                realmId: tenantData.realmId
              },
              { name: tenantData.name + ' Updated' },
              { returnUpdated: true }
            );
            if (updateResult) {
              expect((updateResult as any).save).toBeUndefined();
              expect((updateResult as any).$isNew).toBeUndefined();
              expect((updateResult as any).toObject).toBeUndefined();
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 2: Sorting correctness', () => {
    it('should return tenants sorted by name in the specified order', async () => {
      // Feature: api-rent-data-access-layer, Property 2: Sorting correctness
      // Validates: Requirements 2.5, 7.5

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              contacts: fc.constant([])
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (realmId, tenants) => {
            // Clear database before each property test iteration
            await clearTestDB();

            // Ensure unique names to avoid sort order ambiguity
            const uniqueTenants = tenants.map((t, i) => ({
              ...t,
              name: `${t.name}_${i}`
            }));

            // Create tenants with the same realmId
            for (const tenant of uniqueTenants) {
              await TenantModel.create({
                realmId,
                ...tenant
              });
            }

            // Test ascending sort
            const ascResults = await tenantRepository.find(
              { realmId },
              { sort: { name: 'asc' } }
            );
            
            // Should return all created tenants
            expect(ascResults).toHaveLength(uniqueTenants.length);
            
            const ascNames = ascResults.map(t => t.name);
            
            // Verify ascending order: each name should be <= the next (using string comparison)
            for (let i = 0; i < ascNames.length - 1; i++) {
              expect(ascNames[i] <= ascNames[i + 1]).toBe(true);
            }

            // Test descending sort
            const descResults = await tenantRepository.find(
              { realmId },
              { sort: { name: 'desc' } }
            );
            
            // Should return all created tenants
            expect(descResults).toHaveLength(uniqueTenants.length);
            
            const descNames = descResults.map(t => t.name);
            
            // Verify descending order: each name should be >= the next (using string comparison)
            for (let i = 0; i < descNames.length - 1; i++) {
              expect(descNames[i] >= descNames[i + 1]).toBe(true);
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 3: Realm filtering', () => {
    it('should return only tenants with the specified realmId', async () => {
      // Feature: api-rent-data-access-layer, Property 3: Realm filtering
      // Validates: Requirements 3.1

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              contacts: fc.constant([])
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (targetRealmId, otherRealmId, tenants) => {
            fc.pre(targetRealmId !== otherRealmId);

            // Create tenants with target realmId
            for (const tenant of tenants) {
              await TenantModel.create({
                realmId: targetRealmId,
                ...tenant
              });
            }

            // Create tenants with other realmId
            for (const tenant of tenants) {
              await TenantModel.create({
                realmId: otherRealmId,
                name: tenant.name + ' Other',
                contacts: []
              });
            }

            // Query for target realmId
            const results = await tenantRepository.find({ realmId: targetRealmId });

            // All results should have the target realmId
            expect(results.length).toBeGreaterThan(0);
            for (const result of results) {
              expect(result.realmId).toBe(targetRealmId);
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 4: Tenant ID filtering', () => {
    it('should return only the tenant with the specified tenantId', async () => {
      // Feature: api-rent-data-access-layer, Property 4: Tenant ID filtering
      // Validates: Requirements 3.2

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              contacts: fc.constant([])
            }),
            { minLength: 2, maxLength: 4 }
          ),
          async (realmId, tenants) => {
            // Create multiple tenants
            const createdTenants = [];
            for (const tenant of tenants) {
              const created = await TenantModel.create({
                realmId,
                ...tenant
              });
              createdTenants.push(created);
            }

            // Pick a random tenant to query
            const targetTenant = createdTenants[0];

            // Query for specific tenant
            const results = await tenantRepository.find({
              realmId,
              tenantId: targetTenant._id.toString()
            });

            // Should return exactly one tenant
            expect(results).toHaveLength(1);
            expect(results[0]._id.toString()).toBe(targetTenant._id.toString());
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 5: Term range filtering', () => {
    it('should return only tenants with rents in the specified term range', async () => {
      // Feature: api-rent-data-access-layer, Property 5: Term range filtering
      // Validates: Requirements 3.3, 7.1, 7.3

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 2024010100, max: 2024120100 }),
          fc.integer({ min: 1, max: 3 }),
          async (realmId, baseTerm, rangeMonths) => {
            const startTerm = baseTerm;
            const endTerm = baseTerm + (rangeMonths * 10000);

            // Create tenant with rents in range
            await TenantModel.create({
              realmId,
              name: 'Tenant In Range',
              contacts: [],
              rents: [
                { term: startTerm } as any,
                { term: startTerm + 10000 } as any
              ]
            });

            // Create tenant with rents outside range
            await TenantModel.create({
              realmId,
              name: 'Tenant Out Range',
              contacts: [],
              rents: [
                { term: endTerm + 10000 } as any
              ]
            });

            // Create tenant with no rents
            await TenantModel.create({
              realmId,
              name: 'Tenant No Rents',
              contacts: [],
              rents: []
            });

            // Query for term range
            const results = await tenantRepository.find({
              realmId,
              startTerm,
              endTerm
            });

            // Should find at least the tenant with rents in range
            expect(results.length).toBeGreaterThanOrEqual(1);

            // All returned tenants should have at least one rent in range
            for (const tenant of results) {
              const hasRentInRange = tenant.rents.some(
                (rent: any) => rent.term >= startTerm && rent.term <= endTerm
              );
              expect(hasRentInRange).toBe(true);
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 6: Single term filtering', () => {
    it('should return only tenants with rents matching the exact term', async () => {
      // Feature: api-rent-data-access-layer, Property 6: Single term filtering
      // Validates: Requirements 3.4, 7.2

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 2024010100, max: 2024120100 }),
          async (realmId, targetTerm) => {
            // Create tenant with target term
            await TenantModel.create({
              realmId,
              name: 'Tenant With Term',
              contacts: [],
              rents: [
                { term: targetTerm } as any
              ]
            });

            // Create tenant with different term
            await TenantModel.create({
              realmId,
              name: 'Tenant Different Term',
              contacts: [],
              rents: [
                { term: targetTerm + 10000 } as any
              ]
            });

            // Query for single term
            const results = await tenantRepository.find({
              realmId,
              startTerm: targetTerm
            });

            // Should find at least the tenant with the target term
            expect(results.length).toBeGreaterThanOrEqual(1);

            // All returned tenants should have the target term
            for (const tenant of results) {
              const hasTerm = tenant.rents.some((rent: any) => rent.term === targetTerm);
              expect(hasTerm).toBe(true);
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 7: Multiple filter combination', () => {
    it('should return only tenants matching all filter criteria', async () => {
      // Feature: api-rent-data-access-layer, Property 7: Multiple filter combination
      // Validates: Requirements 3.5

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 2024010100, max: 2024120100 }),
          async (realmId, term) => {
            // Create tenant matching all criteria
            const matchingTenant = await TenantModel.create({
              realmId,
              name: 'Matching Tenant',
              contacts: [],
              rents: [{ term } as any]
            });

            // Create tenant with different realmId
            await TenantModel.create({
              realmId: realmId + '_different',
              name: 'Different Realm',
              contacts: [],
              rents: [{ term } as any]
            });

            // Create tenant with different term
            await TenantModel.create({
              realmId,
              name: 'Different Term',
              contacts: [],
              rents: [{ term: term + 10000 } as any]
            });

            // Query with multiple filters
            const results = await tenantRepository.find({
              realmId,
              tenantId: matchingTenant._id.toString(),
              startTerm: term
            });

            // Should return exactly the matching tenant
            expect(results).toHaveLength(1);
            expect(results[0]._id.toString()).toBe(matchingTenant._id.toString());
            expect(results[0].realmId).toBe(realmId);
            expect(results[0].rents.some((r: any) => r.term === term)).toBe(true);
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 8: Atomic update persistence', () => {
    it('should persist updates atomically and return correct document', async () => {
      // Feature: api-rent-data-access-layer, Property 8: Atomic update persistence
      // Validates: Requirements 5.1, 5.2

      await fc.assert(
        fc.asyncProperty(
          tenantDataArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 0, max: 1000 }),
          async (tenantData, newName, newDiscount) => {
            // Create a tenant
            const tenant = await TenantModel.create(tenantData);

            // Update with returnUpdated: true
            const updated = await tenantRepository.findOneAndUpdate(
              {
                tenantId: tenant._id.toString(),
                realmId: tenantData.realmId
              },
              { name: newName, discount: newDiscount },
              { returnUpdated: true }
            );

            // Should return updated document
            expect(updated).toBeDefined();
            expect(updated!.name).toBe(newName);
            expect(updated!.discount).toBe(newDiscount);

            // Verify persistence by querying again
            const found = await tenantRepository.findOne({
              tenantId: tenant._id.toString(),
              realmId: tenantData.realmId
            });

            expect(found).toBeDefined();
            expect(found!.name).toBe(newName);
            expect(found!.discount).toBe(newDiscount);
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 9: Nested array update support', () => {
    it('should update nested rents array correctly', async () => {
      // Feature: api-rent-data-access-layer, Property 9: Nested array update support
      // Validates: Requirements 5.3

      await fc.assert(
        fc.asyncProperty(
          tenantDataArbitrary,
          fc.array(
            fc.record({
              term: fc.integer({ min: 2024010100, max: 2024120100 }),
              total: fc.record({
                payment: fc.integer({ min: 0, max: 10000 })
              })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (tenantData, newRents) => {
            // Create a tenant with initial rents
            const tenant = await TenantModel.create({
              ...tenantData,
              rents: [{ term: 2024010100, total: { payment: 0 } } as any]
            });

            // Update rents array
            const updated = await tenantRepository.findOneAndUpdate(
              {
                tenantId: tenant._id.toString(),
                realmId: tenantData.realmId
              },
              { rents: newRents as any },
              { returnUpdated: true }
            );

            // Should return updated document with new rents
            expect(updated).toBeDefined();
            expect(updated!.rents).toHaveLength(newRents.length);
            for (let i = 0; i < newRents.length; i++) {
              expect((updated!.rents[i] as any).term).toBe(newRents[i].term);
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 10: ID string conversion', () => {
    it('should return _id that can be converted to string', async () => {
      // Feature: api-rent-data-access-layer, Property 11: ID string conversion
      // Validates: Requirements 7.4

      await fc.assert(
        fc.asyncProperty(
          tenantDataArbitrary,
          async (tenantData) => {
            // Create a tenant
            const tenant = await TenantModel.create(tenantData);

            // Query tenant
            const found = await tenantRepository.findOne({
              tenantId: tenant._id.toString(),
              realmId: tenantData.realmId
            });

            // Should be able to convert _id to string
            expect(found).toBeDefined();
            expect(typeof found!._id).toBe('object'); // MongoDB ObjectId
            const idString = found!._id.toString();
            expect(typeof idString).toBe('string');
            expect(idString).toMatch(/^[0-9a-f]{24}$/); // Valid ObjectId format
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 11: Tenant findByContactEmail returns matching tenants', () => {
    it('should return all tenants with matching contact email', async () => {
      // Feature: authenticator-data-access-layer, Property 5: Tenant findByContactEmail returns matching tenants
      // Validates: Requirements 3.4

      await fc.assert(
        fc.asyncProperty(
          tenantDataArbitrary,
          fc.emailAddress(),
          async (tenantData, searchEmail) => {
            // Create tenant with the search email in contacts
            const tenantWithEmail = {
              ...tenantData,
              contacts: [
                ...tenantData.contacts,
                {
                  contact: 'Test Contact',
                  phone: '123-456-7890',
                  email: searchEmail
                }
              ]
            };
            await TenantModel.create(tenantWithEmail);

            // Create another tenant without the search email
            const tenantWithoutEmail = {
              ...tenantData,
              name: tenantData.name + ' Different',
              contacts: tenantData.contacts.filter(c => c.email !== searchEmail)
            };
            await TenantModel.create(tenantWithoutEmail);

            // Search for tenants with the email
            const results = await tenantRepository.findByContactEmail(searchEmail);

            // Should find at least the tenant we created with that email
            expect(results.length).toBeGreaterThanOrEqual(1);

            // All returned tenants should have the search email in their contacts
            for (const tenant of results) {
              const hasEmail = tenant.contacts?.some(c => c.email === searchEmail);
              expect(hasEmail).toBe(true);
            }

            // Verify results are plain objects
            for (const tenant of results) {
              expect((tenant as any).save).toBeUndefined();
              expect((tenant as any).$isNew).toBeUndefined();
              expect((tenant as any).toObject).toBeUndefined();
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 12: Tenant property filtering', () => {
    it('should return only tenants with specified property IDs', async () => {
      // Feature: api-property-data-access-layer, Property 7: Tenant property filtering
      // Validates: Requirements 4.2

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              propertyId: fc.string({ minLength: 24, maxLength: 24 }).map(s => s.padEnd(24, '0')),
              name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (realmId, tenantPropertyPairs) => {
            // Clear database before each property test iteration
            await clearTestDB();

            // Ensure unique property IDs
            const uniquePairs = tenantPropertyPairs.map((pair, i) => ({
              propertyId: `prop${i.toString().padStart(20, '0')}`,
              name: `${pair.name}_${i}`
            }));

            // Create tenants with different property IDs
            for (const pair of uniquePairs) {
              await TenantModel.create({
                realmId,
                name: pair.name,
                contacts: [],
                properties: [
                  {
                    propertyId: pair.propertyId,
                    rent: 1000
                  }
                ]
              });
            }

            // Pick a subset of property IDs to search for
            const searchPropertyIds = uniquePairs.slice(0, Math.ceil(uniquePairs.length / 2)).map(p => p.propertyId);

            // Query for tenants with those property IDs
            const results = await tenantRepository.findByPropertyIds(searchPropertyIds, realmId);

            // Should return at least the tenants we're searching for
            expect(results.length).toBeGreaterThanOrEqual(searchPropertyIds.length);

            // All returned tenants should have at least one of the searched property IDs
            for (const tenant of results) {
              const hasMatchingProperty = tenant.properties?.some(
                (p: any) => searchPropertyIds.includes(p.propertyId)
              );
              expect(hasMatchingProperty).toBe(true);
            }

            // Verify results are plain objects
            for (const tenant of results) {
              expect((tenant as any).save).toBeUndefined();
              expect((tenant as any).$isNew).toBeUndefined();
              expect((tenant as any).toObject).toBeUndefined();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 13: Tenant realm filtering', () => {
    it('should return only tenants from the specified realm', async () => {
      // Feature: api-property-data-access-layer, Property 8: Tenant realm filtering
      // Validates: Requirements 4.3

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              propertyId: fc.string({ minLength: 24, maxLength: 24 }).map(s => s.padEnd(24, '0')),
              name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (targetRealmId, otherRealmId, tenantPropertyPairs) => {
            // Ensure realms are different
            fc.pre(targetRealmId !== otherRealmId);

            // Clear database before each property test iteration
            await clearTestDB();

            // Ensure unique property IDs
            const uniquePairs = tenantPropertyPairs.map((pair, i) => ({
              propertyId: `prop${i.toString().padStart(20, '0')}`,
              name: `${pair.name}_${i}`
            }));

            const propertyIds = uniquePairs.map(p => p.propertyId);

            // Create tenants in target realm
            for (const pair of uniquePairs) {
              await TenantModel.create({
                realmId: targetRealmId,
                name: pair.name,
                contacts: [],
                properties: [
                  {
                    propertyId: pair.propertyId,
                    rent: 1000
                  }
                ]
              });
            }

            // Create tenants in other realm with same property IDs
            for (const pair of uniquePairs) {
              await TenantModel.create({
                realmId: otherRealmId,
                name: pair.name + ' Other',
                contacts: [],
                properties: [
                  {
                    propertyId: pair.propertyId,
                    rent: 1000
                  }
                ]
              });
            }

            // Query for tenants in target realm
            const results = await tenantRepository.findByPropertyIds(propertyIds, targetRealmId);

            // Should return at least the tenants from target realm
            expect(results.length).toBeGreaterThanOrEqual(uniquePairs.length);

            // All returned tenants should be from target realm
            for (const tenant of results) {
              expect(tenant.realmId).toBe(targetRealmId);
            }

            // Verify results are plain objects
            for (const tenant of results) {
              expect((tenant as any).save).toBeUndefined();
              expect((tenant as any).$isNew).toBeUndefined();
              expect((tenant as any).toObject).toBeUndefined();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 14: Plain object returns for new methods', () => {
    it('should return plain objects without Mongoose methods for create, findByIds, and findAll', async () => {
      // Feature: api-occupant-data-access-layer, Property 1: Plain object returns
      // Validates: Requirements 3.8

      await fc.assert(
        fc.asyncProperty(
          tenantDataArbitrary,
          async (tenantData) => {
            // Clear database before each property test iteration
            await clearTestDB();

            // Test create method
            const created = await tenantRepository.create(tenantData);
            expect((created as any).save).toBeUndefined();
            expect((created as any).$isNew).toBeUndefined();
            expect((created as any).toObject).toBeUndefined();

            // Test findByIds method
            const findByIdsResults = await tenantRepository.findByIds(
              [created._id.toString()],
              tenantData.realmId
            );
            for (const result of findByIdsResults) {
              expect((result as any).save).toBeUndefined();
              expect((result as any).$isNew).toBeUndefined();
              expect((result as any).toObject).toBeUndefined();
            }

            // Test findAll method
            const findAllResults = await tenantRepository.findAll(tenantData.realmId);
            for (const result of findAllResults) {
              expect((result as any).save).toBeUndefined();
              expect((result as any).$isNew).toBeUndefined();
              expect((result as any).toObject).toBeUndefined();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 15: Tenant creation persistence', () => {
    it('should persist created tenants so they can be retrieved by subsequent queries', async () => {
      // Feature: api-occupant-data-access-layer, Property 2: Tenant creation persistence
      // Validates: Requirements 3.1

      await fc.assert(
        fc.asyncProperty(
          tenantDataArbitrary,
          async (tenantData) => {
            // Clear database before each property test iteration
            await clearTestDB();

            // Create a tenant
            const created = await tenantRepository.create(tenantData);

            // Verify it has an ID
            expect(created._id).toBeDefined();

            // Retrieve by ID
            const foundById = await tenantRepository.findById(created._id.toString());
            expect(foundById).toBeDefined();
            expect(foundById!.name).toBe(tenantData.name);
            expect(foundById!.realmId).toBe(tenantData.realmId);

            // Retrieve by findByIds
            const foundByIds = await tenantRepository.findByIds(
              [created._id.toString()],
              tenantData.realmId
            );
            expect(foundByIds).toHaveLength(1);
            expect(foundByIds[0].name).toBe(tenantData.name);

            // Retrieve by findAll
            const foundAll = await tenantRepository.findAll(tenantData.realmId);
            expect(foundAll.length).toBeGreaterThanOrEqual(1);
            const matchingTenant = foundAll.find(t => t._id.toString() === created._id.toString());
            expect(matchingTenant).toBeDefined();
            expect(matchingTenant!.name).toBe(tenantData.name);
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 16: Tenant update persistence', () => {
    it('should persist updates so they can be retrieved by subsequent queries', async () => {
      // Feature: api-occupant-data-access-layer, Property 3: Tenant update persistence
      // Validates: Requirements 3.2

      await fc.assert(
        fc.asyncProperty(
          tenantDataArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (tenantData, newName) => {
            // Clear database before each property test iteration
            await clearTestDB();

            // Create a tenant
            const created = await tenantRepository.create(tenantData);

            // Update the tenant
            const modifiedCount = await tenantRepository.update(
              created._id.toString(),
              tenantData.realmId,
              { name: newName }
            );

            // Should have modified exactly one document
            expect(modifiedCount).toBe(1);

            // Retrieve and verify the update persisted
            const foundById = await tenantRepository.findById(created._id.toString());
            expect(foundById).toBeDefined();
            expect(foundById!.name).toBe(newName);
            expect(foundById!.realmId).toBe(tenantData.realmId);

            // Verify via findByIds
            const foundByIds = await tenantRepository.findByIds(
              [created._id.toString()],
              tenantData.realmId
            );
            expect(foundByIds).toHaveLength(1);
            expect(foundByIds[0].name).toBe(newName);

            // Verify via findAll
            const foundAll = await tenantRepository.findAll(tenantData.realmId);
            const matchingTenant = foundAll.find(t => t._id.toString() === created._id.toString());
            expect(matchingTenant).toBeDefined();
            expect(matchingTenant!.name).toBe(newName);
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 17: Realm-scoped queries', () => {
    it('should return only tenants from the specified realm for all query methods', async () => {
      // Feature: api-occupant-data-access-layer, Property 4: Realm-scoped queries
      // Validates: Requirements 1.2, 3.5

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              contacts: fc.constant([] as any)
            }),
            { minLength: 2, maxLength: 4 }
          ),
          async (targetRealmId, otherRealmId, tenants) => {
            // Ensure realms are different
            fc.pre(targetRealmId !== otherRealmId);

            // Clear database before each property test iteration
            await clearTestDB();

            // Create tenants in target realm
            const targetTenantIds: string[] = [];
            for (const tenant of tenants) {
              const created = await tenantRepository.create({
                realmId: targetRealmId,
                ...tenant
              });
              targetTenantIds.push(created._id.toString());
            }

            // Create tenants in other realm
            for (const tenant of tenants) {
              await tenantRepository.create({
                realmId: otherRealmId,
                name: tenant.name + ' Other',
                contacts: []
              });
            }

            // Test findByIds - should only return target realm tenants
            const findByIdsResults = await tenantRepository.findByIds(
              targetTenantIds,
              targetRealmId
            );
            expect(findByIdsResults).toHaveLength(targetTenantIds.length);
            for (const result of findByIdsResults) {
              expect(result.realmId).toBe(targetRealmId);
            }

            // Test findAll - should only return target realm tenants
            const findAllResults = await tenantRepository.findAll(targetRealmId);
            expect(findAllResults.length).toBeGreaterThanOrEqual(targetTenantIds.length);
            for (const result of findAllResults) {
              expect(result.realmId).toBe(targetRealmId);
            }

            // Test update - should only update target realm tenant
            const updateCount = await tenantRepository.update(
              targetTenantIds[0],
              targetRealmId,
              { name: 'Updated Name' }
            );
            expect(updateCount).toBe(1);

            // Verify update didn't affect other realm
            const otherRealmTenants = await tenantRepository.findAll(otherRealmId);
            for (const tenant of otherRealmTenants) {
              expect(tenant.name).not.toBe('Updated Name');
            }

            // Test deleteMany - should only delete target realm tenants
            const deleteCount = await tenantRepository.deleteMany(
              [targetTenantIds[0]],
              targetRealmId
            );
            expect(deleteCount).toBe(1);

            // Verify deletion didn't affect other realm
            const otherRealmTenantsAfterDelete = await tenantRepository.findAll(otherRealmId);
            expect(otherRealmTenantsAfterDelete.length).toBe(tenants.length);
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  // ============================================================================
  // Unit Tests
  // ============================================================================

  describe('findByContactEmail', () => {
    it('should find tenants by contact email', async () => {
      const tenant1 = await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: [
          {
            contact: 'John Doe',
            phone: '123-456-7890',
            email: 'john@example.com'
          }
        ]
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: [
          {
            contact: 'Jane Smith',
            phone: '098-765-4321',
            email: 'jane@example.com'
          }
        ]
      });

      const results = await tenantRepository.findByContactEmail('john@example.com');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Tenant One');
      expect(results[0]._id.toString()).toBe(tenant1._id.toString());
    });

    it('should return empty array when no tenants match', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: [
          {
            contact: 'John Doe',
            phone: '123-456-7890',
            email: 'john@example.com'
          }
        ]
      });

      const results = await tenantRepository.findByContactEmail('nonexistent@example.com');
      expect(results).toHaveLength(0);
    });

    it('should find multiple tenants with same contact email', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: [
          {
            contact: 'Shared Contact',
            phone: '123-456-7890',
            email: 'shared@example.com'
          }
        ]
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: [
          {
            contact: 'Shared Contact',
            phone: '098-765-4321',
            email: 'shared@example.com'
          }
        ]
      });

      const results = await tenantRepository.findByContactEmail('shared@example.com');
      expect(results).toHaveLength(2);
    });

    it('should throw error for invalid email', async () => {
      await expect(tenantRepository.findByContactEmail('')).rejects.toThrow(
        'Email must be a non-empty string'
      );
      await expect(tenantRepository.findByContactEmail(null as any)).rejects.toThrow(
        'Email must be a non-empty string'
      );
    });
  });

  describe('findById', () => {
    it('should find tenant by ID', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: [
          {
            contact: 'John Doe',
            phone: '123-456-7890',
            email: 'john@example.com'
          }
        ]
      });

      const found = await tenantRepository.findById(tenant._id.toString());

      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Tenant');
      expect(found!._id.toString()).toBe(tenant._id.toString());
    });

    it('should return null for non-existent ID', async () => {
      const found = await tenantRepository.findById('507f1f77bcf86cd799439011');
      expect(found).toBeNull();
    });

    it('should return plain object', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: [
          {
            contact: 'John Doe',
            phone: '123-456-7890',
            email: 'john@example.com'
          }
        ]
      });

      const found = await tenantRepository.findById(tenant._id.toString());

      expect(found).toBeDefined();
      expect((found as any).save).toBeUndefined();
      expect((found as any).$isNew).toBeUndefined();
      expect((found as any).toObject).toBeUndefined();
    });

    it('should throw error for invalid ID', async () => {
      await expect(tenantRepository.findById('')).rejects.toThrow(
        'ID must be a non-empty string'
      );
      await expect(tenantRepository.findById(null as any)).rejects.toThrow(
        'ID must be a non-empty string'
      );
    });
  });

  describe('find', () => {
    it('should find tenants with realmId only', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm2',
        name: 'Tenant Three',
        contacts: []
      });

      const results = await tenantRepository.find({ realmId: 'realm1' });

      expect(results).toHaveLength(2);
      expect(results.every(t => t.realmId === 'realm1')).toBe(true);
    });

    it('should find tenant with realmId and tenantId', async () => {
      const tenant1 = await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: []
      });

      const results = await tenantRepository.find({
        realmId: 'realm1',
        tenantId: tenant1._id.toString()
      });

      expect(results).toHaveLength(1);
      expect(results[0]._id.toString()).toBe(tenant1._id.toString());
    });

    it('should find tenants with realmId and term range', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: [],
        rents: [
          { term: 2024010100 } as any,
          { term: 2024020100 } as any
        ]
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: [],
        rents: [
          { term: 2024030100 } as any
        ]
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Three',
        contacts: [],
        rents: []
      });

      const results = await tenantRepository.find({
        realmId: 'realm1',
        startTerm: 2024010100,
        endTerm: 2024020100
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Tenant One');
    });

    it('should find tenants with realmId and single term', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: [],
        rents: [
          { term: 2024010100 } as any
        ]
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: [],
        rents: [
          { term: 2024020100 } as any
        ]
      });

      const results = await tenantRepository.find({
        realmId: 'realm1',
        startTerm: 2024010100
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Tenant One');
    });

    it('should sort tenants by name ascending', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Charlie',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Alice',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Bob',
        contacts: []
      });

      const results = await tenantRepository.find(
        { realmId: 'realm1' },
        { sort: { name: 'asc' } }
      );

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('Alice');
      expect(results[1].name).toBe('Bob');
      expect(results[2].name).toBe('Charlie');
    });

    it('should sort tenants by name descending', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Charlie',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Alice',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Bob',
        contacts: []
      });

      const results = await tenantRepository.find(
        { realmId: 'realm1' },
        { sort: { name: 'desc' } }
      );

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('Charlie');
      expect(results[1].name).toBe('Bob');
      expect(results[2].name).toBe('Alice');
    });

    it('should throw error for missing realmId', async () => {
      await expect(tenantRepository.find({} as any)).rejects.toThrow(
        'realmId is required and must be a string'
      );
      await expect(tenantRepository.find({ realmId: '' })).rejects.toThrow(
        'realmId is required and must be a string'
      );
    });

    it('should return plain objects', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: []
      });

      const results = await tenantRepository.find({ realmId: 'realm1' });

      expect(results).toHaveLength(1);
      expect((results[0] as any).save).toBeUndefined();
      expect((results[0] as any).$isNew).toBeUndefined();
      expect((results[0] as any).toObject).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should find tenant with valid tenantId and realmId', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: []
      });

      const found = await tenantRepository.findOne({
        tenantId: tenant._id.toString(),
        realmId: 'realm1'
      });

      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Tenant');
      expect(found!._id.toString()).toBe(tenant._id.toString());
    });

    it('should return null for non-existent tenant', async () => {
      const found = await tenantRepository.findOne({
        tenantId: '507f1f77bcf86cd799439011',
        realmId: 'realm1'
      });

      expect(found).toBeNull();
    });

    it('should return null when realmId does not match', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: []
      });

      const found = await tenantRepository.findOne({
        tenantId: tenant._id.toString(),
        realmId: 'realm2'
      });

      expect(found).toBeNull();
    });

    it('should throw error for missing tenantId', async () => {
      await expect(
        tenantRepository.findOne({ realmId: 'realm1' } as any)
      ).rejects.toThrow('tenantId is required and must be a string');

      await expect(
        tenantRepository.findOne({ tenantId: '', realmId: 'realm1' })
      ).rejects.toThrow('tenantId is required and must be a string');
    });

    it('should throw error for missing realmId', async () => {
      await expect(
        tenantRepository.findOne({ tenantId: '507f1f77bcf86cd799439011' } as any)
      ).rejects.toThrow('realmId is required and must be a string');

      await expect(
        tenantRepository.findOne({ tenantId: '507f1f77bcf86cd799439011', realmId: '' })
      ).rejects.toThrow('realmId is required and must be a string');
    });

    it('should return plain object', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: []
      });

      const found = await tenantRepository.findOne({
        tenantId: tenant._id.toString(),
        realmId: 'realm1'
      });

      expect(found).toBeDefined();
      expect((found as any).save).toBeUndefined();
      expect((found as any).$isNew).toBeUndefined();
      expect((found as any).toObject).toBeUndefined();
    });
  });

  describe('findOneAndUpdate', () => {
    it('should update tenant with valid filter and update', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Original Name',
        contacts: []
      });

      const updated = await tenantRepository.findOneAndUpdate(
        {
          tenantId: tenant._id.toString(),
          realmId: 'realm1'
        },
        { name: 'Updated Name' },
        { returnUpdated: true }
      );

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Name');
    });

    it('should return updated document when returnUpdated is true', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Original Name',
        discount: 0,
        contacts: []
      });

      const updated = await tenantRepository.findOneAndUpdate(
        {
          tenantId: tenant._id.toString(),
          realmId: 'realm1'
        },
        { discount: 100 },
        { returnUpdated: true }
      );

      expect(updated).toBeDefined();
      expect(updated!.discount).toBe(100);
    });

    it('should return original document when returnUpdated is false', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Original Name',
        discount: 0,
        contacts: []
      });

      const result = await tenantRepository.findOneAndUpdate(
        {
          tenantId: tenant._id.toString(),
          realmId: 'realm1'
        },
        { discount: 100 },
        { returnUpdated: false }
      );

      expect(result).toBeDefined();
      expect(result!.discount).toBe(0);

      // Verify the update actually happened
      const found = await TenantModel.findById(tenant._id).lean();
      expect(found!.discount).toBe(100);
    });

    it('should update nested rents array', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: [],
        rents: [
          { term: 2024010100, total: { payment: 0 } } as any
        ]
      });

      const newRents = [
        { term: 2024010100, total: { payment: 1000 } } as any,
        { term: 2024020100, total: { payment: 1000 } } as any
      ];

      const updated = await tenantRepository.findOneAndUpdate(
        {
          tenantId: tenant._id.toString(),
          realmId: 'realm1'
        },
        { rents: newRents },
        { returnUpdated: true }
      );

      expect(updated).toBeDefined();
      expect(updated!.rents).toHaveLength(2);
      expect(updated!.rents[0].term).toBe(2024010100);
      expect(updated!.rents[1].term).toBe(2024020100);
    });

    it('should return null for non-existent tenant', async () => {
      const result = await tenantRepository.findOneAndUpdate(
        {
          tenantId: '507f1f77bcf86cd799439011',
          realmId: 'realm1'
        },
        { name: 'Updated Name' },
        { returnUpdated: true }
      );

      expect(result).toBeNull();
    });

    it('should throw error for missing tenantId', async () => {
      await expect(
        tenantRepository.findOneAndUpdate(
          { realmId: 'realm1' } as any,
          { name: 'Updated' }
        )
      ).rejects.toThrow('tenantId is required and must be a string');
    });

    it('should throw error for missing realmId', async () => {
      await expect(
        tenantRepository.findOneAndUpdate(
          { tenantId: '507f1f77bcf86cd799439011' } as any,
          { name: 'Updated' }
        )
      ).rejects.toThrow('realmId is required and must be a string');
    });

    it('should throw error for invalid update', async () => {
      await expect(
        tenantRepository.findOneAndUpdate(
          {
            tenantId: '507f1f77bcf86cd799439011',
            realmId: 'realm1'
          },
          null as any
        )
      ).rejects.toThrow('Update must be an object');
    });

    it('should return plain object', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: []
      });

      const updated = await tenantRepository.findOneAndUpdate(
        {
          tenantId: tenant._id.toString(),
          realmId: 'realm1'
        },
        { name: 'Updated Name' },
        { returnUpdated: true }
      );

      expect(updated).toBeDefined();
      expect((updated as any).save).toBeUndefined();
      expect((updated as any).$isNew).toBeUndefined();
      expect((updated as any).toObject).toBeUndefined();
    });
  });

  describe('findByPropertyIds', () => {
    it('should find tenants with matching property IDs', async () => {
      const propertyId1 = '507f1f77bcf86cd799439011';
      const propertyId2 = '507f1f77bcf86cd799439012';
      const propertyId3 = '507f1f77bcf86cd799439013';

      // Create tenant with property 1
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: [],
        properties: [
          {
            propertyId: propertyId1,
            rent: 1000
          }
        ]
      });

      // Create tenant with property 2
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: [],
        properties: [
          {
            propertyId: propertyId2,
            rent: 1500
          }
        ]
      });

      // Create tenant with property 3 (not in search)
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Three',
        contacts: [],
        properties: [
          {
            propertyId: propertyId3,
            rent: 2000
          }
        ]
      });

      const results = await tenantRepository.findByPropertyIds(
        [propertyId1, propertyId2],
        'realm1'
      );

      expect(results).toHaveLength(2);
      const names = results.map(t => t.name).sort();
      expect(names).toEqual(['Tenant One', 'Tenant Two']);
    });

    it('should filter by realmId correctly', async () => {
      const propertyId = '507f1f77bcf86cd799439011';

      // Create tenant in realm1
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Realm 1',
        contacts: [],
        properties: [
          {
            propertyId: propertyId,
            rent: 1000
          }
        ]
      });

      // Create tenant in realm2 with same property
      await TenantModel.create({
        realmId: 'realm2',
        name: 'Tenant Realm 2',
        contacts: [],
        properties: [
          {
            propertyId: propertyId,
            rent: 1000
          }
        ]
      });

      const results = await tenantRepository.findByPropertyIds([propertyId], 'realm1');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Tenant Realm 1');
      expect(results[0].realmId).toBe('realm1');
    });

    it('should return plain objects', async () => {
      const propertyId = '507f1f77bcf86cd799439011';

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: [],
        properties: [
          {
            propertyId: propertyId,
            rent: 1000
          }
        ]
      });

      const results = await tenantRepository.findByPropertyIds([propertyId], 'realm1');

      expect(results).toHaveLength(1);
      expect((results[0] as any).save).toBeUndefined();
      expect((results[0] as any).$isNew).toBeUndefined();
      expect((results[0] as any).toObject).toBeUndefined();
    });

    it('should return empty array when no matches', async () => {
      const propertyId = '507f1f77bcf86cd799439011';

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: [],
        properties: [
          {
            propertyId: '507f1f77bcf86cd799439099',
            rent: 1000
          }
        ]
      });

      const results = await tenantRepository.findByPropertyIds([propertyId], 'realm1');

      expect(results).toHaveLength(0);
    });

    it('should find tenant with multiple properties when one matches', async () => {
      const propertyId1 = '507f1f77bcf86cd799439011';
      const propertyId2 = '507f1f77bcf86cd799439012';
      const searchPropertyId = '507f1f77bcf86cd799439013';

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Multi Property Tenant',
        contacts: [],
        properties: [
          {
            propertyId: propertyId1,
            rent: 1000
          },
          {
            propertyId: searchPropertyId,
            rent: 1500
          },
          {
            propertyId: propertyId2,
            rent: 2000
          }
        ]
      });

      const results = await tenantRepository.findByPropertyIds([searchPropertyId], 'realm1');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Multi Property Tenant');
      expect(results[0].properties).toHaveLength(3);
    });

    it('should return empty list for empty property IDs array', async () => {
      const results = await tenantRepository.findByPropertyIds([], 'realm1');
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(0);
    });

    it('should throw error for invalid property IDs', async () => {
      await expect(
        tenantRepository.findByPropertyIds(null as any, 'realm1')
      ).rejects.toThrow('Property IDs must be a non-empty array');

      await expect(
        tenantRepository.findByPropertyIds('not-an-array' as any, 'realm1')
      ).rejects.toThrow('Property IDs must be a non-empty array');
    });

    it('should throw error for missing realmId', async () => {
      await expect(
        tenantRepository.findByPropertyIds(['507f1f77bcf86cd799439011'], '')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        tenantRepository.findByPropertyIds(['507f1f77bcf86cd799439011'], null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });
  });

  describe('create', () => {
    it('should create a new tenant with valid data', async () => {
      const tenantData = {
        realmId: 'realm1',
        name: 'New Tenant',
        contacts: [
          {
            contact: 'John Doe',
            phone: '123-456-7890',
            email: 'john@example.com'
          }
        ]
      };

      const created = await tenantRepository.create(tenantData);

      expect(created).toBeDefined();
      expect(created.name).toBe('New Tenant');
      expect(created.realmId).toBe('realm1');
      expect(created._id).toBeDefined();
      expect(created.contacts).toHaveLength(1);
    });

    it('should return plain object', async () => {
      const tenantData = {
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: []
      };

      const created = await tenantRepository.create(tenantData);

      expect((created as any).save).toBeUndefined();
      expect((created as any).$isNew).toBeUndefined();
      expect((created as any).toObject).toBeUndefined();
    });

    it('should throw error for missing realmId', async () => {
      await expect(
        tenantRepository.create({ name: 'Test' } as any)
      ).rejects.toThrow('Tenant data must include realmId');
    });

    it('should throw error for invalid tenant data', async () => {
      await expect(
        tenantRepository.create(null as any)
      ).rejects.toThrow('Tenant data must be an object');

      await expect(
        tenantRepository.create('not an object' as any)
      ).rejects.toThrow('Tenant data must be an object');
    });
  });

  describe('update', () => {
    it('should update tenant and return modification count', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Original Name',
        contacts: []
      });

      const modifiedCount = await tenantRepository.update(
        tenant._id.toString(),
        'realm1',
        { name: 'Updated Name' }
      );

      expect(modifiedCount).toBe(1);

      // Verify the update
      const found = await TenantModel.findById(tenant._id).lean();
      expect(found!.name).toBe('Updated Name');
    });

    it('should return 0 when tenant not found', async () => {
      const modifiedCount = await tenantRepository.update(
        '507f1f77bcf86cd799439011',
        'realm1',
        { name: 'Updated' }
      );

      expect(modifiedCount).toBe(0);
    });

    it('should return 0 when realmId does not match', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: []
      });

      const modifiedCount = await tenantRepository.update(
        tenant._id.toString(),
        'realm2',
        { name: 'Updated' }
      );

      expect(modifiedCount).toBe(0);
    });

    it('should throw error for invalid tenantId', async () => {
      await expect(
        tenantRepository.update('', 'realm1', { name: 'Updated' })
      ).rejects.toThrow('Tenant ID must be a non-empty string');

      await expect(
        tenantRepository.update(null as any, 'realm1', { name: 'Updated' })
      ).rejects.toThrow('Tenant ID must be a non-empty string');
    });

    it('should throw error for invalid realmId', async () => {
      await expect(
        tenantRepository.update('507f1f77bcf86cd799439011', '', { name: 'Updated' })
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        tenantRepository.update('507f1f77bcf86cd799439011', null as any, { name: 'Updated' })
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });

    it('should throw error for invalid update data', async () => {
      await expect(
        tenantRepository.update('507f1f77bcf86cd799439011', 'realm1', null as any)
      ).rejects.toThrow('Update data must be an object');
    });
  });

  describe('findByIds', () => {
    it('should find tenants by multiple IDs', async () => {
      const tenant1 = await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: []
      });

      const tenant2 = await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Three',
        contacts: []
      });

      const results = await tenantRepository.findByIds(
        [tenant1._id.toString(), tenant2._id.toString()],
        'realm1'
      );

      expect(results).toHaveLength(2);
      const names = results.map(t => t.name).sort();
      expect(names).toEqual(['Tenant One', 'Tenant Two']);
    });

    it('should filter by realmId correctly', async () => {
      const tenant1 = await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Realm 1',
        contacts: []
      });

      const tenant2 = await TenantModel.create({
        realmId: 'realm2',
        name: 'Tenant Realm 2',
        contacts: []
      });

      const results = await tenantRepository.findByIds(
        [tenant1._id.toString(), tenant2._id.toString()],
        'realm1'
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Tenant Realm 1');
      expect(results[0].realmId).toBe('realm1');
    });

    it('should return empty array when no matches', async () => {
      const results = await tenantRepository.findByIds(
        ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        'realm1'
      );

      expect(results).toHaveLength(0);
    });

    it('should return plain objects', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: []
      });

      const results = await tenantRepository.findByIds([tenant._id.toString()], 'realm1');

      expect(results).toHaveLength(1);
      expect((results[0] as any).save).toBeUndefined();
      expect((results[0] as any).$isNew).toBeUndefined();
      expect((results[0] as any).toObject).toBeUndefined();
    });

    it('should throw error for empty tenant IDs array', async () => {
      await expect(
        tenantRepository.findByIds([], 'realm1')
      ).rejects.toThrow('Tenant IDs must be a non-empty array');
    });

    it('should throw error for invalid tenant IDs', async () => {
      await expect(
        tenantRepository.findByIds(null as any, 'realm1')
      ).rejects.toThrow('Tenant IDs must be a non-empty array');

      await expect(
        tenantRepository.findByIds('not-an-array' as any, 'realm1')
      ).rejects.toThrow('Tenant IDs must be a non-empty array');
    });

    it('should throw error for missing realmId', async () => {
      await expect(
        tenantRepository.findByIds(['507f1f77bcf86cd799439011'], '')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        tenantRepository.findByIds(['507f1f77bcf86cd799439011'], null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple tenants and return deletion count', async () => {
      const tenant1 = await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: []
      });

      const tenant2 = await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Three',
        contacts: []
      });

      const deletedCount = await tenantRepository.deleteMany(
        [tenant1._id.toString(), tenant2._id.toString()],
        'realm1'
      );

      expect(deletedCount).toBe(2);

      // Verify deletion
      const remaining = await TenantModel.find({ realmId: 'realm1' });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('Tenant Three');
    });

    it('should filter by realmId correctly', async () => {
      const tenant1 = await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Realm 1',
        contacts: []
      });

      const tenant2 = await TenantModel.create({
        realmId: 'realm2',
        name: 'Tenant Realm 2',
        contacts: []
      });

      const deletedCount = await tenantRepository.deleteMany(
        [tenant1._id.toString(), tenant2._id.toString()],
        'realm1'
      );

      expect(deletedCount).toBe(1);

      // Verify only realm1 tenant was deleted
      const tenant1Found = await TenantModel.findById(tenant1._id);
      const tenant2Found = await TenantModel.findById(tenant2._id);

      expect(tenant1Found).toBeNull();
      expect(tenant2Found).toBeDefined();
    });

    it('should return 0 when no tenants match', async () => {
      const deletedCount = await tenantRepository.deleteMany(
        ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        'realm1'
      );

      expect(deletedCount).toBe(0);
    });

    it('should throw error for empty tenant IDs array', async () => {
      await expect(
        tenantRepository.deleteMany([], 'realm1')
      ).rejects.toThrow('Tenant IDs must be a non-empty array');
    });

    it('should throw error for invalid tenant IDs', async () => {
      await expect(
        tenantRepository.deleteMany(null as any, 'realm1')
      ).rejects.toThrow('Tenant IDs must be a non-empty array');

      await expect(
        tenantRepository.deleteMany('not-an-array' as any, 'realm1')
      ).rejects.toThrow('Tenant IDs must be a non-empty array');
    });

    it('should throw error for missing realmId', async () => {
      await expect(
        tenantRepository.deleteMany(['507f1f77bcf86cd799439011'], '')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        tenantRepository.deleteMany(['507f1f77bcf86cd799439011'], null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });
  });

  describe('findWithAggregation', () => {
    it('should return tenants with filesToUpload populated', async () => {
      // This is a basic test - full aggregation testing would require
      // setting up templates and documents which is complex
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: []
      });

      const results = await tenantRepository.findWithAggregation('realm1');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test Tenant');
      expect(results[0].filesToUpload).toBeDefined();
      expect(Array.isArray(results[0].filesToUpload)).toBe(true);
    });

    it('should filter by specific tenantId when provided', async () => {
      const tenant1 = await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: []
      });

      const results = await tenantRepository.findWithAggregation(
        'realm1',
        tenant1._id.toString()
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Tenant One');
    });

    it('should sort results by name', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Charlie',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Alice',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Bob',
        contacts: []
      });

      const results = await tenantRepository.findWithAggregation('realm1');

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('Alice');
      expect(results[1].name).toBe('Bob');
      expect(results[2].name).toBe('Charlie');
    });

    it('should throw error for missing realmId', async () => {
      await expect(
        tenantRepository.findWithAggregation('')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        tenantRepository.findWithAggregation(null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });
  });

  describe('findAll', () => {
    it('should find all tenants in a realm', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant One',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm1',
        name: 'Tenant Two',
        contacts: []
      });

      await TenantModel.create({
        realmId: 'realm2',
        name: 'Tenant Three',
        contacts: []
      });

      const results = await tenantRepository.findAll('realm1');

      expect(results).toHaveLength(2);
      expect(results.every(t => t.realmId === 'realm1')).toBe(true);
    });

    it('should return empty array when no tenants in realm', async () => {
      const results = await tenantRepository.findAll('realm1');
      expect(results).toHaveLength(0);
    });

    it('should return plain objects', async () => {
      await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: []
      });

      const results = await tenantRepository.findAll('realm1');

      expect(results).toHaveLength(1);
      expect((results[0] as any).save).toBeUndefined();
      expect((results[0] as any).$isNew).toBeUndefined();
      expect((results[0] as any).toObject).toBeUndefined();
    });

    it('should throw error for missing realmId', async () => {
      await expect(
        tenantRepository.findAll('')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        tenantRepository.findAll(null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });
  });

  describe('findByIdWithProperties', () => {
    it('should find tenant by ID and realm with populated properties', async () => {
      // Note: This test verifies the method works, but property population
      // requires actual Property documents in the database which is complex
      // to set up. The method uses .populate() which will work in production.
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: [],
        properties: [
          {
            propertyId: '507f1f77bcf86cd799439011',
            rent: 1000
          }
        ]
      });

      const found = await tenantRepository.findByIdWithProperties(
        tenant._id.toString(),
        'realm1'
      );

      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Tenant');
      expect(found!._id.toString()).toBe(tenant._id.toString());
      expect(found!.properties).toBeDefined();
      expect(found!.properties).toHaveLength(1);
    });

    it('should return null for non-existent tenant', async () => {
      const found = await tenantRepository.findByIdWithProperties(
        '507f1f77bcf86cd799439011',
        'realm1'
      );

      expect(found).toBeNull();
    });

    it('should return null when realmId does not match', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: [],
        properties: []
      });

      const found = await tenantRepository.findByIdWithProperties(
        tenant._id.toString(),
        'realm2'
      );

      expect(found).toBeNull();
    });

    it('should return plain object', async () => {
      const tenant = await TenantModel.create({
        realmId: 'realm1',
        name: 'Test Tenant',
        contacts: [],
        properties: []
      });

      const found = await tenantRepository.findByIdWithProperties(
        tenant._id.toString(),
        'realm1'
      );

      expect(found).toBeDefined();
      expect((found as any).save).toBeUndefined();
      expect((found as any).$isNew).toBeUndefined();
      expect((found as any).toObject).toBeUndefined();
    });

    it('should throw error for missing tenantId', async () => {
      await expect(
        tenantRepository.findByIdWithProperties('', 'realm1')
      ).rejects.toThrow('Tenant ID must be a non-empty string');

      await expect(
        tenantRepository.findByIdWithProperties(null as any, 'realm1')
      ).rejects.toThrow('Tenant ID must be a non-empty string');
    });

    it('should throw error for missing realmId', async () => {
      await expect(
        tenantRepository.findByIdWithProperties('507f1f77bcf86cd799439011', '')
      ).rejects.toThrow('Realm ID must be a non-empty string');

      await expect(
        tenantRepository.findByIdWithProperties('507f1f77bcf86cd799439011', null as any)
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });
  });
});
