
import { CollectionTypes } from '@microrealestate/types';

import { ObjectId } from '../collections/index.js';
import TenantModel from '../collections/tenant.js';



/**
 * File descriptor with associated documents
 * 
 * Represents a Template (file descriptor) with its associated uploaded Documents.
 * The missing flag is computed by the occupant manager based on requirements.
 */
interface FileDescriptorWithDocuments {
  // Template fields (from aggregation)
  _id: string;
  name: string;
  description: string;
  required: boolean;
  requiredOnceContractTerminated: boolean;
  
  // Associated documents (from nested aggregation)
  documents: Array<Partial<Document>>;
  
  // Computed field (added by occupant manager after aggregation)
  missing?: boolean;
}
/**
 * Extended Tenant type returned by findWithAggregation
 * 
 * Includes all Tenant fields plus filesToUpload array populated
 * from the aggregation pipeline that joins:
 * - Tenant → Template (file descriptors linked to lease)
 * - Template → Document (uploaded files for this tenant)
 */
interface TenantWithFileDescriptors extends CollectionTypes.Tenant {
  filesToUpload: FileDescriptorWithDocuments[];
}



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

  /**
   * Find tenants by property IDs
   * 
   * Returns all tenants that have any of the specified property IDs
   * in their properties array.
   * 
   * @param propertyIds - Array of property IDs to search for
   * @param realmId - Realm ID for security filtering
   * @returns Array of tenant objects (may be empty if no matches found)
   * @throws Error if propertyIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const tenants = await tenantRepository.findByPropertyIds(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * console.log(`Found ${tenants.length} tenants`);
   * ```
   */
  async findByPropertyIds(
    propertyIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Tenant[]> {
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      throw new Error('Property IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const tenants = await TenantModel.find({
      realmId: realmId,
      'properties.propertyId': {
        $in: propertyIds
      }
    }).lean();

    return tenants as CollectionTypes.Tenant[];
  }

  /**
   * Create a new tenant
   * 
   * Creates a new tenant document in the database and returns it as a plain object.
   * 
   * @param tenantData - Tenant creation data (must include realmId)
   * @returns Created tenant object
   * @throws Error if tenantData is invalid or missing realmId
   * 
   * @example
   * ```typescript
   * const newTenant = await tenantRepository.create({
   *   realmId: '507f1f77bcf86cd799439011',
   *   name: 'John Doe',
   *   contacts: [{ contact: 'John', phone: '123-456-7890', email: 'john@example.com' }]
   * });
   * console.log(`Created tenant: ${newTenant.name}`);
   * ```
   */
  async create(tenantData: Partial<CollectionTypes.Tenant>): Promise<CollectionTypes.Tenant> {
    if (!tenantData || typeof tenantData !== 'object') {
      throw new Error('Tenant data must be an object');
    }
    if (!tenantData.realmId) {
      throw new Error('Tenant data must include realmId');
    }

    const doc = await TenantModel.create(tenantData);
    return doc.toObject();
  }

  /**
   * Update an existing tenant
   * 
   * Updates a tenant document and returns the number of documents modified.
   * 
   * @param tenantId - Tenant ID to update
   * @param realmId - Realm ID for security filtering
   * @param updateData - Data to update
   * @returns Number of documents modified (0 or 1)
   * @throws Error if tenantId, realmId, or updateData is invalid
   * 
   * @example
   * ```typescript
   * const modifiedCount = await tenantRepository.update(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012',
   *   { name: 'Jane Doe' }
   * );
   * console.log(`Modified ${modifiedCount} tenant(s)`);
   * ```
   */
  async update(
    tenantId: string,
    realmId: string,
    updateData: Partial<CollectionTypes.Tenant>
  ): Promise<number> {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Tenant ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }

    const result = await TenantModel.updateOne(
      { _id: tenantId, realmId: realmId },
      updateData
    );

    return result.modifiedCount || 0;
  }

  /**
   * Find tenants by IDs with realm filtering
   * 
   * Returns all tenants with the specified IDs that belong to the given realm.
   * 
   * @param tenantIds - Array of tenant IDs
   * @param realmId - Realm ID for security filtering
   * @returns Array of tenant objects (may be empty if no matches found)
   * @throws Error if tenantIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const tenants = await tenantRepository.findByIds(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * console.log(`Found ${tenants.length} tenants`);
   * ```
   */
  async findByIds(tenantIds: string[], realmId: string): Promise<CollectionTypes.Tenant[]> {
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new Error('Tenant IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const tenants = await TenantModel.find({
      _id: { $in: tenantIds },
      realmId: realmId
    }).lean();

    return tenants as CollectionTypes.Tenant[];
  }

  /**
   * Delete multiple tenants
   * 
   * Deletes all tenants with the specified IDs that belong to the given realm.
   * 
   * @param tenantIds - Array of tenant IDs to delete
   * @param realmId - Realm ID for security filtering
   * @returns Number of tenants deleted
   * @throws Error if tenantIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const deletedCount = await tenantRepository.deleteMany(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * console.log(`Deleted ${deletedCount} tenant(s)`);
   * ```
   */
  async deleteMany(tenantIds: string[], realmId: string): Promise<number> {
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new Error('Tenant IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const result = await TenantModel.deleteMany({
      realmId: realmId,
      _id: { $in: tenantIds }
    });

    return result.deletedCount || 0;
  }

  /**
   * Find tenants with aggregation pipeline
   * 
   * Performs complex aggregation to join tenants with:
   * - File descriptors (templates) linked to the lease
   * - Documents uploaded by the tenant
   * - Lease and property references (populated)
   * 
   * Returns tenants with additional filesToUpload field populated.
   * The missing document flags are NOT computed by this method - 
   * they must be computed by the caller.
   * 
   * @param realmId - Realm ID
   * @param tenantId - Optional specific tenant ID
   * @returns Array of tenant objects with filesToUpload populated
   * @throws Error if realmId is invalid
   * 
   * @example
   * ```typescript
   * // Get all tenants with file descriptors
   * const tenants = await tenantRepository.findWithAggregation('507f1f77bcf86cd799439011');
   * 
   * // Get specific tenant with file descriptors
   * const tenant = await tenantRepository.findWithAggregation(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012'
   * );
   * ```
   */
  async findWithAggregation(
    realmId: string,
    tenantId?: string
  ): Promise<TenantWithFileDescriptors[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const $match: any = { realmId };
    if (tenantId) {
      // Convert string ID to ObjectId for aggregation
      $match._id = new ObjectId(tenantId);
    }

    const tenants = await TenantModel.aggregate<TenantWithFileDescriptors>([
      { $match },
      {
        $lookup: {
          from: 'templates',
          let: {
            tenant_realmId: '$realmId',
            tenant_tenantId: { $toString: '$_id' },
            tenant_leaseId: '$leaseId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$realmId', '$$tenant_realmId'] },
                    { $in: ['$$tenant_leaseId', '$linkedResourceIds'] },
                    { $eq: ['$type', 'fileDescriptor'] }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: 'documents',
                let: { template_templateId: { $toString: '$_id' } },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$realmId', '$$tenant_realmId'] },
                          { $eq: ['$tenantId', '$$tenant_tenantId'] },
                          { $eq: ['$leaseId', '$$tenant_leaseId'] },
                          { $eq: ['$type', 'file'] },
                          { $eq: ['$templateId', '$$template_templateId'] }
                        ]
                      }
                    }
                  },
                  {
                    $project: {
                      realmId: 0,
                      leaseId: 0,
                      tenantId: 0,
                      type: 0,
                      mimeType: 0,
                      templateId: 0,
                      url: 0
                    }
                  }
                ],
                as: 'documents'
              }
            },
            {
              $project: {
                realmId: 0,
                linkedResourceIds: 0,
                type: 0,
                hasExpiryDate: 0
              }
            }
          ],
          as: 'filesToUpload'
        }
      },
      { $sort: { name: 1 } }
    ]);

    // Populate references
    await TenantModel.populate(tenants, [
      { path: 'leaseId' },
      { path: 'properties.propertyId' }
    ]);

    return tenants;
  }


  async findAllByYear(realmId: string, year: string): Promise<any[]> {
return TenantModel.aggregate([
    {
      $match: {
        realmId,
        'rents.year': year
      }
    },
    {
      $addFields: {
        nameLowerCase: { $toLower: '$name' }, // to sort ignoring the case
        properties: {
          $map: {
            input: '$properties',
            as: 'p',
            in: {
              _id: '$$p.property._id',
              type: '$$p.property.type',
              name: '$$p.property.name'
            }
          }
        },
        rents: {
          $map: {
            input: '$rents',
            as: 'rent',
            in: {
              year: '$$rent.year',
              month: '$$rent.month',
              payments: '$$rent.payments',
              total: '$$rent.total'
            }
          }
        }
      }
    },
    {
      // done in a separate stage to rely on endDate computed in the previous stage
      $addFields: {
        incoming: {
          $and: [
            { $gte: ['$beginDate', new Date(`${year}-01-01T00:00:00`)] },
            { $lt: ['$beginDate', new Date(`${year + 1}-01-01T00:00:00`)] }
          ]
        },
        outgoing: {
          $or: [
            {
              $and: [
                {
                  $gte: ['$terminationDate', new Date(`${year}-01-01T00:00:00`)]
                },
                {
                  $lt: [
                    '$terminationDate',
                    new Date(`${year + 1}-01-01T00:00:00`)
                  ]
                }
              ]
            },
            {
              $and: [
                { $gte: ['$endDate', new Date(`${year}-01-01T00:00:00`)] },
                { $lt: ['$endDate', new Date(`${year + 1}-01-01T00:00:00`)] }
              ]
            }
          ]
        }
      }
    },
    {
      $sort: {
        nameLowerCase: 1
      }
    },
    {
      $project: {
        realmId: 1,
        _id: 1,
        name: 1,
        incoming: 1,
        outgoing: 1,
        reference: 1,
        beginDate: 1,
        endDate: 1,
        terminationDate: 1,
        guaranty: 1,
        guarantyPayback: 1,
        properties: 1,
        rents: {
          $filter: {
            input: '$rents',
            as: 'rent',
            cond: {
              $eq: ['$$rent.year', year]
            }
          }
        }
      }
    }
  ]);
  }

  /**
   * Find all tenants in a realm
   * 
   * Returns all tenants that belong to the specified realm.
   * 
   * @param realmId - Realm ID
   * @returns Array of tenant objects (may be empty if no matches found)
   * @throws Error if realmId is invalid
   * 
   * @example
   * ```typescript
   * const tenants = await tenantRepository.findAll('507f1f77bcf86cd799439011');
   * console.log(`Found ${tenants.length} tenants`);
   * ```
   */
  async findAll(realmId: string): Promise<CollectionTypes.Tenant[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const tenants = await TenantModel.find({ realmId }).lean();
    return tenants as CollectionTypes.Tenant[];
  }

  /**
   * Find tenant by ID and realm with populated properties
   * 
   * Returns a tenant with the propertyId references in the properties array
   * populated with full property documents. This is useful when you need
   * complete property information for template generation or reporting.
   * 
   * @param tenantId - Tenant ID
   * @param realmId - Realm ID for security filtering
   * @returns Tenant object with populated properties or null if not found
   * @throws Error if tenantId or realmId is invalid
   * 
   * @example
   * ```typescript
   * const tenant = await tenantRepository.findByIdWithProperties(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012'
   * );
   * if (tenant) {
   *   tenant.properties.forEach(prop => {
   *     console.log(prop.propertyId.name); // Access populated property data
   *   });
   * }
   * ```
   */
  async findByIdWithProperties(
    tenantId: string,
    realmId: string
  ): Promise<CollectionTypes.Tenant | null> {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Tenant ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const tenant = await TenantModel.findOne({
      _id: tenantId,
      realmId: realmId
    })
      .populate('properties.propertyId')
      .lean();

    return tenant as CollectionTypes.Tenant | null;
  }

  /**
   * Find tenant by ID with all references populated (realm, lease, properties)
   * 
   * Returns a tenant with realmId, leaseId, and properties.propertyId references
   * all populated with full documents. This is used for PDF generation where
   * complete landlord, lease, and property information is needed.
   * 
   * @param tenantId - Tenant ID
   * @returns Tenant object with all references populated or null if not found
   * @throws Error if tenantId is invalid
   * 
   * @example
   * ```typescript
   * const tenant = await tenantRepository.findByIdWithAllReferences('507f1f77bcf86cd799439011');
   * if (tenant) {
   *   console.log(tenant.realmId.name); // Access populated realm data
   *   console.log(tenant.leaseId.name); // Access populated lease data
   *   tenant.properties.forEach(prop => {
   *     console.log(prop.propertyId.name); // Access populated property data
   *   });
   * }
   * ```
   */
  async findByIdWithAllReferences(
    tenantId: string
  ): Promise<CollectionTypes.Tenant | null> {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Tenant ID must be a non-empty string');
    }

    const tenant = await TenantModel.findOne({ _id: tenantId })
      .populate('realmId')
      .populate('leaseId')
      .populate('properties.propertyId')
      .lean();

    return tenant as CollectionTypes.Tenant | null;
  }
}
