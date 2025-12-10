# Requirements Document

## Introduction

This feature adds DynamoDB client access to the Service class in `services/common/src/utils/service.ts`, enabling services to initialize and access a DynamoDB client instance in the same way they currently access MongoDB through `mongoClient`. This provides a consistent interface for database access across the application.

## Glossary

- **Service**: The singleton class in `services/common/src/utils/service.ts` that manages service initialization, database connections, and Express server lifecycle
- **DynamoDBClient**: The singleton class in `services/common/src/utils/dynamodbclient.ts` that manages connections to AWS DynamoDB
- **MongoClient**: The singleton class in `services/common/src/utils/mongoclient.ts` that manages connections to MongoDB
- **ServiceOptions**: The type definition for parameters passed to `Service.init()` method
- **EnvironmentConfig**: Configuration object containing environment variables including database connection settings

## Requirements

### Requirement 1

**User Story:** As a developer, I want to initialize a service with DynamoDB support, so that I can use DynamoDB as the data store instead of MongoDB.

#### Acceptance Criteria

1. WHEN a developer calls `Service.init()` with `useDynamo: true`, THEN the Service SHALL create a DynamoDBClient instance
2. WHEN `useDynamo` is true, THEN the Service SHALL store the DynamoDBClient instance in a `dynamoClient` property
3. WHEN `useDynamo` is false or undefined, THEN the Service SHALL NOT create a DynamoDBClient instance
4. WHEN both `useMongo` and `useDynamo` are true, THEN the Service SHALL initialize both database clients
5. WHEN the Service starts up with `useDynamo: true`, THEN the Service SHALL call `dynamoClient.connect()` before starting the Express server

### Requirement 2

**User Story:** As a developer, I want to access the DynamoDB client from the Service instance, so that I can perform database operations in my service code.

#### Acceptance Criteria

1. WHEN a Service is initialized with `useDynamo: true`, THEN the Service SHALL expose a `dynamoClient` property of type `DynamoDBClient | undefined`
2. WHEN accessing `Service.getInstance().dynamoClient`, THEN the developer SHALL receive the initialized DynamoDBClient instance
3. WHEN the Service was not initialized with `useDynamo: true`, THEN `Service.getInstance().dynamoClient` SHALL be undefined

### Requirement 3

**User Story:** As a developer, I want the DynamoDB client to be properly cleaned up when the service shuts down, so that connections are closed gracefully.

#### Acceptance Criteria

1. WHEN the Service shuts down with an active DynamoDBClient, THEN the Service SHALL call `dynamoClient.disconnect()`
2. WHEN `dynamoClient.disconnect()` throws an error, THEN the Service SHALL log the error and continue shutdown
3. WHEN the Service shuts down, THEN the DynamoDB client SHALL be disconnected before the process exits

### Requirement 4

**User Story:** As a developer, I want the ServiceOptions type to include the `useDynamo` parameter, so that TypeScript provides type safety and autocomplete.

#### Acceptance Criteria

1. WHEN defining ServiceOptions in `types/src/common/service.ts`, THEN the type SHALL include an optional `useDynamo?: boolean` property
2. WHEN a developer uses `Service.init()` in TypeScript, THEN the IDE SHALL provide autocomplete for the `useDynamo` parameter
3. WHEN a developer passes an invalid type for `useDynamo`, THEN TypeScript SHALL report a type error

### Requirement 5

**User Story:** As a developer, I want the DynamoDB client to receive proper configuration from EnvironmentConfig, so that it connects to the correct DynamoDB instance.

#### Acceptance Criteria

1. WHEN creating a DynamoDBClient instance, THEN the Service SHALL pass the EnvironmentConfig to the DynamoDBClient constructor
2. WHEN the DynamoDBClient is initialized, THEN it SHALL use environment variables from EnvironmentConfig for connection settings
3. WHEN required DynamoDB configuration is missing, THEN the DynamoDBClient SHALL throw an error during initialization
