# Design Document

## Overview

This design adds DynamoDB client support to the Service class by following the existing pattern established for MongoDB. The implementation will add a `useDynamo` parameter to `ServiceOptions`, create a `dynamoClient` property on the Service class, and handle DynamoDB client lifecycle (initialization, connection, and disconnection) in the same manner as the existing `mongoClient`.

## Architecture

The Service class acts as a central initialization and lifecycle management point for microservices. It currently manages:
- Express server setup
- MongoDB client (via MongoClient)
- Redis client (via RedisClient)
- HTTP interceptors
- Request parsers and middleware

This design extends the Service class to also manage:
- DynamoDB client (via DynamoDBClient)

The architecture maintains the singleton pattern used by both Service and DynamoDBClient classes, ensuring only one instance of each exists per service process.

## Components and Interfaces

### Modified Components

#### 1. ServiceOptions Type (`types/src/common/service.ts`)

Add the `useDynamo` property to the existing ServiceOptions type:

```typescript
export type ServiceOptions = {
  name: string;
  useMongo?: boolean;
  useRedis?: boolean;
  useDynamo?: boolean;  // NEW
  useAxios?: boolean;
  useRequestParsers?: boolean;
  exposeHealthCheck?: boolean;
  onStartUp?: (express: Express.Application) => Promise<void>;
  onShutDown?: () => Promise<void>;
};
```

#### 2. Service Class (`services/common/src/utils/service.ts`)

**New Import:**
```typescript
import DynamoDBClient from './dynamodbclient.js';
```

**New Properties:**
```typescript
class Service {
  // ... existing properties
  useDynamo?: boolean;
  dynamoClient?: DynamoDBClient;
  // ... rest of properties
}
```

**Modified `init()` Method:**
The init method will be extended to handle the `useDynamo` parameter:

```typescript
async init({
  name,
  useMongo,
  useRedis,
  useDynamo,  // NEW parameter
  useAxios,
  useRequestParsers = true,
  exposeHealthCheck = true,
  onStartUp,
  onShutDown
}: ServiceOptions) {
  // ... existing initialization code
  this.useDynamo = useDynamo;
  
  // ... existing mongo/redis initialization
  
  if (useDynamo) {
    this.dynamoClient = DynamoDBClient.getInstance(/* config */);
  }
  
  // ... rest of initialization
}
```

**Modified `startUp()` Method:**
The startUp method will connect to DynamoDB if enabled:

```typescript
async startUp() {
  Logger.default.info(`Starting ${this.name}...`);
  this.envConfig.log();
  
  if (this.mongoClient) {
    await this.mongoClient.connect();
  }
  
  if (this.dynamoClient) {  // NEW
    await this.dynamoClient.connect();
  }
  
  if (this.redisClient) {
    await this.redisClient.connect();
  }
  
  // ... rest of startup
}
```

**Modified `shutDown()` Method:**
The shutDown method will disconnect from DynamoDB if connected:

```typescript
async shutDown(errCode: number) {
  if (this.mongoClient) {
    try {
      await this.mongoClient.disconnect();
    } catch (error) {
      Logger.default.error(String(error));
    }
  }
  
  if (this.dynamoClient) {  // NEW
    try {
      await this.dynamoClient.disconnect();
    } catch (error) {
      Logger.default.error(String(error));
    }
  }
  
  if (this.redisClient) {
    try {
      await this.redisClient.disconnect();
    } catch (error) {
      Logger.default.error(String(error));
    }
  }
  
  await this.onShutDown?.();
  process.exit(errCode);
}
```

**Modified `startService()` Error Handler:**
The error handler in startService should also disconnect DynamoDB on error:

```typescript
private async startService() {
  return new Promise<void>((resolve, reject) => {
    this.expressServer
      .listen(this.port, () => {
        Logger.default.info(
          `${this.name} ready and listening on port ${this.port}`
        );
        resolve();
      })
      .on('error', async (err) => {
        Logger.default.error(String(err));
        
        if (this.mongoClient) {
          try {
            await this.mongoClient.disconnect();
          } catch (error) {
            Logger.default.error(String(error));
          }
        }
        
        if (this.dynamoClient) {  // NEW
          try {
            await this.dynamoClient.disconnect();
          } catch (error) {
            Logger.default.error(String(error));
          }
        }
        
        if (this.redisClient) {
          try {
            await this.redisClient.disconnect();
          } catch (error) {
            Logger.default.error(String(error));
          }
        }
        
        reject(err);
      });
  });
}
```

#### 3. DynamoDBClient Configuration

The DynamoDBClient.getInstance() currently requires a DynamoDBClientConfig parameter. We need to determine how to construct this from EnvironmentConfig.

**Option A: Modify DynamoDBClient to accept EnvironmentConfig**
Change DynamoDBClient.getInstance() to accept EnvironmentConfig and extract necessary values internally.

**Option B: Extract config in Service class**
Service class extracts DynamoDB configuration from EnvironmentConfig and passes it to DynamoDBClient.

**Recommended: Option A** - This maintains consistency with MongoClient pattern and encapsulates configuration logic within the client class.

## Data Models

No new data models are required. This feature only affects service initialization and database client management.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: DynamoDB Client Initialization Consistency

*For any* Service instance initialized with `useDynamo: true`, the `dynamoClient` property should be defined and be an instance of DynamoDBClient.

**Validates: Requirements 1.1, 1.2**

### Property 2: DynamoDB Client Absence When Disabled

*For any* Service instance initialized with `useDynamo: false` or `useDynamo: undefined`, the `dynamoClient` property should be undefined.

**Validates: Requirements 1.3**

### Property 3: Multiple Database Client Coexistence

*For any* Service instance initialized with both `useMongo: true` and `useDynamo: true`, both `mongoClient` and `dynamoClient` properties should be defined.

**Validates: Requirements 1.4**

### Property 4: Connection Lifecycle Ordering

*For any* Service instance with `useDynamo: true`, calling `startUp()` should result in `dynamoClient.connect()` being called before the Express server starts listening.

**Validates: Requirements 1.5**

### Property 5: Graceful Shutdown

*For any* Service instance with an active `dynamoClient`, calling `shutDown()` should result in `dynamoClient.disconnect()` being called, and any errors during disconnection should be logged without preventing process exit.

**Validates: Requirements 3.1, 3.2, 3.3**

## Error Handling

### DynamoDB Connection Errors

If DynamoDB connection fails during `startUp()`:
1. The error will be logged by the DynamoDBClient
2. The error will propagate up and prevent service startup
3. Any already-connected clients (Mongo, Redis) will be disconnected
4. The process will exit with an error code

### DynamoDB Disconnection Errors

If DynamoDB disconnection fails during `shutDown()`:
1. The error will be caught and logged
2. Shutdown will continue for other clients
3. The process will still exit with the provided error code

### Missing Configuration

If required DynamoDB configuration is missing:
1. DynamoDBClient.getInstance() will throw an error
2. Service.init() will fail
3. The service will not start

## Testing Strategy

### Unit Tests

Unit tests will verify:
1. Service.init() correctly sets `useDynamo` property
2. Service.init() creates DynamoDBClient instance when `useDynamo: true`
3. Service.init() does not create DynamoDBClient when `useDynamo: false`
4. Service.startUp() calls dynamoClient.connect() when dynamoClient exists
5. Service.shutDown() calls dynamoClient.disconnect() when dynamoClient exists
6. Error handling during connection/disconnection

### Property-Based Tests

Property-based tests will use fast-check to verify:
1. **Property 1**: For any boolean value of `useDynamo`, the Service initializes correctly
2. **Property 2**: For any combination of `useMongo` and `useDynamo` flags, the Service initializes the correct clients
3. **Property 5**: For any Service with dynamoClient, shutdown always attempts disconnection

### Integration Tests

Integration tests will verify:
1. A service can successfully connect to DynamoDB Local
2. A service can perform basic operations using the dynamoClient
3. A service can run with both MongoDB and DynamoDB simultaneously
4. Graceful shutdown properly closes all connections

## Implementation Notes

### DynamoDBClient Configuration

The DynamoDBClient currently uses a hardcoded test configuration in its getInstance() method:

```typescript
const DynamoDBClientTESTConfig = {
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  tableName: 'microrealestate-local',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local'
  }
}
```

This needs to be refactored to accept configuration from EnvironmentConfig. The implementation should:
1. Modify DynamoDBClient.getInstance() to accept EnvironmentConfig
2. Extract DynamoDB configuration from environment variables
3. Fall back to test configuration for development/testing

### Environment Variables

New environment variables should be added to support DynamoDB configuration:
- `USE_DYNAMODB`: Boolean flag to enable DynamoDB
- `DYNAMODB_ENDPOINT`: DynamoDB endpoint URL (optional, for local development)
- `DYNAMODB_REGION`: AWS region (default: us-east-1)
- `DYNAMODB_TABLE_NAME`: Table name
- `DYNAMODB_ACCESS_KEY_ID`: AWS access key (optional, uses IAM role if not provided)
- `DYNAMODB_SECRET_ACCESS_KEY`: AWS secret key (optional, uses IAM role if not provided)

### Backward Compatibility and Safety

This change maintains backward compatibility for existing functionality:
- Existing services that don't use `useDynamo` will continue to work unchanged
- The `useDynamo` parameter is optional
- No changes to existing MongoDB or Redis functionality

**Important Safety Guarantee:**
Services that do NOT initialize with `useDynamo: true` will have `dynamoClient` set to `undefined`. Any attempt to access `Service.getInstance().dynamoClient` in such services will result in:
1. TypeScript compile-time errors if proper null checking is not performed
2. Runtime errors (TypeError: Cannot read properties of undefined) if the code attempts to call methods on undefined

This is intentional and desirable behavior - it prevents services from accidentally attempting DynamoDB operations without proper initialization. Services must explicitly opt-in to DynamoDB support by setting `useDynamo: true` during initialization.
