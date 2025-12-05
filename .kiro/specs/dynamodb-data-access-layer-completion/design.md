# Design Document: DynamoDB Data Access Layer Completion

## Overview

This design document outlines the implementation strategy for completing the DynamoDB data access layer in MicroRealEstate. The system currently has a fully functional MongoDB implementation using Mongoose, and a partially complete DynamoDB implementation. This work will finish the DynamoDB repositories to achieve full database portability.

### Goals

- Complete DynamoDB implementations for 6 entity repositories: Account, Document, Property, Template, Tenant, and Lease
- Maintain exact interface compatibility with MongoDB implementations
- Implement efficient DynamoDB patterns (single-table design, GSIs, batch operations)
- Ensure data integrity and consistency across both database backends
- Provide comprehensive error handling and logging

### Non-Goals

- Migrating existing MongoDB data to DynamoDB (out of scope)
- Modifying the MongoDB implementations
- Changing repository interfaces or adding new methods
- Implementing real-time data synchronization between databases

## Architecture

### Current State

The data access layer uses the Repository pattern with a factory-based approach:

```
┌─────────────────────────────────────────────────────────────┐
│                     Business Logic Layer                     │
│         (Services use repository interfaces only)            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Repository Factories                      │
│   getAccountRepository(), getTenantRepository(), etc.        │
│   (Select MongoDB or DynamoDB based on USE_DYNAMODB env)    │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐     ┌───────────────────────────────┐
│  MongoDB Repositories │     │   DynamoDB Repositories       │
│  (Fully Implemented)  │     │   (Partially Implemented)     │
│                       │     │                               │
│  - Uses Mongoose      │     │  - Uses AWS SDK v3            │
│  - Document-based     │     │  - Single-table design        │
│  - Rich query DSL     │     │  - Key-value with GSIs        │
└───────────────────────┘     └───────────────────────────────┘
```

### DynamoDB Single-Table Design

All entities are stored in a single DynamoDB table with the following key structure:

| Entity   | Partition Key (PK)      | Sort Key (SK)           |
|----------|-------------------------|-------------------------|
| Realm    | REALM#<realmId>         | REALM#<realmId>         |
| Account  | ACCOUNT#<accountId>     | ACCOUNT#<accountId>     |
| Lease    | REALM#<realmId>         | LEASE#<leaseId>         |
| Property | REALM#<realmId>         | PROPERTY#<propertyId>   |
| Tenant   | REALM#<realmId>         | TENANT#<tenantId>       |
| Document | REALM#<realmId>         | DOCUMENT#<documentId>   |
| Template | REALM#<realmId>         | TEMPLATE#<templateId>   |

**Key Design Decisions:**

1. **Realm-scoped entities** (Lease, Property, Tenant, Document, Template) use `REALM#<realmId>` as PK for efficient querying within a realm
2. **Global entities** (Account, Realm) use their own ID as both PK and SK
3. **Entity type prefix** in SK enables querying all entities of a type within a realm
4. **Composite keys** provide strong consistency and enable conditional operations

### Global Secondary Indexes (GSIs)

Two GSIs are required for non-key attribute queries:

**GSI-1: Email Index**
- Partition Key: `Email`
- Sort Key: `EntityType`
- Purpose: Query accounts by email address
- Projection: ALL

**GSI-2: ContactEmail Index**
- Partition Key: `ContactEmail`
- Sort Key: `EntityType`
- Purpose: Query tenants by contact email
- Projection: ALL

## Components and Interfaces

### Base Repository Classes

The existing base repository classes provide common CRUD operations:

1. **BaseRepository<T>** - Abstract base with key construction and transformation methods
2. **BaseRealmCRUDRepository<T>** - For Realm entity (no realmId parameter needed)
3. **BaseOthersCRUDRepository<T>** - For all other entities (requires realmId parameter)

Each entity-specific repository extends one of these base classes and implements:
- `buildPK(id, realmId?)` - Construct partition key
- `buildSK(id)` - Construct sort key
- `toItem(entity)` - Transform entity to DynamoDB item
- `fromItem(item)` - Transform DynamoDB item to entity

### Repository Implementations

Each repository follows this structure:

```
<entity>/
├── interface.ts              # IEntityRepository interface
├── index.ts                  # Factory function
├── mongodb/
│   └── repository.ts         # MongoDB implementation (complete)
└── dynamodb/
    ├── base-repository.ts    # Entity-specific base class
    └── repository.ts         # DynamoDB implementation (to complete)
```

## Data Models

### Account Entity

```typescript
interface Account {
  _id: string;              // Account ID (ObjectId as string)
  firstname: string;
  lastname: string;
  email: string;            // Normalized to lowercase
  password: string;         // Bcrypt hashed
}
```

**DynamoDB Mapping:**
- PK: `ACCOUNT#<accountId>`
- SK: `ACCOUNT#<accountId>`
- GSI-1 PK: `<email>`
- Attributes: `FirstName`, `LastName`, `Email`, `Password`

### Document Entity

```typescript
interface Document {
  _id: string;              // Document ID
  realmId: string;          // Owner realm
  tenantId: string;         // Associated tenant
  leaseId: string;          // Associated lease
  type: string;             // Document type
  name: string;
  description?: string;
  mimeType: string;
  expiryDate?: Date;
  url: string;              // Storage URL
  templateId?: string;      // Template reference
}
```

**DynamoDB Mapping:**
- PK: `REALM#<realmId>`
- SK: `DOCUMENT#<documentId>`
- Attributes: All fields with Date as ISO string

### Property Entity

```typescript
interface Property {
  _id: string;
  realmId: string;
  type: string;             // 'building', 'unit', etc.
  name: string;
  description?: string;
  surface?: number;
  phone?: string;
  digicode?: string;
  address?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  price?: number;
  expense?: number;
  // ... many more nested fields
}
```

**DynamoDB Mapping:**
- PK: `REALM#<realmId>`
- SK: `PROPERTY#<propertyId>`
- Attributes: All fields preserved as nested objects

### Template Entity

```typescript
interface Template {
  _id: string;
  realmId: string;
  name: string;
  type: string;             // 'text', 'fileDescriptor', etc.
  description?: string;
  contents?: string;        // Template content
  linkedResourceIds?: string[]; // Linked leases
  required?: boolean;
  requiredOnceContractTerminated?: boolean;
  hasExpiryDate?: boolean;
}
```

**DynamoDB Mapping:**
- PK: `REALM#<realmId>`
- SK: `TEMPLATE#<templateId>`
- Attributes: All fields with arrays preserved

### Tenant Entity

```typescript
interface Tenant {
  _id: string;
  realmId: string;
  name: string;
  isCompany: boolean;
  companyInfo?: {
    name?: string;
    legalForm?: string;
    capital?: number;
    ein?: string;
    dos?: string;
    vatNumber?: string;
    legalRepresentative?: string;
  };
  manager?: string;
  leaseId: string;          // Reference to Lease
  properties: Array<{
    propertyId: string;     // Reference to Property
    entryDate?: Date;
    exitDate?: Date;
    rent?: number;
    expenses?: Array<{
      title: string;
      amount: number;
    }>;
  }>;
  contacts: Array<{
    name?: string;
    email?: string;
    phone1?: string;
    phone2?: string;
  }>;
  guaranty?: number;
  guarantyPayback?: number;
  reference?: string;
  beginDate: Date;
  endDate: Date;
  terminationDate?: Date;
  rents: Array<{
    term: number;
    month: number;
    year: number;
    payments: Array<{
      date: Date;
      amount: number;
      type: string;
      reference?: string;
    }>;
    // ... many more rent fields
  }>;
  // ... many more fields
}
```

**DynamoDB Mapping:**
- PK: `REALM#<realmId>`
- SK: `TENANT#<tenantId>`
- GSI-2 PK: `<contacts[0].email>` (first contact email)
- Attributes: All fields with nested arrays and objects preserved, Dates as ISO strings

### Lease Entity

```typescript
interface Lease {
  _id: string;
  realmId: string;
  name: string;
  description?: string;
  numberOfTerms: number;
  timeRange: string;        // 'days', 'weeks', 'months', 'years'
  active: boolean;
  system?: boolean;
  templateIds?: string[];   // References to Templates
}
```

**DynamoDB Mapping:**
- PK: `REALM#<realmId>`
- SK: `LEASE#<leaseId>`
- Attributes: All fields with arrays preserved

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Account Key Structure Consistency
*For any* account entity, when stored in DynamoDB, the partition key SHALL equal `ACCOUNT#<accountId>` and the sort key SHALL equal `ACCOUNT#<accountId>`.
**Validates: Requirements 1.2**

### Property 2: Account Email Query Round-Trip
*For any* account with a valid email, creating the account and then querying by email SHALL return the same account with all fields intact.
**Validates: Requirements 1.1, 1.3**

### Property 3: Account Password Hashing
*For any* account with a plaintext password, when transformed to a DynamoDB item, the password field SHALL be bcrypt-hashed and SHALL NOT equal the original plaintext.
**Validates: Requirements 1.6**

### Property 4: Account Data Round-Trip
*For any* account entity, transforming to DynamoDB item via toItem() and back via fromItem() SHALL produce an equivalent account with all fields preserved.
**Validates: Requirements 1.7**

### Property 5: Document Realm Scoping
*For any* document in a realm, querying all documents in that realm SHALL return the document, and querying documents in a different realm SHALL NOT return the document.
**Validates: Requirements 2.2**

### Property 6: Document Batch Operations
*For any* set of document IDs in a realm, calling findByIds SHALL return all existing documents, and calling deleteMany followed by findByIds SHALL return an empty array.
**Validates: Requirements 2.6, 2.7**

### Property 7: Property CRUD Consistency
*For any* property, creating it, updating it with partial data, and retrieving it SHALL return the property with the updates applied and all other fields unchanged.
**Validates: Requirements 3.2, 3.6**

### Property 8: Property Count Accuracy
*For any* realm, the count returned by countByRealmId SHALL equal the length of the array returned by findAll for that realm.
**Validates: Requirements 3.8**

### Property 9: Template Linked Resource Filtering
*For any* set of lease IDs, querying templates by those linked resource IDs SHALL return only templates where linkedResourceIds contains at least one of the queried IDs.
**Validates: Requirements 4.6**

### Property 10: Template Replace Completeness
*For any* existing template, calling replace with new data SHALL result in the template having exactly the new data fields and none of the old data fields (except ID and realmId).
**Validates: Requirements 4.5**

### Property 11: Tenant Property Filtering
*For any* set of property IDs in a realm, querying tenants by those property IDs SHALL return only tenants where at least one property in the properties array has a propertyId matching the queried IDs.
**Validates: Requirements 5.7**

### Property 12: Tenant Contact Email Query
*For any* tenant with a contact email, creating the tenant and then querying by contact email SHALL return the tenant.
**Validates: Requirements 5.2**

### Property 13: Tenant Atomic Update
*For any* tenant, calling findOneAndUpdate with updates SHALL atomically update the tenant and return either the old or new version based on the returnUpdated option.
**Validates: Requirements 5.6**

### Property 14: Lease Usage Detection
*For any* lease ID, if at least one tenant references that lease ID, then findLeaseIdsUsedByTenants SHALL return a Set containing that lease ID.
**Validates: Requirements 6.7**

### Property 15: Batch Operation Splitting
*For any* operation with more than 25 items, the system SHALL split the operation into multiple batches of at most 25 items each, and all items SHALL be processed.
**Validates: Requirements 8.3**

### Property 16: Item Size Validation
*For any* entity that when serialized exceeds 400KB, attempting to create or update it SHALL throw a ServiceError before making any DynamoDB API calls.
**Validates: Requirements 9.1**

### Property 17: Nested Object Preservation
*For any* entity with nested objects (like Property.address or Tenant.companyInfo), the round-trip transformation (entity → toItem → fromItem → entity) SHALL preserve all nested fields and their values.
**Validates: Requirements 9.2, 10.2**

### Property 18: Date Field Transformation
*For any* entity with Date fields, transforming to DynamoDB item SHALL convert Dates to ISO 8601 strings, and transforming back SHALL convert strings to Date objects with the same timestamp.
**Validates: Requirements 10.6**

### Property 19: Interface Compatibility
*For any* repository method and input, the DynamoDB implementation SHALL return data in the same structure and format as the MongoDB implementation (excluding database-specific metadata).
**Validates: Requirements 11.1, 11.2**

### Property 20: Conditional Update Failure
*For any* non-existent entity ID, attempting to update it SHALL throw an error indicating the entity was not found, matching MongoDB behavior.
**Validates: Requirements 9.5, 11.2**

## Error Handling

### Error Types

1. **ValidationError** - Invalid input parameters
   - Missing required fields (realmId, email, etc.)
   - Invalid data types
   - Empty arrays where non-empty expected

2. **ServiceError** - Business logic errors
   - Entity not found (404)
   - Item size exceeds 400KB (400)
   - Conditional update failed (409)

3. **DynamoDBError** - Database-specific errors
   - Throttling (retry with exponential backoff)
   - GSI not available
   - Batch operation partial failures

### Error Handling Strategy

```typescript
try {
  // Repository operation
} catch (error) {
  if (error instanceof ValidationError) {
    logger.error('Validation failed', { error, context });
    throw error; // Re-throw with original message
  } else if (error.name === 'ProvisionedThroughputExceededException') {
    logger.warn('DynamoDB throttled, retrying', { error });
    // Retry with exponential backoff (handled by AWS SDK)
  } else if (error.name === 'ConditionalCheckFailedException') {
    logger.error('Conditional update failed', { error, context });
    throw new ServiceError('Entity not found or condition not met', 404);
  } else {
    logger.error('Unexpected error', { error, stack: error.stack, context });
    throw error;
  }
}
```

### Logging Strategy

All repository operations log:
- **Debug level**: Successful operations with key details (IDs, counts)
- **Error level**: Failed operations with full context and stack traces
- **Warn level**: Retryable errors (throttling, transient failures)

Log format:
```typescript
logger.debug('Operation completed', {
  operation: 'findById',
  entityType: 'Tenant',
  tenantId: 'xxx',
  realmId: 'yyy',
  duration: 45 // ms
});
```

## Testing Strategy

### Unit Testing

Each repository implementation will have unit tests covering:

1. **CRUD Operations**
   - Create with valid data
   - Create with missing required fields (should throw)
   - FindById with existing ID
   - FindById with non-existent ID (should return null)
   - Update with valid data
   - Update non-existent entity (should throw)
   - Delete existing entity
   - Delete non-existent entity (should not throw)

2. **Query Operations**
   - FindAll returns all entities in realm
   - FindByIds returns only requested entities
   - FindByEmail/ContactEmail returns correct entity
   - Filtering operations return correct subsets

3. **Batch Operations**
   - Batch operations with < 25 items
   - Batch operations with > 25 items (tests splitting)
   - Batch operations with partial failures (tests retry)

4. **Data Transformation**
   - toItem preserves all fields
   - fromItem preserves all fields
   - Round-trip transformation is identity
   - Date fields convert correctly
   - Nested objects preserve structure

5. **Error Cases**
   - Invalid inputs throw ValidationError
   - Non-existent entities throw ServiceError
   - Oversized items throw ServiceError

### Property-Based Testing

Using `fast-check` library (already in dependencies), we'll implement property-based tests for:

1. **Round-Trip Properties**
   - For any valid entity, create → findById → result equals original
   - For any valid entity, toItem → fromItem → result equals original

2. **Invariant Properties**
   - For any realm, count equals findAll length
   - For any entity update, non-updated fields remain unchanged
   - For any batch operation, all items are processed

3. **Metamorphic Properties**
   - For any entity, findAll includes findById result
   - For any filter, filtered results are subset of unfiltered results

4. **Error Condition Properties**
   - For any invalid input, operation throws appropriate error
   - For any non-existent ID, findById returns null

### Integration Testing

Integration tests will:
1. Use local DynamoDB (via Docker or DynamoDB Local)
2. Test against both MongoDB and DynamoDB
3. Verify identical behavior between implementations
4. Test GSI queries
5. Test batch operations with real AWS SDK

### Test Configuration

```typescript
// vitest.config.ts
export default {
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/test/**']
    }
  }
};
```

```typescript
// test/setup.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Configure for local DynamoDB
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
process.env.DYNAMODB_TABLE_NAME = 'test-table';
process.env.DYNAMODB_REGION = 'us-east-1';
process.env.USE_DYNAMODB = 'true';
```

## Implementation Plan

### Phase 1: Complete Base Repositories (Already Done)
- ✅ BaseRepository abstract class
- ✅ BaseRealmCRUDRepository
- ✅ BaseOthersCRUDRepository

### Phase 2: Complete Entity-Specific Base Repositories
For each entity, implement the base repository with:
- `buildPK()` method
- `buildSK()` method
- `toItem()` method
- `fromItem()` method

### Phase 3: Implement Repository Methods
For each entity, implement all interface methods:
- Standard CRUD (create, findById, update, delete)
- Query methods (findAll, findByIds, etc.)
- Entity-specific methods (findByEmail, findByPropertyIds, etc.)
- Batch operations (deleteMany, updateMany)

### Phase 4: Implement GSI Support
- Add GSI query methods to DynamoDBClient utility
- Implement email-based queries using GSI-1
- Implement contact email queries using GSI-2
- Add pagination support for GSI queries

### Phase 5: Testing
- Write unit tests for each repository
- Write property-based tests for core operations
- Write integration tests against local DynamoDB
- Verify MongoDB/DynamoDB parity

### Phase 6: Documentation and Examples
- Update README with DynamoDB setup instructions
- Add code examples for each repository
- Document GSI requirements
- Add troubleshooting guide

## Dependencies

### Existing Dependencies
- `@aws-sdk/client-dynamodb` - AWS SDK for DynamoDB
- `@aws-sdk/lib-dynamodb` - Document client for easier DynamoDB operations
- `@microrealestate/types` - Shared TypeScript types
- `bcrypt` - Password hashing
- `vitest` - Testing framework
- `fast-check` - Property-based testing

### New Dependencies
None required - all necessary dependencies are already in the project.

## Configuration

### Environment Variables

```bash
# DynamoDB Configuration
USE_DYNAMODB=true                          # Enable DynamoDB mode
DYNAMODB_TABLE_NAME=microrealestate-table  # Table name
DYNAMODB_REGION=us-east-1                  # AWS region
DYNAMODB_ENDPOINT=http://localhost:8000    # Optional: local endpoint

# AWS Credentials (if not using IAM roles)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=yyy
```

### DynamoDB Table Schema

```typescript
{
  TableName: 'microrealestate-table',
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'Email', AttributeType: 'S' },
    { AttributeName: 'ContactEmail', AttributeType: 'S' },
    { AttributeName: 'EntityType', AttributeType: 'S' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'EmailIndex',
      KeySchema: [
        { AttributeName: 'Email', KeyType: 'HASH' },
        { AttributeName: 'EntityType', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' }
    },
    {
      IndexName: 'ContactEmailIndex',
      KeySchema: [
        { AttributeName: 'ContactEmail', KeyType: 'HASH' },
        { AttributeName: 'EntityType', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' }
    }
  ],
  BillingMode: 'PAY_PER_REQUEST'
}
```

## Migration Considerations

### Data Migration (Out of Scope)
While implementing the repositories, we are NOT implementing data migration. However, for future reference:

1. **Export from MongoDB** - Use `mongoexport` or custom scripts
2. **Transform data** - Convert ObjectIds to strings, adjust field names
3. **Import to DynamoDB** - Use batch write operations
4. **Verify data** - Compare counts and sample records

### Rollback Strategy
N/A this is out of scope for this design

## Performance Considerations

### DynamoDB Optimization
N/A this is out of scope for this design


### Expected Performance
N/A this is out of scope for this design


### Monitoring
N/A

## Security Considerations

### Data Protection
1. **Encryption at Rest** - Enable DynamoDB encryption
2. **Encryption in Transit** - Use HTTPS for all API calls
3. **Password Hashing** - Use bcrypt with salt rounds = 10
4. **Sensitive Data** - Never log passwords or secrets

### Access Control
1. **IAM Policies** - Restrict DynamoDB access to application role
2. **Realm Isolation** - Always filter by realmId for multi-tenant security
3. **Conditional Updates** - Use conditions to prevent race conditions

### Audit Logging
Log all data modifications:
- Entity type and ID
- Operation type (create, update, delete)
- User/service performing operation
- Timestamp
- Changed fields (for updates)

## Open Questions

1. **GSI Provisioning** - Should we use on-demand or provisioned capacity for GSIs?
   - on-demand

2. **Backup Strategy** - How should DynamoDB backups be configured?
   - No recovery configuration, Prod setup will be addressed in a different spec

3. **Testing Environment** - Should we use DynamoDB Local or real AWS for integration tests?
   - DynamoDB Local for CI, Staging and Prod setup will be addressed in a different spec

4. **Migration Timeline** - When should we migrate production to DynamoDB?
   - No, migration will be addressed in a separate spec

5. **Populate/Join Operations** - How should we handle MongoDB's populate() for reference resolution?
   - Implement separate query methods that fetch related entities

## Success Criteria

The implementation will be considered complete when:

1. ✅ All 6 entity repositories have complete DynamoDB implementations
2. ✅ All repository interface methods are implemented
3. ✅ All unit tests pass for both MongoDB and DynamoDB
4. ✅ Property-based tests verify core correctness properties
5. ✅ Integration tests show identical behavior between MongoDB and DynamoDB
6. ✅ Code coverage > 80% for DynamoDB repositories
7. ✅ Documentation is complete and accurate
8. ✅ Application runs successfully with USE_DYNAMODB=true
9. ✅ Performance meets expected benchmarks
10. ✅ No data loss or corruption in test scenarios
