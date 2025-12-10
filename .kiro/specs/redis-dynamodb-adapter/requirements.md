# Requirements Document

## Introduction

This specification defines the requirements for adding DynamoDB support as an alternative backend for the Redis client used for session and cache management in MicroRealEstate. When `USE_DYNAMODB` is enabled, the existing `RedisClient` interface will transparently use DynamoDB for storage instead of Redis, allowing the application to operate without Redis infrastructure while maintaining API compatibility.

## Glossary

- **RedisClient**: The existing singleton class in `services/common/src/utils/redisclient.ts` that provides key-value storage operations (get, set, del, keys) for session and cache management
- **DynamoDB**: Amazon's NoSQL database service that will serve as an alternative backend for key-value storage
- **Session Storage**: Temporary storage of user authentication sessions and application state
- **Cache Storage**: Temporary storage of frequently accessed data to improve performance
- **TTL (Time To Live)**: The duration after which a cached item should expire and be automatically deleted
- **Adapter Pattern**: A design pattern that allows incompatible interfaces to work together by wrapping one interface to match another
- **USE_DYNAMODB**: Environment variable flag that determines whether to use DynamoDB or Redis for session/cache storage

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want to use DynamoDB for session and cache storage when `USE_DYNAMODB` is enabled, so that I can deploy the application without Redis infrastructure.

#### Acceptance Criteria

1. WHEN `USE_DYNAMODB` environment variable is set to true, THE RedisClient SHALL use DynamoDB as the storage backend instead of Redis
2. WHEN `USE_DYNAMODB` environment variable is false or not set, THE RedisClient SHALL use Redis as the storage backend
3. WHEN the RedisClient is instantiated, THE system SHALL select the appropriate backend based on the `USE_DYNAMODB` configuration
4. WHEN switching between Redis and DynamoDB backends, THE application code using RedisClient SHALL require no modifications

### Requirement 2

**User Story:** As a developer, I want the RedisClient interface to remain unchanged, so that existing code continues to work without modifications when switching storage backends.

#### Acceptance Criteria

1. WHEN the DynamoDB backend is active, THE RedisClient SHALL expose the same `get`, `set`, `del`, and `keys` methods with identical signatures
2. WHEN calling `get(key)`, THE system SHALL return a Promise resolving to a string value or null, regardless of backend
3. WHEN calling `set(key, value)`, THE system SHALL store the key-value pair and return a Promise resolving to string or null, regardless of backend
4. WHEN calling `del(key)`, THE system SHALL delete the key and return a Promise resolving to a number, regardless of backend
5. WHEN calling `keys(pattern)`, THE system SHALL return a Promise resolving to an array of matching key strings, regardless of backend

### Requirement 3

**User Story:** As a developer, I want DynamoDB to store session and cache data with appropriate TTL support, so that expired data is automatically cleaned up.

#### Acceptance Criteria

1. WHEN storing a key-value pair in DynamoDB, THE system SHALL include a TTL attribute for automatic expiration
2. WHEN a key is set without an explicit TTL, THE system SHALL apply a default TTL of 12 hours
3. WHEN DynamoDB's TTL mechanism deletes an expired item, THE system SHALL not return the item in subsequent `get` operations
4. WHEN querying for keys, THE system SHALL exclude items that have expired based on their TTL attribute
5. WHEN the `set` method is called with an existing key, THE system SHALL update the TTL to extend the expiration time

### Requirement 4

**User Story:** As a developer, I want the DynamoDB adapter to handle key pattern matching for the `keys` method, so that session and cache queries work correctly.

#### Acceptance Criteria

1. WHEN `keys(pattern)` is called with a wildcard pattern (e.g., "session:*"), THE system SHALL return all keys matching the pattern
2. WHEN the pattern contains a single asterisk wildcard, THE system SHALL match zero or more characters at that position
3. WHEN the pattern is an exact string without wildcards, THE system SHALL return only keys that match exactly
4. WHEN no keys match the pattern, THE system SHALL return an empty array
5. WHEN scanning for keys, THE system SHALL filter out expired items based on TTL

### Requirement 5

**User Story:** As a system architect, I want the DynamoDB adapter to use a dedicated table or key prefix for session/cache data, so that it doesn't conflict with application data storage.

#### Acceptance Criteria

1. WHEN storing session/cache data in DynamoDB, THE system SHALL use a key prefix (e.g., "CACHE#") to distinguish it from application data
2. WHEN the same DynamoDB table is used for both application data and cache data, THE system SHALL ensure no key collisions occur
3. WHEN querying for cache keys, THE system SHALL only scan items with the cache key prefix
4. WHEN deleting cache data, THE system SHALL only delete items with the cache key prefix
5. WHEN the DynamoDB table schema is defined, THE system SHALL support storing cache items with PK="CACHE#{key}" and SK="CACHE"

### Requirement 6

**User Story:** As a developer, I want proper error handling when DynamoDB operations fail, so that the application can gracefully handle storage errors.

#### Acceptance Criteria

1. WHEN a DynamoDB operation fails due to network issues, THE system SHALL throw an appropriate error with a descriptive message
2. WHEN a DynamoDB operation fails due to throttling, THE system SHALL retry the operation with exponential backoff
3. WHEN a DynamoDB operation fails after maximum retries, THE system SHALL throw an error that matches the Redis client error behavior
4. WHEN the DynamoDB table does not exist, THE system SHALL throw an error during connection initialization
5. WHEN DynamoDB credentials are invalid, THE system SHALL throw an error during connection initialization

### Requirement 7

**User Story:** As a developer, I want the DynamoDB adapter to log operations for debugging, so that I can troubleshoot session and cache issues.

#### Acceptance Criteria

1. WHEN the DynamoDB backend is initialized, THE system SHALL log a debug message indicating DynamoDB is being used for cache storage
2. WHEN a cache operation succeeds, THE system SHALL log debug-level information about the operation
3. WHEN a cache operation fails, THE system SHALL log error-level information with the operation details and error message
4. WHEN scanning for keys with a pattern, THE system SHALL log the pattern and number of results found
5. WHEN TTL cleanup occurs, THE system SHALL log debug information about expired items being filtered

### Requirement 8

**User Story:** As a system administrator, I want the DynamoDB adapter to be performant for typical session and cache operations, so that application performance is not degraded.

#### Acceptance Criteria

1. WHEN performing a `get` operation, THE system SHALL complete the operation in under 50ms for 95% of requests
2. WHEN performing a `set` operation, THE system SHALL complete the operation in under 100ms for 95% of requests
3. WHEN performing a `del` operation, THE system SHALL complete the operation in under 50ms for 95% of requests
4. WHEN performing a `keys` operation with a pattern, THE system SHALL use efficient DynamoDB query operations when possible instead of full table scans
5. WHEN the number of cache keys exceeds 1000, THE system SHALL implement pagination for `keys` operations to avoid timeouts

### Requirement 9

**User Story:** As a developer, I want to test the DynamoDB adapter independently, so that I can verify it works correctly before integration.

#### Acceptance Criteria

1. WHEN unit tests are written for the DynamoDB adapter, THE tests SHALL mock DynamoDB client operations
2. WHEN integration tests are written, THE tests SHALL use a local DynamoDB instance or DynamoDB Local
3. WHEN testing the `get` method, THE tests SHALL verify correct retrieval of stored values and null for missing keys
4. WHEN testing the `set` method, THE tests SHALL verify values are stored with correct TTL attributes
5. WHEN testing the `keys` method, THE tests SHALL verify pattern matching works correctly for various patterns
