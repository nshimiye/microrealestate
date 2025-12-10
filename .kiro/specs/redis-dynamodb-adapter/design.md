# Design Document

## Overview

This design implements a DynamoDB adapter for the existing RedisClient class, allowing transparent switching between Redis and DynamoDB backends for session and cache storage. The implementation uses the Adapter pattern to maintain API compatibility while delegating operations to either Redis or DynamoDB based on the `USE_DYNAMODB` environment variable.

The key design principle is **zero breaking changes** - existing code using RedisClient will continue to work without modifications. The adapter pattern encapsulates the backend-specific logic, presenting a unified interface regardless of the underlying storage mechanism.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Code                      │
│              (Services using RedisClient)                │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ Uses RedisClient interface
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     RedisClient                          │
│                   (Singleton Class)                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Public Interface:                                │  │
│  │  - get(key): Promise<string | null>              │  │
│  │  - set(key, value): Promise<string | null>       │  │
│  │  - del(key): Promise<number>                     │  │
│  │  - keys(pattern): Promise<string[]>              │  │
│  │  - connect(): Promise<void>                      │  │
│  │  - disconnect(): Promise<void>                   │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                                │
│         ┌───────────────┴───────────────┐                │
│         │                               │                │
│         ▼                               ▼                │
│  ┌─────────────┐              ┌──────────────────┐      │
│  │   Redis     │              │    DynamoDB      │      │
│  │  Backend    │              │     Adapter      │      │
│  │  (Existing) │              │      (New)       │      │
│  └─────────────┘              └──────────────────┘      │
└─────────────────────────────────────────────────────────┘
         │                               │
         │                               │
         ▼                               ▼
┌─────────────────┐          ┌──────────────────────┐
│  Redis Server   │          │  DynamoDB Service    │
│   (External)    │          │     (AWS/Local)      │
└─────────────────┘          └──────────────────────┘
```

### Backend Selection Logic

The RedisClient will determine which backend to use during initialization:

1. Read `USE_DYNAMODB` from EnvironmentConfig
2. If `USE_DYNAMODB === true`, initialize DynamoDB adapter
3. If `USE_DYNAMODB === false` or undefined, initialize Redis client (existing behavior)
4. Bind the appropriate backend methods to the public interface methods

### DynamoDB Table Schema for Cache Data

Cache data will be stored in the existing DynamoDB table using a specific key structure:

```
PK (Partition Key): "CACHE#{key}"
SK (Sort Key): "CACHE"
Value: string (the cached value)
TTL: number (Unix timestamp for expiration)
CreatedAt: number (Unix timestamp)
```

This schema allows:
- Efficient single-item retrieval using PK and SK
- Separation from application data using the "CACHE#" prefix
- Automatic cleanup using DynamoDB's TTL feature
- Pattern-based queries using the PK prefix

## Components and Interfaces

### 1. RedisClient (Modified)

**Location:** `services/common/src/utils/redisclient.ts`

**Responsibilities:**
- Maintain singleton pattern
- Select appropriate backend during initialization
- Expose unified interface for cache operations
- Delegate operations to the selected backend

**Key Changes:**
```typescript
export default class RedisClient {
  private static instance: RedisClient | null = null;
  private client: redis.RedisClientType | null = null;
  private dynamoAdapter: DynamoDBCacheAdapter | null = null;
  private useDynamoDB: boolean = false;
  private envConfig: EnvironmentConfig;

  // Public interface methods (unchanged signatures)
  get: RedisClientTypes.GetFunction;
  set: RedisClientTypes.SetFunction;
  del: RedisClientTypes.DelFunction;
  keys: RedisClientTypes.KeysFunction;

  private constructor(envConfig: EnvironmentConfig) {
    this.envConfig = envConfig;
    const config = envConfig.getValues();
    this.useDynamoDB = config.USE_DYNAMODB === true;
  }

  async connect() {
    if (this.useDynamoDB) {
      await this.connectDynamoDB();
    } else {
      await this.connectRedis();
    }
  }

  private async connectDynamoDB() {
    // Initialize DynamoDB adapter
    // Bind adapter methods to public interface
  }

  private async connectRedis() {
    // Existing Redis connection logic
  }
}
```

### 2. DynamoDBCacheAdapter (New)

**Location:** `services/common/src/utils/dynamodbcacheadapter.ts`

**Responsibilities:**
- Implement cache operations using DynamoDB
- Handle TTL management
- Implement pattern matching for keys() method
- Transform data between cache format and DynamoDB format

**Interface:**
```typescript
export default class DynamoDBCacheAdapter {
  private dynamoClient: DynamoDBClient;
  private readonly KEY_PREFIX = 'CACHE#';
  private readonly SORT_KEY = 'CACHE';
  private readonly DEFAULT_TTL_SECONDS = 43200; // 12 hours

  constructor(dynamoClient: DynamoDBClient);
  
  async get(key: string): Promise<string | null>;
  async set(key: string, value: string, ttlSeconds?: number): Promise<string | null>;
  async del(key: string): Promise<number>;
  async keys(pattern: string): Promise<string[]>;
}
```

**Key Methods:**

#### get(key: string)
1. Construct DynamoDB key: `{ PK: "CACHE#{key}", SK: "CACHE" }`
2. Call `dynamoClient.getItem()`
3. If item not found, return null
4. Check if TTL has expired (compare TTL with current timestamp)
5. If expired, delete item and return null
6. Return the Value attribute

#### set(key: string, value: string, ttlSeconds?: number)
1. Calculate TTL timestamp: `Math.floor(Date.now() / 1000) + ttlSeconds`
2. Construct DynamoDB item:
   ```typescript
   {
     PK: `CACHE#${key}`,
     SK: 'CACHE',
     Value: value,
     TTL: ttlTimestamp,
     CreatedAt: Math.floor(Date.now() / 1000)
   }
   ```
3. Call `dynamoClient.putItem()`
4. Return 'OK' on success, null on failure

#### del(key: string)
1. Construct DynamoDB key: `{ PK: "CACHE#{key}", SK: "CACHE" }`
2. Call `dynamoClient.deleteItem()`
3. Return 1 if deleted, 0 if key didn't exist

#### keys(pattern: string)
1. Convert Redis pattern to filter logic:
   - `*` matches any characters
   - `?` matches single character
   - Exact string matches exactly
2. If pattern is `*`, scan all items with PK prefix "CACHE#"
3. If pattern has prefix before wildcard (e.g., "session:*"), use query with PK condition
4. Filter results by:
   - Pattern matching
   - TTL expiration (exclude expired items)
5. Extract original keys (remove "CACHE#" prefix)
6. Return array of matching keys

### 3. Pattern Matching Utility

**Location:** `services/common/src/utils/dynamodbcacheadapter.ts` (internal helper)

**Responsibilities:**
- Convert Redis-style patterns to JavaScript regex
- Match keys against patterns

**Implementation:**
```typescript
private patternToRegex(pattern: string): RegExp {
  // Escape special regex characters except * and ?
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // Convert * to .* and ? to .
  const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`);
}

private matchesPattern(key: string, pattern: string): boolean {
  const regex = this.patternToRegex(pattern);
  return regex.test(key);
}
```

## Data Models

### Cache Item in DynamoDB

```typescript
interface DynamoDBCacheItem {
  PK: string;           // "CACHE#{key}"
  SK: string;           // "CACHE"
  Value: string;        // The cached value
  TTL: number;          // Unix timestamp (seconds) for expiration
  CreatedAt: number;    // Unix timestamp (seconds) when created
}
```

### Key Transformation

| Original Key | DynamoDB PK | DynamoDB SK |
|--------------|-------------|-------------|
| `session:abc123` | `CACHE#session:abc123` | `CACHE` |
| `user:data:123` | `CACHE#user:data:123` | `CACHE` |
| `temp:xyz` | `CACHE#temp:xyz` | `CACHE` |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Backend Selection Properties

Property 1: Backend selection based on configuration
*For any* EnvironmentConfig with USE_DYNAMODB set to true or false, initializing RedisClient should select DynamoDB backend when true and Redis backend when false
**Validates: Requirements 1.1, 1.2, 1.3**

Property 2: API compatibility across backends
*For any* key-value pair and operation (get/set/del/keys), the same client code should work with both Redis and DynamoDB backends without modification
**Validates: Requirements 1.4, 2.2, 2.3, 2.4, 2.5**

### Storage and Retrieval Properties

Property 3: Set-then-get consistency
*For any* key and value, after calling set(key, value), calling get(key) should return the same value
**Validates: Requirements 2.3, 2.2**

Property 4: Delete removes key
*For any* key that exists, after calling del(key), calling get(key) should return null
**Validates: Requirements 2.4**

Property 5: Non-existent key returns null
*For any* key that has not been set, calling get(key) should return null
**Validates: Requirements 2.2**

### TTL Properties

Property 6: TTL attribute presence
*For any* key-value pair stored in DynamoDB, the DynamoDB item should contain a TTL attribute
**Validates: Requirements 3.1**

Property 7: Default TTL application
*For any* key set without an explicit TTL parameter, the TTL should be set to 12 hours (43200 seconds) from the current time
**Validates: Requirements 3.2**

Property 8: Expired items return null
*For any* key with an expired TTL, calling get(key) should return null
**Validates: Requirements 3.3**

Property 9: Expired items excluded from keys
*For any* pattern, calling keys(pattern) should not return keys with expired TTLs
**Validates: Requirements 3.4, 4.5**

Property 10: TTL refresh on update
*For any* existing key, calling set(key, newValue) should update the TTL to a new expiration time
**Validates: Requirements 3.5**

### Pattern Matching Properties

Property 11: Wildcard pattern matching
*For any* pattern containing asterisk wildcards and any set of keys, keys(pattern) should return all keys where the pattern matches (with * matching zero or more characters)
**Validates: Requirements 4.1, 4.2**

Property 12: Exact pattern matching
*For any* pattern without wildcards and any set of keys, keys(pattern) should return only keys that match the pattern exactly
**Validates: Requirements 4.3**

Property 13: Pattern matching with question mark
*For any* pattern containing question mark wildcards and any set of keys, keys(pattern) should return all keys where ? matches exactly one character
**Validates: Requirements 4.2**

### Key Prefix Properties

Property 14: Cache key prefix transformation
*For any* cache key, when stored in DynamoDB, the PK should be "CACHE#{key}"
**Validates: Requirements 5.1**

Property 15: No collision with application data
*For any* cache key, the transformed DynamoDB key should not collide with application data keys (which don't have the CACHE# prefix)
**Validates: Requirements 5.2**

Property 16: Keys query scans only cache items
*For any* keys() operation, only DynamoDB items with PK starting with "CACHE#" should be scanned
**Validates: Requirements 5.3**

Property 17: Delete only affects cache items
*For any* delete operation on a cache key, only the item with PK="CACHE#{key}" should be deleted, not application data
**Validates: Requirements 5.4**

### Error Handling Properties

Property 18: Error consistency across backends
*For any* operation that fails, both Redis and DynamoDB backends should throw errors with similar structure and information
**Validates: Requirements 6.3**

### Logging Properties

Property 19: Successful operation logging
*For any* successful cache operation (get/set/del/keys), a debug-level log entry should be created
**Validates: Requirements 7.2**

Property 20: Failed operation logging
*For any* failed cache operation, an error-level log entry should be created with operation details and error message
**Validates: Requirements 7.3**

Property 21: TTL filtering logging
*For any* keys() operation that filters out expired items, a debug log should indicate how many items were filtered
**Validates: Requirements 7.5**

### Performance Properties

Property 22: Query optimization for prefix patterns
*For any* pattern with a fixed prefix before a wildcard (e.g., "session:*"), the DynamoDB adapter should use a query operation with PK condition instead of a full scan
**Validates: Requirements 8.4**

Property 23: Pagination for large result sets
*For any* keys() operation that would return more than 1000 items, the adapter should use pagination to retrieve all results
**Validates: Requirements 8.5**

## Error Handling

### Error Translation Strategy

The DynamoDB adapter will translate DynamoDB-specific errors to match Redis client error patterns:

| DynamoDB Error | Translated Error | HTTP Status |
|----------------|------------------|-------------|
| `ConditionalCheckFailedException` | "Conditional check failed" | 409 |
| `ProvisionedThroughputExceededException` | "Request rate exceeded" | 429 |
| `ResourceNotFoundException` | "Resource not found" | 404 |
| `ValidationException` | "Validation error: {message}" | 400 |
| Network errors | "Connection error: {message}" | 500 |

### Retry Logic

For throttling errors (`ProvisionedThroughputExceededException`):
1. Retry up to 3 times
2. Use exponential backoff: 100ms, 200ms, 400ms
3. After max retries, throw error to caller

### Connection Errors

During `connect()`:
- Verify DynamoDB table exists
- Verify credentials are valid
- Throw descriptive errors if initialization fails

## Testing Strategy

### Unit Testing

**Framework:** Vitest (already used in the project)

**Approach:**
- Mock DynamoDBClient to test adapter logic in isolation
- Test each method (get, set, del, keys) independently
- Test TTL calculation and expiration logic
- Test pattern matching regex conversion
- Test key prefix transformation

**Example Test Structure:**
```typescript
describe('DynamoDBCacheAdapter', () => {
  let adapter: DynamoDBCacheAdapter;
  let mockDynamoClient: MockDynamoDBClient;

  beforeEach(() => {
    mockDynamoClient = createMockDynamoClient();
    adapter = new DynamoDBCacheAdapter(mockDynamoClient);
  });

  describe('get', () => {
    it('should return value for existing key', async () => {
      // Test implementation
    });

    it('should return null for non-existent key', async () => {
      // Test implementation
    });

    it('should return null for expired key', async () => {
      // Test implementation
    });
  });

  // More test suites for set, del, keys
});
```

### Property-Based Testing

**Framework:** fast-check (already used in the gateway service)

**Approach:**
- Generate random keys, values, and patterns
- Verify properties hold across all generated inputs
- Test round-trip properties (set then get)
- Test pattern matching correctness
- Test TTL behavior

**Property Tests:**
1. **Set-Get Round Trip**: For any key and value, set(key, value) followed by get(key) should return the value
2. **Delete Removes Key**: For any key, after del(key), get(key) should return null
3. **Pattern Matching**: For any pattern and set of keys, keys(pattern) should return exactly the keys that match
4. **TTL Expiration**: For any key with expired TTL, get(key) should return null
5. **Key Prefix**: For any cache key, the DynamoDB PK should start with "CACHE#"

**Example Property Test:**
```typescript
import fc from 'fast-check';

describe('DynamoDBCacheAdapter Properties', () => {
  it('set-get round trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // key
        fc.string(),                  // value
        async (key, value) => {
          await adapter.set(key, value);
          const result = await adapter.get(key);
          expect(result).toBe(value);
        }
      )
    );
  });

  it('pattern matching correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1 })), // keys to store
        fc.string(),                             // pattern
        async (keys, pattern) => {
          // Store all keys
          for (const key of keys) {
            await adapter.set(key, 'value');
          }
          
          // Get keys matching pattern
          const matchedKeys = await adapter.keys(pattern);
          
          // Verify all matched keys actually match the pattern
          for (const matchedKey of matchedKeys) {
            expect(matchesPattern(matchedKey, pattern)).toBe(true);
          }
          
          // Verify all keys that should match are included
          for (const key of keys) {
            if (matchesPattern(key, pattern)) {
              expect(matchedKeys).toContain(key);
            }
          }
        }
      )
    );
  });
});
```

### Integration Testing

**Approach:**
- Use DynamoDB Local for integration tests
- Test actual DynamoDB operations without mocks
- Verify TTL behavior with real DynamoDB
- Test error scenarios (table not found, invalid credentials)

**Setup:**
```typescript
describe('DynamoDBCacheAdapter Integration', () => {
  let dynamoClient: DynamoDBClient;
  let adapter: DynamoDBCacheAdapter;

  beforeAll(async () => {
    // Start DynamoDB Local or use test table
    dynamoClient = new DynamoDBClient({
      region: 'us-east-1',
      endpoint: 'http://localhost:8000',
      tableName: 'test-cache-table',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    });
    await dynamoClient.connect();
    adapter = new DynamoDBCacheAdapter(dynamoClient);
  });

  afterAll(async () => {
    await dynamoClient.disconnect();
  });

  // Integration tests
});
```

### Backend Compatibility Testing

**Approach:**
- Run the same test suite against both Redis and DynamoDB backends
- Verify identical behavior for all operations
- Use parameterized tests to test both backends

**Example:**
```typescript
describe.each([
  ['Redis', createRedisClient],
  ['DynamoDB', createDynamoDBClient]
])('%s Backend', (backendName, createClient) => {
  let client: RedisClient;

  beforeEach(async () => {
    client = await createClient();
    await client.connect();
  });

  it('should store and retrieve values', async () => {
    await client.set('test-key', 'test-value');
    const result = await client.get('test-key');
    expect(result).toBe('test-value');
  });

  // More tests that should work identically on both backends
});
```

## Implementation Plan

### Phase 1: Core Adapter Implementation
1. Create `DynamoDBCacheAdapter` class
2. Implement `get()` method with TTL checking
3. Implement `set()` method with TTL calculation
4. Implement `del()` method
5. Write unit tests for core methods

### Phase 2: Pattern Matching
1. Implement pattern-to-regex conversion utility
2. Implement `keys()` method with pattern matching
3. Optimize queries for prefix patterns
4. Write unit tests for pattern matching
5. Write property-based tests for pattern correctness

### Phase 3: RedisClient Integration
1. Modify `RedisClient` to detect `USE_DYNAMODB` flag
2. Add DynamoDB adapter initialization path
3. Bind adapter methods to public interface
4. Add logging for backend selection
5. Write integration tests

### Phase 4: Error Handling and Logging
1. Implement error translation
2. Add retry logic for throttling
3. Add comprehensive logging
4. Test error scenarios
5. Write property-based tests for error consistency

### Phase 5: Performance Optimization
1. Implement pagination for large result sets
2. Optimize query operations for prefix patterns
3. Add caching for frequently accessed keys (optional)
4. Performance testing and tuning

### Phase 6: Documentation and Testing
1. Update README with DynamoDB configuration
2. Add code comments and JSDoc
3. Write integration tests with DynamoDB Local
4. Run full test suite on both backends
5. Update environment variable documentation

## Configuration

### Environment Variables

New environment variables (already defined in types):
- `USE_DYNAMODB`: boolean - Enable DynamoDB backend
- `DYNAMODB_TABLE_NAME`: string - Table name for cache storage
- `DYNAMODB_REGION`: string - AWS region
- `DYNAMODB_ENDPOINT`: string - Optional endpoint for local development
- `DYNAMODB_ACCESS_KEY_ID`: string - AWS credentials
- `DYNAMODB_SECRET_ACCESS_KEY`: string - AWS credentials

### Example Configuration

**Development (DynamoDB Local):**
```env
USE_DYNAMODB=true
DYNAMODB_TABLE_NAME=microrealestate-local
DYNAMODB_REGION=us-east-1
DYNAMODB_ENDPOINT=http://dynamodb-local:8000
DYNAMODB_ACCESS_KEY_ID=local
DYNAMODB_SECRET_ACCESS_KEY=local
```

**Production (AWS DynamoDB):**
```env
USE_DYNAMODB=true
DYNAMODB_TABLE_NAME=microrealestate-prod
DYNAMODB_REGION=us-east-1
# Credentials from IAM role or environment
```

## Migration Strategy

### Gradual Rollout

1. **Development Environment**: Test with DynamoDB Local
2. **Staging Environment**: Test with AWS DynamoDB
3. **Production**: Enable for new sessions, keep Redis for existing sessions
4. **Full Migration**: Switch all traffic to DynamoDB

### Rollback Plan

If issues occur:
1. Set `USE_DYNAMODB=false`
2. Restart services
3. Redis takes over immediately
4. Investigate and fix DynamoDB issues

### Data Migration

**Note:** Session and cache data is ephemeral, so no data migration is needed. When switching backends:
- Existing sessions in Redis will expire naturally
- New sessions will be created in DynamoDB
- No data loss for critical application data (stored in MongoDB)

## Performance Considerations

### DynamoDB Capacity Planning

**Read Capacity:**
- Estimate: 10-50 reads/second per service
- Use on-demand billing for variable workloads
- Monitor CloudWatch metrics for throttling

**Write Capacity:**
- Estimate: 5-20 writes/second per service
- Session creation and updates
- Cache invalidation

### Optimization Strategies

1. **Batch Operations**: Use batch get/write for multiple keys
2. **Query vs Scan**: Use query with PK prefix when possible
3. **Projection Expressions**: Only retrieve needed attributes
4. **Connection Pooling**: Reuse DynamoDB client connections
5. **Local Caching**: Consider in-memory cache for hot keys (future enhancement)

### Monitoring

Key metrics to monitor:
- Operation latency (p50, p95, p99)
- Error rates by operation type
- DynamoDB throttling events
- TTL deletion lag
- Cache hit/miss rates

## Security Considerations

### Access Control

- Use IAM roles with least privilege
- Restrict DynamoDB table access to cache operations only
- Separate credentials for dev/staging/prod

### Data Encryption

- Enable encryption at rest for DynamoDB table
- Use HTTPS for all DynamoDB API calls
- Rotate credentials regularly

### Data Isolation

- Use key prefixes to prevent cache/application data mixing
- Validate all keys before storage
- Sanitize pattern inputs to prevent injection

## Future Enhancements

1. **Compression**: Compress large values before storage
2. **Metrics**: Add detailed metrics for cache operations
3. **Multi-Region**: Support DynamoDB global tables
4. **Batch Operations**: Expose batch get/set methods
5. **Cache Warming**: Pre-populate frequently accessed keys
6. **Adaptive TTL**: Adjust TTL based on access patterns
