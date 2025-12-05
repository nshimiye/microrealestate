/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fc from 'fast-check';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clearTestDB, connectTestDB, disconnectTestDB } from './testSetup.js';

import { Locale } from '@microrealestate/types';
import RealmModel from '../../collections/realm.js';
import { getRealmRepository, IRealmRepository } from '../../data-access-layer/index.js';

// Generator for valid realm data
const realmDataArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  members: fc.array(
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      email: fc.emailAddress(),
      role: fc.constantFrom('administrator', 'renter'),
      registered: fc.boolean()
    }),
    { minLength: 0, maxLength: 5 }
  ),
  applications: fc.array(
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      role: fc.constantFrom('administrator', 'renter'),
      clientId: fc.uuid(),
      clientSecret: fc.string({ minLength: 10, maxLength: 50 }),
      createdDate: fc.date({ noInvalidDate: true, min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
      expiryDate: fc.date({ noInvalidDate: true, min: new Date('2000-01-01'), max: new Date('2030-12-31') })
    }),
    { minLength: 0, maxLength: 3 }
  )
});

describe('RealmRepository', () => {
  let realmRepository: IRealmRepository;

  beforeAll(async () => {
    await connectTestDB();
    realmRepository = getRealmRepository();
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

  describe('Property 6: Realm findById returns realm with applications', () => {
    it('should return realm with applications array', async () => {
      // Feature: authenticator-data-access-layer, Property 6: Realm findById returns realm with applications
      // Validates: Requirements 3.5

      await fc.assert(
        fc.asyncProperty(
          realmDataArbitrary,
          async (realmData) => {
            // Create realm
            const created = await RealmModel.create(realmData);

            // Find by ID
            const found = await realmRepository.findById(created._id.toString());

            // Verify realm is returned
            expect(found).toBeDefined();
            expect(found!._id.toString()).toBe(created._id.toString());
            expect(found!.name).toBe(realmData.name);

            // Verify applications array is present
            expect(found!.applications).toBeDefined();
            expect(Array.isArray(found!.applications)).toBe(true);
            expect(found!.applications).toHaveLength(realmData.applications.length);

            // Verify it's a plain object (no Mongoose methods)
            expect((found as any).save).toBeUndefined();
            expect((found as any).$isNew).toBeUndefined();
            expect((found as any).toObject).toBeUndefined();
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 6: Realm findOne returns correct realm', () => {
    it('should return the first realm matching the filter or null', async () => {
      // Feature: api-realm-data-access-layer, Property 6: Realm findOne returns correct realm
      // Validates: Requirements 2.3

      await fc.assert(
        fc.asyncProperty(
          realmDataArbitrary,
          async (realmData) => {
            // Create realm
            const created = await RealmModel.create(realmData);

            // Find by _id filter
            const found = await realmRepository.findOne({ _id: created._id.toString() });

            // Verify realm is returned
            expect(found).toBeDefined();
            expect(found!._id.toString()).toBe(created._id.toString());
            expect(found!.name).toBe(realmData.name);

            // Verify it's a plain object (no Mongoose methods)
            expect((found as any).save).toBeUndefined();
            expect((found as any).$isNew).toBeUndefined();
            expect((found as any).toObject).toBeUndefined();

            // Test non-existent ID returns null
            const notFound = await realmRepository.findOne({ _id: '507f1f77bcf86cd799439011' });
            expect(notFound).toBeNull();
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 2: Realm creation persistence', () => {
    it('should persist realms so they can be retrieved', async () => {
      // Feature: api-realm-data-access-layer, Property 2: Realm creation persistence
      // Validates: Requirements 2.1

      await fc.assert(
        fc.asyncProperty(
          realmDataArbitrary,
          async (realmData) => {
            // Create realm via repository
            const created = await realmRepository.create(realmData);

            // Verify it has an ID
            expect(created._id).toBeDefined();

            // Retrieve by ID using findById
            const foundById = await realmRepository.findById(created._id.toString());
            expect(foundById).toBeDefined();
            expect(foundById!._id.toString()).toBe(created._id.toString());
            expect(foundById!.name).toBe(realmData.name);

            // Retrieve by filter using findOne
            const foundByFilter = await realmRepository.findOne({ _id: created._id.toString() });
            expect(foundByFilter).toBeDefined();
            expect(foundByFilter!._id.toString()).toBe(created._id.toString());
            expect(foundByFilter!.name).toBe(realmData.name);

            // Verify it's a plain object
            expect((created as any).save).toBeUndefined();
            expect((created as any).$isNew).toBeUndefined();
            expect((created as any).toObject).toBeUndefined();
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 4: Application secret hashing (create)', () => {
    it('should hash application client secrets before storing', async () => {
      // Feature: api-realm-data-access-layer, Property 4: Application secret hashing
      // Validates: Requirements 2.5, 5.3

      // Generator for realm data with applications that have plain secrets
      const realmWithAppsArbitrary = fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        members: fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            email: fc.emailAddress(),
            role: fc.constantFrom('administrator', 'renter'),
            registered: fc.boolean()
          }),
          { minLength: 0, maxLength: 3 }
        ),
        applications: fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            role: fc.constantFrom('administrator', 'renter'),
            clientId: fc.uuid(),
            clientSecret: fc.string({ minLength: 10, maxLength: 50 }),
            expiryDate: fc.date({ noInvalidDate: true, min: new Date('2000-01-01'), max: new Date('2030-12-31') })
          }),
          { minLength: 1, maxLength: 3 } // At least 1 application
        )
      });

      await fc.assert(
        fc.asyncProperty(
          realmWithAppsArbitrary,
          async (realmData) => {
            // Store original secrets
            const originalSecrets = realmData.applications.map(app => app.clientSecret);

            // Create realm via repository
            const created = await realmRepository.create(realmData);

            // Verify all application secrets are hashed
            expect(created.applications).toHaveLength(realmData.applications.length);
            
            for (let i = 0; i < created.applications.length; i++) {
              const app = created.applications[i];
              const originalSecret = originalSecrets[i];

              // Secret should not match original
              expect(app.clientSecret).not.toBe(originalSecret);

              // Secret should be a bcrypt hash
              expect(app.clientSecret).toMatch(/^\$2[aby]\$/);

              // createdDate should be set
              expect(app.createdDate).toBeDefined();
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 3: Realm update persistence', () => {
    it('should persist updates so they can be retrieved', async () => {
      // Feature: api-realm-data-access-layer, Property 3: Realm update persistence
      // Validates: Requirements 2.2, 5.1

      // Generator for update data
      const updateDataArbitrary = fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        locale: fc.constantFrom<Locale>('en', 'fr', 'pt-BR'),
        currency: fc.constantFrom('USD', 'EUR', 'GBP')
      });

      await fc.assert(
        fc.asyncProperty(
          realmDataArbitrary,
          updateDataArbitrary,
          async (initialData, updateData) => {
            // Create initial realm
            const created = await realmRepository.create(initialData);

            // Update realm via repository
            const updated = await realmRepository.update(created._id.toString(), updateData);

            // Verify updates are reflected
            expect(updated.name).toBe(updateData.name);
            expect(updated.locale).toBe(updateData.locale);
            expect(updated.currency).toBe(updateData.currency);

            // Retrieve and verify persistence
            const retrieved = await realmRepository.findById(created._id.toString());
            expect(retrieved).toBeDefined();
            expect(retrieved!.name).toBe(updateData.name);
            expect(retrieved!.locale).toBe(updateData.locale);
            expect(retrieved!.currency).toBe(updateData.currency);

            // Verify it's a plain object
            expect((updated as any).save).toBeUndefined();
            expect((updated as any).$isNew).toBeUndefined();
            expect((updated as any).toObject).toBeUndefined();
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 4: Application secret hashing (update)', () => {
    it('should hash new application secrets when updating', async () => {
      // Feature: api-realm-data-access-layer, Property 4: Application secret hashing
      // Validates: Requirements 2.5, 5.3

      // Generator for new applications to add during update
      const newAppsArbitrary = fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          role: fc.constantFrom('administrator', 'renter'),
          clientId: fc.uuid(),
          clientSecret: fc.string({ minLength: 10, maxLength: 50 }),
          expiryDate: fc.date({ noInvalidDate: true, min: new Date('2000-01-01'), max: new Date('2030-12-31') })
        }),
        { minLength: 1, maxLength: 3 }
      );

      await fc.assert(
        fc.asyncProperty(
          realmDataArbitrary,
          newAppsArbitrary,
          async (initialData, newApps) => {
            // Create initial realm (may have existing apps)
            const created = await realmRepository.create(initialData);

            // Store original secrets of new apps
            const originalSecrets = newApps.map(app => app.clientSecret);

            // Update realm with new applications
            const updated = await realmRepository.update(created._id.toString(), {
              applications: newApps
            });

            // Verify all new application secrets are hashed
            expect(updated.applications).toHaveLength(newApps.length);
            
            for (let i = 0; i < updated.applications.length; i++) {
              const app = updated.applications[i];
              const originalSecret = originalSecrets[i];

              // Secret should not match original
              expect(app.clientSecret).not.toBe(originalSecret);

              // Secret should be a bcrypt hash
              expect(app.clientSecret).toMatch(/^\$2[aby]\$/);

              // createdDate should be set
              expect(app.createdDate).toBeDefined();
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

  describe('findById', () => {
    it('should find realm by ID with applications', async () => {
      const realmData = {
        name: 'Test Realm',
        members: [
          {
            name: 'John Doe',
            email: 'john@example.com',
            role: 'administrator',
            registered: true
          }
        ],
        applications: [
          {
            name: 'Test App',
            role: 'administrator',
            clientId: 'test-client-id',
            clientSecret: 'test-secret',
            createdDate: new Date(),
            expiryDate: new Date(Date.now() + 86400000)
          }
        ]
      };

      const created = await RealmModel.create(realmData);
      const found = await realmRepository.findById(created._id.toString());

      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Realm');
      expect(found!.applications).toHaveLength(1);
      expect(found!.applications[0].name).toBe('Test App');
      expect(found!.applications[0].clientId).toBe('test-client-id');
    });

    it('should return null for non-existent ID', async () => {
      const found = await realmRepository.findById('507f1f77bcf86cd799439011');
      expect(found).toBeNull();
    });

    it('should return plain object without Mongoose methods', async () => {
      const realmData = {
        name: 'Plain Object Test',
        members: [],
        applications: []
      };

      const created = await RealmModel.create(realmData);
      const found = await realmRepository.findById(created._id.toString());

      expect(found).toBeDefined();
      expect((found as any).save).toBeUndefined();
      expect((found as any).$isNew).toBeUndefined();
      expect((found as any).toObject).toBeUndefined();
    });

    it('should throw error for invalid ID', async () => {
      await expect(realmRepository.findById('')).rejects.toThrow(
        'ID must be a non-empty string'
      );
      await expect(realmRepository.findById(null as any)).rejects.toThrow(
        'ID must be a non-empty string'
      );
    });
  });

  describe('findOne', () => {
    it('should find realm by _id filter', async () => {
      const realmData = {
        name: 'Test Realm',
        members: [
          {
            name: 'John Doe',
            email: 'john@example.com',
            role: 'administrator',
            registered: true
          }
        ],
        applications: []
      };

      const created = await RealmModel.create(realmData);
      const found = await realmRepository.findOne({ _id: created._id.toString() });

      expect(found).toBeDefined();
      expect(found!._id.toString()).toBe(created._id.toString());
      expect(found!.name).toBe('Test Realm');
    });

    it('should return null for non-existent realm', async () => {
      const found = await realmRepository.findOne({ _id: '507f1f77bcf86cd799439011' });
      expect(found).toBeNull();
    });

    it('should throw error for invalid filter', async () => {
      await expect(realmRepository.findOne({ _id: '' })).rejects.toThrow(
        'Filter must contain a valid _id string'
      );
      await expect(realmRepository.findOne(null as any)).rejects.toThrow(
        'Filter must contain a valid _id string'
      );
      await expect(realmRepository.findOne({} as any)).rejects.toThrow(
        'Filter must contain a valid _id string'
      );
    });

    it('should return plain object without Mongoose methods', async () => {
      const realmData = {
        name: 'Plain Object Test',
        members: [],
        applications: []
      };

      const created = await RealmModel.create(realmData);
      const found = await realmRepository.findOne({ _id: created._id.toString() });

      expect(found).toBeDefined();
      expect((found as any).save).toBeUndefined();
      expect((found as any).$isNew).toBeUndefined();
      expect((found as any).toObject).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create realm with valid data', async () => {
      const realmData = {
        name: 'New Realm',
        members: [
          {
            name: 'Alice',
            email: 'alice@example.com',
            role: 'administrator' as const,
            registered: true
          }
        ],
        applications: [],
        locale: 'en' as const,
        currency: 'USD'
      };

      const created = await realmRepository.create(realmData);

      expect(created).toBeDefined();
      expect(created._id).toBeDefined();
      expect(created.name).toBe('New Realm');
      expect(created.members).toHaveLength(1);
      expect(created.locale).toBe('en');
      expect(created.currency).toBe('USD');

      // Verify it was persisted
      const found = await RealmModel.findById(created._id).lean();
      expect(found).toBeDefined();
      expect(found!.name).toBe('New Realm');
    });

    it('should create realm with applications and trigger secret hashing', async () => {
      const plainSecret = 'my-plain-secret-123';
      const realmData = {
        name: 'Realm with Apps',
        members: [],
        applications: [
          {
            name: 'Test App',
            role: 'administrator' as const,
            clientId: 'test-client-id',
            clientSecret: plainSecret,
            expiryDate: new Date(Date.now() + 86400000)
          }
        ]
      };

      const created = await realmRepository.create(realmData);

      expect(created).toBeDefined();
      expect(created.applications).toHaveLength(1);
      expect(created.applications[0].clientSecret).not.toBe(plainSecret);
      expect(created.applications[0].clientSecret).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern
      expect(created.applications[0].createdDate).toBeDefined();
    });

    it('should throw error for invalid data', async () => {
      await expect(realmRepository.create(null as any)).rejects.toThrow(
        'Realm data must be an object'
      );
      await expect(realmRepository.create(undefined as any)).rejects.toThrow(
        'Realm data must be an object'
      );
    });

    it('should return plain object without Mongoose methods', async () => {
      const realmData = {
        name: 'Plain Object Realm',
        members: [],
        applications: []
      };

      const created = await realmRepository.create(realmData);

      expect(created).toBeDefined();
      expect((created as any).save).toBeUndefined();
      expect((created as any).$isNew).toBeUndefined();
      expect((created as any).toObject).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update realm with valid data', async () => {
      const realmData = {
        name: 'Original Name',
        members: [],
        applications: [],
        locale: 'en',
        currency: 'USD'
      };

      const created = await RealmModel.create(realmData);
      const updated = await realmRepository.update(created._id.toString(), {
        name: 'Updated Name',
        locale: 'fr'
      });

      expect(updated).toBeDefined();
      expect(updated.name).toBe('Updated Name');
      expect(updated.locale).toBe('fr');
      expect(updated.currency).toBe('USD'); // Unchanged

      // Verify persistence
      const found = await RealmModel.findById(created._id).lean();
      expect(found!.name).toBe('Updated Name');
      expect(found!.locale).toBe('fr');
    });

    it('should update realm with new applications and trigger secret hashing', async () => {
      const realmData = {
        name: 'Test Realm',
        members: [],
        applications: []
      };

      const created = await RealmModel.create(realmData);
      const plainSecret = 'new-secret-456';

      const updated = await realmRepository.update(created._id.toString(), {
        applications: [
          {
            name: 'New App',
            role: 'administrator',
            clientId: 'new-client-id',
            clientSecret: plainSecret,
            expiryDate: new Date(Date.now() + 86400000)
          }
        ]
      });

      expect(updated).toBeDefined();
      expect(updated.applications).toHaveLength(1);
      expect(updated.applications[0].clientSecret).not.toBe(plainSecret);
      expect(updated.applications[0].clientSecret).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern
      expect(updated.applications[0].createdDate).toBeDefined();
    });

    it('should throw error for non-existent realm', async () => {
      await expect(
        realmRepository.update('507f1f77bcf86cd799439011', { name: 'Test' })
      ).rejects.toThrow('Realm not found');
    });

    it('should throw error for invalid realm ID', async () => {
      await expect(
        realmRepository.update('', { name: 'Test' })
      ).rejects.toThrow('Realm ID must be a non-empty string');
      await expect(
        realmRepository.update(null as any, { name: 'Test' })
      ).rejects.toThrow('Realm ID must be a non-empty string');
    });

    it('should throw error for invalid update data', async () => {
      const created = await RealmModel.create({ name: 'Test', members: [], applications: [] });
      await expect(
        realmRepository.update(created._id.toString(), null as any)
      ).rejects.toThrow('Update data must be an object');
      await expect(
        realmRepository.update(created._id.toString(), undefined as any)
      ).rejects.toThrow('Update data must be an object');
    });

    it('should return plain object without Mongoose methods', async () => {
      const realmData = {
        name: 'Test Realm',
        members: [],
        applications: []
      };

      const created = await RealmModel.create(realmData);
      const updated = await realmRepository.update(created._id.toString(), {
        name: 'Updated'
      });

      expect(updated).toBeDefined();
      expect((updated as any).save).toBeUndefined();
      expect((updated as any).$isNew).toBeUndefined();
      expect((updated as any).toObject).toBeUndefined();
    });
  });

  describe('updateMemberRegistration', () => {
    it('should update member registration status and name', async () => {
      const realmData = {
        name: 'Test Realm',
        members: [
          {
            name: '',
            email: 'user@example.com',
            role: 'administrator',
            registered: false
          }
        ],
        applications: []
      };

      const created = await RealmModel.create(realmData);
      const count = await realmRepository.updateMemberRegistration(
        'user@example.com',
        'John Doe'
      );

      expect(count).toBe(1);

      // Verify the update
      const updated = await RealmModel.findById(created._id).lean();
      expect(updated!.members[0].registered).toBe(true);
      expect(updated!.members[0].name).toBe('John Doe');
    });

    it('should update multiple realms with same member email', async () => {
      await RealmModel.create({
        name: 'Realm 1',
        members: [
          {
            name: '',
            email: 'shared@example.com',
            role: 'administrator',
            registered: false
          }
        ],
        applications: []
      });

      await RealmModel.create({
        name: 'Realm 2',
        members: [
          {
            name: '',
            email: 'shared@example.com',
            role: 'renter',
            registered: false
          }
        ],
        applications: []
      });

      const count = await realmRepository.updateMemberRegistration(
        'shared@example.com',
        'Jane Smith'
      );

      expect(count).toBe(2);

      // Verify both realms were updated
      const realms = await RealmModel.find({
        'members.email': 'shared@example.com'
      }).lean();

      expect(realms).toHaveLength(2);
      realms.forEach(realm => {
        const member = realm.members.find(m => m.email === 'shared@example.com');
        expect(member!.registered).toBe(true);
        expect(member!.name).toBe('Jane Smith');
      });
    });

    it('should return 0 when no realms match', async () => {
      const count = await realmRepository.updateMemberRegistration(
        'nonexistent@example.com',
        'Nobody'
      );

      expect(count).toBe(0);
    });

    it('should throw error for invalid email', async () => {
      await expect(
        realmRepository.updateMemberRegistration('', 'John Doe')
      ).rejects.toThrow('Email must be a non-empty string');

      await expect(
        realmRepository.updateMemberRegistration(null as any, 'John Doe')
      ).rejects.toThrow('Email must be a non-empty string');
    });

    it('should throw error for invalid name', async () => {
      await expect(
        realmRepository.updateMemberRegistration('user@example.com', '')
      ).rejects.toThrow('Name must be a non-empty string');

      await expect(
        realmRepository.updateMemberRegistration('user@example.com', null as any)
      ).rejects.toThrow('Name must be a non-empty string');
    });
  });
});
