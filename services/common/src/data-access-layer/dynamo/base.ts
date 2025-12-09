import DynamoDBClient from '../../utils/dynamodbclient.js';
import ServiceError from '../../utils/serviceerror.js';
import logger from '../../utils/logger.js';
// import Service from '../../utils/service.js';

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
    // const service = Service.getInstance();
    // const { DYNAMODB_TABLE_NAME, DYNAMODB_REGION, DYNAMODB_ENDPOINT } =
      // service.envConfig.getValues();
    const DYNAMODB_TABLE_NAME = 'microrealestate-local', DYNAMODB_REGION = 'us-east-1', DYNAMODB_ENDPOINT  = 'http://dynamodb-local:8000';
    if (!DYNAMODB_TABLE_NAME) {
      throw new Error(
        'DYNAMODB_TABLE_NAME is required when USE_DYNAMODB is true'
      );
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
}
