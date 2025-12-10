import DynamoDBClient from './dynamodbclient.js';
import logger from './logger.js';

/**
 * DynamoDBCacheAdapter provides a Redis-compatible cache interface using DynamoDB as the backend.
 * 
 * This adapter implements the same interface as Redis client methods (get, set, del, keys)
 * to allow transparent switching between Redis and DynamoDB for session and cache storage.
 * 
 * Key Design Decisions:
 * - Uses "CACHE#" prefix for all cache keys to separate from application data
 * - Stores items with PK="CACHE#{key}" and SK="CACHE" for efficient querying
 * - Implements TTL (Time To Live) for automatic expiration of cached items
 * - Default TTL is 12 hours (43200 seconds)
 * 
 * @example
 * const adapter = new DynamoDBCacheAdapter(dynamoClient);
 * await adapter.set('session:123', 'user-data', 3600); // 1 hour TTL
 * const value = await adapter.get('session:123');
 * await adapter.del('session:123');
 * const keys = await adapter.keys('session:*');
 */
export default class DynamoDBCacheAdapter {
  private dynamoClient: DynamoDBClient;
  
  /**
   * Prefix added to all cache keys when storing in DynamoDB.
   * This separates cache data from application data in the same table.
   */
  private readonly KEY_PREFIX = 'CACHE#';
  
  /**
   * Sort key used for all cache items.
   * Allows efficient querying of cache items using PK prefix.
   */
  private readonly SORT_KEY = 'CACHE';
  
  /**
   * Default TTL in seconds (12 hours).
   * Applied when set() is called without an explicit TTL parameter.
   */
  private readonly DEFAULT_TTL_SECONDS = 43200;

  /**
   * Creates a new DynamoDBCacheAdapter instance.
   * 
   * @param dynamoClient - Connected DynamoDBClient instance to use for storage operations
   */
  constructor(dynamoClient: DynamoDBClient) {
    this.dynamoClient = dynamoClient;
    logger.debug('DynamoDBCacheAdapter initialized');
  }

  /**
   * Constructs a DynamoDB primary key from a cache key.
   * 
   * Transforms a cache key like "session:123" into a DynamoDB key structure:
   * { PK: "CACHE#session:123", SK: "CACHE" }
   * 
   * This ensures cache items are:
   * - Separated from application data (via CACHE# prefix)
   * - Efficiently queryable (via consistent SK value)
   * - Compatible with DynamoDB's key-value access patterns
   * 
   * @param cacheKey - The original cache key (e.g., "session:123", "user:data:456")
   * @returns DynamoDB key object with PK and SK
   * 
   * @example
   * constructDynamoKey('session:abc') 
   * // Returns: { PK: 'CACHE#session:abc', SK: 'CACHE' }
   */
  private constructDynamoKey(cacheKey: string): { PK: string; SK: string } {
    return {
      PK: `${this.KEY_PREFIX}${cacheKey}`,
      SK: this.SORT_KEY
    };
  }

  /**
   * Extracts the original cache key from a DynamoDB primary key.
   * 
   * Reverses the transformation done by constructDynamoKey().
   * Removes the "CACHE#" prefix to get back the original cache key.
   * 
   * @param dynamoPK - The DynamoDB partition key (e.g., "CACHE#session:123")
   * @returns The original cache key without the prefix (e.g., "session:123")
   * 
   * @example
   * extractCacheKey('CACHE#session:abc')
   * // Returns: 'session:abc'
   * 
   * extractCacheKey('CACHE#user:data:456')
   * // Returns: 'user:data:456'
   */
  private extractCacheKey(dynamoPK: string): string {
    if (dynamoPK.startsWith(this.KEY_PREFIX)) {
      return dynamoPK.substring(this.KEY_PREFIX.length);
    }
    return dynamoPK;
  }

  /**
   * Retrieves a value from the cache by key.
   * 
   * This method:
   * 1. Constructs the DynamoDB key from the cache key
   * 2. Retrieves the item from DynamoDB
   * 3. Checks if the item exists
   * 4. Validates that the TTL has not expired
   * 5. Returns the value or null
   * 
   * TTL Expiration Logic:
   * - If the item's TTL timestamp is less than the current time, the item is considered expired
   * - Expired items are treated as if they don't exist (returns null)
   * - This provides client-side TTL enforcement in addition to DynamoDB's automatic cleanup
   * 
   * @param key - The cache key to retrieve (e.g., "session:123", "user:data:456")
   * @returns Promise resolving to the cached value string, or null if not found or expired
   * 
   * @example
   * const value = await adapter.get('session:abc123');
   * if (value) {
   *   console.log('Session data:', value);
   * } else {
   *   console.log('Session not found or expired');
   * }
   */
  async get(key: string): Promise<string | null> {
    try {
      // Construct DynamoDB key with CACHE# prefix
      const dynamoKey = this.constructDynamoKey(key);
      
      logger.debug(`Cache get operation: ${key}`);
      
      // Retrieve item from DynamoDB
      const item = await this.dynamoClient.getItem(dynamoKey);
      
      // If item doesn't exist, return null
      if (!item) {
        logger.debug(`Cache miss: ${key} (not found)`);
        return null;
      }
      
      // Check if TTL has expired
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (item.TTL && item.TTL < currentTimestamp) {
        logger.debug(`Cache miss: ${key} (expired at ${item.TTL}, current: ${currentTimestamp})`);
        return null;
      }
      
      // Return the cached value
      logger.debug(`Cache hit: ${key}`);
      return item.Value !== undefined ? item.Value : null;
    } catch (error) {
      logger.error(`Cache get failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Stores a value in the cache with an optional TTL.
   * 
   * This method:
   * 1. Calculates the TTL timestamp (current time + ttlSeconds or DEFAULT_TTL_SECONDS)
   * 2. Constructs a DynamoDB item with PK, SK, Value, TTL, and CreatedAt
   * 3. Stores the item in DynamoDB using putItem()
   * 4. Returns 'OK' on success, null on failure
   * 
   * TTL Calculation:
   * - If ttlSeconds is provided, uses that value
   * - If ttlSeconds is not provided, uses DEFAULT_TTL_SECONDS (12 hours)
   * - TTL is stored as a Unix timestamp (seconds since epoch)
   * - DynamoDB's TTL feature will automatically delete expired items
   * 
   * Item Structure:
   * - PK: "CACHE#{key}" - Partition key with cache prefix
   * - SK: "CACHE" - Sort key for all cache items
   * - Value: The string value to cache
   * - TTL: Unix timestamp when the item expires
   * - CreatedAt: Unix timestamp when the item was created
   * 
   * @param key - The cache key to store (e.g., "session:123", "user:data:456")
   * @param value - The string value to cache
   * @param ttlSeconds - Optional TTL in seconds. If not provided, uses DEFAULT_TTL_SECONDS (12 hours)
   * @returns Promise resolving to 'OK' on success, null on failure
   * 
   * @example
   * // Store with default TTL (12 hours)
   * await adapter.set('session:abc123', 'user-data');
   * 
   * // Store with custom TTL (1 hour)
   * await adapter.set('session:abc123', 'user-data', 3600);
   * 
   * // Store with short TTL (5 minutes)
   * await adapter.set('temp:data', 'temporary-value', 300);
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<string | null> {
    try {
      // Calculate TTL timestamp
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const ttl = ttlSeconds !== undefined ? ttlSeconds : this.DEFAULT_TTL_SECONDS;
      const ttlTimestamp = currentTimestamp + ttl;
      
      // Construct DynamoDB key
      const dynamoKey = this.constructDynamoKey(key);
      
      // Construct DynamoDB item
      const item = {
        PK: dynamoKey.PK,
        SK: dynamoKey.SK,
        Value: value,
        TTL: ttlTimestamp,
        CreatedAt: currentTimestamp
      };
      
      logger.debug(`Cache set operation: ${key} (TTL: ${ttl}s, expires at: ${ttlTimestamp})`);
      
      console.log('cached', item);
      // Store item in DynamoDB
      await this.dynamoClient.putItem(item);
      
      logger.debug(`Cache set successful: ${key}`);
      return 'OK';
    } catch (error) {
      logger.error(`Cache set failed for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Deletes a value from the cache by key.
   * 
   * This method:
   * 1. Constructs the DynamoDB key from the cache key
   * 2. Checks if the item exists before deletion
   * 3. Deletes the item from DynamoDB
   * 4. Returns 1 if the key was deleted, 0 if it didn't exist
   * 
   * Redis Compatibility:
   * - Redis del() returns the number of keys deleted (0 or 1 for single key)
   * - This implementation matches that behavior by checking existence first
   * - DynamoDB's deleteItem() succeeds even if the item doesn't exist
   * - We need to check existence to return the correct count
   * 
   * @param key - The cache key to delete (e.g., "session:123", "user:data:456")
   * @returns Promise resolving to 1 if the key was deleted, 0 if it didn't exist
   * 
   * @example
   * const deleted = await adapter.del('session:abc123');
   * if (deleted === 1) {
   *   console.log('Session deleted');
   * } else {
   *   console.log('Session not found');
   * }
   */
  async del(key: string): Promise<number> {
    try {
      // Construct DynamoDB key with CACHE# prefix
      const dynamoKey = this.constructDynamoKey(key);
      
      logger.debug(`Cache delete operation: ${key}`);
      
      // Check if the item exists before deletion
      // This is necessary to return the correct count (Redis compatibility)
      const existingItem = await this.dynamoClient.getItem(dynamoKey);
      
      if (!existingItem) {
        logger.debug(`Cache delete: ${key} (not found)`);
        return 0;
      }
      
      // Delete the item from DynamoDB
      await this.dynamoClient.deleteItem(dynamoKey);
      
      logger.debug(`Cache delete successful: ${key}`);
      return 1;
    } catch (error) {
      logger.error(`Cache delete failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Converts a Redis-style pattern to a JavaScript RegExp.
   * 
   * Redis pattern syntax:
   * - `*` matches zero or more characters (converted to `.*` in regex)
   * - `?` matches exactly one character (converted to `.` in regex)
   * - All other special regex characters are escaped
   * 
   * This method ensures that Redis patterns work correctly with JavaScript regex
   * by escaping special regex characters and converting wildcards appropriately.
   * 
   * Special regex characters that are escaped:
   * . + ^ $ { } ( ) | [ ] \
   * 
   * @param pattern - Redis-style pattern (e.g., "session:*", "user:?123", "exact-key")
   * @returns RegExp that matches keys according to the pattern
   * 
   * @example
   * patternToRegex('session:*')
   * // Returns: /^session:.*$/
   * 
   * patternToRegex('user:?123')
   * // Returns: /^user:.123$/
   * 
   * patternToRegex('exact-key')
   * // Returns: /^exact-key$/
   * 
   * patternToRegex('data[123]')
   * // Returns: /^data\[123\]$/ (brackets are escaped)
   */
  private patternToRegex(pattern: string): RegExp {
    // Escape special regex characters except * and ?
    // These characters need to be escaped: . + ^ $ { } ( ) | [ ] \
    let escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    
    // Convert Redis wildcards to regex equivalents
    // * matches zero or more characters -> .*
    // ? matches exactly one character -> .
    escaped = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    
    // Anchor the pattern to match the entire string
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Tests if a cache key matches a Redis-style pattern.
   * 
   * This method uses the patternToRegex() helper to convert the pattern
   * to a regular expression and then tests the key against it.
   * 
   * Pattern Matching Rules:
   * - `*` matches zero or more characters
   * - `?` matches exactly one character
   * - Exact strings match exactly
   * - Matching is case-sensitive
   * 
   * @param key - The cache key to test (e.g., "session:abc123", "user:data:456")
   * @param pattern - Redis-style pattern (e.g., "session:*", "user:?123", "exact-key")
   * @returns true if the key matches the pattern, false otherwise
   * 
   * @example
   * matchesPattern('session:abc123', 'session:*')
   * // Returns: true
   * 
   * matchesPattern('session:abc123', 'user:*')
   * // Returns: false
   * 
   * matchesPattern('user:a123', 'user:?123')
   * // Returns: true
   * 
   * matchesPattern('user:ab123', 'user:?123')
   * // Returns: false (? matches exactly one character)
   * 
   * matchesPattern('exact-key', 'exact-key')
   * // Returns: true
   */
  private matchesPattern(key: string, pattern: string): boolean {
    const regex = this.patternToRegex(pattern);
    return regex.test(key);
  }

  /**
   * Extracts a fixed prefix from a pattern if it exists.
   * 
   * A fixed prefix is the part of the pattern before the first wildcard (* or ?).
   * This prefix can be used to optimize DynamoDB queries by using begins_with condition.
   * 
   * Examples:
   * - "session:*" -> "session:"
   * - "user:data:*" -> "user:data:"
   * - "temp?" -> "temp"
   * - "*" -> null (no fixed prefix)
   * - "exact-key" -> "exact-key" (entire pattern is prefix)
   * 
   * @param pattern - Redis-style pattern
   * @returns The fixed prefix if it exists and is useful for optimization, null otherwise
   */
  private extractFixedPrefix(pattern: string): string | null {
    // Find the first wildcard character
    const wildcardIndex = pattern.search(/[*?]/);
    
    // If no wildcard found, the entire pattern is a fixed prefix (exact match)
    if (wildcardIndex === -1) {
      return pattern;
    }
    
    // If wildcard is at the start, no fixed prefix
    if (wildcardIndex === 0) {
      return null;
    }
    
    // Extract the prefix before the wildcard
    const prefix = pattern.substring(0, wildcardIndex);
    
    // Only use prefix optimization if it's meaningful (at least 1 character)
    return prefix.length > 0 ? prefix : null;
  }

  /**
   * Retrieves all cache keys matching a Redis-style pattern.
   * 
   * This method:
   * 1. Detects if the pattern has a fixed prefix before wildcards
   * 2. Uses optimized query operation for prefix patterns (e.g., "session:*")
   * 3. Falls back to scan for complex patterns (e.g., "*:session", "?abc")
   * 4. Implements pagination for large result sets (>1000 items)
   * 5. Filters items by pattern matching and TTL expiration
   * 6. Extracts cache keys (removes "CACHE#" prefix)
   * 7. Returns array of matching keys
   * 
   * Pattern Matching:
   * - `*` matches zero or more characters (e.g., "session:*" matches all session keys)
   * - `?` matches exactly one character (e.g., "user:?123" matches "user:a123", "user:b123")
   * - Exact strings match exactly (e.g., "exact-key" matches only "exact-key")
   * 
   * TTL Filtering:
   * - Items with expired TTL are excluded from results
   * - TTL is checked against current timestamp
   * - This ensures consistency with get() behavior
   * 
   * Performance Optimizations:
   * - Uses query with begins_with for patterns with fixed prefix (e.g., "session:*")
   * - Uses scanAll for patterns without fixed prefix (e.g., "*", "?abc")
   * - Implements pagination to handle large result sets (>1000 items)
   * - Filters are applied client-side after retrieval
   * 
   * @param pattern - Redis-style pattern to match keys against (e.g., "session:*", "user:?123", "*")
   * @returns Promise resolving to array of matching cache keys (without CACHE# prefix)
   * 
   * @example
   * // Get all session keys (uses optimized query)
   * const sessionKeys = await adapter.keys('session:*');
   * // Returns: ['session:abc123', 'session:def456', ...]
   * 
   * // Get all keys (uses scan)
   * const allKeys = await adapter.keys('*');
   * // Returns: ['session:abc123', 'user:data:456', 'temp:xyz', ...]
   * 
   * // Get specific pattern (uses scan)
   * const userKeys = await adapter.keys('user:?123');
   * // Returns: ['user:a123', 'user:b123'] (if they exist)
   * 
   * // Get exact key (uses optimized query)
   * const exactKey = await adapter.keys('exact-key');
   * // Returns: ['exact-key'] or [] if not found
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      logger.debug(`Cache keys operation: pattern="${pattern}"`);
      
      // Detect if pattern has a fixed prefix for optimization
      const fixedPrefix = this.extractFixedPrefix(pattern);
      
      let allItems: any[] = [];
      
      if (fixedPrefix) {
        // Use optimized query operation for patterns with fixed prefix
        logger.debug(`Using query optimization for prefix pattern: "${fixedPrefix}"`);
        
        const queryParams = {
          keyConditionExpression: 'begins_with(PK, :pk) AND SK = :sk',
          expressionAttributeValues: {
            ':pk': `${this.KEY_PREFIX}${fixedPrefix}`,
            ':sk': this.SORT_KEY
          }
        };
        
        // Query with pagination support
        let lastEvaluatedKey: any = undefined;
        let pageCount = 0;
        
        do {
          const queryParamsWithPagination = lastEvaluatedKey
            ? { ...queryParams, exclusiveStartKey: lastEvaluatedKey }
            : queryParams;
          
          const result = await this.dynamoClient.query(queryParamsWithPagination);
          
          if (result.items) {
            allItems = allItems.concat(result.items);
          }
          
          lastEvaluatedKey = result.lastEvaluatedKey;
          pageCount++;
          
          if (lastEvaluatedKey) {
            logger.debug(`Query pagination: retrieved page ${pageCount}, continuing...`);
          }
        } while (lastEvaluatedKey);
        
        logger.debug(`Cache keys query retrieved ${allItems.length} items (${pageCount} pages)`);
      } else {
        // Fall back to scan for complex patterns without fixed prefix
        logger.debug(`Using scan for complex pattern (no fixed prefix)`);
        
        const scanParams = {
          filterExpression: 'begins_with(PK, :prefix)',
          expressionAttributeValues: {
            ':prefix': this.KEY_PREFIX
          }
        };
        
        allItems = await this.dynamoClient.scanAll(scanParams);
        
        logger.debug(`Cache keys scan retrieved ${allItems.length} items`);
      }
      
      // Get current timestamp for TTL checking
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      // Filter items by:
      // 1. TTL expiration (exclude expired items)
      // 2. Pattern matching
      const matchingKeys: string[] = [];
      let expiredCount = 0;
      
      for (const item of allItems) {
        // Check if item has expired
        if (item.TTL && item.TTL < currentTimestamp) {
          expiredCount++;
          continue;
        }
        
        // Extract cache key from DynamoDB PK
        const cacheKey = this.extractCacheKey(item.PK);
        
        // Check if key matches pattern
        if (this.matchesPattern(cacheKey, pattern)) {
          matchingKeys.push(cacheKey);
        }
      }
      
      logger.debug(
        `Cache keys operation completed: pattern="${pattern}", ` +
        `matched=${matchingKeys.length}, expired=${expiredCount}, ` +
        `total_scanned=${allItems.length}`
      );
      
      return matchingKeys;
    } catch (error) {
      logger.error(`Cache keys operation failed for pattern "${pattern}":`, error);
      throw error;
    }
  }
}
