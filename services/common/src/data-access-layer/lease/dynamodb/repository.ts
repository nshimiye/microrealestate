import { CollectionTypes } from '@microrealestate/types';
import { IDataBaseSession, ILeaseRepository } from '../interface.js';
import LeaseBaseRepository from './base-repository.js';
import logger from '../../../utils/logger.js';
import { getTenantRepository } from '../../tenant/index.js';

/**
 * DynamoDB implementation of Lease repository
 */
export default class LeaseRepository
  extends LeaseBaseRepository
  implements ILeaseRepository
{
  /**
   * Create a new lease
   *
   * @param leaseData - Lease creation data
   * @returns Created lease object
   * @throws Error if leaseData is invalid
   *
   * @example
   * ```typescript
   * const lease = await leaseRepository.create({
   *   realmId: '507f1f77bcf86cd799439011',
   *   name: '12 Month Lease',
   *   numberOfTerms: 12,
   *   timeRange: 'months',
   *   active: true
   * });
   * ```
   */
  async create(
    leaseData: Partial<CollectionTypes.Lease>
  ): Promise<CollectionTypes.Lease> {
    if (!leaseData || typeof leaseData !== 'object') {
      throw new Error('Lease data must be an object');
    }

    if (!leaseData.realmId) {
      throw new Error('Realm ID is required');
    }

    try {
      const lease = await super.create(leaseData as CollectionTypes.Lease);

      logger.debug('Lease created successfully', {
        leaseId: lease._id,
        realmId: lease.realmId,
        name: lease.name
      });

      return lease;
    } catch (error) {
      logger.error('Failed to create lease', { leaseData, error });
      throw error;
    }
  }

  /**
   * Find a lease by ID within a realm
   *
   * @param leaseId - Lease ID
   * @param realmId - Realm ID
   * @returns Lease object or null if not found
   * @throws Error if leaseId or realmId is invalid
   *
   * @example
   * ```typescript
   * const lease = await leaseRepository.findById(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012'
   * );
   * ```
   */
  async findById(
    leaseId: string,
    realmId: string
  ): Promise<CollectionTypes.Lease | null> {
    if (!leaseId || typeof leaseId !== 'string') {
      throw new Error('Lease ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      const lease = await super.findById(leaseId, realmId);

      logger.debug('Lease findById completed', {
        leaseId,
        realmId,
        found: !!lease
      });

      return lease;
    } catch (error) {
      logger.error('Failed to find lease by ID', { leaseId, realmId, error });
      throw error;
    }
  }

  /**
   * Find all leases in a realm
   *
   * Returns leases sorted by name in ascending order.
   *
   * @param realmId - Realm ID
   * @returns Array of lease objects
   * @throws Error if realmId is invalid
   *
   * @example
   * ```typescript
   * const leases = await leaseRepository.findAll('507f1f77bcf86cd799439011');
   * ```
   */
  async findAll(realmId: string): Promise<CollectionTypes.Lease[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      const leases = await this.findByRealm(realmId);

      // Sort by name in ascending order
      leases.sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });

      logger.debug('Found leases in realm', {
        realmId,
        count: leases.length
      });

      return leases;
    } catch (error) {
      logger.error('Failed to find leases', { realmId, error });
      throw error;
    }
  }

  /**
   * Update a lease
   *
   * @param leaseId - Lease ID
   * @param realmId - Realm ID
   * @param updateData - Data to update
   * @returns Updated lease object or null if not found
   * @throws Error if leaseId, realmId, or updateData is invalid
   *
   * @example
   * ```typescript
   * const updated = await leaseRepository.update(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012',
   *   { name: 'Updated Lease Name', active: false }
   * );
   * ```
   */
  async update(
    leaseId: string,
    realmId: string,
    updates: Partial<CollectionTypes.Lease>
  ): Promise<CollectionTypes.Lease | null> {
    if (!leaseId || typeof leaseId !== 'string') {
      throw new Error('Lease ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!updates || typeof updates !== 'object') {
      throw new Error('Update data must be an object');
    }

    try {
      const lease = await super.update(leaseId, realmId, updates);

      logger.debug('Lease updated successfully', {
        leaseId,
        realmId,
        found: !!lease
      });

      return lease;
    } catch (error) {
      logger.error('Failed to update lease', { leaseId, realmId, error });
      throw error;
    }
  }

  /**
   * Delete multiple leases
   *
   * @param leaseIds - Array of lease IDs to delete
   * @param realmId - Realm ID
   * @param session - Optional database session for transactions (not used in DynamoDB)
   * @returns Number of leases deleted
   * @throws Error if leaseIds or realmId is invalid
   *
   * @example
   * ```typescript
   * const count = await leaseRepository.deleteMany(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * ```
   */
  async deleteMany(
    leaseIds: string[],
    realmId: string,
    session?: IDataBaseSession
  ): Promise<number> {
    if (!Array.isArray(leaseIds) || leaseIds.length === 0) {
      throw new Error('Lease IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Build delete requests for batch operation
      const deleteRequests = leaseIds.map((leaseId) => ({
        deleteRequest: {
          PK: this.buildPK(leaseId, realmId),
          SK: this.buildSK(leaseId)
        }
      }));

      // Execute batch delete
      const result = await this.client.batchWrite(deleteRequests);

      // Calculate number of successfully deleted items
      const deletedCount = leaseIds.length - result.unprocessedItems.length;

      if (result.unprocessedItems.length > 0) {
        logger.warn('Some leases could not be deleted', {
          realmId,
          unprocessedCount: result.unprocessedItems.length,
          totalRequested: leaseIds.length
        });
      }

      logger.debug('Leases deleted', {
        realmId,
        deletedCount,
        requestedCount: leaseIds.length
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete leases', { realmId, error });
      throw error;
    }
  }

  /**
   * Find lease IDs that are used by tenants
   *
   * Queries all tenants in the realm and returns a Set of lease IDs
   * that are referenced by at least one tenant.
   *
   * @param realmId - Realm ID
   * @returns Set of lease IDs used by tenants
   * @throws Error if realmId is invalid
   *
   * @example
   * ```typescript
   * const usedLeaseIds = await leaseRepository.findLeaseIdsUsedByTenants(
   *   '507f1f77bcf86cd799439011'
   * );
   * if (usedLeaseIds.has(leaseId)) {
   *   console.log('Lease is in use');
   * }
   * ```
   */
  async findLeaseIdsUsedByTenants(realmId: string): Promise<Set<string>> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Get tenant repository instance
      const tenantRepository = getTenantRepository();

      // Query all tenants in the realm
      const tenants = await tenantRepository.findAll(realmId);

      // Collect unique lease IDs
      const leaseIds = tenants.reduce((acc, tenant) => {
        if (tenant.leaseId) {
          acc.add(tenant.leaseId.toString());
        }
        return acc;
      }, new Set<string>());

      logger.debug('Found lease IDs used by tenants', {
        realmId,
        count: leaseIds.size
      });

      return leaseIds;
    } catch (error) {
      logger.error('Failed to find lease IDs used by tenants', {
        realmId,
        error
      });
      throw error;
    }
  }

  /**
   * Find multiple leases by IDs
   *
   * @param leaseIds - Array of lease IDs
   * @param realmId - Realm ID
   * @returns Array of lease objects
   * @throws Error if leaseIds or realmId is invalid
   *
   * @example
   * ```typescript
   * const leases = await leaseRepository.findByIds(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * ```
   */
  async findByIds(
    leaseIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Lease[]> {
    if (!Array.isArray(leaseIds) || leaseIds.length === 0) {
      throw new Error('Lease IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Build keys for batch get operation
      const keys = leaseIds.map((leaseId) => ({
        PK: this.buildPK(leaseId, realmId),
        SK: this.buildSK(leaseId)
      }));

      // Execute batch get
      const items = await this.client.batchGet(keys);

      // Transform items to Lease entities
      const leases = items.map((item: Record<string, any>) => this.fromItem(item));

      logger.debug('Found leases by IDs', {
        realmId,
        requestedCount: leaseIds.length,
        foundCount: leases.length
      });

      return leases;
    } catch (error) {
      logger.error('Failed to find leases by IDs', { realmId, error });
      throw error;
    }
  }
}
