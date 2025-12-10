import { CollectionTypes } from '@microrealestate/types';
import LeaseModel from '../../../collections/lease.js';
import mongoose from 'mongoose';
import TenantModel from '../../../collections/tenant.js';
import {ILeaseRepository} from '../interface.js';

/**
 * Repository for Lease entity operations
 * 
 * Provides an abstraction layer over Mongoose Lease model,
 * returning plain JavaScript objects instead of Mongoose documents.
 */
export default class LeaseRepository implements ILeaseRepository {
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
  async create(leaseData: Partial<CollectionTypes.Lease>): Promise<CollectionTypes.Lease> {
    if (!leaseData || typeof leaseData !== 'object') {
      throw new Error('Lease data must be an object');
    }
    
    if (!leaseData.realmId) {
      throw new Error('Realm ID is required');
    }
    
    const doc = await LeaseModel.create(leaseData);
    return doc.toObject();
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
  async findById(leaseId: string, realmId: string): Promise<CollectionTypes.Lease | null> {
    if (!leaseId || typeof leaseId !== 'string') {
      throw new Error('Lease ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    
    const lease = await LeaseModel.findOne({
      _id: leaseId,
      realmId: realmId
    }).lean();
    
    return lease as CollectionTypes.Lease | null;
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
    
    const leases = await LeaseModel.find({ realmId: realmId })
      .sort({ name: 1 })
      .lean();
    
    return leases as CollectionTypes.Lease[];
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
    updateData: Partial<CollectionTypes.Lease>
  ): Promise<CollectionTypes.Lease | null> {
    if (!leaseId || typeof leaseId !== 'string') {
      throw new Error('Lease ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }
    
    const lease = await LeaseModel.findOneAndUpdate(
      { _id: leaseId, realmId: realmId },
      updateData,
      { new: true }
    ).lean();
    
    return lease as CollectionTypes.Lease | null;
  }

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
  async deleteMany(
    leaseIds: string[],
    realmId: string,
    session?: mongoose.ClientSession
  ): Promise<number> {
    if (!Array.isArray(leaseIds) || leaseIds.length === 0) {
      throw new Error('Lease IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    
    const result = await LeaseModel.deleteMany(
      { _id: { $in: leaseIds }, realmId: realmId },
      // { session: session as any }
    );
    
    return result.deletedCount || 0;
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
    
    const tenants = await TenantModel.find(
      { realmId: realmId },
      { leaseId: 1 }  // Project only leaseId field
    ).lean();
    
    return tenants.reduce((acc, tenant: any) => {
      if (tenant.leaseId) {
        acc.add(tenant.leaseId.toString());
      }
      return acc;
    }, new Set<string>());
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
  async findByIds(leaseIds: string[], realmId: string): Promise<CollectionTypes.Lease[]> {
    if (!Array.isArray(leaseIds) || leaseIds.length === 0) {
      throw new Error('Lease IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    
    const leases = await LeaseModel.find({
      _id: { $in: leaseIds },
      realmId: realmId
    }).lean();
    
    return leases as CollectionTypes.Lease[];
  }
}
