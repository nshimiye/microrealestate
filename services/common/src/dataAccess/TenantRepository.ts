import { CollectionTypes } from '@microrealestate/types';
import TenantModel from '../collections/tenant.js';

/**
 * Repository for Tenant entity operations
 * 
 * Provides an abstraction layer over Mongoose Tenant model,
 * returning plain JavaScript objects instead of Mongoose documents.
 */
export default class TenantRepository {
  /**
   * Find tenants by contact email
   * 
   * Searches for tenants that have the specified email in their contacts array.
   * 
   * @param email - Contact email address to search for
   * @returns Array of tenant objects (may be empty if no matches found)
   * @throws Error if email is invalid
   * 
   * @example
   * ```typescript
   * const tenants = await tenantRepository.findByContactEmail('tenant@example.com');
   * console.log(`Found ${tenants.length} tenants`);
   * ```
   */
  async findByContactEmail(email: string): Promise<CollectionTypes.Tenant[]> {
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }

    const tenants = await TenantModel.find({
      'contacts.email': email
    }).lean();

    return tenants as CollectionTypes.Tenant[];
  }

  /**
   * Find a tenant by ID
   * 
   * @param id - Tenant ID
   * @returns Tenant object or null if not found
   * @throws Error if ID is invalid
   * 
   * @example
   * ```typescript
   * const tenant = await tenantRepository.findById('507f1f77bcf86cd799439011');
   * if (tenant) {
   *   console.log(tenant.name);
   * }
   * ```
   */
  async findById(id: string): Promise<CollectionTypes.Tenant | null> {
    if (!id || typeof id !== 'string') {
      throw new Error('ID must be a non-empty string');
    }

    const tenant = await TenantModel.findById(id).lean();
    return tenant as CollectionTypes.Tenant | null;
  }

  /**
   * Find multiple tenants with filtering and sorting
   * 
   * Supports filtering by:
   * - realmId (required)
   * - tenantId (optional)
   * - startTerm and endTerm for rent term ranges (optional)
   * - Sorting by name in ascending or descending order
   * 
   * @param filter - Tenant query filter
   * @param filter.realmId - Organization/realm ID (required)
   * @param filter.tenantId - Specific tenant ID (optional)
   * @param filter.startTerm - Start of rent term range in YYYYMMDDHH format (optional)
   * @param filter.endTerm - End of rent term range in YYYYMMDDHH format (optional)
   * @param options - Query options
   * @param options.sort - Sort configuration
   * @param options.sort.name - Sort by name: 'asc' for ascending, 'desc' for descending
   * @returns Array of tenant objects
   * @throws Error if realmId is missing or invalid
   * 
   * @example
   * ```typescript
   * // Find all tenants in a realm, sorted by name ascending
   * const tenants = await tenantRepository.find(
   *   { realmId: '507f1f77bcf86cd799439011' },
   *   { sort: { name: 'asc' } }
   * );
   * 
   * // Find tenants with rents in a specific term range
   * const tenants = await tenantRepository.find(
   *   {
   *     realmId: '507f1f77bcf86cd799439011',
   *     startTerm: 2024010100,
   *     endTerm: 2024123100
   *   },
   *   { sort: { name: 'asc' } }
   * );
   * 
   * // Find a specific tenant (no sorting needed)
   * const tenants = await tenantRepository.find(
   *   {
   *     realmId: '507f1f77bcf86cd799439011',
   *     tenantId: '507f1f77bcf86cd799439012'
   *   }
   * );
   * ```
   */
  async find(
    filter: {
      realmId: string;
      tenantId?: string;
      startTerm?: number;
      endTerm?: number;
    },
    options?: { sort?: { name?: 'asc' | 'desc' } }
  ): Promise<CollectionTypes.Tenant[]> {
    if (!filter?.realmId || typeof filter.realmId !== 'string') {
      throw new Error('realmId is required and must be a string');
    }

    // Build MongoDB query from simple filter
    const mongoQuery: any = {
      $and: [{ realmId: filter.realmId }]
    };

    if (filter.tenantId) {
      mongoQuery.$and.push({ _id: filter.tenantId });
    }

    if (filter.startTerm && filter.endTerm) {
      mongoQuery.$and.push({ 'rents.term': { $gte: filter.startTerm } });
      mongoQuery.$and.push({ 'rents.term': { $lte: filter.endTerm } });
    } else if (filter.startTerm) {
      mongoQuery.$and.push({ 'rents.term': filter.startTerm });
    }

    let query = TenantModel.find(mongoQuery);

    if (options?.sort?.name) {
      query = query.sort({ name: options.sort.name === 'asc' ? 1 : -1 });
    }

    const tenants = await query.lean();
    return tenants as CollectionTypes.Tenant[];
  }

  /**
   * Find a single tenant by ID and realm
   * 
   * @param filter - Tenant query filter
   * @param filter.tenantId - Tenant ID (required)
   * @param filter.realmId - Organization/realm ID (required)
   * @returns Tenant object or null if not found
   * @throws Error if tenantId or realmId is missing or invalid
   * 
   * @example
   * ```typescript
   * const tenant = await tenantRepository.findOne({
   *   tenantId: '507f1f77bcf86cd799439011',
   *   realmId: '507f1f77bcf86cd799439012'
   * });
   * ```
   */
  async findOne(filter: {
    tenantId: string;
    realmId: string;
  }): Promise<CollectionTypes.Tenant | null> {
    if (!filter?.tenantId || typeof filter.tenantId !== 'string') {
      throw new Error('tenantId is required and must be a string');
    }
    if (!filter?.realmId || typeof filter.realmId !== 'string') {
      throw new Error('realmId is required and must be a string');
    }

    const tenant = await TenantModel.findOne({
      _id: filter.tenantId,
      realmId: filter.realmId
    }).lean();

    return tenant as CollectionTypes.Tenant | null;
  }

  /**
   * Find and update a tenant atomically
   * 
   * This method performs an atomic update and returns the updated document.
   * Used for updating tenant rent arrays after payment processing.
   * 
   * @param filter - Tenant query filter
   * @param filter.tenantId - Tenant ID (required)
   * @param filter.realmId - Organization/realm ID (required)
   * @param update - Update data (partial tenant object)
   * @param options - Update options
   * @param options.returnUpdated - If true, return the updated document; if false, return the original
   * @returns Updated tenant object or null if not found
   * @throws Error if tenantId, realmId, or update is missing or invalid
   * 
   * @example
   * ```typescript
   * const updated = await tenantRepository.findOneAndUpdate(
   *   {
   *     tenantId: '507f1f77bcf86cd799439011',
   *     realmId: '507f1f77bcf86cd799439012'
   *   },
   *   { rents: updatedRents },
   *   { returnUpdated: true }
   * );
   * ```
   */
  async findOneAndUpdate(
    filter: {
      tenantId: string;
      realmId: string;
    },
    update: Partial<CollectionTypes.Tenant>,
    options?: { returnUpdated?: boolean }
  ): Promise<CollectionTypes.Tenant | null> {
    if (!filter?.tenantId || typeof filter.tenantId !== 'string') {
      throw new Error('tenantId is required and must be a string');
    }
    if (!filter?.realmId || typeof filter.realmId !== 'string') {
      throw new Error('realmId is required and must be a string');
    }
    if (!update || typeof update !== 'object') {
      throw new Error('Update must be an object');
    }

    const tenant = await TenantModel.findOneAndUpdate(
      { _id: filter.tenantId, realmId: filter.realmId },
      update,
      { new: options?.returnUpdated ?? false, lean: true }
    );

    return tenant as CollectionTypes.Tenant | null;
  }
}
