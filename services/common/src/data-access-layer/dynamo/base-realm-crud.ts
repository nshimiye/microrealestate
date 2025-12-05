import DynamoDBClient from '../../utils/dynamodbclient.js';
import ServiceError from '../../utils/serviceerror.js';
import logger from '../../utils/logger.js';
import { BaseRepository } from './base.js';

/**
 * used by realm
 */
export abstract class BaseRealmCRUDRepository<T> extends BaseRepository<T> {
  /**
   * Create a new entity in DynamoDB.
   *
   * @param entity The entity to create
   * @returns The created entity
   * @throws ServiceError if creation fails or item exceeds size limit
   */
  async create(entity: T): Promise<T> {
    try {
      const item = this.toItem(entity);

      // Validate item size before attempting to write
      this.validateItemSize(item);

      await this.client.putItem(item);

      logger.debug('Entity created successfully', {
        PK: item.PK,
        SK: item.SK
      });

      return entity;
    } catch (error) {
      logger.error('Failed to create entity', { error });
      throw error;
    }
  }

  /**
   * Find an entity by its identifier.
   *
   * @param id The entity identifier
   * @param realmId Optional realm identifier for multi-tenant entities
   * @returns The entity if found, null otherwise
   * @throws ServiceError if retrieval fails
   */
  async findById(id: string): Promise<T | null> {
    try {
      const key = {
        PK: this.buildPK(id),
        SK: this.buildSK(id)
      };

      const item = await this.client.getItem(key);

      if (!item) {
        logger.debug('Entity not found', { id });
        return null;
      }

      return this.fromItem(item);
    } catch (error) {
      logger.error('Failed to find entity by id', { id, error });
      throw error;
    }
  }

  /**
   * Update an entity with partial updates.
   *
   * @param id The entity identifier
   * @param updates Partial entity updates
   * @returns The updated entity
   * @throws ServiceError if update fails or entity not found
   */
  async update(id: string, updates: Partial<T>): Promise<T | null> {
    try {
      const key = {
        PK: this.buildPK(id),
        SK: this.buildSK(id)
      };

      // First, get the existing item to ensure it exists
      const existingItem = await this.client.getItem(key);
      if (!existingItem) {
        throw new ServiceError('Entity not found', 404);
      }

      // Transform updates to DynamoDB format
      const existingEntity = this.fromItem(existingItem);
      const updatedEntity = { ...existingEntity, ...updates };
      const updatedItem = this.toItem(updatedEntity);

      // Validate item size after updates
      this.validateItemSize(updatedItem);

      // Extract only the fields that changed (excluding PK, SK)
      const { PK, SK, ...itemUpdates } = updatedItem;

      // Use conditional update to prevent race conditions
      await this.client.updateItem(
        key,
        itemUpdates,
        'attribute_exists(PK)', // Ensure item still exists
        undefined,
        undefined
      );

      logger.debug('Entity updated successfully', {
        PK: key.PK,
        SK: key.SK
      });

      return updatedEntity;
    } catch (error) {
      logger.error('Failed to update entity', { id, error });
      throw error;
    }
  }

  /**
   * Delete an entity by its identifier.
   *
   * @param id The entity identifier
   * @param realmId Optional realm identifier for multi-tenant entities
   * @throws ServiceError if deletion fails
   */
  async delete(id: string): Promise<void> {
    try {
      const key = {
        PK: this.buildPK(id),
        SK: this.buildSK(id)
      };

      await this.client.deleteItem(key);

      logger.debug('Entity deleted successfully', {
        PK: key.PK,
        SK: key.SK
      });
    } catch (error) {
      logger.error('Failed to delete entity', { id, error });
      throw error;
    }
  }
}
