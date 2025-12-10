# Implementation Plan

- [x] 1. Update TypeScript type definitions
  - Add `useDynamo?: boolean` property to ServiceOptions type in `types/src/common/service.ts`
  - Build the types package to make the new type available to other packages
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Refactor DynamoDBClient to accept EnvironmentConfig
  - [x] 2.1 Modify DynamoDBClient.getInstance() signature to accept EnvironmentConfig instead of DynamoDBClientConfig
    - Update the getInstance method to accept `envConfig?: EnvironmentConfig` parameter
    - Extract DynamoDB configuration from EnvironmentConfig.getValues()
    - Construct DynamoDBClientConfig from environment variables
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 2.2 Add environment variable extraction logic
    - Extract `USE_DYNAMODB`, `DYNAMODB_ENDPOINT`, `DYNAMODB_REGION`, `DYNAMODB_TABLE_NAME`, `DYNAMODB_ACCESS_KEY_ID`, `DYNAMODB_SECRET_ACCESS_KEY` from EnvironmentConfig
    - Provide sensible defaults for development (use existing test config as fallback)
    - _Requirements: 5.1, 5.2_
  
  - [x] 2.3 Update DynamoDBClient constructor to handle configuration
    - Remove hardcoded DynamoDBClientTESTConfig usage
    - Use configuration derived from EnvironmentConfig
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 3. Update Service class to support DynamoDB
  - [x] 3.1 Add DynamoDB client property and import
    - Import DynamoDBClient at the top of service.ts
    - Add `useDynamo?: boolean` property to Service class
    - Add `dynamoClient?: DynamoDBClient` property to Service class
    - _Requirements: 1.2, 2.1, 2.2_
  
  - [x] 3.2 Modify init() method to initialize DynamoDB client
    - Add `useDynamo` parameter to destructured ServiceOptions
    - Set `this.useDynamo = useDynamo`
    - Add conditional initialization: `if (useDynamo) { this.dynamoClient = DynamoDBClient.getInstance(this.envConfig); }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 3.3 Modify startUp() method to connect DynamoDB client
    - Add conditional connection after mongoClient connection: `if (this.dynamoClient) { await this.dynamoClient.connect(); }`
    - Ensure connection happens before Express server starts
    - _Requirements: 1.5, 4.1_
  
  - [x] 3.4 Modify shutDown() method to disconnect DynamoDB client
    - Add try-catch block for dynamoClient disconnection after mongoClient
    - Log errors but continue shutdown process
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 3.5 Modify startService() error handler to disconnect DynamoDB client
    - Add try-catch block for dynamoClient disconnection in error handler
    - Ensure cleanup happens on startup failure
    - _Requirements: 3.1, 3.2_

- [x] 4. Build and verify changes
  - Build the common package to ensure TypeScript compilation succeeds
  - Verify no compilation errors in dependent services
  - _Requirements: All_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
