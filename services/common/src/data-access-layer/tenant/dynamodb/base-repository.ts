import logger from '../../../utils/logger.js';

import { BaseOthersCRUDRepository } from '../../dynamo/base-others-crud.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * Base repository for Tenant entity in DynamoDB
 */
export abstract class TenantBaseRepository extends BaseOthersCRUDRepository<CollectionTypes.Tenant> {
  /**
   * Build partition key for Tenant entity.
   * Format: REALM#<realmId>
   *
   * @param tenantId The tenant identifier (not used for PK)
   * @param realmId The realm identifier
   * @returns The partition key
   */
  protected buildPK(tenantId: string, realmId?: string): string {
    if (!realmId) {
      throw new Error('realmId is required for Tenant entities');
    }
    return `REALM#${realmId}`;
  }

  /**
   * Build sort key for Tenant entity.
   * Format: TENANT#<tenantId>
   *
   * @param tenantId The tenant identifier
   * @returns The sort key
   */
  protected buildSK(tenantId: string): string {
    return `TENANT#${tenantId}`;
  }

  /**
   * Transform Tenant entity to DynamoDB item.
   * Includes GSI2 keys for lease relationship lookups.
   * Preserves all nested structures (properties array, rents object, contacts).
   *
   * @param entity The Tenant entity
   * @returns The DynamoDB item
   */
  protected toItem(entity: CollectionTypes.Tenant): Record<string, any> {
    const tenantId = entity._id;
    const realmId =
      typeof entity.realmId === 'string' ? entity.realmId : entity.realmId._id;
    const leaseId =
      typeof entity.leaseId === 'string' ? entity.leaseId : entity.leaseId?._id;

    // Convert Date objects to ISO strings in properties array
    const properties = (entity.properties || []).map((prop) => ({
      ...prop,
      entryDate: prop.entryDate ? prop.entryDate.toISOString() : undefined,
      exitDate: prop.exitDate ? prop.exitDate.toISOString() : undefined,
      expenses: (prop.expenses || []).map((expense) => ({
        ...expense,
        beginDate: expense.beginDate
          ? expense.beginDate.toISOString()
          : undefined,
        endDate: expense.endDate ? expense.endDate.toISOString() : undefined
      }))
    }));

    const item: Record<string, any> = {
      PK: this.buildPK(tenantId, realmId),
      SK: this.buildSK(tenantId),
      EntityType: 'Tenant',
      RealmId: realmId,
      TenantId: tenantId,
      Name: entity.name,

      // Company details
      IsCompany: entity.isCompany || false,
      Company: entity.company,
      Manager: entity.manager,
      LegalForm: entity.legalForm,
      Siret: entity.siret,
      Rcs: entity.rcs,
      Capital: entity.capital,

      // Address
      Street1: entity.street1,
      Street2: entity.street2,
      ZipCode: entity.zipCode,
      City: entity.city,
      Country: entity.country,

      // Contacts
      Contacts: entity.contacts || [],

      // Contract details
      Reference: entity.reference,
      Contract: entity.contract,
      LeaseId: leaseId,
      BeginDate: entity.beginDate ? entity.beginDate.toISOString() : undefined,
      EndDate: entity.endDate ? entity.endDate.toISOString() : undefined,
      TerminationDate: entity.terminationDate
        ? entity.terminationDate.toISOString()
        : undefined,

      // Properties and rents
      Properties: properties,
      Rents: entity.rents || [],

      // Billing
      IsVat: entity.isVat || false,
      VatRatio: entity.vatRatio,
      Discount: entity.discount,
      Guaranty: entity.guaranty,
      GuarantyPayback: entity.guarantyPayback,

      // UI state
      StepperMode: entity.stepperMode || false
    };

    // Add GSI2 keys for lease relationship lookups (if leaseId exists)
    if (leaseId) {
      item.GSI2PK = `LEASE#${leaseId}`;
      item.GSI2SK = `TENANT#${tenantId}`;
    }

    return item;
  }

  /**
   * Transform DynamoDB item to Tenant entity.
   * Restores all nested structures from DynamoDB format.
   *
   * @param item The DynamoDB item
   * @returns The Tenant entity
   */
  protected fromItem(item: Record<string, any>): CollectionTypes.Tenant {
    // Convert ISO strings back to Date objects in properties array
    const properties = (item.Properties || []).map((prop: any) => ({
      ...prop,
      entryDate: prop.entryDate ? new Date(prop.entryDate) : undefined,
      exitDate: prop.exitDate ? new Date(prop.exitDate) : undefined,
      expenses: (prop.expenses || []).map((expense: any) => ({
        ...expense,
        beginDate: expense.beginDate ? new Date(expense.beginDate) : undefined,
        endDate: expense.endDate ? new Date(expense.endDate) : undefined
      }))
    }));

    return {
      _id: item.TenantId,
      realmId: item.RealmId,
      name: item.Name,

      // Company details
      isCompany: item.IsCompany || false,
      company: item.Company,
      manager: item.Manager,
      legalForm: item.LegalForm,
      siret: item.Siret,
      rcs: item.Rcs,
      capital: item.Capital,

      // Address
      street1: item.Street1,
      street2: item.Street2,
      zipCode: item.ZipCode,
      city: item.City,
      country: item.Country,

      // Contacts
      contacts: item.Contacts || [],

      // Contract details
      reference: item.Reference,
      contract: item.Contract,
      leaseId: item.LeaseId,
      beginDate: item.BeginDate ? new Date(item.BeginDate) : (undefined as any),
      endDate: item.EndDate ? new Date(item.EndDate) : (undefined as any),
      terminationDate: item.TerminationDate
        ? new Date(item.TerminationDate)
        : (undefined as any),

      // Properties and rents
      properties,
      rents: item.Rents || [],

      // Billing
      isVat: item.IsVat || false,
      vatRatio: item.VatRatio,
      discount: item.Discount,
      guaranty: item.Guaranty,
      guarantyPayback: item.GuarantyPayback,

      // UI state
      stepperMode: item.StepperMode || false
    };
  }

  /**
   * Find all tenants for a given realm.
   * Uses the base repository's findByRealm method with TENANT# prefix.
   *
   * @param realmId The realm identifier
   * @returns Array of tenants in the realm
   * @throws ServiceError if query fails
   */
  async findByRealm(realmId: string): Promise<CollectionTypes.Tenant[]> {
    return super.findByRealm(realmId, 'TENANT#');
  }

  /**
   * Find all tenants for a given lease using GSI2.
   * This enables querying tenants by their lease relationship.
   *
   * @param leaseId The lease identifier
   * @returns Array of tenants associated with the lease
   * @throws ServiceError if query fails
   */
  async findByLease(leaseId: string): Promise<CollectionTypes.Tenant[]> {
    try {
      const result = await this.client.queryGSI('GSI2', {
        keyConditionExpression: '#gsi2pk = :gsi2pk',
        expressionAttributeNames: {
          '#gsi2pk': 'GSI2PK'
        },
        expressionAttributeValues: {
          ':gsi2pk': `LEASE#${leaseId}`
        }
      });

      logger.debug('Found tenants by lease', {
        leaseId,
        count: result.items.length
      });

      return result.items.map((item) => this.fromItem(item));
    } catch (error) {
      logger.error('Failed to find tenants by lease', { leaseId, error });
      throw error;
    }
  }

  /**
   * Create a new tenant.
   * Overrides base method for clarity and validation.
   *
   * @param entity The tenant to create
   * @returns The created tenant
   * @throws ServiceError if creation fails or realmId is missing
   */
  async create(
    entity: CollectionTypes.Tenant
  ): Promise<CollectionTypes.Tenant> {
    const realmId =
      typeof entity.realmId === 'string' ? entity.realmId : entity.realmId._id;

    if (!realmId) {
      throw new Error('realmId is required to create a Tenant');
    }

    return super.create(entity);
  }

  /**
   * Find tenant by ID.
   * Requires realmId for partition key construction.
   *
   * @param tenantId The tenant identifier
   * @param realmId The realm identifier
   * @returns The tenant if found, null otherwise
   * @throws Error if realmId is not provided
   */
  async findById(
    tenantId: string,
    realmId?: string
  ): Promise<CollectionTypes.Tenant | null> {
    if (!realmId) {
      throw new Error('realmId is required to find a Tenant by ID');
    }
    return super.findById(tenantId, realmId);
  }

  /**
   * Update a tenant.
   * Requires realmId for partition key construction.
   *
   * @param tenantId The tenant identifier
   * @param updates Partial tenant updates
   * @param realmId The realm identifier
   * @returns The updated tenant
   * @throws Error if realmId is not provided
   */
  async update(
    tenantId: string,
    realmId: string,
    updates: Partial<CollectionTypes.Tenant>
  ): Promise<CollectionTypes.Tenant | null> {
    if (!realmId) {
      throw new Error('realmId is required to update a Tenant');
    }
    return super.update(tenantId, realmId, updates);
  }

  /**
   * Delete a tenant.
   * Requires realmId for partition key construction.
   *
   * @param tenantId The tenant identifier
   * @param realmId The realm identifier
   * @throws Error if realmId is not provided
   */
  async delete(tenantId: string, realmId?: string): Promise<void> {
    if (!realmId) {
      throw new Error('realmId is required to delete a Tenant');
    }
    return super.delete(tenantId, realmId);
  }
}
