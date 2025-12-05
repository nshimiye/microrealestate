import DynamoDBClient from '../../utils/dynamodbclient.js';
import ServiceError from '../../utils/serviceerror.js';
import logger from '../../utils/logger.js';
import Service from '../../utils/service.js';

/**
 * Abstract base class for DynamoDB repositories.
 * Provides common CRUD operations and enforces consistent patterns
 * for key construction and data transformation.
 *
 * @template T The entity type this repository manages
 */
export abstract class BaseRepository<T> {
  protected client: DynamoDBClient;

  constructor() {
    const service = Service.getInstance();
    const { DYNAMODB_TABLE_NAME, DYNAMODB_REGION, DYNAMODB_ENDPOINT } = service.envConfig.getValues();

    if (!DYNAMODB_TABLE_NAME) {
        throw new Error('DYNAMODB_TABLE_NAME is required when USE_DYNAMODB is true');
    }

    this.client = DynamoDBClient.getInstance({
      tableName: DYNAMODB_TABLE_NAME,
      region: DYNAMODB_REGION,
      endpoint: DYNAMODB_ENDPOINT
    });
  }

    /**
   * Get the underlying DynamoDB client.
   * Useful for advanced operations not covered by repositories.
   */
  getClient(): DynamoDBClient {
    return this.client;
  }

  /**
   * Build the partition key for an entity.
   * Must be implemented by subclasses to define entity-specific key structure.
   *
   * @param id The entity identifier
   * @param realmId Optional realm identifier for multi-tenant entities
   * @returns The partition key string
   */
  protected abstract buildPK(id: string, realmId?: string): string;

  /**
   * Build the sort key for an entity.
   * Must be implemented by subclasses to define entity-specific key structure.
   *
   * @param id The entity identifier
   * @returns The sort key string
   */
  protected abstract buildSK(id: string): string;

  /**
   * Transform an application entity to a DynamoDB item.
   * Must be implemented by subclasses to handle entity-specific fields.
   *
   * @param entity The application entity
   * @returns The DynamoDB item representation
   */
  protected abstract toItem(entity: T): Record<string, any>;

  /**
   * Transform a DynamoDB item to an application entity.
   * Must be implemented by subclasses to handle entity-specific fields.
   *
   * @param item The DynamoDB item
   * @returns The application entity
   */
  protected abstract fromItem(item: Record<string, any>): T;

  /**
   * Validate that an item does not exceed DynamoDB's 400KB size limit.
   *
   * @param item The item to validate
   * @throws ServiceError if item exceeds size limit
   */
  protected validateItemSize(item: Record<string, any>): void {
    const itemSize = JSON.stringify(item).length;
    const maxSize = 400 * 1024; // 400KB in bytes

    if (itemSize > maxSize) {
      const errorMsg = `Item size (${itemSize} bytes) exceeds DynamoDB limit of 400KB (${maxSize} bytes)`;
      logger.error(errorMsg, { itemSize, maxSize });
      throw new ServiceError(errorMsg, 400);
    }
  }

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
        SK: item.SK,
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
  async findById(id: string, realmId?: string): Promise<T | null> {
    try {
      const key = {
        PK: this.buildPK(id, realmId),
        SK: this.buildSK(id),
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
    updates: Partial<T>,
  ): Promise<T|null> {
    try {
      const key = {
        PK: this.buildPK(id, realmId),
        SK: this.buildSK(id),
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
        SK: key.SK,
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
  async delete(id: string, realmId?: string): Promise<void> {
    try {
      const key = {
        PK: this.buildPK(id, realmId),
        SK: this.buildSK(id),
      };

      await this.client.deleteItem(key);

      logger.debug('Entity deleted successfully', {
        PK: key.PK,
        SK: key.SK,
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
          '#sk': 'SK',
        },
        expressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': entityPrefix,
        },
      });

      logger.debug('Found entities by realm', {
        realmId,
        entityPrefix,
        count: result.length,
      });

      return result.map((item) => this.fromItem(item));
    } catch (error) {
      logger.error('Failed to find entities by realm', {
        realmId,
        entityPrefix,
        error,
      });
      throw error;
    }
  }
}
