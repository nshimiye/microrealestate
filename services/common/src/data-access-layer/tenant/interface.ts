import { CollectionTypes } from '@microrealestate/types';

/**
 * File descriptor with associated documents
 */
interface FileDescriptorWithDocuments {
  _id: string;
  name: string;
  description: string;
  required: boolean;
  requiredOnceContractTerminated: boolean;
  documents: Array<Partial<Document>>;
  missing?: boolean;
}

/**
 * Extended Tenant type with file descriptors
 */
interface TenantWithFileDescriptors extends CollectionTypes.Tenant {
  filesToUpload: FileDescriptorWithDocuments[];
}

/**
 * Repository for Tenant entity operations
 *
 * Provides an abstraction layer over database Tenant operations,
 * returning plain JavaScript objects.
 */
export interface ITenantRepository {
  /**
   * Find tenants by contact email
   */
  findByContactEmail(email: string): Promise<CollectionTypes.Tenant[]>;

  /**
   * Find tenants by contact email including other related entities
   * included entities
   * - Realm
   * - Lease
   */
  findAggregatedByContactEmail(email: string): Promise<CollectionTypes.Tenant[]>;
  
  /**
   * Find a tenant by ID
   */
  findById(id: string): Promise<CollectionTypes.Tenant | null>;

  /**
   * Find multiple tenants with filtering and sorting
   */
  find(
    filter: {
      realmId: string;
      tenantId?: string;
      startTerm?: number;
      endTerm?: number;
    },
    options?: { sort?: { name?: 'asc' | 'desc' } }
  ): Promise<CollectionTypes.Tenant[]>;

  /**
   * Find a single tenant by ID and realm
   */
  findOne(filter: {
    tenantId: string;
    realmId: string;
  }): Promise<CollectionTypes.Tenant | null>;

  /**
   * Find a single tenant by ID and contact email
   * included entities in the response
   * - Realm
   * - Lease
   */
  findOneByContactEmail(filter: {
      tenantId: string;
      email: string;
  }): Promise<CollectionTypes.Tenant | null>;

  /**
   * Find and update a tenant atomically
   */
  findOneAndUpdate(
    filter: {
      tenantId: string;
      realmId: string;
    },
    update: Partial<CollectionTypes.Tenant>,
    options?: { returnUpdated?: boolean }
  ): Promise<CollectionTypes.Tenant | null>;

  /**
   * Find tenants by property IDs
   */
  findByPropertyIds(
    propertyIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Tenant[]>;

  /**
   * Create a new tenant
   */
  create(
    tenantData: Partial<CollectionTypes.Tenant>
  ): Promise<CollectionTypes.Tenant>;

  /**
   * Update an existing tenant
   */
  update(
    tenantId: string,
    realmId: string,
    updateData: Partial<CollectionTypes.Tenant>
  ): Promise<CollectionTypes.Tenant | null>;

  /**
   * Find tenants by IDs with realm filtering
   */
  findByIds(
    tenantIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Tenant[]>;

  /**
   * Delete multiple tenants
   */
  deleteMany(tenantIds: string[], realmId: string): Promise<number>;

  /**
   * Find tenants with aggregation pipeline
   */
  findWithAggregation(
    realmId: string,
    tenantId?: string
  ): Promise<TenantWithFileDescriptors[]>;

  /**
   * Find all tenants by year
   */
  findAllByYear(realmId: string, year: number): Promise<any[]>;

  /**
   * Find all tenants in a realm
   */
  findAll(realmId: string): Promise<CollectionTypes.Tenant[]>;

  /**
   * Find tenant by ID and realm with populated properties
   */
  findByIdWithProperties(
    tenantId: string,
    realmId: string
  ): Promise<CollectionTypes.Tenant | null>;

  /**
   * Find tenant by ID with all references populated
   */
  findByIdWithAllReferences(
    tenantId: string
  ): Promise<CollectionTypes.Tenant | null>;
}
