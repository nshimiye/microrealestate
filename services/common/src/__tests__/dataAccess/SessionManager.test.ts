/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fc from 'fast-check';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clearTestDB, connectTestDB, disconnectTestDB, supportsTransactions } from './testSetup.js';

import SessionManager from '../../dataAccess/SessionManager.js';
import TenantModel from '../../collections/tenant.js';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeAll(async () => {
    await connectTestDB();
    sessionManager = new SessionManager();
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

  describe('startSession', () => {
    it('should return a valid session', async () => {
      const session = await sessionManager.startSession();

      expect(session).toBeDefined();
      expect(typeof session.startTransaction).toBe('function');
      expect(typeof session.commitTransaction).toBe('function');
      expect(typeof session.abortTransaction).toBe('function');
      expect(typeof session.endSession).toBe('function');

      // Clean up
      session.endSession();
    });
  });

  describe('withTransaction', () => {
    it.skipIf(!supportsTransactions())('should commit transaction on success', async () => {
      const realmId = 'test-realm-123';
      const tenantName = 'Test Tenant';

      // Execute operation within transaction
      const result = await sessionManager.withTransaction(async (session) => {
        const tenant = await TenantModel.create([{
          realmId,
          name: tenantName,
          isCompany: false
        }], { session });

        return tenant[0]._id.toString();
      });

      // Verify the tenant was created (transaction committed)
      const tenant = await TenantModel.findById(result).lean();
      expect(tenant).toBeDefined();
      expect(tenant?.name).toBe(tenantName);
      expect(tenant?.realmId).toBe(realmId);
    });

    it.skipIf(!supportsTransactions())('should abort transaction on error', async () => {
      const realmId = 'test-realm-456';
      const tenantName = 'Test Tenant';

      // Execute operation that throws error
      await expect(
        sessionManager.withTransaction(async (session) => {
          // Create a tenant
          await TenantModel.create([{
            realmId,
            name: tenantName,
            isCompany: false
          }], { session });

          // Throw error to trigger rollback
          throw new Error('Simulated error');
        })
      ).rejects.toThrow('Simulated error');

      // Verify the tenant was NOT created (transaction aborted)
      const tenants = await TenantModel.find({ realmId }).lean();
      expect(tenants).toHaveLength(0);
    });

    it.skipIf(!supportsTransactions())('should always end session in finally block', async () => {
      const realmId = 'test-realm-789';

      // Track if session is ended
      let sessionEnded = false;

      try {
        await sessionManager.withTransaction(async (session) => {
          // Override endSession to track if it's called
          const originalEndSession = session.endSession.bind(session);
          (session as any).endSession = () => {
            sessionEnded = true;
            originalEndSession();
          };

          // Create a tenant
          await TenantModel.create([{
            realmId,
            name: 'Test Tenant',
            isCompany: false
          }], { session });

          // Throw error
          throw new Error('Test error');
        });
      } catch (error) {
        // Expected error
      }

      // Verify session was ended despite error
      expect(sessionEnded).toBe(true);
    });

    it.skipIf(!supportsTransactions())('should return transaction result correctly', async () => {
      const realmId = 'test-realm-abc';
      const expectedResult = { success: true, count: 42 };

      const result = await sessionManager.withTransaction(async (session) => {
        // Create a tenant
        await TenantModel.create([{
          realmId,
          name: 'Test Tenant',
          isCompany: false
        }], { session });

        // Return custom result
        return expectedResult;
      });

      expect(result).toEqual(expectedResult);
    });

    it.skipIf(!supportsTransactions())('should handle multiple operations in transaction', async () => {
      const realmId = 'test-realm-multi';

      const result = await sessionManager.withTransaction(async (session) => {
        // Create multiple tenants
        const tenant1 = await TenantModel.create([{
          realmId,
          name: 'Tenant 1',
          isCompany: false
        }], { session });

        const tenant2 = await TenantModel.create([{
          realmId,
          name: 'Tenant 2',
          isCompany: true
        }], { session });

        const tenant3 = await TenantModel.create([{
          realmId,
          name: 'Tenant 3',
          isCompany: false
        }], { session });

        return {
          ids: [
            tenant1[0]._id.toString(),
            tenant2[0]._id.toString(),
            tenant3[0]._id.toString()
          ]
        };
      });

      // Verify all tenants were created
      const tenants = await TenantModel.find({ realmId }).lean();
      expect(tenants).toHaveLength(3);
      expect(tenants.map(t => t._id.toString()).sort()).toEqual(result.ids.sort());
    });

    it.skipIf(!supportsTransactions())('should rollback all operations on error', async () => {
      const realmId = 'test-realm-rollback';

      await expect(
        sessionManager.withTransaction(async (session) => {
          // Create multiple tenants
          await TenantModel.create([{
            realmId,
            name: 'Tenant 1',
            isCompany: false
          }], { session });

          await TenantModel.create([{
            realmId,
            name: 'Tenant 2',
            isCompany: true
          }], { session });

          await TenantModel.create([{
            realmId,
            name: 'Tenant 3',
            isCompany: false
          }], { session });

          // Throw error after creating all tenants
          throw new Error('Rollback all operations');
        })
      ).rejects.toThrow('Rollback all operations');

      // Verify NO tenants were created (all rolled back)
      const tenants = await TenantModel.find({ realmId }).lean();
      expect(tenants).toHaveLength(0);
    });
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property 10: Transaction atomicity', () => {
    it.skipIf(!supportsTransactions())('should ensure all operations commit on success or all rollback on failure', async () => {
      // Feature: api-occupant-data-access-layer, Property 10: Transaction atomicity
      // Validates: Requirements 10.5, 15.5

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              isCompany: fc.boolean()
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.boolean(),
          async (realmId, tenants, shouldFail) => {
            // Clear database before each property test iteration
            await clearTestDB();

            // Count tenants before transaction
            const beforeCount = await TenantModel.countDocuments({ realmId });

            if (shouldFail) {
              // Transaction should fail and rollback
              await expect(
                sessionManager.withTransaction(async (session) => {
                  // Create all tenants
                  for (const tenant of tenants) {
                    await TenantModel.create([{
                      realmId,
                      name: tenant.name,
                      isCompany: tenant.isCompany
                    }], { session });
                  }

                  // Throw error to trigger rollback
                  throw new Error('Intentional failure');
                })
              ).rejects.toThrow('Intentional failure');

              // Verify NO tenants were created (atomicity - all rolled back)
              const afterCount = await TenantModel.countDocuments({ realmId });
              expect(afterCount).toBe(beforeCount);
            } else {
              // Transaction should succeed and commit
              await sessionManager.withTransaction(async (session) => {
                // Create all tenants
                for (const tenant of tenants) {
                  await TenantModel.create([{
                    realmId,
                    name: tenant.name,
                    isCompany: tenant.isCompany
                  }], { session });
                }
              });

              // Verify ALL tenants were created (atomicity - all committed)
              const afterCount = await TenantModel.countDocuments({ realmId });
              expect(afterCount).toBe(beforeCount + tenants.length);

              // Verify all tenants have correct data
              const createdTenants = await TenantModel.find({ realmId }).lean();
              const createdNames = createdTenants.map(t => t.name).sort();
              const expectedNames = tenants.map(t => t.name).sort();
              expect(createdNames).toEqual(expectedNames);
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 35000);
  });
});
