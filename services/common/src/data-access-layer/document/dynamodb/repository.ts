import { DocumentBaseRepository } from './base-repository.js';
import { IDocumentRepository } from '../interface.js';
import { CollectionTypes } from '@microrealestate/types';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../../utils/logger.js';

/**
 * DynamoDB implementation of Document repository
 */
export default class DynamoRepository
  extends DocumentBaseRepository
  implements IDocumentRepository
{
  /**
   * Find all documents in a realm
   * Uses base class findByRealm method with DOCUMENT# prefix
   */
  async findAll(realmId: string): Promise<CollectionTypes.Document[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    return this.findByRealm(realmId);
  }

  /**
   * Find a single document by ID and realm
   * Uses base class findById method
   */
  async findById(
    documentId: string,
    realmId: string
  ): Promise<CollectionTypes.Document | null> {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Document ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    return super.findById(documentId, realmId);
  }

  /**
   * Create a new document
   * Generates UUID for document ID if not provided
   */
  async create(
    documentData: Partial<CollectionTypes.Document>
  ): Promise<CollectionTypes.Document> {
    if (!documentData || typeof documentData !== 'object') {
      throw new Error('Document data must be an object');
    }
    if (!documentData.realmId) {
      throw new Error('Document data must include realmId');
    }

    const document: CollectionTypes.Document = {
      _id: documentData._id || uuidv4(),
      realmId: documentData.realmId,
      tenantId: documentData.tenantId || '',
      leaseId: documentData.leaseId || '',
      templateId: documentData.templateId,
      type: documentData.type || '',
      name: documentData.name || '',
      description: documentData.description,
      mimeType: documentData.mimeType || '',
      expiryDate: documentData.expiryDate,
      contents: documentData.contents,
      html: documentData.html,
      url: documentData.url || '',
      versionId: documentData.versionId,
      createdDate: documentData.createdDate || new Date(),
      updatedDate: documentData.updatedDate || new Date()
    };

    return super.create(document);
  }

  /**
   * Update an existing document
   * Uses base class update method with automatic timestamp update
   */
  async update(
    documentId: string,
    realmId: string,
    updateData: Partial<CollectionTypes.Document>
  ): Promise<CollectionTypes.Document | null> {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Document ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }

    return super.update(documentId, realmId, updateData);
  }

  /**
   * Delete multiple documents using batch delete operations
   * Splits into batches of 25 items (DynamoDB limit)
   */
  async deleteMany(documentIds: string[], realmId: string): Promise<number> {
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new Error('Document IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Build batch write items for deletion
      const items = documentIds.map((documentId) => ({
        deleteRequest: {
          PK: this.buildPK(documentId, realmId),
          SK: this.buildSK(documentId)
        }
      }));

      // Use batch write from client
      const result = await this.client.batchWrite(items);

      if (result.unprocessedItems.length > 0) {
        logger.warn('Some documents were not deleted', {
          realmId,
          unprocessedCount: result.unprocessedItems.length
        });
      }

      logger.debug('Documents deleted successfully', {
        realmId,
        count: documentIds.length - result.unprocessedItems.length
      });

      return documentIds.length - result.unprocessedItems.length;
    } catch (error) {
      logger.error('Failed to delete documents', { realmId, error });
      throw error;
    }
  }

  /**
   * Find multiple documents by their IDs using batch get operations
   * Splits into batches of 100 items (DynamoDB limit)
   */
  async findByIds(
    documentIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Document[]> {
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new Error('Document IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Build keys for batch get
      const keys = documentIds.map((documentId) => ({
        PK: this.buildPK(documentId, realmId),
        SK: this.buildSK(documentId)
      }));

      // Use batch get from client
      const items = await this.client.batchGet(keys);

      logger.debug('Found documents by IDs', {
        realmId,
        requested: documentIds.length,
        found: items.length
      });

      return items.map((item) => this.fromItem(item));
    } catch (error) {
      logger.error('Failed to find documents by IDs', { realmId, error });
      throw error;
    }
  }

  /**
   * Find documents by tenant IDs using query with filter expression
   * Queries all documents in realm and filters by tenantId
   */
  async findByTenantIds(
    tenantIds: string[],
    realmId: string,
    projection?: Record<string, number>
  ): Promise<CollectionTypes.Document[]> {
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new Error('Tenant IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      const pk = `REALM#${realmId}`;

      // Build filter expression for tenant IDs
      const filterExpression = `TenantId IN (${tenantIds.map((_, i) => `:tid${i}`).join(', ')})`;
      const expressionAttributeValues: Record<string, any> = {
        ':pk': pk,
        ':skPrefix': 'DOCUMENT#'
      };

      // Add tenant ID values
      tenantIds.forEach((tenantId, i) => {
        expressionAttributeValues[`:tid${i}`] = tenantId;
      });

      const result = await this.client.queryAll({
        keyConditionExpression: '#pk = :pk AND begins_with(#sk, :skPrefix)',
        filterExpression,
        expressionAttributeNames: {
          '#pk': 'PK',
          '#sk': 'SK'
        },
        expressionAttributeValues
      });

      logger.debug('Found documents by tenant IDs', {
        realmId,
        tenantIds,
        count: result.length
      });

      return result.map((item) => this.fromItem(item));
    } catch (error) {
      logger.error('Failed to find documents by tenant IDs', {
        realmId,
        tenantIds,
        error
      });
      throw error;
    }
  }
}
