import { TenantBaseRepository } from './base-repository.js';
import { ITenantRepository } from '../interface.js';
import { CollectionTypes } from '@microrealestate/types';
import { randomUUID } from 'crypto';
import logger from '../../../utils/logger.js';

/**
 * DynamoDB implementation of Tenant repository
 */
export default class TenantRepository
  extends TenantBaseRepository
  implements ITenantRepository
{
  /**
   * Find a tenant by ID
   * Note: Unlike other entities, this method does NOT require realmId parameter
   * because the interface signature is findById(id: string)
   * 
   * This requires scanning or using a GSI to find the tenant without knowing the realm
   * For now, this will throw an error as it requires GSI implementation
   */
  async findById(id: string): Promise<CollectionTypes.Tenant | null> {
    if (!id || typeof id !== 'string') {
      throw new Error('ID must be a non-empty string');
    }

    // TODO: This requires a GSI on TenantId to query without realmId
    // For now, throw an error indicating this needs GSI support
    throw new Error(
      'findById without realmId requires GSI implementation - use findOne() with realmId instead'
    );
  }
  /**
   * Create a new tenant
   * Generates UUID for tenant ID if not provided
   * Validates realmId and preserves all nested structures
   */
  async create(
    tenantData: Partial<CollectionTypes.Tenant>
  ): Promise<CollectionTypes.Tenant> {
    if (!tenantData || typeof tenantData !== 'object') {
      throw new Error('Tenant data must be an object');
    }
    if (!tenantData.realmId) {
      throw new Error('Tenant data must include realmId');
    }

    // Extract ID generation to separate variable
    const tenantId = tenantData._id || randomUUID();
    
    // Validate that tenantId is defined
    if (!tenantId) {
      throw new Error('Failed to generate tenant ID');
    }

    const tenant: CollectionTypes.Tenant = {
      _id: tenantId,
      realmId: tenantData.realmId,
      name: tenantData.name || '',
      isCompany: tenantData.isCompany || false,
      company: (tenantData.company || '') as any,
      manager: (tenantData.manager || '') as any,
      legalForm: (tenantData.legalForm || '') as any,
      siret: (tenantData.siret || '') as any,
      rcs: (tenantData.rcs || '') as any,
      capital: (tenantData.capital || 0) as any,
      street1: (tenantData.street1 || '') as any,
      street2: (tenantData.street2 || '') as any,
      zipCode: (tenantData.zipCode || '') as any,
      city: (tenantData.city || '') as any,
      country: (tenantData.country || '') as any,
      contacts: tenantData.contacts || [],
      reference: (tenantData.reference || '') as any,
      contract: (tenantData.contract || '') as any,
      leaseId: tenantData.leaseId || '',
      beginDate: tenantData.beginDate || (undefined as any),
      endDate: tenantData.endDate || (undefined as any),
      terminationDate: (tenantData.terminationDate || undefined) as any,
      properties: tenantData.properties || [],
      rents: tenantData.rents || [],
      isVat: tenantData.isVat || false,
      vatRatio: (tenantData.vatRatio || 0) as any,
      discount: (tenantData.discount || 0) as any,
      guaranty: (tenantData.guaranty || 0) as any,
      guarantyPayback: (tenantData.guarantyPayback || 0) as any,
      stepperMode: tenantData.stepperMode || false
    };

    return super.create(tenant);
  }

  /**
   * Find tenants by contact email using GSI
   * Uses GSI1 with ContactEmail as partition key
   */
  async findByContactEmail(email: string): Promise<CollectionTypes.Tenant[]> {
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }

    try {
      const result = await this.client.queryGSI('GSI1', {
        keyConditionExpression: '#gsi1pk = :email',
        expressionAttributeNames: {
          '#gsi1pk': 'GSI1PK'
        },
        expressionAttributeValues: {
          ':email': email
        }
      });

      logger.debug('Found tenants by contact email', {
        email,
        count: result.items.length
      });

      return result.items.map((item) => this.fromItem(item));
    } catch (error) {
      logger.error('Failed to find tenants by contact email', { email, error });
      throw error;
    }
  }

  /**
   * Find multiple tenants with filtering and sorting
   * Supports filtering by tenantId, term range, and sorting by name
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

    try {
      const pk = `REALM#${filter.realmId}`;
      let keyConditionExpression = '#pk = :pk AND begins_with(#sk, :skPrefix)';
      const expressionAttributeNames: Record<string, string> = {
        '#pk': 'PK',
        '#sk': 'SK'
      };
      const expressionAttributeValues: Record<string, any> = {
        ':pk': pk,
        ':skPrefix': 'TENANT#'
      };

      // If tenantId is specified, query for specific tenant
      if (filter.tenantId) {
        keyConditionExpression = '#pk = :pk AND #sk = :sk';
        expressionAttributeValues[':sk'] = `TENANT#${filter.tenantId}`;
      }

      // Note: DynamoDB doesn't support array wildcard syntax like Rents[*].term
      // We'll filter in memory after querying all tenants
      const result = await this.client.queryAll({
        keyConditionExpression,
        expressionAttributeNames,
        expressionAttributeValues,
        scanIndexForward: options?.sort?.name === 'desc' ? false : true
      });

      logger.debug('Found tenants with filters', {
        realmId: filter.realmId,
        tenantId: filter.tenantId,
        count: result.length
      });

      let tenants = result.map((item) => this.fromItem(item));

      // Apply term filtering in memory (DynamoDB doesn't support array filtering well)
      if (filter.startTerm || filter.endTerm) {
        tenants = tenants.filter((tenant) => {
          if (!tenant.rents || tenant.rents.length === 0) return false;

          return tenant.rents.some((rent: any) => {
            if (filter.startTerm && filter.endTerm) {
              return rent.term >= filter.startTerm && rent.term <= filter.endTerm;
            } else if (filter.startTerm) {
              return rent.term === filter.startTerm;
            }
            return false;
          });
        });
      }

      // Sort by name if requested (DynamoDB doesn't support sorting by non-key attributes)
      if (options?.sort?.name) {
        tenants.sort((a, b) => {
          const comparison = a.name.localeCompare(b.name);
          return options.sort!.name === 'desc' ? -comparison : comparison;
        });
      }

      return tenants;
    } catch (error) {
      logger.error('Failed to find tenants', { filter, error });
      throw error;
    }
  }

  /**
   * Find a single tenant by ID and realm
   * Uses base class findById method with realmId validation
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

    return super.findById(filter.tenantId, filter.realmId);
  }

  /**
   * Find and update a tenant atomically
   * Returns either the old or new version based on returnUpdated option
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

    try {
      // Get the current tenant (for returning old version if needed)
      const currentTenant = await this.findOne(filter);
      if (!currentTenant) {
        return null;
      }

      // Perform the update
      const updatedTenant = await this.update(
        filter.tenantId,
        filter.realmId,
        update
      );

      // Return based on returnUpdated option
      if (options?.returnUpdated) {
        return updatedTenant;
      } else {
        return currentTenant;
      }
    } catch (error) {
      logger.error('Failed to find and update tenant', { filter, error });
      throw error;
    }
  }

  /**
   * Find tenants by property IDs
   * Queries all tenants in realm and filters by property IDs in memory
   */
  async findByPropertyIds(
    propertyIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Tenant[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!Array.isArray(propertyIds)) {
      throw new Error('Property IDs must be a non-empty array');
    }
    if (propertyIds.length === 0) {
      return [];
    }

    try {
      // Query all tenants in the realm
      const allTenants = await this.findByRealm(realmId);

      // Filter tenants that have at least one matching property
      const matchingTenants = allTenants.filter((tenant) => {
        if (!tenant.properties || tenant.properties.length === 0) {
          return false;
        }

        return tenant.properties.some((prop: any) =>
          propertyIds.includes(prop.propertyId)
        );
      });

      logger.debug('Found tenants by property IDs', {
        realmId,
        propertyIds,
        count: matchingTenants.length
      });

      return matchingTenants;
    } catch (error) {
      logger.error('Failed to find tenants by property IDs', {
        realmId,
        propertyIds,
        error
      });
      throw error;
    }
  }

  /**
   * Update an existing tenant
   * Uses base class update method with nested structure merging
   */
  async update(
    tenantId: string,
    realmId: string,
    updateData: Partial<CollectionTypes.Tenant>
  ): Promise<CollectionTypes.Tenant | null> {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Tenant ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }

    return super.update(tenantId, realmId, updateData);
  }

  /**
   * Find multiple tenants by their IDs using batch get operations
   * Splits into batches of 100 items (DynamoDB limit)
   */
  async findByIds(
    tenantIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Tenant[]> {
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new Error('Tenant IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Build keys for batch get
      const keys = tenantIds.map((tenantId) => ({
        PK: this.buildPK(tenantId, realmId),
        SK: this.buildSK(tenantId)
      }));

      // Use batch get from client
      const items = await this.client.batchGet(keys);

      logger.debug('Found tenants by IDs', {
        realmId,
        requested: tenantIds.length,
        found: items.length
      });

      return items.map((item) => this.fromItem(item));
    } catch (error) {
      logger.error('Failed to find tenants by IDs', { realmId, error });
      throw error;
    }
  }

  /**
   * Delete multiple tenants using batch delete operations
   * Splits into batches of 25 items (DynamoDB limit)
   */
  async deleteMany(tenantIds: string[], realmId: string): Promise<number> {
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new Error('Tenant IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Build batch write items for deletion
      const items = tenantIds.map((tenantId) => ({
        deleteRequest: {
          PK: this.buildPK(tenantId, realmId),
          SK: this.buildSK(tenantId)
        }
      }));

      // Use batch write from client
      const result = await this.client.batchWrite(items);

      if (result.unprocessedItems.length > 0) {
        logger.warn('Some tenants were not deleted', {
          realmId,
          unprocessedCount: result.unprocessedItems.length
        });
      }

      logger.debug('Tenants deleted successfully', {
        realmId,
        count: tenantIds.length - result.unprocessedItems.length
      });

      return tenantIds.length - result.unprocessedItems.length;
    } catch (error) {
      logger.error('Failed to delete tenants', { realmId, error });
      throw error;
    }
  }

  /**
   * Find tenants with aggregation pipeline
   * This is a complex MongoDB aggregation that needs to be reimplemented for DynamoDB
   * Requires querying tenants, templates, and documents, then joining in memory
   * TODO: write a test for this function
   */
  async findWithAggregation(
    realmId: string,
    tenantId?: string
  ): Promise<any[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Import repositories dynamically to avoid circular dependencies
      const { getTemplateRepository } = await import('../../template/index.js');
      const { getDocumentRepository } = await import('../../document/index.js');
      const { getLeaseRepository } = await import('../../lease/index.js');
      const { getPropertyRepository } = await import('../../property/index.js');

      const templateRepository = getTemplateRepository();
      const documentRepository = getDocumentRepository();
      const leaseRepository = getLeaseRepository();
      const propertyRepository = getPropertyRepository();

      // Step 1: Query tenants (all or specific tenantId)
      let tenants: CollectionTypes.Tenant[];
      if (tenantId) {
        const tenant = await this.findOne({ tenantId, realmId });
        tenants = tenant ? [tenant] : [];
      } else {
        tenants = await this.findByRealm(realmId);
      }

      if (tenants.length === 0) {
        return [];
      }

      // Step 2: Query all templates with type='fileDescriptor' in the realm
      const allTemplates = await templateRepository.findAll(realmId);
      const fileDescriptorTemplates = allTemplates.filter(
        (template) => template.type === 'fileDescriptor'
      );

      // Step 3: Query all documents in the realm
      const allDocuments = await documentRepository.findAll(realmId);

      // Step 4: Build a map of leaseIds to populate
      const leaseIds = new Set<string>();
      tenants.forEach((tenant) => {
        if (tenant.leaseId) {
          leaseIds.add(tenant.leaseId as string);
        }
      });

      // Query leases for population
      const leases = leaseIds.size > 0 
        ? await leaseRepository.findByIds(Array.from(leaseIds), realmId)
        : [];
      const leaseMap = new Map(leases.map((lease) => [lease._id, lease]));

      // Step 5: Build a map of propertyIds to populate
      const propertyIds = new Set<string>();
      tenants.forEach((tenant) => {
        if (tenant.properties && Array.isArray(tenant.properties)) {
          tenant.properties.forEach((prop: any) => {
            if (prop.propertyId) {
              propertyIds.add(prop.propertyId);
            }
          });
        }
      });

      // Query properties for population
      const properties = propertyIds.size > 0
        ? await Promise.all(
            Array.from(propertyIds).map((propId) =>
              propertyRepository.findById(propId, realmId)
            )
          )
        : [];
      const propertyMap = new Map(
        properties.filter((p) => p !== null).map((prop) => [prop!._id, prop])
      );

      // Step 6: Process each tenant and build filesToUpload
      const results = tenants.map((tenant) => {
        const tenantLeaseId = tenant.leaseId;

        // Filter templates that are linked to this tenant's lease
        const relevantTemplates = fileDescriptorTemplates.filter((template) => {
          if (!template.linkedResourceIds || !tenantLeaseId) {
            return false;
          }
          return template.linkedResourceIds.includes(tenantLeaseId as string);
        });

        // For each template, find matching documents
        const filesToUpload = relevantTemplates.map((template) => {
          const matchingDocuments = allDocuments.filter(
            (doc) =>
              doc.tenantId === tenant._id &&
              doc.leaseId === tenantLeaseId &&
              doc.templateId === template._id &&
              doc.type === 'file'
          );

          // Project documents to remove unnecessary fields
          const documents = matchingDocuments.map((doc) => ({
            _id: doc._id,
            name: doc.name,
            description: doc.description,
            expiryDate: doc.expiryDate,
            createdDate: doc.createdDate,
            updatedDate: doc.updatedDate
          }));

          return {
            _id: template._id,
            name: template.name,
            description: template.description,
            required: template.required || false,
            requiredOnceContractTerminated:
              template.requiredOnceContractTerminated || false,
            documents
          };
        });

        // Populate leaseId reference
        const populatedLeaseId = tenantLeaseId && leaseMap.has(tenantLeaseId as string)
          ? leaseMap.get(tenantLeaseId as string)
          : tenantLeaseId;

        // Populate properties.propertyId references
        const populatedProperties = tenant.properties
          ? tenant.properties.map((prop: any) => {
              if (prop.propertyId && propertyMap.has(prop.propertyId)) {
                return {
                  ...prop,
                  propertyId: propertyMap.get(prop.propertyId)
                };
              }
              return prop;
            })
          : [];

        return {
          ...tenant,
          leaseId: populatedLeaseId,
          properties: populatedProperties,
          filesToUpload
        };
      });

      // Sort by name ascending
      results.sort((a, b) => a.name.localeCompare(b.name));

      logger.debug('Found tenants with aggregation', {
        realmId,
        tenantId,
        count: results.length
      });

      return results;
    } catch (error) {
      logger.error('Failed to find tenants with aggregation', {
        realmId,
        tenantId,
        error
      });
      throw error;
    }
  }

  /**
   * Find all tenants by year
   * Filters tenants with rents in the specified year
   */
  async findAllByYear(realmId: string, year: number): Promise<any[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!year || typeof year !== 'number') {
      throw new Error('Year must be a non-empty string');
    }

    try {
      // Query all tenants in the realm
      const allTenants = await this.findByRealm(realmId);

      // Filter tenants that have rents in the specified year
      const tenantsWithYear = allTenants.filter((tenant) => {
        if (!tenant.rents || tenant.rents.length === 0) {
          return false;
        }

        return tenant.rents.some((rent: any) => rent.year === year);
      });

      // Transform to match MongoDB aggregation output
      // This is a simplified version - full implementation would need more fields
      const results = tenantsWithYear.map((tenant) => ({
        _id: tenant._id,
        realmId: tenant.realmId,
        name: tenant.name,
        reference: tenant.reference,
        beginDate: tenant.beginDate,
        endDate: tenant.endDate,
        terminationDate: tenant.terminationDate,
        guaranty: tenant.guaranty,
        guarantyPayback: tenant.guarantyPayback,
        properties: tenant.properties,
        rents: tenant.rents.filter((rent: any) => rent.year === year),
        incoming: false, // TODO: Calculate based on beginDate
        outgoing: false // TODO: Calculate based on terminationDate/endDate
      }));

      // Sort by name (case-insensitive)
      results.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

      logger.debug('Found tenants by year', {
        realmId,
        year,
        count: results.length
      });

      return results;
    } catch (error) {
      logger.error('Failed to find tenants by year', { realmId, year, error });
      throw error;
    }
  }

  /**
   * Find all tenants in a realm
   * Uses base class findByRealm method with TENANT# prefix
   */
  async findAll(realmId: string): Promise<CollectionTypes.Tenant[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    return this.findByRealm(realmId);
  }

  /**
   * Find tenant by ID and realm with populated properties
   * Queries tenant and then queries properties to populate references
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

    try {
      // Get the tenant
      const tenant = await this.findOne({ tenantId, realmId });
      if (!tenant) {
        return null;
      }

      // TODO: Full implementation would query Property entities and populate
      // tenant.properties[].propertyId with actual Property objects
      // For now, return tenant as-is (property IDs are already in the data)
      
      logger.debug('Found tenant with properties', {
        tenantId,
        realmId
      });

      return tenant;
    } catch (error) {
      logger.error('Failed to find tenant with properties', {
        tenantId,
        realmId,
        error
      });
      throw error;
    }
  }

  /**
   * Find tenant by ID with all references populated
   * Queries tenant, realm, lease, and properties, then joins in memory
   */
  async findByIdWithAllReferences(
    tenantId: string
  ): Promise<CollectionTypes.Tenant | null> {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Tenant ID must be a non-empty string');
    }

    // TODO: This requires a GSI on TenantId to query without realmId
    // Or we need to scan all realms to find the tenant
    // For now, throw an error indicating this needs GSI support
    
    throw new Error(
      'findByIdWithAllReferences requires GSI on TenantId or scanning - not yet implemented for DynamoDB'
    );
  }
}
