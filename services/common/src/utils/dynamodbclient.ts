import {
  DynamoDBClient as AWSDynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  ConditionalCheckFailedException,
  ProvisionedThroughputExceededException,
  ItemCollectionSizeLimitExceededException,
  TransactionConflictException
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
import EnvironmentConfig from './environmentconfig.js';
import logger from './logger.js';
import ServiceError from './serviceerror.js';

export interface DynamoDBClientConfig {
  region?: string;
  endpoint?: string;
  tableName: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface QueryParams {
  keyConditionExpression: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, any>;
  filterExpression?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, any>;
  scanIndexForward?: boolean;
  projectionExpression?: string;
}

export interface QueryResult {
  items: Record<string, any>[];
  lastEvaluatedKey?: Record<string, any>;
  count: number;
}

export interface ScanParams {
  filterExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, any>;
  limit?: number;
  exclusiveStartKey?: Record<string, any>;
  projectionExpression?: string;
}

export interface ScanResult {
  items: Record<string, any>[];
  lastEvaluatedKey?: Record<string, any>;
  count: number;
}

export interface BatchWriteItem {
  putRequest?: Record<string, any>;
  deleteRequest?: { PK: string; SK: string };
}

export interface BatchWriteResult {
  unprocessedItems: BatchWriteItem[];
}

export interface TableSchema {
  attributeDefinitions: Array<{
    attributeName: string;
    attributeType: string;
  }>;
  keySchema: Array<{
    attributeName: string;
    keyType: string;
  }>;
  globalSecondaryIndexes?: Array<{
    indexName: string;
    keySchema: Array<{
      attributeName: string;
      keyType: string;
    }>;
    projection: {
      projectionType: string;
      nonKeyAttributes?: string[];
    };
  }>;
  billingMode?: string;
  pointInTimeRecoveryEnabled?: boolean;
  sseEnabled?: boolean;
}

process.on('SIGINT', async () => {
  try {
    await DynamoDBClient.getInstance()?.disconnect();
  } catch (error) {
    console.error(error);
  }
});

const DynamoDBClientTESTConfig = {
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  tableName: 'microrealestate-local',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local'
  }
}
export default class DynamoDBClient {
  private static instance: DynamoDBClient | null = null;

  static getInstance(config?: DynamoDBClientConfig) {
    if (!DynamoDBClient.instance) {
      if (!config) {
        throw new Error('config is required');
      }
      DynamoDBClient.instance = new DynamoDBClient(DynamoDBClientTESTConfig);
      DynamoDBClient.instance.connect(); // HACK
    }
    return DynamoDBClient.instance;
  }

  private client: AWSDynamoDBClient | null = null;
  private docClient: DynamoDBDocumentClient | null = null;
  private config: DynamoDBClientConfig;

  private constructor(config: DynamoDBClientConfig) {
    this.config = config;
  }

  isConnected = false;
  async connect() {
    if (this.isConnected) {
      return;
    }
    this.isConnected = true;
    if (!this.client) {
      logger.debug(
        `connecting to DynamoDB at ${this.config.endpoint || 'AWS'}...`
      );

      const clientConfig: any = {
        region: this.config.region || 'us-east-1'
      };

      if (this.config.endpoint) {
        clientConfig.endpoint = this.config.endpoint;
      }

      if (this.config.credentials) {
        clientConfig.credentials = this.config.credentials;
      }

      this.client = new AWSDynamoDBClient(clientConfig);
      this.docClient = DynamoDBDocumentClient.from(this.client, {
        marshallOptions: {
          removeUndefinedValues: true,
          // convertEmptyValues: false - Empty strings are NOT automatically converted
          // DynamoDB does not support empty strings as attribute values.
          // Empty string handling is intentionally deferred as it requires system-wide
          // changes to data transformation. See DYNAMODB_CONSTRAINTS.md for details.
          convertEmptyValues: false
        },
        unmarshallOptions: {
          wrapNumbers: false
        }
      });

      logger.debug('DynamoDB client ready');
    }
  }

  async disconnect() {
    if (this.client) {
      logger.debug('disconnecting DynamoDB client...');
      this.client.destroy();
      this.client = null;
      this.docClient = null;
      logger.debug('DynamoDB client disconnected');
    }
  }

  private ensureConnected() {
    if (!this.docClient) {
      throw new Error('DynamoDB client not connected. Call connect() first.');
    }
  }

  private translateError(error: any): ServiceError {
    if (error instanceof ConditionalCheckFailedException) {
      return new ServiceError(
        'Conditional check failed - item may have been modified',
        409
      );
    }

    if (error instanceof ProvisionedThroughputExceededException) {
      return new ServiceError(
        'Request rate exceeded - please retry with backoff',
        429
      );
    }

    if (error instanceof ItemCollectionSizeLimitExceededException) {
      return new ServiceError('Item collection size limit exceeded', 400);
    }

    if (error instanceof TransactionConflictException) {
      return new ServiceError('Transaction conflict - please retry', 409);
    }

    if (error.name === 'ValidationException') {
      return new ServiceError(`Validation error: ${error.message}`, 400);
    }

    if (error instanceof ResourceNotFoundException) {
      return new ServiceError('Resource not found', 404);
    }

    // Generic error
    return new ServiceError(error.message || 'DynamoDB operation failed', 500);
  }

  async putItem(item: Record<string, any>): Promise<void> {
    this.ensureConnected();
    // ensure PK,SK, and _id are defined and do not contain undefined

    try {
      const itemSize = JSON.stringify(item).length;
      if (itemSize > 400 * 1024) {
        throw new ServiceError(
          `Item size (${itemSize} bytes) exceeds DynamoDB limit of 400KB`,
          400
        );
      }

      await this.docClient!.send(
        new PutCommand({
          TableName: this.config.tableName,
          Item: item
        })
      );
    } catch (error) {
      console.log('aaaa', this.config.tableName, JSON.stringify(item));
      throw this.translateError(error);
    }
  }

  async getItem(key: {
    PK: string;
    SK: string;
  }): Promise<Record<string, any> | null> {
    this.ensureConnected();

    try {
      const result = await this.docClient!.send(
        new GetCommand({
          TableName: this.config.tableName,
          Key: key
        })
      );

      return result.Item || null;
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async updateItem(
    key: { PK: string; SK: string },
    updates: Record<string, any>,
    conditionExpression?: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, any>
  ): Promise<void> {
    this.ensureConnected();
    logger.info(JSON.stringify({key, updates, conditionExpression, expressionAttributeNames, expressionAttributeValues}, null, 2))

    try {
      // Build update expression
      const updateExpressions: string[] = [];
      const attrNames: Record<string, string> = {
        ...expressionAttributeNames
      };
      const attrValues: Record<string, any> = {
        ...expressionAttributeValues
      };

      let nameCounter = 0;
      let valueCounter = 0;
      console.log(Object.entries(updates));
      for (const [field, value] of Object.entries(updates)) {
        const namePlaceholder = `#field${nameCounter++}`;
        const valuePlaceholder = `:value${valueCounter++}`;
        attrNames[namePlaceholder] = field;
        attrValues[valuePlaceholder] = value;
        updateExpressions.push(`${namePlaceholder} = ${valuePlaceholder}`);
      }

      const params: any = {
        TableName: this.config.tableName,
        Key: key,
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: attrNames,
        ExpressionAttributeValues: attrValues
      };
    logger.info(JSON.stringify({ params }, null, 2))

      if (conditionExpression) {
        params.ConditionExpression = conditionExpression;
      }

      await this.docClient!.send(new UpdateCommand(params));
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async deleteItem(key: { PK: string; SK: string }): Promise<void> {
    this.ensureConnected();

    try {
      await this.docClient!.send(
        new DeleteCommand({
          TableName: this.config.tableName,
          Key: key
        })
      );
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async query(params: QueryParams): Promise<QueryResult> {
    this.ensureConnected();
    logger.info(JSON.stringify({params}, null, 2))

    try {
      const commandParams: any = {
        TableName: this.config.tableName,
        KeyConditionExpression: params.keyConditionExpression
      };

      if (params.expressionAttributeNames) {
        commandParams.ExpressionAttributeNames =
          params.expressionAttributeNames;
      }

      if (params.expressionAttributeValues) {
        commandParams.ExpressionAttributeValues =
          params.expressionAttributeValues;
      }

      if (params.filterExpression) {
        commandParams.FilterExpression = params.filterExpression;
      }

      if (params.limit) {
        commandParams.Limit = params.limit;
      }

      if (params.exclusiveStartKey) {
        commandParams.ExclusiveStartKey = params.exclusiveStartKey;
      }

      if (params.scanIndexForward !== undefined) {
        commandParams.ScanIndexForward = params.scanIndexForward;
      }

      if (params.projectionExpression) {
        commandParams.ProjectionExpression = params.projectionExpression;
      }

      const result = await this.docClient!.send(
        new QueryCommand(commandParams)
      );

      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0
      };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async queryGSI(indexName: string, params: QueryParams): Promise<QueryResult> {
    this.ensureConnected();

    try {
      logger.debug('Querying GSI', {
        indexName,
        keyConditionExpression: params.keyConditionExpression
      });

      const commandParams: any = {
        TableName: this.config.tableName,
        IndexName: indexName,
        KeyConditionExpression: params.keyConditionExpression
      };

      if (params.expressionAttributeNames) {
        commandParams.ExpressionAttributeNames =
          params.expressionAttributeNames;
      }

      if (params.expressionAttributeValues) {
        commandParams.ExpressionAttributeValues =
          params.expressionAttributeValues;
      }

      if (params.filterExpression) {
        commandParams.FilterExpression = params.filterExpression;
      }

      if (params.limit) {
        commandParams.Limit = params.limit;
      }

      if (params.exclusiveStartKey) {
        commandParams.ExclusiveStartKey = params.exclusiveStartKey;
      }

      if (params.scanIndexForward !== undefined) {
        commandParams.ScanIndexForward = params.scanIndexForward;
      }

      if (params.projectionExpression) {
        commandParams.ProjectionExpression = params.projectionExpression;
      }

      const result = await this.docClient!.send(
        new QueryCommand(commandParams)
      );

      logger.debug('GSI query completed', {
        indexName,
        count: result.Count || 0
      });

      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0
      };
    } catch (error: any) {
      // Provide more descriptive error for missing GSI
      if (
        error.name === 'ValidationException' &&
        error.message?.includes('index')
      ) {
        logger.error('GSI not available', { indexName, error: error.message });
        throw new ServiceError(
          `Global Secondary Index '${indexName}' is not available on table '${this.config.tableName}'`,
          404
        );
      }
      logger.error('GSI query failed', { indexName, error });
      throw this.translateError(error);
    }
  }

  async batchGet(
    keys: Array<{ PK: string; SK: string }>
  ): Promise<Record<string, any>[]> {
    this.ensureConnected();

    try {
      const results: Record<string, any>[] = [];
      const failedKeys: Array<{ PK: string; SK: string }> = [];

      // Process in chunks of 25 items (DynamoDB best practice)
      for (let i = 0; i < keys.length; i += 25) {
        const chunk = keys.slice(i, i + 25);

        const result = await this.docClient!.send(
          new BatchGetCommand({
            RequestItems: {
              [this.config.tableName]: {
                Keys: chunk
              }
            }
          })
        );

        if (result.Responses && result.Responses[this.config.tableName]) {
          results.push(...result.Responses[this.config.tableName]);
        }

        // Handle unprocessed keys with exponential backoff (up to 3 retries)
        let unprocessedKeys = result.UnprocessedKeys;
        let retryCount = 0;
        const maxRetries = 3;

        while (
          unprocessedKeys &&
          unprocessedKeys[this.config.tableName] &&
          retryCount < maxRetries
        ) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          logger.debug(
            `Retrying ${unprocessedKeys[this.config.tableName].Keys?.length} unprocessed keys (attempt ${retryCount + 1}/${maxRetries})`,
            { delay }
          );
          await new Promise((resolve) => setTimeout(resolve, delay));

          const retryResult = await this.docClient!.send(
            new BatchGetCommand({
              RequestItems: unprocessedKeys
            })
          );

          if (
            retryResult.Responses &&
            retryResult.Responses[this.config.tableName]
          ) {
            results.push(...retryResult.Responses[this.config.tableName]);
          }

          unprocessedKeys = retryResult.UnprocessedKeys;
          retryCount++;
        }

        // Collect failed keys after all retries exhausted
        if (
          unprocessedKeys &&
          unprocessedKeys[this.config.tableName] &&
          retryCount >= maxRetries
        ) {
          const unprocessedCount =
            unprocessedKeys[this.config.tableName].Keys?.length || 0;
          logger.error(
            `Failed to process ${unprocessedCount} keys after ${maxRetries} retries`,
            { unprocessedKeys: unprocessedKeys[this.config.tableName].Keys }
          );
          failedKeys.push(
            ...(unprocessedKeys[this.config.tableName].Keys as Array<{
              PK: string;
              SK: string;
            }>)
          );
        }
      }

      // Throw error if any keys failed after all retries
      if (failedKeys.length > 0) {
        const errorMsg = `Batch get failed for ${failedKeys.length} items after 3 retries`;
        logger.error(errorMsg, { failedKeys });
        throw new ServiceError(errorMsg, 500);
      }

      return results;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw this.translateError(error);
    }
  }

  async batchWrite(items: BatchWriteItem[]): Promise<BatchWriteResult> {
    this.ensureConnected();

    try {
      const unprocessedItems: BatchWriteItem[] = [];

      // Process in chunks of 25 (DynamoDB limit for BatchWriteItem)
      for (let i = 0; i < items.length; i += 25) {
        const chunk = items.slice(i, i + 25);

        const requestItems = chunk.map((item) => {
          if (item.putRequest) {
            return { PutRequest: { Item: item.putRequest } };
          } else if (item.deleteRequest) {
            return { DeleteRequest: { Key: item.deleteRequest } };
          }
          throw new Error('Invalid batch write item');
        });

        const result = await this.docClient!.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.config.tableName]: requestItems
            }
          })
        );

        // Handle unprocessed items with exponential backoff (up to 3 retries)
        let unprocessed = result.UnprocessedItems;
        let retryCount = 0;
        const maxRetries = 3;

        while (
          unprocessed &&
          unprocessed[this.config.tableName] &&
          retryCount < maxRetries
        ) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          logger.debug(
            `Retrying ${unprocessed[this.config.tableName].length} unprocessed items (attempt ${retryCount + 1}/${maxRetries})`,
            { delay }
          );
          await new Promise((resolve) => setTimeout(resolve, delay));

          const retryResult = await this.docClient!.send(
            new BatchWriteCommand({
              RequestItems: unprocessed
            })
          );

          unprocessed = retryResult.UnprocessedItems;
          retryCount++;
        }

        // Collect unprocessed items after all retries exhausted
        if (
          unprocessed &&
          unprocessed[this.config.tableName] &&
          retryCount >= maxRetries
        ) {
          logger.error(
            `Failed to process ${unprocessed[this.config.tableName].length} items after ${maxRetries} retries`,
            { unprocessedCount: unprocessed[this.config.tableName].length }
          );

          // Convert unprocessed items back to BatchWriteItem format
          for (const item of unprocessed[this.config.tableName]) {
            if ('PutRequest' in item && item.PutRequest) {
              unprocessedItems.push({ putRequest: item.PutRequest.Item });
            } else if ('DeleteRequest' in item && item.DeleteRequest) {
              unprocessedItems.push({
                deleteRequest: item.DeleteRequest.Key as {
                  PK: string;
                  SK: string;
                }
              });
            }
          }
        }
      }

      // Throw error if any items failed after all retries
      if (unprocessedItems.length > 0) {
        const errorMsg = `Batch write failed for ${unprocessedItems.length} items after 3 retries`;
        logger.error(errorMsg, { unprocessedItems });
        throw new ServiceError(errorMsg, 500);
      }

      return { unprocessedItems };
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw this.translateError(error);
    }
  }

  async tableExists(): Promise<boolean> {
    this.ensureConnected();

    try {
      await this.client!.send(
        new DescribeTableCommand({
          TableName: this.config.tableName
        })
      );
      return true;
    } catch (error: any) {
      if (error instanceof ResourceNotFoundException) {
        return false;
      }
      throw this.translateError(error);
    }
  }

  async createTable(schema: TableSchema): Promise<void> {
    this.ensureConnected();

    try {
      const params: any = {
        TableName: this.config.tableName,
        AttributeDefinitions: schema.attributeDefinitions,
        KeySchema: schema.keySchema,
        BillingMode: schema.billingMode || 'PAY_PER_REQUEST'
      };

      if (schema.globalSecondaryIndexes) {
        params.GlobalSecondaryIndexes = schema.globalSecondaryIndexes;
      }

      await this.client!.send(new CreateTableCommand(params));

      logger.info(`Table ${this.config.tableName} created successfully`);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async queryAll(params: QueryParams): Promise<Record<string, any>[]> {
    this.ensureConnected();

    const allItems: Record<string, any>[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    do {
      const queryParams = {
        ...params,
        exclusiveStartKey: lastEvaluatedKey
      };

      const result = await this.query(queryParams);
      allItems.push(...result.items);
      lastEvaluatedKey = result.lastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems;
  }

  async queryGSIAll(
    indexName: string,
    params: QueryParams
  ): Promise<Record<string, any>[]> {
    this.ensureConnected();

    logger.debug('Querying GSI with pagination', { indexName });

    const allItems: Record<string, any>[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    do {
      const queryParams = {
        ...params,
        exclusiveStartKey: lastEvaluatedKey
      };

      const result = await this.queryGSI(indexName, queryParams);
      allItems.push(...result.items);
      lastEvaluatedKey = result.lastEvaluatedKey;
    } while (lastEvaluatedKey);

    logger.debug('GSI query with pagination completed', {
      indexName,
      totalItems: allItems.length
    });

    return allItems;
  }

  async scan(params: ScanParams = {}): Promise<ScanResult> {
    this.ensureConnected();

    try {
      const commandParams: any = {
        TableName: this.config.tableName
      };

      if (params.filterExpression) {
        commandParams.FilterExpression = params.filterExpression;
      }

      if (params.expressionAttributeNames) {
        commandParams.ExpressionAttributeNames =
          params.expressionAttributeNames;
      }

      if (params.expressionAttributeValues) {
        commandParams.ExpressionAttributeValues =
          params.expressionAttributeValues;
      }

      if (params.limit) {
        commandParams.Limit = params.limit;
      }

      if (params.exclusiveStartKey) {
        commandParams.ExclusiveStartKey = params.exclusiveStartKey;
      }

      if (params.projectionExpression) {
        commandParams.ProjectionExpression = params.projectionExpression;
      }

      const result = await this.docClient!.send(
        new ScanCommand(commandParams)
      );

      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0
      };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async scanAll(params: ScanParams = {}): Promise<Record<string, any>[]> {
    this.ensureConnected();

    const allItems: Record<string, any>[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    do {
      const scanParams = {
        ...params,
        exclusiveStartKey: lastEvaluatedKey
      };

      const result = await this.scan(scanParams);
      allItems.push(...result.items);
      lastEvaluatedKey = result.lastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems;
  }
}
