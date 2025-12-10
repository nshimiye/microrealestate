import logger from '../../../utils/logger.js';
import { BaseOthersCRUDRepository } from '../../dynamo/base-others-crud.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * Base repository for Document entity in DynamoDB
 */
export abstract class DocumentBaseRepository extends BaseOthersCRUDRepository<CollectionTypes.Document> {
  /**
   * Build partition key for Document entity.
   * Format: REALM#<realmId>
   *
   * @param documentId The document identifier (not used for PK)
   * @param realmId The realm identifier
   * @returns The partition key
   */
  protected buildPK(documentId: string, realmId: string): string {
    if (!realmId) {
      throw new Error('realmId is required for Document entities');
    }
    return `REALM#${realmId}`;
  }

  /**
   * Build sort key for Document entity.
   * Format: DOCUMENT#<documentId>
   *
   * @param documentId The document identifier
   * @returns The sort key
   */
  protected buildSK(documentId: string): string {
    return `DOCUMENT#${documentId}`;
  }

  /**
   * Transform Document entity to DynamoDB item.
   * Includes GSI3 keys for tenant relationship lookups.
   * Preserves all fields including contents, html, and metadata.
   *
   * @param entity The Document entity
   * @returns The DynamoDB item
   */
  protected toItem(entity: CollectionTypes.Document): Record<string, any> {
    const documentId = entity._id;
    const realmId = entity.realmId;
    const tenantId = entity.tenantId;
    const leaseId = entity.leaseId;
    const templateId = entity.templateId;

    const item: Record<string, any> = {
      PK: this.buildPK(documentId, realmId),
      SK: this.buildSK(documentId),
      EntityType: 'Document',
      RealmId: realmId,
      DocumentId: documentId,
      TenantId: tenantId,
      LeaseId: leaseId,
      TemplateId: templateId,

      // Document metadata
      Type: entity.type,
      Name: entity.name,
      Description: entity.description,
      MimeType: entity.mimeType,
      ExpiryDate: entity.expiryDate
        ? entity.expiryDate.toISOString()
        : undefined,

      // Document content
      Contents: entity.contents,
      Html: entity.html,
      Url: entity.url,
      VersionId: entity.versionId,

      // Timestamps
      CreatedDate: entity.createdDate
        ? entity.createdDate.toISOString()
        : new Date().toISOString(),
      UpdatedDate: entity.updatedDate
        ? entity.updatedDate.toISOString()
        : new Date().toISOString()
    };

    // Add GSI3 keys for tenant relationship lookups (if tenantId exists)
    if (tenantId) {
      item.GSI3PK = `TENANT#${tenantId}`;
      item.GSI3SK = `DOCUMENT#${documentId}`;
    }

    return item;
  }

  /**
   * Transform DynamoDB item to Document entity.
   * Restores all fields from DynamoDB format.
   *
   * @param item The DynamoDB item
   * @returns The Document entity
   */
  protected fromItem(item: Record<string, any>): CollectionTypes.Document {
    return {
      _id: item.DocumentId,
      realmId: item.RealmId,
      tenantId: item.TenantId,
      leaseId: item.LeaseId,
      templateId: item.TemplateId,

      // Document metadata
      type: item.Type,
      name: item.Name,
      description: item.Description,
      mimeType: item.MimeType,
      expiryDate: item.ExpiryDate ? new Date(item.ExpiryDate) : undefined,

      // Document content
      contents: item.Contents,
      html: item.Html,
      url: item.Url,
      versionId: item.VersionId,

      // Timestamps
      createdDate: item.CreatedDate
        ? new Date(item.CreatedDate)
        : (undefined as any),
      updatedDate: item.UpdatedDate
        ? new Date(item.UpdatedDate)
        : (undefined as any)
    };
  }

  /**
   * Find all documents for a given realm.
   * Uses the base repository's findByRealm method with DOCUMENT# prefix.
   *
   * @param realmId The realm identifier
   * @returns Array of documents in the realm
   * @throws ServiceError if query fails
   */
  async findByRealm(realmId: string): Promise<CollectionTypes.Document[]> {
    return super.findByRealm(realmId, 'DOCUMENT#');
  }

  /**
   * Find all documents for a given tenant using GSI3.
   * This enables querying documents by their tenant relationship.
   *
   * @param tenantId The tenant identifier
   * @returns Array of documents associated with the tenant
   * @throws ServiceError if query fails
   */
  async findByTenant(tenantId: string): Promise<CollectionTypes.Document[]> {
    try {
      const result = await this.client.queryGSI('GSI3', {
        keyConditionExpression:
          '#gsi3pk = :gsi3pk AND begins_with(#gsi3sk, :skPrefix)',
        expressionAttributeNames: {
          '#gsi3pk': 'GSI3PK',
          '#gsi3sk': 'GSI3SK'
        },
        expressionAttributeValues: {
          ':gsi3pk': `TENANT#${tenantId}`,
          ':skPrefix': 'DOCUMENT#'
        }
      });

      logger.debug('Found documents by tenant', {
        tenantId,
        count: result.items.length
      });

      return result.items.map((item) => this.fromItem(item));
    } catch (error) {
      logger.error('Failed to find documents by tenant', { tenantId, error });
      throw error;
    }
  }

  /**
   * Create a new document.
   * Overrides base method for clarity and validation.
   *
   * @param entity The document to create
   * @returns The created document
   * @throws ServiceError if creation fails or realmId is missing
   */
  async create(
    entity: CollectionTypes.Document
  ): Promise<CollectionTypes.Document> {
    const realmId = entity.realmId;

    if (!realmId) {
      throw new Error('realmId is required to create a Document');
    }

    // Set timestamps if not provided
    const documentWithTimestamps = {
      ...entity,
      createdDate: entity.createdDate || new Date(),
      updatedDate: entity.updatedDate || new Date()
    };

    return super.create(documentWithTimestamps);
  }

  /**
   * Find document by ID.
   * Requires realmId for partition key construction.
   *
   * @param documentId The document identifier
   * @param realmId The realm identifier
   * @returns The document if found, null otherwise
   * @throws Error if realmId is not provided
   */
  async findById(
    documentId: string,
    realmId?: string
  ): Promise<CollectionTypes.Document | null> {
    if (!realmId) {
      throw new Error('realmId is required to find a Document by ID');
    }
    return super.findById(documentId, realmId);
  }

  /**
   * Update a document.
   * Requires realmId for partition key construction.
   * Automatically updates the updatedDate timestamp.
   *
   * @param documentId The document identifier
   * @param updates Partial document updates
   * @param realmId The realm identifier
   * @returns The updated document
   * @throws Error if realmId is not provided
   */
  async update(
    documentId: string,
    realmId: string,
    updates: Partial<CollectionTypes.Document>
  ): Promise<CollectionTypes.Document | null> {
    if (!realmId) {
      throw new Error('realmId is required to update a Document');
    }

    // Automatically update the updatedDate timestamp
    const updatesWithTimestamp = {
      ...updates,
      updatedDate: new Date()
    };

    return super.update(documentId, realmId, updatesWithTimestamp);
  }

  /**
   * Delete a document.
   * Requires realmId for partition key construction.
   *
   * @param documentId The document identifier
   * @param realmId The realm identifier
   * @throws Error if realmId is not provided
   */
  async delete(documentId: string, realmId?: string): Promise<void> {
    if (!realmId) {
      throw new Error('realmId is required to delete a Document');
    }
    return super.delete(documentId, realmId);
  }
}
