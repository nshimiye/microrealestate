# Implementation Plan

- [x] 1. Create DynamoDBCacheAdapter foundation
  - Create new file `services/common/src/utils/dynamodbcacheadapter.ts`
  - Implement class constructor that accepts DynamoDBClient
  - Define constants: KEY_PREFIX='CACHE#', SORT_KEY='CACHE', DEFAULT_TTL_SECONDS=43200
  - Add helper method for constructing DynamoDB keys from cache keys
  - Add helper method for extracting cache keys from DynamoDB keys
  - _Requirements: 5.1, 5.2_

- [x] 2. Implement get() method with TTL checking
  - Implement get(key: string) method
  - Construct DynamoDB key with CACHE# prefix
  - Call dynamoClient.getItem()
  - Check if item exists and TTL has not expired
  - Return value or null appropriately
  - Add debug logging for get operations
  - _Requirements: 2.2, 3.3, 7.2_

- [x] 2.1 Write property test for get() method
  - **Property 5: Non-existent key returns null**
  - **Validates: Requirements 2.2**

- [x] 2.2 Write property test for TTL expiration
  - **Property 8: Expired items return null**
  - **Validates: Requirements 3.3**

- [x] 3. Implement set() method with TTL calculation
  - Implement set(key: string, value: string, ttlSeconds?: number) method
  - Calculate TTL timestamp (current time + ttlSeconds or DEFAULT_TTL_SECONDS)
  - Construct DynamoDB item with PK, SK, Value, TTL, CreatedAt
  - Call dynamoClient.putItem()
  - Return 'OK' on success, null on failure
  - Add debug logging for set operations
  - _Requirements: 2.3, 3.1, 3.2, 3.5, 7.2_

- [x] 3.1 Write property test for set-get round trip
  - **Property 3: Set-then-get consistency**
  - **Validates: Requirements 2.3, 2.2**

- [x] 3.2 Write property test for default TTL
  - **Property 7: Default TTL application**
  - **Validates: Requirements 3.2**

- [x] 3.3 Write property test for TTL attribute presence
  - **Property 6: TTL attribute presence**
  - **Validates: Requirements 3.1**

- [x] 4. Implement del() method
  - Implement del(key: string) method
  - Construct DynamoDB key with CACHE# prefix
  - Call dynamoClient.deleteItem()
  - Return 1 if deleted, 0 if key didn't exist
  - Add debug logging for delete operations
  - _Requirements: 2.4, 5.4, 7.2_

- [x] 4.1 Write property test for delete
  - **Property 4: Delete removes key**
  - **Validates: Requirements 2.4**

- [x] 5. Implement pattern matching utility
  - Create private method patternToRegex(pattern: string): RegExp
  - Handle asterisk wildcard (*) - convert to .*
  - Handle question mark wildcard (?) - convert to .
  - Escape other special regex characters
  - Create private method matchesPattern(key: string, pattern: string): boolean
  - Test regex against key
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5.1 Write property test for pattern matching
  - **Property 11: Wildcard pattern matching**
  - **Validates: Requirements 4.1, 4.2**
  - **PBT Status: passed**

- [x] 5.2 Write property test for exact matching
  - **Property 12: Exact pattern matching**
  - **Validates: Requirements 4.3**
  - **PBT Status: passed**

- [x] 6. Implement keys() method with basic scanning
  - Implement keys(pattern: string) method
  - Determine if pattern allows query optimization (has fixed prefix)
  - For simple patterns, use scanAll() to get all cache items
  - Filter items by pattern matching
  - Filter out expired items based on TTL
  - Extract cache keys (remove CACHE# prefix)
  - Return array of matching keys
  - Add debug logging with pattern and result count
  - _Requirements: 2.5, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.3, 7.4_

- [x] 6.1 Write property test for expired item filtering
  - **Property 9: Expired items excluded from keys**
  - **Validates: Requirements 3.4, 4.5**

- [x] 6.2 Write property test for cache prefix scanning
  - **Property 16: Keys query scans only cache items**
  - **Validates: Requirements 5.3**

- [ ] 7. Optimize keys() for prefix patterns
  - Detect patterns with fixed prefix before wildcard (e.g., "session:*")
  - Extract prefix from pattern
  - Use query operation with PK condition for prefix patterns
  - Implement pagination for large result sets (>1000 items)
  - Fall back to scan for complex patterns
  - _Requirements: 8.4, 8.5_

- [ ] 7.1 Write property test for query optimization
  - **Property 22: Query optimization for prefix patterns**
  - **Validates: Requirements 8.4**

- [ ] 7.2 Write property test for pagination
  - **Property 23: Pagination for large result sets**
  - **Validates: Requirements 8.5**

- [-] 8. Integrate DynamoDB adapter into RedisClient
  - Modify RedisClient constructor to read USE_DYNAMODB from envConfig
  - Add private field: dynamoAdapter: DynamoDBCacheAdapter | null
  - Add private field: useDynamoDB: boolean
  - Modify connect() method to branch based on useDynamoDB flag
  - Create private method connectDynamoDB() to initialize adapter
  - Keep existing connectRedis() method unchanged
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 8.1 Write property test for backend selection
  - **Property 1: Backend selection based on configuration**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [ ] 9. Bind adapter methods to RedisClient interface
  - In connectDynamoDB(), bind adapter.get to this.get
  - Bind adapter.set to this.set
  - Bind adapter.del to this.del
  - Bind adapter.keys to this.keys
  - Ensure method signatures match RedisClientTypes
  - Add debug log indicating DynamoDB backend is active
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 7.1_

- [ ] 9.1 Write property test for API compatibility
  - **Property 2: API compatibility across backends**
  - **Validates: Requirements 1.4, 2.2, 2.3, 2.4, 2.5**

- [ ] 10. Implement error handling and translation
  - Add private method translateError(error: any) in adapter
  - Translate DynamoDB errors to match Redis error patterns
  - Handle ConditionalCheckFailedException
  - Handle ProvisionedThroughputExceededException
  - Handle ResourceNotFoundException
  - Handle ValidationException
  - Add error logging with operation details
  - _Requirements: 6.1, 6.3, 7.3_

- [ ] 10.1 Write unit tests for error translation
  - Test network error handling
  - Test throttling error handling
  - Test table not found error
  - Test invalid credentials error
  - _Requirements: 6.1, 6.4, 6.5_

- [ ] 11. Implement retry logic for throttling
  - Wrap DynamoDB operations in retry logic
  - Detect ProvisionedThroughputExceededException
  - Retry up to 3 times with exponential backoff (100ms, 200ms, 400ms)
  - Log retry attempts at debug level
  - Throw error after max retries
  - _Requirements: 6.2_

- [ ] 12. Add comprehensive logging
  - Add debug log when DynamoDB backend initializes
  - Add debug logs for successful operations (get, set, del, keys)
  - Add error logs for failed operations with details
  - Add debug log for TTL filtering in keys() method
  - Ensure log messages include operation type and key information
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 12.1 Write property test for logging
  - **Property 19: Successful operation logging**
  - **Validates: Requirements 7.2**

- [ ] 12.2 Write property test for error logging
  - **Property 20: Failed operation logging**
  - **Validates: Requirements 7.3**

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Write integration tests with DynamoDB Local
  - Set up test environment with DynamoDB Local
  - Test actual DynamoDB operations without mocks
  - Test get/set/del/keys operations end-to-end
  - Test TTL expiration behavior
  - Test error scenarios (table not found, invalid credentials)
  - Test pattern matching with real data
  - _Requirements: 9.2, 9.3, 9.4, 9.5_

- [ ] 15. Write backend compatibility tests
  - Create parameterized test suite that runs against both backends
  - Test identical behavior for get/set/del/keys
  - Test error handling consistency
  - Test pattern matching consistency
  - Verify both backends pass the same test suite
  - _Requirements: 1.4, 2.2, 2.3, 2.4, 2.5_

- [ ] 16. Update documentation
  - Add JSDoc comments to DynamoDBCacheAdapter class and methods
  - Document USE_DYNAMODB environment variable
  - Document DynamoDB configuration variables
  - Add example configurations for dev and production
  - Update README with DynamoDB setup instructions
  - Document migration strategy and rollback plan
  - _Requirements: All_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
