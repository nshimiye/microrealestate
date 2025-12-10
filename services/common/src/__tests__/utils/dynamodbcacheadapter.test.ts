import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import DynamoDBCacheAdapter from '../../utils/dynamodbcacheadapter.js';
import DynamoDBClient from '../../utils/dynamodbclient.js';
import type { QueryParams } from '../../utils/dynamodbclient.js';

describe('DynamoDBCacheAdapter - Foundation', () => {
  let mockDynamoClient: DynamoDBClient;
  let adapter: DynamoDBCacheAdapter;

  beforeEach(() => {
    // Create a mock DynamoDB client
    mockDynamoClient = {
      getItem: vi.fn(),
      putItem: vi.fn(),
      deleteItem: vi.fn(),
      scanAll: vi.fn(),
      query: vi.fn()
    } as any;

    adapter = new DynamoDBCacheAdapter(mockDynamoClient);
  });

  describe('Constructor and Constants', () => {
    it('should initialize with DynamoDBClient', () => {
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(DynamoDBCacheAdapter);
    });

    it('should have correct KEY_PREFIX constant', () => {
      // Access private property through type assertion for testing
      const keyPrefix = (adapter as any).KEY_PREFIX;
      expect(keyPrefix).toBe('CACHE#');
    });

    it('should have correct SORT_KEY constant', () => {
      const sortKey = (adapter as any).SORT_KEY;
      expect(sortKey).toBe('CACHE');
    });

    it('should have correct DEFAULT_TTL_SECONDS constant', () => {
      const defaultTtl = (adapter as any).DEFAULT_TTL_SECONDS;
      expect(defaultTtl).toBe(43200); // 12 hours in seconds
    });
  });

  describe('Helper Methods', () => {
    describe('constructDynamoKey', () => {
      it('should construct DynamoDB key with CACHE# prefix', () => {
        const constructDynamoKey = (adapter as any).constructDynamoKey.bind(adapter);
        
        const result = constructDynamoKey('session:123');
        expect(result).toEqual({
          PK: 'CACHE#session:123',
          SK: 'CACHE'
        });
      });

      it('should handle keys with colons', () => {
        const constructDynamoKey = (adapter as any).constructDynamoKey.bind(adapter);
        
        const result = constructDynamoKey('user:data:456');
        expect(result).toEqual({
          PK: 'CACHE#user:data:456',
          SK: 'CACHE'
        });
      });

      it('should handle simple keys', () => {
        const constructDynamoKey = (adapter as any).constructDynamoKey.bind(adapter);
        
        const result = constructDynamoKey('mykey');
        expect(result).toEqual({
          PK: 'CACHE#mykey',
          SK: 'CACHE'
        });
      });
    });

    describe('extractCacheKey', () => {
      it('should extract cache key from DynamoDB PK', () => {
        const extractCacheKey = (adapter as any).extractCacheKey.bind(adapter);
        
        const result = extractCacheKey('CACHE#session:123');
        expect(result).toBe('session:123');
      });

      it('should handle keys with multiple colons', () => {
        const extractCacheKey = (adapter as any).extractCacheKey.bind(adapter);
        
        const result = extractCacheKey('CACHE#user:data:456');
        expect(result).toBe('user:data:456');
      });

      it('should return key as-is if no CACHE# prefix', () => {
        const extractCacheKey = (adapter as any).extractCacheKey.bind(adapter);
        
        const result = extractCacheKey('somekey');
        expect(result).toBe('somekey');
      });

      it('should handle empty string after prefix', () => {
        const extractCacheKey = (adapter as any).extractCacheKey.bind(adapter);
        
        const result = extractCacheKey('CACHE#');
        expect(result).toBe('');
      });
    });

    describe('Round-trip key transformation', () => {
      it('should correctly round-trip keys through construct and extract', () => {
        const constructDynamoKey = (adapter as any).constructDynamoKey.bind(adapter);
        const extractCacheKey = (adapter as any).extractCacheKey.bind(adapter);
        
        const originalKey = 'session:abc123';
        const dynamoKey = constructDynamoKey(originalKey);
        const extractedKey = extractCacheKey(dynamoKey.PK);
        
        expect(extractedKey).toBe(originalKey);
      });

      it('should handle complex keys in round-trip', () => {
        const constructDynamoKey = (adapter as any).constructDynamoKey.bind(adapter);
        const extractCacheKey = (adapter as any).extractCacheKey.bind(adapter);
        
        const originalKey = 'tenant:123:lease:456:payment';
        const dynamoKey = constructDynamoKey(originalKey);
        const extractedKey = extractCacheKey(dynamoKey.PK);
        
        expect(extractedKey).toBe(originalKey);
      });
    });
  });
});

describe('DynamoDBCacheAdapter - get() method', () => {
  let mockDynamoClient: DynamoDBClient;
  let adapter: DynamoDBCacheAdapter;

  beforeEach(() => {
    mockDynamoClient = {
      getItem: vi.fn(),
      putItem: vi.fn(),
      deleteItem: vi.fn(),
      scanAll: vi.fn(),
      query: vi.fn()
    } as any;

    adapter = new DynamoDBCacheAdapter(mockDynamoClient);
  });

  describe('Basic functionality', () => {
    it('should return value for existing key', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      vi.mocked(mockDynamoClient.getItem).mockResolvedValue({
        PK: 'CACHE#test-key',
        SK: 'CACHE',
        Value: value,
        TTL: futureTimestamp,
        CreatedAt: Math.floor(Date.now() / 1000)
      });

      const result = await adapter.get(key);
      expect(result).toBe(value);
      expect(mockDynamoClient.getItem).toHaveBeenCalledWith({
        PK: 'CACHE#test-key',
        SK: 'CACHE'
      });
    });

    it('should return null for non-existent key', async () => {
      const key = 'non-existent-key';

      vi.mocked(mockDynamoClient.getItem).mockResolvedValue(null);

      const result = await adapter.get(key);
      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      const key = 'expired-key';
      const value = 'expired-value';
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      vi.mocked(mockDynamoClient.getItem).mockResolvedValue({
        PK: 'CACHE#expired-key',
        SK: 'CACHE',
        Value: value,
        TTL: pastTimestamp,
        CreatedAt: Math.floor(Date.now() / 1000) - 7200
      });

      const result = await adapter.get(key);
      expect(result).toBeNull();
    });

    it('should return value when TTL is exactly current time', async () => {
      const key = 'edge-case-key';
      const value = 'edge-case-value';
      const currentTimestamp = Math.floor(Date.now() / 1000);

      vi.mocked(mockDynamoClient.getItem).mockResolvedValue({
        PK: 'CACHE#edge-case-key',
        SK: 'CACHE',
        Value: value,
        TTL: currentTimestamp,
        CreatedAt: currentTimestamp - 3600
      });

      const result = await adapter.get(key);
      // TTL < currentTimestamp is false when they're equal, so item should be returned
      expect(result).toBe(value);
    });

    it('should handle item without TTL field', async () => {
      const key = 'no-ttl-key';
      const value = 'no-ttl-value';

      vi.mocked(mockDynamoClient.getItem).mockResolvedValue({
        PK: 'CACHE#no-ttl-key',
        SK: 'CACHE',
        Value: value,
        CreatedAt: Math.floor(Date.now() / 1000)
      });

      const result = await adapter.get(key);
      expect(result).toBe(value);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: redis-dynamodb-adapter, Property 5: Non-existent key returns null
     * 
     * Property: For any key that has not been set, calling get(key) should return null
     * Validates: Requirements 2.2
     */
    it('Property 5: Non-existent key returns null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // Generate random keys
          async (key) => {
            // Mock getItem to return null (key doesn't exist)
            vi.mocked(mockDynamoClient.getItem).mockResolvedValue(null);

            const result = await adapter.get(key);
            
            // Property: get() should return null for non-existent keys
            expect(result).toBeNull();
            
            // Verify the correct DynamoDB key was constructed
            expect(mockDynamoClient.getItem).toHaveBeenCalledWith({
              PK: `CACHE#${key}`,
              SK: 'CACHE'
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 8: Expired items return null
     * 
     * Property: For any key with an expired TTL, calling get(key) should return null
     * Validates: Requirements 3.3
     */
    it('Property 8: Expired items return null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // Random key
          fc.string({ minLength: 0, maxLength: 1000 }), // Random value
          fc.integer({ min: 1, max: 86400 }), // Random seconds in the past (1 second to 1 day)
          async (key, value, secondsAgo) => {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const expiredTimestamp = currentTimestamp - secondsAgo;

            // Mock getItem to return an expired item
            vi.mocked(mockDynamoClient.getItem).mockResolvedValue({
              PK: `CACHE#${key}`,
              SK: 'CACHE',
              Value: value,
              TTL: expiredTimestamp,
              CreatedAt: expiredTimestamp - 3600
            });

            const result = await adapter.get(key);
            
            // Property: get() should return null for expired items
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Additional property test: Valid (non-expired) items return their value
     * 
     * This complements Property 8 by testing the positive case
     */
    it('Property: Valid items return their value', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // Random key
          fc.string({ minLength: 0, maxLength: 1000 }), // Random value
          fc.integer({ min: 1, max: 86400 }), // Random seconds in the future (1 second to 1 day)
          async (key, value, secondsInFuture) => {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const futureTimestamp = currentTimestamp + secondsInFuture;

            // Mock getItem to return a valid (non-expired) item
            vi.mocked(mockDynamoClient.getItem).mockResolvedValue({
              PK: `CACHE#${key}`,
              SK: 'CACHE',
              Value: value,
              TTL: futureTimestamp,
              CreatedAt: currentTimestamp
            });

            const result = await adapter.get(key);
            
            // Property: get() should return the value for valid items
            expect(result).toBe(value);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('DynamoDBCacheAdapter - set() method', () => {
  let mockDynamoClient: DynamoDBClient;
  let adapter: DynamoDBCacheAdapter;

  beforeEach(() => {
    mockDynamoClient = {
      getItem: vi.fn(),
      putItem: vi.fn(),
      deleteItem: vi.fn(),
      scanAll: vi.fn(),
      query: vi.fn()
    } as any;

    adapter = new DynamoDBCacheAdapter(mockDynamoClient);
  });

  describe('Basic functionality', () => {
    it('should store value with default TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';

      vi.mocked(mockDynamoClient.putItem).mockResolvedValue(undefined);

      const result = await adapter.set(key, value);
      
      expect(result).toBe('OK');
      expect(mockDynamoClient.putItem).toHaveBeenCalledTimes(1);
      
      const calledWith = vi.mocked(mockDynamoClient.putItem).mock.calls[0][0];
      expect(calledWith.PK).toBe('CACHE#test-key');
      expect(calledWith.SK).toBe('CACHE');
      expect(calledWith.Value).toBe(value);
      expect(calledWith.TTL).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(calledWith.CreatedAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it('should store value with custom TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const ttlSeconds = 3600; // 1 hour

      vi.mocked(mockDynamoClient.putItem).mockResolvedValue(undefined);

      const result = await adapter.set(key, value, ttlSeconds);
      
      expect(result).toBe('OK');
      
      const calledWith = vi.mocked(mockDynamoClient.putItem).mock.calls[0][0];
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const expectedTTL = currentTimestamp + ttlSeconds;
      
      // Allow 1 second tolerance for test execution time
      expect(calledWith.TTL).toBeGreaterThanOrEqual(expectedTTL - 1);
      expect(calledWith.TTL).toBeLessThanOrEqual(expectedTTL + 1);
    });

    it('should return null on DynamoDB error', async () => {
      const key = 'test-key';
      const value = 'test-value';

      vi.mocked(mockDynamoClient.putItem).mockRejectedValue(new Error('DynamoDB error'));

      const result = await adapter.set(key, value);
      
      expect(result).toBeNull();
    });

    it('should handle empty string value', async () => {
      const key = 'test-key';
      const value = '';

      vi.mocked(mockDynamoClient.putItem).mockResolvedValue(undefined);

      const result = await adapter.set(key, value);
      
      expect(result).toBe('OK');
      
      const calledWith = vi.mocked(mockDynamoClient.putItem).mock.calls[0][0];
      expect(calledWith.Value).toBe('');
    });

    it('should handle zero TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const ttlSeconds = 0;

      vi.mocked(mockDynamoClient.putItem).mockResolvedValue(undefined);

      const result = await adapter.set(key, value, ttlSeconds);
      
      expect(result).toBe('OK');
      
      const calledWith = vi.mocked(mockDynamoClient.putItem).mock.calls[0][0];
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      // TTL should be approximately current time (item expires immediately)
      expect(calledWith.TTL).toBeGreaterThanOrEqual(currentTimestamp - 1);
      expect(calledWith.TTL).toBeLessThanOrEqual(currentTimestamp + 1);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: redis-dynamodb-adapter, Property 3: Set-then-get consistency
     * 
     * Property: For any key and value, after calling set(key, value), calling get(key) should return the same value
     * Validates: Requirements 2.3, 2.2
     */
    it('Property 3: Set-then-get consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // Random key
          fc.string({ minLength: 0, maxLength: 1000 }), // Random value
          fc.option(fc.integer({ min: 1, max: 86400 }), { nil: undefined }), // Optional TTL
          async (key, value, ttlSeconds) => {
            // Reset mocks for each property test run
            vi.clearAllMocks();
            
            // Mock putItem to succeed
            vi.mocked(mockDynamoClient.putItem).mockResolvedValue(undefined);

            // Call set()
            const setResult = await adapter.set(key, value, ttlSeconds);
            expect(setResult).toBe('OK');

            // Capture what was stored (should be the first and only call)
            const putItemCalls = vi.mocked(mockDynamoClient.putItem).mock.calls;
            expect(putItemCalls.length).toBe(1);
            const storedItem = putItemCalls[0][0];

            // Mock getItem to return what was just stored
            vi.mocked(mockDynamoClient.getItem).mockResolvedValue(storedItem);

            // Call get()
            const getResult = await adapter.get(key);

            // Property: get() should return the same value that was set
            expect(getResult).toBe(value);

            // Verify the stored item has correct structure
            expect(storedItem.PK).toBe(`CACHE#${key}`);
            expect(storedItem.SK).toBe('CACHE');
            expect(storedItem.Value).toBe(value);
            expect(storedItem.TTL).toBeGreaterThan(Math.floor(Date.now() / 1000) - 1);
            expect(storedItem.CreatedAt).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 7: Default TTL application
     * 
     * Property: For any key set without an explicit TTL parameter, the TTL should be set to 12 hours (43200 seconds) from the current time
     * Validates: Requirements 3.2
     */
    it('Property 7: Default TTL application', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // Random key
          fc.string({ minLength: 0, maxLength: 1000 }), // Random value
          async (key, value) => {
            // Mock putItem to succeed
            vi.mocked(mockDynamoClient.putItem).mockResolvedValue(undefined);

            const beforeTimestamp = Math.floor(Date.now() / 1000);

            // Call set() without TTL parameter
            const result = await adapter.set(key, value);
            expect(result).toBe('OK');

            const afterTimestamp = Math.floor(Date.now() / 1000);

            // Capture what was stored
            const storedItem = vi.mocked(mockDynamoClient.putItem).mock.calls[0][0];

            // Property: TTL should be approximately current time + 43200 seconds (12 hours)
            const expectedMinTTL = beforeTimestamp + 43200;
            const expectedMaxTTL = afterTimestamp + 43200;

            expect(storedItem.TTL).toBeGreaterThanOrEqual(expectedMinTTL);
            expect(storedItem.TTL).toBeLessThanOrEqual(expectedMaxTTL);

            // Verify the TTL is approximately 12 hours from now
            const ttlDifference = storedItem.TTL - beforeTimestamp;
            expect(ttlDifference).toBeGreaterThanOrEqual(43200);
            expect(ttlDifference).toBeLessThanOrEqual(43201); // Allow 1 second tolerance
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 6: TTL attribute presence
     * 
     * Property: For any key-value pair stored in DynamoDB, the DynamoDB item should contain a TTL attribute
     * Validates: Requirements 3.1
     */
    it('Property 6: TTL attribute presence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // Random key
          fc.string({ minLength: 0, maxLength: 1000 }), // Random value
          fc.option(fc.integer({ min: 0, max: 86400 }), { nil: undefined }), // Optional TTL
          async (key, value, ttlSeconds) => {
            // Mock putItem to succeed
            vi.mocked(mockDynamoClient.putItem).mockResolvedValue(undefined);

            // Call set()
            const result = await adapter.set(key, value, ttlSeconds);
            expect(result).toBe('OK');

            // Capture what was stored
            const storedItem = vi.mocked(mockDynamoClient.putItem).mock.calls[0][0];

            // Property: The stored item must have a TTL attribute
            expect(storedItem).toHaveProperty('TTL');
            expect(typeof storedItem.TTL).toBe('number');
            expect(storedItem.TTL).toBeGreaterThan(0);

            // Property: The TTL should be a valid Unix timestamp (not in the past)
            const currentTimestamp = Math.floor(Date.now() / 1000);
            expect(storedItem.TTL).toBeGreaterThanOrEqual(currentTimestamp - 1);

            // Property: The stored item must also have CreatedAt
            expect(storedItem).toHaveProperty('CreatedAt');
            expect(typeof storedItem.CreatedAt).toBe('number');
            expect(storedItem.CreatedAt).toBeLessThanOrEqual(currentTimestamp);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('DynamoDBCacheAdapter - del() method', () => {
  let mockDynamoClient: DynamoDBClient;
  let adapter: DynamoDBCacheAdapter;

  beforeEach(() => {
    mockDynamoClient = {
      getItem: vi.fn(),
      putItem: vi.fn(),
      deleteItem: vi.fn(),
      scanAll: vi.fn(),
      query: vi.fn()
    } as any;

    adapter = new DynamoDBCacheAdapter(mockDynamoClient);
  });

  describe('Basic functionality', () => {
    it('should return 1 when deleting an existing key', async () => {
      const key = 'test-key';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;

      // Mock getItem to return an existing item
      vi.mocked(mockDynamoClient.getItem).mockResolvedValue({
        PK: 'CACHE#test-key',
        SK: 'CACHE',
        Value: 'test-value',
        TTL: futureTimestamp,
        CreatedAt: Math.floor(Date.now() / 1000)
      });

      // Mock deleteItem to succeed
      vi.mocked(mockDynamoClient.deleteItem).mockResolvedValue(undefined);

      const result = await adapter.del(key);
      
      expect(result).toBe(1);
      expect(mockDynamoClient.getItem).toHaveBeenCalledWith({
        PK: 'CACHE#test-key',
        SK: 'CACHE'
      });
      expect(mockDynamoClient.deleteItem).toHaveBeenCalledWith({
        PK: 'CACHE#test-key',
        SK: 'CACHE'
      });
    });

    it('should return 0 when deleting a non-existent key', async () => {
      const key = 'non-existent-key';

      // Mock getItem to return null (key doesn't exist)
      vi.mocked(mockDynamoClient.getItem).mockResolvedValue(null);

      const result = await adapter.del(key);
      
      expect(result).toBe(0);
      expect(mockDynamoClient.getItem).toHaveBeenCalledWith({
        PK: 'CACHE#non-existent-key',
        SK: 'CACHE'
      });
      // deleteItem should not be called if the key doesn't exist
      expect(mockDynamoClient.deleteItem).not.toHaveBeenCalled();
    });

    it('should throw error on DynamoDB failure', async () => {
      const key = 'test-key';

      // Mock getItem to throw an error
      vi.mocked(mockDynamoClient.getItem).mockRejectedValue(new Error('DynamoDB error'));

      await expect(adapter.del(key)).rejects.toThrow('DynamoDB error');
    });

    it('should handle keys with special characters', async () => {
      const key = 'session:user:123:data';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;

      vi.mocked(mockDynamoClient.getItem).mockResolvedValue({
        PK: 'CACHE#session:user:123:data',
        SK: 'CACHE',
        Value: 'test-value',
        TTL: futureTimestamp,
        CreatedAt: Math.floor(Date.now() / 1000)
      });

      vi.mocked(mockDynamoClient.deleteItem).mockResolvedValue(undefined);

      const result = await adapter.del(key);
      
      expect(result).toBe(1);
      expect(mockDynamoClient.deleteItem).toHaveBeenCalledWith({
        PK: 'CACHE#session:user:123:data',
        SK: 'CACHE'
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: redis-dynamodb-adapter, Property 4: Delete removes key
     * 
     * Property: For any key that exists, after calling del(key), calling get(key) should return null
     * Validates: Requirements 2.4
     */
    it('Property 4: Delete removes key', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // Random key
          fc.string({ minLength: 0, maxLength: 1000 }), // Random value
          async (key, value) => {
            // Reset mocks for each property test run
            vi.clearAllMocks();
            
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const futureTimestamp = currentTimestamp + 3600;

            // Step 1: Set a key-value pair
            vi.mocked(mockDynamoClient.putItem).mockResolvedValue(undefined);
            const setResult = await adapter.set(key, value);
            expect(setResult).toBe('OK');

            // Capture what was stored
            const storedItem = vi.mocked(mockDynamoClient.putItem).mock.calls[0][0];

            // Step 2: Mock getItem to return the stored item (for del's existence check)
            vi.mocked(mockDynamoClient.getItem).mockResolvedValue(storedItem);

            // Mock deleteItem to succeed
            vi.mocked(mockDynamoClient.deleteItem).mockResolvedValue(undefined);

            // Step 3: Delete the key
            const delResult = await adapter.del(key);
            
            // Property: del() should return 1 for existing keys
            expect(delResult).toBe(1);

            // Verify deleteItem was called with correct key
            expect(mockDynamoClient.deleteItem).toHaveBeenCalledWith({
              PK: `CACHE#${key}`,
              SK: 'CACHE'
            });

            // Step 4: Mock getItem to return null (key no longer exists after deletion)
            vi.mocked(mockDynamoClient.getItem).mockResolvedValue(null);

            // Step 5: Try to get the deleted key
            const getResult = await adapter.get(key);

            // Property: get() should return null after deletion
            expect(getResult).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Additional property test: Deleting non-existent keys returns 0
     * 
     * This tests the Redis-compatible behavior where del() returns the count of deleted keys
     */
    it('Property: Deleting non-existent keys returns 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // Random key
          async (key) => {
            // Mock getItem to return null (key doesn't exist)
            vi.mocked(mockDynamoClient.getItem).mockResolvedValue(null);

            const result = await adapter.del(key);
            
            // Property: del() should return 0 for non-existent keys
            expect(result).toBe(0);

            // Property: deleteItem should not be called if key doesn't exist
            expect(mockDynamoClient.deleteItem).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Additional property test: Delete is idempotent
     * 
     * Deleting the same key multiple times should be safe
     */
    it('Property: Delete is idempotent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // Random key
          async (key) => {
            // First deletion: key exists
            vi.mocked(mockDynamoClient.getItem).mockResolvedValueOnce({
              PK: `CACHE#${key}`,
              SK: 'CACHE',
              Value: 'test-value',
              TTL: Math.floor(Date.now() / 1000) + 3600,
              CreatedAt: Math.floor(Date.now() / 1000)
            });
            vi.mocked(mockDynamoClient.deleteItem).mockResolvedValue(undefined);

            const firstDel = await adapter.del(key);
            expect(firstDel).toBe(1);

            // Second deletion: key no longer exists
            vi.mocked(mockDynamoClient.getItem).mockResolvedValue(null);

            const secondDel = await adapter.del(key);
            
            // Property: Second deletion should return 0 (key already deleted)
            expect(secondDel).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('DynamoDBCacheAdapter - Pattern Matching Utility', () => {
  let mockDynamoClient: DynamoDBClient;
  let adapter: DynamoDBCacheAdapter;

  beforeEach(() => {
    mockDynamoClient = {
      getItem: vi.fn(),
      putItem: vi.fn(),
      deleteItem: vi.fn(),
      scanAll: vi.fn(),
      query: vi.fn()
    } as any;

    adapter = new DynamoDBCacheAdapter(mockDynamoClient);
  });

  describe('patternToRegex', () => {
    it('should convert asterisk wildcard to regex', () => {
      const patternToRegex = (adapter as any).patternToRegex.bind(adapter);
      
      const regex = patternToRegex('session:*');
      expect(regex.test('session:')).toBe(true);
      expect(regex.test('session:abc')).toBe(true);
      expect(regex.test('session:abc123')).toBe(true);
      expect(regex.test('user:abc')).toBe(false);
    });

    it('should convert question mark wildcard to regex', () => {
      const patternToRegex = (adapter as any).patternToRegex.bind(adapter);
      
      const regex = patternToRegex('user:?123');
      expect(regex.test('user:a123')).toBe(true);
      expect(regex.test('user:b123')).toBe(true);
      expect(regex.test('user:ab123')).toBe(false);
      expect(regex.test('user:123')).toBe(false);
    });

    it('should handle exact patterns without wildcards', () => {
      const patternToRegex = (adapter as any).patternToRegex.bind(adapter);
      
      const regex = patternToRegex('exact-key');
      expect(regex.test('exact-key')).toBe(true);
      expect(regex.test('exact-key-suffix')).toBe(false);
      expect(regex.test('prefix-exact-key')).toBe(false);
    });

    it('should escape special regex characters', () => {
      const patternToRegex = (adapter as any).patternToRegex.bind(adapter);
      
      const regex = patternToRegex('data[123]');
      expect(regex.test('data[123]')).toBe(true);
      expect(regex.test('data1')).toBe(false);
      expect(regex.test('data123')).toBe(false);
    });

    it('should handle multiple wildcards', () => {
      const patternToRegex = (adapter as any).patternToRegex.bind(adapter);
      
      const regex = patternToRegex('*:user:*');
      expect(regex.test('tenant:user:123')).toBe(true);
      expect(regex.test('app:user:data')).toBe(true);
      expect(regex.test('user:123')).toBe(false);
    });

    it('should handle pattern with dots', () => {
      const patternToRegex = (adapter as any).patternToRegex.bind(adapter);
      
      const regex = patternToRegex('file.*.txt');
      expect(regex.test('file.abc.txt')).toBe(true);
      expect(regex.test('file.123.txt')).toBe(true);
      expect(regex.test('fileabctxt')).toBe(false);
    });
  });

  describe('matchesPattern', () => {
    it('should match keys with asterisk wildcard', () => {
      const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
      
      expect(matchesPattern('session:abc123', 'session:*')).toBe(true);
      expect(matchesPattern('session:', 'session:*')).toBe(true);
      expect(matchesPattern('user:abc', 'session:*')).toBe(false);
    });

    it('should match keys with question mark wildcard', () => {
      const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
      
      expect(matchesPattern('user:a123', 'user:?123')).toBe(true);
      expect(matchesPattern('user:b123', 'user:?123')).toBe(true);
      expect(matchesPattern('user:ab123', 'user:?123')).toBe(false);
    });

    it('should match exact patterns', () => {
      const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
      
      expect(matchesPattern('exact-key', 'exact-key')).toBe(true);
      expect(matchesPattern('exact-key-suffix', 'exact-key')).toBe(false);
    });

    it('should handle complex patterns', () => {
      const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
      
      expect(matchesPattern('tenant:123:lease:456', 'tenant:*:lease:*')).toBe(true);
      expect(matchesPattern('tenant:123:user:456', 'tenant:*:lease:*')).toBe(false);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: redis-dynamodb-adapter, Property 11: Wildcard pattern matching
     * 
     * Property: For any pattern containing asterisk wildcards and any set of keys,
     * matchesPattern should correctly identify keys that match the pattern
     * (with * matching zero or more characters)
     * 
     * Validates: Requirements 4.1, 4.2
     */
    it('Property 11: Wildcard pattern matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('*') && !s.includes('?')), // prefix without wildcards
          fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes('*') && !s.includes('?')), // suffix without wildcards
          fc.string({ minLength: 0, maxLength: 50 }), // middle part (can contain anything)
          async (prefix, suffix, middle) => {
            const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
            
            // Pattern with asterisk wildcard
            const pattern = `${prefix}*${suffix}`;
            
            // Key that should match the pattern
            const matchingKey = `${prefix}${middle}${suffix}`;
            
            // Property: The key should match the pattern
            expect(matchesPattern(matchingKey, pattern)).toBe(true);
            
            // Additional test: Key without the prefix should not match
            if (prefix.length > 0) {
              const nonMatchingKey = `x${prefix}${middle}${suffix}`;
              expect(matchesPattern(nonMatchingKey, pattern)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 11 (variant): Asterisk matches zero characters
     * 
     * Property: The asterisk wildcard should match zero characters
     * Validates: Requirements 4.1, 4.2
     */
    it('Property 11 (variant): Asterisk matches zero characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('*') && !s.includes('?')), // prefix without wildcards
          async (prefix) => {
            const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
            
            // Pattern with asterisk at the end
            const pattern = `${prefix}*`;
            
            // Key that is exactly the prefix (asterisk matches zero characters)
            const key = prefix;
            
            // Property: The key should match the pattern (asterisk can match zero characters)
            expect(matchesPattern(key, pattern)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 11 (variant): Question mark matches exactly one character
     * 
     * Property: The question mark wildcard should match exactly one character
     * Validates: Requirements 4.2
     */
    it('Property 11 (variant): Question mark matches exactly one character', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('*') && !s.includes('?')), // prefix without wildcards
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('*') && !s.includes('?')), // suffix without wildcards
          fc.string({ minLength: 1, maxLength: 1 }), // single character (can be anything)
          async (prefix, suffix, singleChar) => {
            const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
            
            // Pattern with question mark wildcard
            const pattern = `${prefix}?${suffix}`;
            
            // Key with exactly one character in place of ?
            const matchingKey = `${prefix}${singleChar}${suffix}`;
            
            // Property: The key should match the pattern
            expect(matchesPattern(matchingKey, pattern)).toBe(true);
            
            // Key with zero characters should not match
            const nonMatchingKey1 = `${prefix}${suffix}`;
            expect(matchesPattern(nonMatchingKey1, pattern)).toBe(false);
            
            // Key with two characters should not match
            const nonMatchingKey2 = `${prefix}${singleChar}${singleChar}${suffix}`;
            expect(matchesPattern(nonMatchingKey2, pattern)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 12: Exact pattern matching
     * 
     * Property: For any pattern without wildcards and any set of keys,
     * matchesPattern should return true only for keys that match the pattern exactly
     * 
     * Validates: Requirements 4.3
     */
    it('Property 12: Exact pattern matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('*') && !s.includes('?')), // pattern without wildcards
          fc.string({ minLength: 0, maxLength: 50 }), // suffix to create non-matching key
          async (pattern, suffix) => {
            const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
            
            // Property: The pattern should match itself exactly
            expect(matchesPattern(pattern, pattern)).toBe(true);
            
            // Property: A key with additional characters should not match
            if (suffix.length > 0) {
              const nonMatchingKey = `${pattern}${suffix}`;
              expect(matchesPattern(nonMatchingKey, pattern)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 12 (variant): Exact pattern with special characters
     * 
     * Property: Patterns with special regex characters should be properly escaped
     * and match exactly
     * 
     * Validates: Requirements 4.3
     */
    it('Property 12 (variant): Exact pattern with special characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('[', ']', '(', ')', '{', '}', '.', '+', '^', '$', '|', '\\'),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (specialChar, baseString) => {
            const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
            
            // Pattern with special regex character
            const pattern = `${baseString}${specialChar}`;
            
            // Property: The pattern should match itself exactly
            expect(matchesPattern(pattern, pattern)).toBe(true);
            
            // Property: A similar key without the special character should not match
            expect(matchesPattern(baseString, pattern)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property: Pattern matching is case-sensitive
     * 
     * Property: Pattern matching should be case-sensitive
     */
    it('Property: Pattern matching is case-sensitive', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.toLowerCase() !== s.toUpperCase()),
          async (baseString) => {
            const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
            
            const lowerCase = baseString.toLowerCase();
            const upperCase = baseString.toUpperCase();
            
            // Only test if the strings are actually different
            if (lowerCase !== upperCase) {
              // Property: Lowercase pattern should not match uppercase key
              expect(matchesPattern(upperCase, lowerCase)).toBe(false);
              
              // Property: Uppercase pattern should not match lowercase key
              expect(matchesPattern(lowerCase, upperCase)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('DynamoDBCacheAdapter - keys() method', () => {
  let mockDynamoClient: DynamoDBClient;
  let adapter: DynamoDBCacheAdapter;

  beforeEach(() => {
    mockDynamoClient = {
      getItem: vi.fn(),
      putItem: vi.fn(),
      deleteItem: vi.fn(),
      scanAll: vi.fn(),
      query: vi.fn()
    } as any;

    adapter = new DynamoDBCacheAdapter(mockDynamoClient);
  });

  describe('Basic functionality', () => {
    it('should return all keys matching asterisk pattern', async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const futureTimestamp = currentTimestamp + 3600;

      // Mock query for prefix pattern optimization
      vi.mocked(mockDynamoClient.query).mockResolvedValue({
        items: [
          {
            PK: 'CACHE#session:abc123',
            SK: 'CACHE',
            Value: 'value1',
            TTL: futureTimestamp,
            CreatedAt: currentTimestamp
          },
          {
            PK: 'CACHE#session:def456',
            SK: 'CACHE',
            Value: 'value2',
            TTL: futureTimestamp,
            CreatedAt: currentTimestamp
          }
        ],
        lastEvaluatedKey: undefined,
        count: 2
      });

      const result = await adapter.keys('session:*');
      
      expect(result).toHaveLength(2);
      expect(result).toContain('session:abc123');
      expect(result).toContain('session:def456');
      expect(result).not.toContain('user:xyz');
    });

    it('should return all keys when pattern is asterisk', async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const futureTimestamp = currentTimestamp + 3600;

      vi.mocked(mockDynamoClient.scanAll).mockResolvedValue([
        {
          PK: 'CACHE#key1',
          SK: 'CACHE',
          Value: 'value1',
          TTL: futureTimestamp,
          CreatedAt: currentTimestamp
        },
        {
          PK: 'CACHE#key2',
          SK: 'CACHE',
          Value: 'value2',
          TTL: futureTimestamp,
          CreatedAt: currentTimestamp
        }
      ]);

      const result = await adapter.keys('*');
      
      expect(result).toHaveLength(2);
      expect(result).toContain('key1');
      expect(result).toContain('key2');
    });

    it('should return empty array when no keys match', async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const futureTimestamp = currentTimestamp + 3600;

      // Mock query for prefix pattern optimization
      vi.mocked(mockDynamoClient.query).mockResolvedValue({
        items: [],
        lastEvaluatedKey: undefined,
        count: 0
      });

      const result = await adapter.keys('user:*');
      
      expect(result).toHaveLength(0);
    });

    it('should filter out expired items', async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const futureTimestamp = currentTimestamp + 3600;
      const pastTimestamp = currentTimestamp - 3600;

      // Mock query for prefix pattern optimization
      vi.mocked(mockDynamoClient.query).mockResolvedValue({
        items: [
          {
            PK: 'CACHE#session:valid',
            SK: 'CACHE',
            Value: 'value1',
            TTL: futureTimestamp,
            CreatedAt: currentTimestamp
          },
          {
            PK: 'CACHE#session:expired',
            SK: 'CACHE',
            Value: 'value2',
            TTL: pastTimestamp,
            CreatedAt: pastTimestamp - 3600
          }
        ],
        lastEvaluatedKey: undefined,
        count: 2
      });

      const result = await adapter.keys('session:*');
      
      expect(result).toHaveLength(1);
      expect(result).toContain('session:valid');
      expect(result).not.toContain('session:expired');
    });

    it('should handle exact pattern matching', async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const futureTimestamp = currentTimestamp + 3600;

      // Mock query for exact match (treated as prefix pattern)
      vi.mocked(mockDynamoClient.query).mockResolvedValue({
        items: [
          {
            PK: 'CACHE#exact-key',
            SK: 'CACHE',
            Value: 'value1',
            TTL: futureTimestamp,
            CreatedAt: currentTimestamp
          },
          {
            PK: 'CACHE#exact-key-suffix',
            SK: 'CACHE',
            Value: 'value2',
            TTL: futureTimestamp,
            CreatedAt: currentTimestamp
          }
        ],
        lastEvaluatedKey: undefined,
        count: 2
      });

      const result = await adapter.keys('exact-key');
      
      expect(result).toHaveLength(1);
      expect(result).toContain('exact-key');
      expect(result).not.toContain('exact-key-suffix');
    });

    it('should use filterExpression to scan only cache items', async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const futureTimestamp = currentTimestamp + 3600;

      vi.mocked(mockDynamoClient.scanAll).mockResolvedValue([
        {
          PK: 'CACHE#key1',
          SK: 'CACHE',
          Value: 'value1',
          TTL: futureTimestamp,
          CreatedAt: currentTimestamp
        }
      ]);

      await adapter.keys('*');
      
      // Verify scanAll was called with correct filter expression
      expect(mockDynamoClient.scanAll).toHaveBeenCalledWith({
        filterExpression: 'begins_with(PK, :prefix)',
        expressionAttributeValues: {
          ':prefix': 'CACHE#'
        }
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: redis-dynamodb-adapter, Property 9: Expired items excluded from keys
     * 
     * Property: For any pattern, calling keys(pattern) should not return keys with expired TTLs
     * Validates: Requirements 3.4, 4.5
     */
    it('Property 9: Expired items excluded from keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // Random pattern
          fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 100 }),
              value: fc.string({ minLength: 0, maxLength: 1000 }),
              isExpired: fc.boolean()
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (pattern, items) => {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            
            // Create mock items with some expired and some valid
            const mockItems = items.map(item => {
              const ttl = item.isExpired
                ? currentTimestamp - Math.floor(Math.random() * 3600) // Expired (in the past)
                : currentTimestamp + Math.floor(Math.random() * 3600) + 1; // Valid (in the future)
              
              return {
                PK: `CACHE#${item.key}`,
                SK: 'CACHE',
                Value: item.value,
                TTL: ttl,
                CreatedAt: currentTimestamp - 7200
              };
            });

            // Mock both scanAll and query to handle different optimization paths
            vi.mocked(mockDynamoClient.scanAll).mockResolvedValue(mockItems);
            vi.mocked(mockDynamoClient.query).mockResolvedValue({
              items: mockItems,
              lastEvaluatedKey: undefined,
              count: mockItems.length
            });

            const result = await adapter.keys(pattern);

            // Property: Result should not contain any expired keys
            for (const item of items) {
              if (item.isExpired) {
                // Expired items should not be in the result
                expect(result).not.toContain(item.key);
              }
            }

            // Property: All returned keys should be non-expired
            for (const returnedKey of result) {
              const originalItem = items.find(i => i.key === returnedKey);
              if (originalItem) {
                expect(originalItem.isExpired).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 16: Keys query scans only cache items
     * 
     * Property: For any keys() operation, only DynamoDB items with PK starting with "CACHE#" should be scanned
     * Validates: Requirements 5.3
     */
    it('Property 16: Keys query scans only cache items', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // Random pattern
          async (pattern) => {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const futureTimestamp = currentTimestamp + 3600;

            const mockItems = [
              {
                PK: 'CACHE#key1',
                SK: 'CACHE',
                Value: 'value1',
                TTL: futureTimestamp,
                CreatedAt: currentTimestamp
              }
            ];

            // Mock both scanAll and query to handle different optimization paths
            vi.mocked(mockDynamoClient.scanAll).mockResolvedValue(mockItems);
            vi.mocked(mockDynamoClient.query).mockResolvedValue({
              items: mockItems,
              lastEvaluatedKey: undefined,
              count: mockItems.length
            });

            await adapter.keys(pattern);

            // Property: Either scanAll or query should be called with CACHE# prefix filtering
            // Check if scanAll was called (for patterns without fixed prefix)
            if (vi.mocked(mockDynamoClient.scanAll).mock.calls.length > 0) {
              expect(mockDynamoClient.scanAll).toHaveBeenCalledWith(
                expect.objectContaining({
                  filterExpression: 'begins_with(PK, :prefix)',
                  expressionAttributeValues: expect.objectContaining({
                    ':prefix': 'CACHE#'
                  })
                })
              );
            }
            
            // Check if query was called (for patterns with fixed prefix)
            if (vi.mocked(mockDynamoClient.query).mock.calls.length > 0) {
              expect(mockDynamoClient.query).toHaveBeenCalledWith(
                expect.objectContaining({
                  keyConditionExpression: expect.stringContaining('begins_with'),
                  expressionAttributeValues: expect.objectContaining({
                    ':pk': expect.stringContaining('CACHE#')
                  })
                })
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Additional property test: Pattern matching consistency
     * 
     * Property: All returned keys should match the provided pattern
     */
    it('Property: All returned keys match the pattern', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // Random pattern
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }),
            { minLength: 0, maxLength: 20 }
          ),
          async (pattern, keys) => {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const futureTimestamp = currentTimestamp + 3600;

            // Create mock items for all keys
            const mockItems = keys.map(key => ({
              PK: `CACHE#${key}`,
              SK: 'CACHE',
              Value: 'test-value',
              TTL: futureTimestamp,
              CreatedAt: currentTimestamp
            }));

            // Mock both scanAll and query to handle different optimization paths
            vi.mocked(mockDynamoClient.scanAll).mockResolvedValue(mockItems);
            vi.mocked(mockDynamoClient.query).mockResolvedValue({
              items: mockItems,
              lastEvaluatedKey: undefined,
              count: mockItems.length
            });

            const result = await adapter.keys(pattern);

            // Property: All returned keys should match the pattern
            const matchesPattern = (adapter as any).matchesPattern.bind(adapter);
            for (const returnedKey of result) {
              expect(matchesPattern(returnedKey, pattern)).toBe(true);
            }

            // Property: All keys that match the pattern should be in the result
            for (const key of keys) {
              if (matchesPattern(key, pattern)) {
                expect(result).toContain(key);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Additional property test: Keys extracts cache keys correctly
     * 
     * Property: Returned keys should not have the CACHE# prefix
     */
    it('Property: Returned keys do not have CACHE# prefix', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }),
            { minLength: 0, maxLength: 20 }
          ),
          async (keys) => {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const futureTimestamp = currentTimestamp + 3600;

            // Create mock items with CACHE# prefix
            const mockItems = keys.map(key => ({
              PK: `CACHE#${key}`,
              SK: 'CACHE',
              Value: 'test-value',
              TTL: futureTimestamp,
              CreatedAt: currentTimestamp
            }));

            vi.mocked(mockDynamoClient.scanAll).mockResolvedValue(mockItems);

            const result = await adapter.keys('*');

            // Property: No returned key should start with CACHE#
            for (const returnedKey of result) {
              expect(returnedKey).not.toMatch(/^CACHE#/);
            }

            // Property: Returned keys should match the original keys (without prefix)
            for (const key of keys) {
              expect(result).toContain(key);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Task 7: Optimize keys() for prefix patterns - Property-Based Tests
// ============================================================================

describe('DynamoDBCacheAdapter - keys() Optimization', () => {
  let mockDynamoClient: DynamoDBClient;
  let adapter: DynamoDBCacheAdapter;

  beforeEach(() => {
    mockDynamoClient = {
      getItem: vi.fn(),
      putItem: vi.fn(),
      deleteItem: vi.fn(),
      scanAll: vi.fn(),
      query: vi.fn()
    } as any;

    adapter = new DynamoDBCacheAdapter(mockDynamoClient);
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: redis-dynamodb-adapter, Property 22: Query optimization for prefix patterns
     * 
     * Property: For any pattern with a fixed prefix before a wildcard (e.g., "session:*"),
     * the DynamoDB adapter should use a query operation with PK condition instead of a full scan
     * Validates: Requirements 8.4
     */
    it('Property 22: Query optimization for prefix patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate patterns with fixed prefix before wildcard
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('*') && !s.includes('?')),
            fc.constantFrom('*', '?*', '*?', '**')
          ).map(([prefix, wildcard]) => `${prefix}${wildcard}`),
          fc.array(
            fc.string({ minLength: 1, maxLength: 100 }),
            { minLength: 0, maxLength: 20 }
          ),
          async (pattern, keys) => {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const futureTimestamp = currentTimestamp + 3600;

            // Create mock items for all keys
            const mockItems = keys.map(key => ({
              PK: `CACHE#${key}`,
              SK: 'CACHE',
              Value: 'test-value',
              TTL: futureTimestamp,
              CreatedAt: currentTimestamp
            }));

            // Mock query to return items matching the prefix
            vi.mocked(mockDynamoClient.query).mockResolvedValue({
              items: mockItems,
              lastEvaluatedKey: undefined,
              count: mockItems.length
            });
            vi.mocked(mockDynamoClient.scanAll).mockResolvedValue(mockItems);

            await adapter.keys(pattern);

            // Property: For patterns with fixed prefix before wildcard, query should be called
            // Extract the prefix from the pattern (everything before the first wildcard)
            const prefixMatch = pattern.match(/^([^*?]+)[*?]/);
            if (prefixMatch && prefixMatch[1].length > 0) {
              // Should use query operation for prefix patterns
              expect(mockDynamoClient.query).toHaveBeenCalled();
              
              // Verify query was called with begins_with condition
              const queryCall = vi.mocked(mockDynamoClient.query).mock.calls[0];
              if (queryCall && queryCall[0]) {
                const queryParams = queryCall[0];
                expect(queryParams.keyConditionExpression).toContain('begins_with');
                expect(queryParams.expressionAttributeValues?.[':pk']).toContain('CACHE#');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: redis-dynamodb-adapter, Property 23: Pagination for large result sets
     * 
     * Property: For any keys() operation that would return more than 1000 items,
     * the adapter should use pagination to retrieve all results
     * Validates: Requirements 8.5
     */
    it('Property 23: Pagination for large result sets', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1001, max: 2500 }),
          async (itemCount) => {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const futureTimestamp = currentTimestamp + 3600;

            // Create a large number of mock items
            const mockItems = Array.from({ length: itemCount }, (_, i) => ({
              PK: `CACHE#key${i}`,
              SK: 'CACHE',
              Value: `value${i}`,
              TTL: futureTimestamp,
              CreatedAt: currentTimestamp
            }));

            // Mock query to return items with pagination
            // Simulate pagination by returning items in chunks
            let callCount = 0;
            vi.mocked(mockDynamoClient.query).mockImplementation(async () => {
              const startIndex = callCount * 1000;
              const endIndex = Math.min(startIndex + 1000, itemCount);
              const chunk = mockItems.slice(startIndex, endIndex);
              callCount++;
              
              return {
                count: chunk.length, // ??
                items: chunk,
                lastEvaluatedKey: endIndex < itemCount ? { PK: `CACHE#key${endIndex}`, SK: 'CACHE' } : undefined
              };
            });

            // Mock scanAll to also handle pagination
            vi.mocked(mockDynamoClient.scanAll).mockResolvedValue(mockItems);

            const result = await adapter.keys('*');

            // Property: All items should be returned despite pagination
            expect(result.length).toBe(itemCount);

            // Property: If using query with pagination, it should be called multiple times
            if (vi.mocked(mockDynamoClient.query).mock.calls.length > 0) {
              const expectedCalls = Math.ceil(itemCount / 1000);
              expect(mockDynamoClient.query).toHaveBeenCalledTimes(expectedCalls);
            }
          }
        ),
        { numRuns: 10 } // Reduced runs due to large data generation
      );
    });
  });
});
