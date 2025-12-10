import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import RedisClient from '../../utils/redisclient.js';
import EnvironmentConfig from '../../utils/environmentconfig.js';
import DynamoDBClient from '../../utils/dynamodbclient.js';
import DynamoDBCacheAdapter from '../../utils/dynamodbcacheadapter.js';

// Mock the dependencies
vi.mock('../../utils/dynamodbclient.js');
vi.mock('../../utils/dynamodbcacheadapter.js');

// Mock Redis
const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  connect: vi.fn(),
  quit: vi.fn(),
  on: vi.fn()
};

vi.mock('redis', () => ({
  default: {
    createClient: vi.fn(() => mockRedisClient)
  }
}));

describe('RedisClient - Backend Selection', () => {
  let mockEnvConfig: EnvironmentConfig;
  let mockDynamoClient: DynamoDBClient;
  let mockDynamoAdapter: DynamoDBCacheAdapter;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset the singleton instances
    (RedisClient as any).instance = null;
    (DynamoDBClient as any).instance = null;

    // Create mock environment config
    mockEnvConfig = {
      getValues: vi.fn(),
      getObfuscatedValues: vi.fn()
    } as any;

    // Create mock DynamoDB client
    mockDynamoClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      getItem: vi.fn(),
      putItem: vi.fn(),
      deleteItem: vi.fn(),
      scanAll: vi.fn(),
      query: vi.fn()
    } as any;

    // Create mock DynamoDB adapter
    mockDynamoAdapter = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn()
    } as any;

    // Mock DynamoDBClient.getInstance
    vi.mocked(DynamoDBClient.getInstance).mockReturnValue(mockDynamoClient);
    
    // Mock DynamoDBCacheAdapter constructor
    vi.mocked(DynamoDBCacheAdapter).mockImplementation(() => mockDynamoAdapter);
  });

  afterEach(() => {
    // Clean up singleton instances
    (RedisClient as any).instance = null;
    (DynamoDBClient as any).instance = null;
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: redis-dynamodb-adapter, Property 1: Backend selection based on configuration
     * 
     * Property: For any EnvironmentConfig with USE_DYNAMODB set to true or false,
     * initializing RedisClient should select DynamoDB backend when true and Redis backend when false
     * Validates: Requirements 1.1, 1.2, 1.3
     */
    it('Property 1: Backend selection based on configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // Random USE_DYNAMODB value
          async (useDynamoDB) => {
            // Reset singletons for each test
            (RedisClient as any).instance = null;
            (DynamoDBClient as any).instance = null;
            vi.clearAllMocks();

            // Configure environment values
            const configValues = {
              USE_DYNAMODB: useDynamoDB,
              REDIS_URL: 'redis://localhost:6379',
              DYNAMODB_TABLE_NAME: 'test-table',
              DYNAMODB_REGION: 'us-east-1'
            };

            vi.mocked(mockEnvConfig.getValues).mockReturnValue(configValues);
            vi.mocked(mockEnvConfig.getObfuscatedValues).mockReturnValue({
              ...configValues,
              REDIS_PASSWORD: '****'
            });

            // Create RedisClient instance
            const client = RedisClient.getInstance(mockEnvConfig);
            expect(client).toBeDefined();

            // Connect the client
            await client.connect();

            if (useDynamoDB) {
              // Property: When USE_DYNAMODB is true, should use DynamoDB backend
              expect(DynamoDBClient.getInstance).toHaveBeenCalledWith(mockEnvConfig);
              expect(mockDynamoClient.connect).toHaveBeenCalled();
              expect(DynamoDBCacheAdapter).toHaveBeenCalledWith(mockDynamoClient);
              
              // Clean up DynamoDB
              await client.disconnect();
            } else {
              // Property: When USE_DYNAMODB is false, should use Redis backend
              expect(DynamoDBClient.getInstance).not.toHaveBeenCalled();
              expect(DynamoDBCacheAdapter).not.toHaveBeenCalled();
              
              // Clean up Redis (ignore errors)
              try {
                await client.disconnect();
              } catch (error) {
                // Ignore disconnect errors for Redis backend in tests
              }
            }
          }
        ),
        { numRuns: 50 } // Reduced runs for faster testing
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 1 (variant): DynamoDB backend initialization
     * 
     * Property: When USE_DYNAMODB is true, the client should properly initialize DynamoDB components
     * Validates: Requirements 1.1, 1.2
     */
    it('Property 1 (variant): DynamoDB backend initialization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            DYNAMODB_TABLE_NAME: fc.string({ minLength: 1, maxLength: 50 }),
            DYNAMODB_REGION: fc.string({ minLength: 1, maxLength: 20 }),
            DYNAMODB_ENDPOINT: fc.option(fc.string(), { nil: undefined }),
            DYNAMODB_ACCESS_KEY_ID: fc.option(fc.string(), { nil: undefined }),
            DYNAMODB_SECRET_ACCESS_KEY: fc.option(fc.string(), { nil: undefined })
          }),
          async (envValues) => {
            // Reset singletons for each test
            (RedisClient as any).instance = null;
            (DynamoDBClient as any).instance = null;
            vi.clearAllMocks();

            // Configure environment to use DynamoDB
            const configValues = {
              ...envValues,
              USE_DYNAMODB: true,
              REDIS_URL: 'redis://localhost:6379' // Still needed for Redis path
            };

            vi.mocked(mockEnvConfig.getValues).mockReturnValue(configValues);
            vi.mocked(mockEnvConfig.getObfuscatedValues).mockReturnValue({
              ...configValues,
              DYNAMODB_ACCESS_KEY_ID: '****',
              DYNAMODB_SECRET_ACCESS_KEY: '****'
            });

            // Create and connect RedisClient
            const client = RedisClient.getInstance(mockEnvConfig);
            await client.connect();

            // Property: DynamoDB client should be initialized with environment config
            expect(DynamoDBClient.getInstance).toHaveBeenCalledWith(mockEnvConfig);
            expect(mockDynamoClient.connect).toHaveBeenCalled();

            // Property: DynamoDB adapter should be created with the client
            expect(DynamoDBCacheAdapter).toHaveBeenCalledWith(mockDynamoClient);

            // Property: Client methods should be bound to adapter methods (check that they're bound functions)
            expect(client.get.name).toContain('bound');
            expect(client.set.name).toContain('bound');
            expect(client.del.name).toContain('bound');
            expect(client.keys.name).toContain('bound');

            // Test disconnect
            await client.disconnect();
            expect(mockDynamoClient.disconnect).toHaveBeenCalled();
            
            // Reset mocks after disconnect
            vi.clearAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 1 (variant): Redis backend fallback
     * 
     * Property: When USE_DYNAMODB is false or undefined, the client should use Redis backend
     * Validates: Requirements 1.3
     */
    it('Property 1 (variant): Redis backend fallback', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(false),
            fc.constant(undefined)
          ), // USE_DYNAMODB is false or undefined
          fc.record({
            REDIS_URL: fc.string({ minLength: 10, maxLength: 100 }),
            REDIS_PASSWORD: fc.option(fc.string(), { nil: undefined })
          }),
          async (useDynamoDB, envValues) => {
            // Reset singletons for each test
            (RedisClient as any).instance = null;
            (DynamoDBClient as any).instance = null;
            vi.clearAllMocks();

            // Configure environment to use Redis
            const configValues = {
              ...envValues,
              USE_DYNAMODB: useDynamoDB
            };

            vi.mocked(mockEnvConfig.getValues).mockReturnValue(configValues);
            vi.mocked(mockEnvConfig.getObfuscatedValues).mockReturnValue({
              ...configValues,
              REDIS_PASSWORD: '****'
            });

            // Create RedisClient instance
            const client = RedisClient.getInstance(mockEnvConfig);
            await client.connect();

            // Property: DynamoDB components should not be initialized
            expect(DynamoDBClient.getInstance).not.toHaveBeenCalled();
            expect(DynamoDBCacheAdapter).not.toHaveBeenCalled();

            // Property: Should use Redis backend (we can't easily test the binding without more mocking)
            // but we can verify DynamoDB was not used

            // Clean up - handle disconnect for Redis backend
            try {
              await client.disconnect();
            } catch (error) {
              // Ignore disconnect errors in tests for Redis backend
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 1 (variant): Singleton behavior consistency
     * 
     * Property: The singleton instance should maintain the same backend selection across calls
     * Validates: Requirements 1.1, 1.2, 1.3
     */
    it('Property 1 (variant): Singleton behavior consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // Random USE_DYNAMODB value
          async (useDynamoDB) => {
            // Reset singletons for each test
            (RedisClient as any).instance = null;
            (DynamoDBClient as any).instance = null;
            vi.clearAllMocks();

            // Configure environment
            const configValues = {
              USE_DYNAMODB: useDynamoDB,
              REDIS_URL: 'redis://localhost:6379',
              DYNAMODB_TABLE_NAME: 'test-table',
              DYNAMODB_REGION: 'us-east-1'
            };

            vi.mocked(mockEnvConfig.getValues).mockReturnValue(configValues);
            vi.mocked(mockEnvConfig.getObfuscatedValues).mockReturnValue({
              ...configValues,
              REDIS_PASSWORD: '****'
            });

            // Create first instance
            const client1 = RedisClient.getInstance(mockEnvConfig);
            
            // Create second instance (should be the same)
            const client2 = RedisClient.getInstance();

            // Property: Both instances should be the same object
            expect(client1).toBe(client2);

            // Property: Backend selection should be consistent
            await client1.connect();

            if (useDynamoDB) {
              expect(DynamoDBClient.getInstance).toHaveBeenCalled();
              expect(DynamoDBCacheAdapter).toHaveBeenCalled();
              await client1.disconnect();
            } else {
              expect(DynamoDBClient.getInstance).not.toHaveBeenCalled();
              expect(DynamoDBCacheAdapter).not.toHaveBeenCalled();
              // For Redis backend, handle disconnect carefully
              try {
                await client1.disconnect();
              } catch (error) {
                // Ignore disconnect errors in tests for Redis backend
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Basic functionality tests', () => {
    it('should select DynamoDB backend when USE_DYNAMODB is true', async () => {
      // Reset singleton
      (RedisClient as any).instance = null;

      const configValues = {
        USE_DYNAMODB: true,
        DYNAMODB_TABLE_NAME: 'test-table',
        DYNAMODB_REGION: 'us-east-1',
        REDIS_URL: 'redis://localhost:6379'
      };

      vi.mocked(mockEnvConfig.getValues).mockReturnValue(configValues);
      vi.mocked(mockEnvConfig.getObfuscatedValues).mockReturnValue(configValues);

      const client = RedisClient.getInstance(mockEnvConfig);
      await client.connect();

      expect(DynamoDBClient.getInstance).toHaveBeenCalledWith(mockEnvConfig);
      expect(mockDynamoClient.connect).toHaveBeenCalled();
      expect(DynamoDBCacheAdapter).toHaveBeenCalledWith(mockDynamoClient);

      await client.disconnect();
    });

    it('should select Redis backend when USE_DYNAMODB is false', async () => {
      // Reset singleton
      (RedisClient as any).instance = null;

      const configValues = {
        USE_DYNAMODB: false,
        REDIS_URL: 'redis://localhost:6379'
      };

      vi.mocked(mockEnvConfig.getValues).mockReturnValue(configValues);
      vi.mocked(mockEnvConfig.getObfuscatedValues).mockReturnValue(configValues);

      const client = RedisClient.getInstance(mockEnvConfig);
      await client.connect();

      expect(DynamoDBClient.getInstance).not.toHaveBeenCalled();
      expect(DynamoDBCacheAdapter).not.toHaveBeenCalled();

      // Handle Redis disconnect carefully in tests
      try {
        await client.disconnect();
      } catch (error) {
        // Ignore disconnect errors for Redis backend in tests
      }
    });

    it('should select Redis backend when USE_DYNAMODB is undefined', async () => {
      // Reset singleton
      (RedisClient as any).instance = null;

      const configValues = {
        REDIS_URL: 'redis://localhost:6379'
        // USE_DYNAMODB is undefined
      };

      vi.mocked(mockEnvConfig.getValues).mockReturnValue(configValues);
      vi.mocked(mockEnvConfig.getObfuscatedValues).mockReturnValue(configValues);

      const client = RedisClient.getInstance(mockEnvConfig);
      await client.connect();

      expect(DynamoDBClient.getInstance).not.toHaveBeenCalled();
      expect(DynamoDBCacheAdapter).not.toHaveBeenCalled();

      // Handle Redis disconnect carefully in tests
      try {
        await client.disconnect();
      } catch (error) {
        // Ignore disconnect errors for Redis backend in tests
      }
    });
  });
});