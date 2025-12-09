import DynamoDBClient from '../../utils/dynamodbclient.js';
import ServiceError from '../../utils/serviceerror.js';
import logger from '../../utils/logger.js';
import Service from '../../utils/service.js';
import { BaseRepository } from './base.js';

/**
 * Used by all entities except realm
 * All entities rely on realm, so you need realmId to interact with their data
 */
export abstract class BaseOthersCRUDRepository<T> extends BaseRepository<T> {
  /**
   * Create a new entity in DynamoDB.
   *
   * @param entity The entity to create
   * @returns The created entity
   * @throws ServiceError if creation fails or item exceeds size limit
   */
  async create(entity: T): Promise<T> {
    try {
      // Validate that entity has a defined _id before calling toItem
      const entityId = (entity as any)._id;
      if (!entityId) {
        throw new ServiceError(
          'Entity must have a defined _id before creation',
          400
        );
      }

      const item = this.toItem(entity);

      // Validate item size before attempting to write
      this.validateItemSize(item);

      await this.client.putItem(item);

      logger.debug('Entity created successfully', {
        PK: item.PK,
        SK: item.SK,
        entityId: entityId
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
  async findById(id: string, realmId: string): Promise<T | null> {
    try {
      const key = {
        PK: this.buildPK(id, realmId),
        SK: this.buildSK(id)
      };

      const item = await this.client.getItem(key);

      if (!item) {
        logger.debug('Entity not found', { id, realmId });
        return null;
      }

      return this.fromItem(item);
    } catch (error) {
      logger.error('Failed to find entity by id', { id, realmId, error });
      throw error;
    }
  }

  /**
   * Update an entity with partial updates.
   *
   * @param id The entity identifier
   * @param updates Partial entity updates
   * @param realmId Optional realm identifier for multi-tenant entities
   * @returns The updated entity
   * @throws ServiceError if update fails or entity not found
   */
  async update(
    id: string,
    realmId: string,
    updates: Partial<T>
  ): Promise<T | null> {
    try {
      const key = {
        PK: this.buildPK(id, realmId),
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
      logger.error('Failed to update entity', { id, realmId, error });
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
  async delete(id: string, realmId: string): Promise<void> {
    try {
      const key = {
        PK: this.buildPK(id, realmId),
        SK: this.buildSK(id)
      };

      await this.client.deleteItem(key);

      logger.debug('Entity deleted successfully', {
        PK: key.PK,
        SK: key.SK
      });
    } catch (error) {
      logger.error('Failed to delete entity', { id, realmId, error });
      throw error;
    }
  }

  /**
   * Find all entities for a given realm.
   * Uses a query operation with the realm's partition key.
   *
   * @param realmId The realm identifier
   * @param entityPrefix The entity type prefix for the sort key (e.g., "TENANT#", "PROPERTY#")
   * @returns Array of entities in the realm
   * @throws ServiceError if query fails
   */
  async findByRealm(realmId: string, entityPrefix: string): Promise<T[]> {
    try {
      const pk = `REALM#${realmId}`;

      const result = await this.client.queryAll({
        keyConditionExpression: '#pk = :pk AND begins_with(#sk, :skPrefix)',
        expressionAttributeNames: {
          '#pk': 'PK',
          '#sk': 'SK'
        },
        expressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': entityPrefix
        }
      });

      logger.debug('Found entities by realm', {
        realmId,
        entityPrefix,
        count: result.length
      });

      return result.map((item) => this.fromItem(item));
    } catch (error) {
      logger.error('Failed to find entities by realm', {
        realmId,
        entityPrefix,
        error
      });
      throw error;
    }
  }
}
