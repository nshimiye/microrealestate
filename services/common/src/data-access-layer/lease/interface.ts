import { CollectionTypes,  } from '@microrealestate/types';
export interface IDataBaseSession {
    // this is db specific
}
/**
 * Repository for Lease entity operations
 *
 * Provides an abstraction layer over Mongoose Lease model,
 * returning plain JavaScript objects instead of Mongoose documents.
 */
export interface ILeaseRepository {
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
    create(leaseData: Partial<CollectionTypes.Lease>): Promise<CollectionTypes.Lease>;
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
    findById(leaseId: string, realmId: string): Promise<CollectionTypes.Lease | null>;
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
    findAll(realmId: string): Promise<CollectionTypes.Lease[]>;
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
    update(leaseId: string, realmId: string, updateData: Partial<CollectionTypes.Lease>): Promise<CollectionTypes.Lease | null>;
    /**
     * Delete multiple leases
     *
     * @param leaseIds - Array of lease IDs to delete
     * @param realmId - Realm ID
     * @param session - Optional database session for transactions
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
    deleteMany(leaseIds: string[], realmId: string, session?: IDataBaseSession): Promise<number>;
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
    findLeaseIdsUsedByTenants(realmId: string): Promise<Set<string>>;
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
    findByIds(leaseIds: string[], realmId: string): Promise<CollectionTypes.Lease[]>;
}
