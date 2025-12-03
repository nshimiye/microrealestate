# Design Document

## Overview

This design document outlines the technical approach for refactoring the API service's occupant manager (`services/api/src/managers/occupantmanager.js`) to use the data access layer in the `services/common` package. The occupant manager currently uses direct Mongoose model calls (`Collections.Tenant`, `Collections.Property`, `Collections.Document`) which creates tight coupling between business logic and data persistence.

The refactoring will extend the existing `TenantRepository` and `PropertyRepository` classes with additional methods needed by the occupant manager, then update the occupant manager to use these repository methods instead of direct Mongoose calls. This follows the same pattern successfully implemented for the realm manager and property manager.

The occupant manager is more complex than previous refactorings because it:
1. Uses MongoDB aggregation pipelines to join tenants with file descriptors and documents
2. Coordinates with external services (PDF generator) for document deletion
3. Manages complex contract-based rent schedule generation
4. Uses MongoDB transactions for data consistency during deletions
5. Queries and manages document records across multiple collections

This refactoring will completely decouple the occupant manager from MongoDB/Mongoose by:
- Creating a DocumentRepository for document operations
- Creating a session management abstraction for MongoDB transactions
- Ensuring no direct Mongoose/Collections imports remain in the occupant manager

## Architecture

### Current Architecture

```
┌─────────────────────────────────────────────┐
│  API Service (services/api)                 │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  Occupant Manager                     │ │
│  │  occupantmanager.js                   │ │
│  │                                       │ │
│  │  Direct Mongoose Calls:               │ │
│  │  - Collections.Tenant.create()        │ │
│  │  - Collections.Tenant.findOne()       │ │
│  │  - Collections.Tenant.updateOne()     │ │
│  │  - Collections.Tenant.find()          │ │
│  │  - Collections.Tenant.deleteMany()    │ │
│  │  - Collections.Tenant.aggregate()     │ │
│  │  - Collections.Property.find()        │ │
│  │  - Collections.Document.find()        │ │
│  │  - Collections.startSession()         │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         │
         │ Direct Import
         ▼
┌─────────────────────────────────────────────┐
│  Common Package (@microrealestate/common)   │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  Collections                          │ │
│  │  - Tenant Model                       │ │
│  │  - Property Model                     │ │
│  │  - Document Model                     │ │
│  │  (Mongoose Models)                    │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```


### Proposed Architecture

```
┌─────────────────────────────────────────────┐
│  API Service (services/api)                 │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  Occupant Manager                     │ │
│  │  occupantmanager.js                   │ │
│  │                                       │ │
│  │  Repository Calls:                    │ │
│  │  - tenantRepository.create()          │ │
│  │  - tenantRepository.findById()        │ │
│  │  - tenantRepository.update()          │ │
│  │  - tenantRepository.findAll()         │ │
│  │  - tenantRepository.findByIds()       │ │
│  │  - tenantRepository.deleteMany()      │ │
│  │  - tenantRepository.                  │ │
│  │      findWithAggregation()            │ │
│  │  - propertyRepository.findAll()       │ │
│  │  - documentRepository.                │ │
│  │      findByTenantIds()                │ │
│  │  - sessionManager.startSession()      │ │
│  │  - sessionManager.withTransaction()   │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         │
         │ Clean API
         ▼
┌─────────────────────────────────────────────┐
│  Common Package (@microrealestate/common)   │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  Data Access Layer                    │ │
│  │  - TenantRepository (extended)        │ │
│  │  - PropertyRepository (already has    │ │
│  │    findAll method)                    │ │
│  │  - DocumentRepository (new)           │ │
│  │  - SessionManager (new)               │ │
│  └───────────────────────────────────────┘ │
│         │                                   │
│         │ Internal Use                      │
│         ▼                                   │
│  ┌───────────────────────────────────────┐ │
│  │  Collections                          │ │
│  │  - Tenant Model                       │ │
│  │  - Property Model                     │ │
│  │  - Document Model                     │ │
│  │  (Mongoose Models)                    │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Extend Existing Repositories**: Add methods to existing `TenantRepository` and use existing `PropertyRepository.findAll()` method
2. **Create New Repositories**: Create `DocumentRepository` for document operations
3. **Create Session Manager**: Create `SessionManager` utility for MongoDB transaction management
4. **Plain Objects**: Repositories return plain JavaScript objects (using `.lean()` or `.toObject()`) to avoid leaking Mongoose abstractions
5. **Aggregation Support**: TenantRepository includes `findWithAggregation()` method to handle complex MongoDB aggregation pipelines
6. **Complete Decoupling**: Occupant manager will have zero direct Mongoose/Collections imports after refactoring
7. **No Business Logic in Repositories**: Validation, contract generation, date formatting, and property map building remain in occupant manager
8. **Backward Compatibility**: Existing Collections exports remain unchanged, allowing other managers to continue using direct Mongoose calls


## Components and Interfaces

### Extended TenantRepository Interface

The TenantRepository already has several methods. We need to add the following methods for the occupant manager:

```typescript
export class TenantRepository {
  // Existing methods (already implemented)
  async findByContactEmail(email: string): Promise<Tenant[]>;
  async findById(id: string): Promise<Tenant | null>;
  async find(filter, options?): Promise<Tenant[]>;
  async findOne(filter): Promise<Tenant | null>;
  async findOneAndUpdate(filter, update, options?): Promise<Tenant | null>;
  async findByPropertyIds(propertyIds: string[], realmId: string): Promise<Tenant[]>;

  // New methods for occupant manager
  
  /**
   * Create a new tenant
   * @param tenantData - Tenant creation data (must include realmId)
   * @returns Created tenant object
   */
  async create(tenantData: Partial<Tenant>): Promise<Tenant>;

  /**
   * Update an existing tenant
   * @param tenantId - Tenant ID to update
   * @param realmId - Realm ID for security filtering
   * @param updateData - Data to update
   * @returns Number of documents modified (0 or 1)
   */
  async update(tenantId: string, realmId: string, updateData: Partial<Tenant>): Promise<number>;

  /**
   * Find tenants by IDs with realm filtering
   * @param tenantIds - Array of tenant IDs
   * @param realmId - Realm ID for security filtering
   * @returns Array of tenant objects
   */
  async findByIds(tenantIds: string[], realmId: string): Promise<Tenant[]>;

  /**
   * Delete multiple tenants
   * @param tenantIds - Array of tenant IDs to delete
   * @param realmId - Realm ID for security filtering
   * @returns Number of tenants deleted
   */
  async deleteMany(tenantIds: string[], realmId: string): Promise<number>;

  /**
   * Find tenants with aggregation pipeline
   * 
   * Performs complex aggregation to join tenants with:
   * - File descriptors (templates) linked to the lease
   * - Documents uploaded by the tenant
   * - Lease and property references (populated)
   * 
   * Returns tenants with additional filesToUpload field populated.
   * The missing document flags are NOT computed by this method - 
   * they must be computed by the caller.
   * 
   * @param realmId - Realm ID
   * @param tenantId - Optional specific tenant ID
   * @returns Array of tenant objects with filesToUpload populated
   */
  async findWithAggregation(
    realmId: string,
    tenantId?: string
  ): Promise<TenantWithFileDescriptors[]>;
}
```

### PropertyRepository Interface (Already Complete)

The PropertyRepository already has the `findAll()` method we need:

```typescript
export class PropertyRepository {
  // Existing methods (already implemented)
  async create(propertyData): Promise<Property>;
  async update(propertyId, realmId, updateData): Promise<Property | null>;
  async delete(propertyIds, realmId): Promise<number>;
  async findById(propertyId, realmId): Promise<Property | null>;
  
  /**
   * Find all properties in a realm
   * 
   * This method is already implemented and will be used by occupant manager
   * to build property maps.
   * 
   * @param realmId - Realm ID
   * @returns Array of property objects sorted by name ascending
   */
  async findAll(realmId: string): Promise<Property[]>;
}
```

### New DocumentRepository Interface

```typescript
export class DocumentRepository {
  /**
   * Find documents by tenant IDs
   * 
   * Retrieves all documents associated with the specified tenant IDs
   * within a realm. Used for document cleanup during tenant deletion.
   * 
   * @param tenantIds - Array of tenant IDs
   * @param realmId - Realm ID for security filtering
   * @param projection - Optional fields to include/exclude (e.g., { _id: 1 })
   * @returns Array of document objects
   */
  async findByTenantIds(
    tenantIds: string[],
    realmId: string,
    projection?: Record<string, number>
  ): Promise<Document[]>;
}
```

### New SessionManager Utility

```typescript
export class SessionManager {
  /**
   * Start a new MongoDB session
   * 
   * Creates a new client session for transaction support.
   * The caller is responsible for ending the session.
   * 
   * @returns MongoDB ClientSession
   */
  startSession(): Promise<ClientSession>;

  /**
   * Execute a function within a transaction
   * 
   * Automatically handles session creation, transaction lifecycle,
   * and cleanup. If the function throws an error, the transaction
   * is aborted. Otherwise, it is committed.
   * 
   * @param fn - Async function to execute within transaction
   * @returns Result of the function
   * @throws Error if transaction fails
   * 
   * @example
   * ```typescript
   * await sessionManager.withTransaction(async (session) => {
   *   await tenantRepository.deleteMany(ids, realmId);
   *   await documentRepository.deleteByTenantIds(ids, realmId);
   * });
   * ```
   */
  async withTransaction<T>(
    fn: (session: ClientSession) => Promise<T>
  ): Promise<T>;
}
```


## Data Models

The repositories use existing Mongoose models internally but return plain JavaScript objects.

### Tenant Type

The Tenant type is defined in `@microrealestate/types`:

```typescript
import { CollectionTypes } from '@microrealestate/types';

// Use CollectionTypes.Tenant from the types package
type Tenant = CollectionTypes.Tenant;

// Key fields for reference:
// - _id: string
// - realmId: string | Realm
// - name: string
// - isCompany: boolean
// - company, manager, legalForm, siret, rcs, capital
// - street1, street2, zipCode, city, country
// - contacts: Array<{ contact, phone, email }>
// - reference: string
// - contract: string
// - leaseId: string | Lease
// - beginDate, endDate, terminationDate: Date
// - properties: Array<{ propertyId, property, rent, expenses, entryDate, exitDate }>
// - rents: PartRent[] (generated from contract)
// - isVat, vatRatio, discount, guaranty, guarantyPayback
// - stepperMode: boolean

/**
 * File descriptor with associated documents
 * 
 * Represents a Template (file descriptor) with its associated uploaded Documents.
 * The missing flag is computed by the occupant manager based on requirements.
 */
interface FileDescriptorWithDocuments {
  // Template fields (from aggregation)
  _id: string;
  name: string;
  description: string;
  required: boolean;
  requiredOnceContractTerminated: boolean;
  
  // Associated documents (from nested aggregation)
  documents: Array<Partial<Document>>;
  
  // Computed field (added by occupant manager after aggregation)
  missing?: boolean;
}

/**
 * Extended Tenant type returned by findWithAggregation
 * 
 * Includes all Tenant fields plus filesToUpload array populated
 * from the aggregation pipeline that joins:
 * - Tenant → Template (file descriptors linked to lease)
 * - Template → Document (uploaded files for this tenant)
 */
interface TenantWithFileDescriptors extends Tenant {
  filesToUpload: FileDescriptorWithDocuments[];
}
```

### Property Type

```typescript
import { CollectionTypes } from '@microrealestate/types';

// Use CollectionTypes.Property from the types package
type Property = CollectionTypes.Property;

// Key fields for reference:
// - _id: string
// - realmId: string
// - type: string
// - name: string
// - description: string
// - surface: number
// - phone: string
// - address: PartAddress
// - price: number
```

### Document Type

```typescript
import { CollectionTypes } from '@microrealestate/types';

// Use CollectionTypes.Document from the types package
type Document = CollectionTypes.Document;

// Key fields for reference:
// - _id: string
// - realmId: string
// - tenantId: string
// - leaseId: string
// - templateId: string
// - type: 'text' | 'file'
// - name: string
// - description: string
// - mimeType?: string
// - expiryDate?: Date
// - url?: string
// - createdDate, updatedDate: Date
```

### Template Type

```typescript
import { CollectionTypes } from '@microrealestate/types';

// Use CollectionTypes.Template from the types package
type Template = CollectionTypes.Template;

// Key fields for reference:
// - _id: string
// - realmId: string
// - name: string
// - type: string
// - description: string
// - hasExpiryDate: boolean
// - linkedResourceIds: string[]
// - required: boolean
// - requiredOnceContractTerminated: boolean
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Plain object returns

*For any* TenantRepository method that returns data, the returned object should be a plain JavaScript object without Mongoose-specific methods (such as `.save()`, `.$isNew`, `.toObject()`)
**Validates: Requirements 3.8**

### Property 2: Tenant creation persistence

*For any* valid tenant data with realmId, calling `TenantRepository.create(tenantData)` should persist the tenant such that it can be retrieved by subsequent queries
**Validates: Requirements 3.1**

### Property 3: Tenant update persistence

*For any* existing tenant and valid update data, calling `TenantRepository.update(tenantId, realmId, updateData)` should persist the changes such that subsequent queries return the updated data
**Validates: Requirements 3.2**

### Property 4: Realm-scoped queries

*For any* TenantRepository query method with realmId parameter, the results should only include tenants belonging to that specific realm
**Validates: Requirements 1.2, 3.5**

### Property 5: Property map completeness

*For any* realm, calling `PropertyRepository.findAll(realmId)` should return all properties in that realm, and building a property map from the results should allow lookup of any property ID in that realm
**Validates: Requirements 7.1, 7.2**

### Property 6: Tenant deletion count

*For any* set of tenant IDs and realmId, calling `TenantRepository.deleteMany(tenantIds, realmId)` should return a count equal to the number of tenants that existed in that realm with those IDs
**Validates: Requirements 3.6**

### Property 7: Aggregation result structure

*For any* tenant returned by `TenantRepository.findWithAggregation()`, the result should include a `filesToUpload` array with properly structured file descriptor and document data
**Validates: Requirements 3.7, 9.1**

### Property 8: Repository error propagation

*For any* repository method, when an error condition occurs (invalid input, database error), the method should throw an error that can be caught by the caller
**Validates: Requirements 1.5**

### Property 9: Document query by tenant IDs

*For any* set of tenant IDs and realmId, calling `DocumentRepository.findByTenantIds(tenantIds, realmId)` should return all documents associated with those tenants in that realm
**Validates: Requirements 15.2**

### Property 10: Transaction atomicity

*For any* function executed within `SessionManager.withTransaction()`, if the function throws an error, all database operations should be rolled back; if it succeeds, all operations should be committed
**Validates: Requirements 10.5, 15.5**


## Error Handling

### Repository Error Patterns

Repositories handle errors consistently:

1. **Not Found**: Methods that query return `null` or empty array when no matching documents are found (not an error)
2. **Invalid Input**: Methods throw `Error` with descriptive message for invalid input (e.g., empty ID, missing realmId)
3. **Database Errors**: Methods propagate Mongoose/MongoDB errors to the caller for handling at the service layer
4. **Validation Errors**: Mongoose validation errors are propagated as-is to maintain existing error handling behavior

### Example Error Handling

```typescript
// In repository
async create(tenantData: Partial<Tenant>): Promise<Tenant> {
  if (!tenantData || typeof tenantData !== 'object') {
    throw new Error('Tenant data must be an object');
  }
  if (!tenantData.realmId) {
    throw new Error('Tenant data must include realmId');
  }
  
  try {
    const doc = await TenantModel.create(tenantData);
    return doc.toObject();
  } catch (error) {
    // Propagate database/validation errors
    throw error;
  }
}
```

### Occupant Manager Error Handling

The occupant manager continues to use its existing error handling patterns:

```javascript
// Existing pattern in occupant manager
if (!occupant.name) {
  logger.error('missing tenant name');
  throw new ServiceError('missing fields', 422);
}

try {
  const newOccupant = await tenantRepository.create({
    ...occupant,
    realmId: realm._id
  });
  // ... rest of logic
} catch (error) {
  // ServiceError thrown by validation
  // or database errors from repository
  throw new ServiceError(error, 409);
}
```


## Testing Strategy

### Unit Testing

Unit tests will verify repository method behaviors:

1. **TenantRepository Method Tests**
   - Test `create()` with valid tenant data
   - Test `update()` with existing tenant
   - Test `findByIds()` with multiple tenant IDs
   - Test `deleteMany()` returns correct count
   - Test `findWithAggregation()` returns properly structured data
   - Test that plain objects are returned (no Mongoose methods)
   - Test error handling for invalid inputs
   - Test realm-scoped filtering

2. **PropertyRepository Tests**
   - Test `findAll()` returns all properties for a realm
   - Test that plain objects are returned
   - Test empty realm returns empty array

3. **Integration Tests**
   - Test occupant manager `add()` flow with repositories
   - Test occupant manager `update()` flow with repositories
   - Test occupant manager `remove()` flow with repositories
   - Test occupant manager `all()` and `one()` flows
   - Test occupant manager `overview()` flow

### Property-Based Testing

Property-based tests will verify universal properties using **fast-check**:

1. **Plain Object Property**
   - Generate random tenant data
   - Call repository methods
   - Verify all returned objects are plain (no Mongoose methods)
   - Run 100+ iterations

2. **Round-trip Property**
   - Generate random tenant data
   - Create tenant via repository
   - Retrieve tenant by ID
   - Verify retrieved data matches created data
   - Run 100+ iterations

3. **Realm Isolation Property**
   - Generate random tenants for multiple realms
   - Create tenants via repository
   - Query each realm separately
   - Verify no cross-realm data leakage
   - Run 100+ iterations

4. **Update Persistence Property**
   - Generate random tenant data
   - Create tenant via repository
   - Generate random update data
   - Update tenant via repository
   - Retrieve tenant and verify updates persisted
   - Run 100+ iterations

5. **Deletion Count Property**
   - Generate random tenants
   - Create tenants via repository
   - Delete subset of tenants
   - Verify deletion count matches expected
   - Run 100+ iterations

### Test Configuration

- Property-based tests will run a minimum of 100 iterations per property
- Each property-based test will be tagged with a comment referencing the design document property
- Tag format: `// Feature: api-occupant-data-access-layer, Property X: [property text]`
- Tests will use the existing Vitest framework configured in services/common


## Implementation Notes

### Repository Implementation Strategy

#### For Queries (findByIds, findWithAggregation)

Use `.lean()` to return plain objects:

```typescript
async findByIds(tenantIds: string[], realmId: string): Promise<Tenant[]> {
  if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
    throw new Error('Tenant IDs must be a non-empty array');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const tenants = await TenantModel.find({
    _id: { $in: tenantIds },
    realmId: realmId
  }).lean();
  
  return tenants as Tenant[];
}
```

#### For Creates

Use `.create()` then convert to plain object:

```typescript
async create(tenantData: Partial<Tenant>): Promise<Tenant> {
  if (!tenantData || typeof tenantData !== 'object') {
    throw new Error('Tenant data must be an object');
  }
  if (!tenantData.realmId) {
    throw new Error('Tenant data must include realmId');
  }
  
  const doc = await TenantModel.create(tenantData);
  return doc.toObject();
}
```

#### For Updates

Use `updateOne()` which returns modification count:

```typescript
async update(
  tenantId: string,
  realmId: string,
  updateData: Partial<Tenant>
): Promise<number> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Tenant ID must be a non-empty string');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  if (!updateData || typeof updateData !== 'object') {
    throw new Error('Update data must be an object');
  }
  
  const result = await TenantModel.updateOne(
    { _id: tenantId, realmId: realmId },
    updateData
  );
  
  return result.modifiedCount || 0;
}
```

#### For Aggregations

The aggregation pipeline is complex and needs to be preserved exactly:

```typescript
async findWithAggregation(
  realmId: string,
  tenantId?: string
): Promise<TenantWithFileDescriptors[]> {
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const $match: any = { realmId };
  if (tenantId) {
    $match._id = new mongoose.Types.ObjectId(tenantId);
  }
  
  const tenants = await TenantModel.aggregate([
    { $match },
    {
      $lookup: {
        from: 'templates',
        let: {
          tenant_realmId: '$realmId',
          tenant_tenantId: { $toString: '$_id' },
          tenant_leaseId: '$leaseId'
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$realmId', '$$tenant_realmId'] },
                  { $in: ['$$tenant_leaseId', '$linkedResourceIds'] },
                  { $eq: ['$type', 'fileDescriptor'] }
                ]
              }
            }
          },
          {
            $lookup: {
              from: 'documents',
              let: { template_templateId: { $toString: '$_id' } },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$realmId', '$$tenant_realmId'] },
                        { $eq: ['$tenantId', '$$tenant_tenantId'] },
                        { $eq: ['$leaseId', '$$tenant_leaseId'] },
                        { $eq: ['$type', 'file'] },
                        { $eq: ['$templateId', '$$template_templateId'] }
                      ]
                    }
                  }
                },
                {
                  $project: {
                    realmId: 0,
                    leaseId: 0,
                    tenantId: 0,
                    type: 0,
                    mimeType: 0,
                    templateId: 0,
                    url: 0
                  }
                }
              ],
              as: 'documents'
            }
          },
          {
            $project: {
              realmId: 0,
              linkedResourceIds: 0,
              type: 0,
              hasExpiryDate: 0
            }
          }
        ],
        as: 'filesToUpload'
      }
    },
    { $sort: { name: 1 } }
  ]);
  
  // Populate references
  await TenantModel.populate(tenants, [
    { path: 'leaseId' },
    { path: 'properties.propertyId' }
  ]);
  
  return tenants as TenantWithFileDescriptors[];
}
```

#### For Document Queries

Simple query with projection support:

```typescript
async findByTenantIds(
  tenantIds: string[],
  realmId: string,
  projection?: Record<string, number>
): Promise<Document[]> {
  if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
    throw new Error('Tenant IDs must be a non-empty array');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  let query = DocumentModel.find({
    realmId: realmId,
    tenantId: { $in: tenantIds }
  });
  
  if (projection) {
    query = query.select(projection);
  }
  
  const documents = await query.lean();
  return documents as Document[];
}
```

#### For Session Management

Wrapper around Mongoose connection:

```typescript
import mongoose from 'mongoose';

export class SessionManager {
  startSession(): Promise<mongoose.ClientSession> {
    return mongoose.startSession();
  }

  async withTransaction<T>(
    fn: (session: mongoose.ClientSession) => Promise<T>
  ): Promise<T> {
    const session = await this.startSession();
    session.startTransaction();
    
    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
```


### Occupant Manager Refactoring Strategy

The refactoring will happen in phases:

1. **Phase 1**: Extend TenantRepository with new methods (create, update, findByIds, deleteMany, findWithAggregation)
2. **Phase 2**: Create DocumentRepository with findByTenantIds method
3. **Phase 3**: Create SessionManager utility with startSession and withTransaction methods
4. **Phase 4**: Add unit tests for new TenantRepository methods
5. **Phase 5**: Add unit tests for DocumentRepository methods
6. **Phase 6**: Add unit tests for SessionManager methods
7. **Phase 7**: Add property-based tests for repositories
8. **Phase 8**: Refactor occupant manager helper functions (_buildPropertyMap, _fetchTenants)
9. **Phase 9**: Refactor occupant manager `add()` function
10. **Phase 10**: Refactor occupant manager `update()` function
11. **Phase 11**: Refactor occupant manager `remove()` function (including transaction management)
12. **Phase 12**: Refactor occupant manager `all()` and `one()` functions
13. **Phase 13**: Refactor occupant manager `overview()` function
14. **Phase 14**: Remove all Collections imports from occupant manager
15. **Phase 15**: Verify occupant manager has zero Mongoose dependencies

### Occupant Manager Business Logic Preservation

The following business logic remains in the occupant manager (not moved to repositories):

1. **Date Formatting**
   - `_stringToDate()` - converts DD/MM/YYYY strings to Date objects
   - Formatting property entry/exit dates
   - Formatting expense dates

2. **Tenant Formatting**
   - `_formatTenant()` - formats tenant data for persistence
   - Generating unique reference codes with nanoid
   - Handling company vs individual tenant data
   - Setting default values for company fields

3. **Property Map Building**
   - `_buildPropertyMap()` - creates lookup object from properties
   - Converting property IDs to strings for consistent lookups
   - Used for resolving property references in tenant data

4. **Contract Generation**
   - Using `Contract.create()` for new tenants
   - Using `Contract.update()` for existing tenants
   - Validating contract data completeness
   - Generating rent schedules from contract terms

5. **Validation**
   - Validating tenant name is provided
   - Validating tenant IDs are provided for deletion
   - Checking for paid rents before updates/deletions
   - Throwing ServiceError with appropriate status codes

6. **Document Cleanup**
   - Calling PDF generator service to delete document files via axios
   - Handling document deletion errors gracefully
   - Logging document deletion failures

8. **Missing Document Computation**
   - Computing `missing` flag for file descriptors
   - Checking document expiry dates
   - Determining if documents are required based on contract status


### Backward Compatibility

To maintain backward compatibility:

1. Collections namespace remains exported from services/common
2. Other managers continue using Collections directly
3. Both Collections and DataAccess are exported from common package index
4. DocumentRepository and SessionManager are available for other managers to use
5. Gradual migration of other managers can happen independently

### Export Structure

The existing export structure remains unchanged:

```typescript
// services/common/src/index.ts
export { default as Service } from './utils/service.js';
export { default as EnvironmentConfig } from './utils/environmentconfig.js';
export * as Crypto from './utils/crypto.js';
export * as Format from './utils/format.js';
export * as Middlewares from './utils/middlewares.js';
export { default as MongoClient } from './utils/mongoclient.js';
export * as URLUtils from './utils/url.js';
export * as Collections from './collections/index.js';  // Existing
export * as DataAccess from './dataAccess/index.js';    // Existing (extended)
export { default as logger } from './utils/logger.js';
export { default as ServiceError } from './utils/serviceerror.js';
```

The DataAccess index will be extended with new getters:

```typescript
// services/common/src/dataAccess/index.ts
import DocumentRepository from './DocumentRepository.js';
import SessionManager from './SessionManager.js';

let documentRepositoryInstance: DocumentRepository | null = null;
let sessionManagerInstance: SessionManager | null = null;

export function getDocumentRepository(): DocumentRepository {
  if (!documentRepositoryInstance) {
    documentRepositoryInstance = new DocumentRepository();
  }
  return documentRepositoryInstance;
}

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
```

### Usage Examples

**Before (Direct Mongoose):**
```javascript
import { Collections } from '@microrealestate/common';

// Create
const newOccupant = await Collections.Tenant.create({
  ...occupant,
  realmId: realm._id
});

// Query
const originalOccupant = await Collections.Tenant.findOne({
  _id: occupantId,
  realmId: realm._id
}).lean();

// Update
await Collections.Tenant.updateOne(
  { realmId: realm._id, _id: occupantId },
  newOccupant
);

// Delete
await Collections.Tenant.deleteMany({
  realmId: realm._id,
  _id: { $in: occupantIds }
});

// Aggregation
const tenants = await Collections.Tenant.aggregate([
  { $match: { realmId } },
  // ... complex pipeline
]);

// Build property map
const properties = await Collections.Property.find({
  realmId: realm._id
}).lean();

// Query documents
const documents = await Collections.Document.find(
  { realmId: realm._id, tenantId: { $in: occupantIds } },
  { _id: 1 }
);

// Transaction
const session = await Collections.startSession();
session.startTransaction();
try {
  await Collections.Tenant.deleteMany({ /* ... */ });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

**After (Repository):**
```javascript
import { DataAccess } from '@microrealestate/common';

const tenantRepository = DataAccess.getTenantRepository();
const propertyRepository = DataAccess.getPropertyRepository();
const documentRepository = DataAccess.getDocumentRepository();
const sessionManager = DataAccess.getSessionManager();

// Create
const newOccupant = await tenantRepository.create({
  ...occupant,
  realmId: realm._id
});

// Query
const originalOccupant = await tenantRepository.findById(
  occupantId,
  realm._id
);

// Update
await tenantRepository.update(
  occupantId,
  realm._id,
  newOccupant
);

// Delete
await tenantRepository.deleteMany(
  occupantIds,
  realm._id
);

// Aggregation
const tenants = await tenantRepository.findWithAggregation(
  realm._id,
  tenantId
);

// Build property map
const properties = await propertyRepository.findAll(realm._id);

// Query documents
const documents = await documentRepository.findByTenantIds(
  occupantIds,
  realm._id,
  { _id: 1 }
);

// Transaction
await sessionManager.withTransaction(async (session) => {
  await tenantRepository.deleteMany(occupantIds, realm._id);
  // Other operations...
});
```


## Dependencies

### Existing Dependencies

The extended repositories use existing dependencies from services/common:

- `mongoose@6.13.6` - MongoDB ODM
- `@microrealestate/types` - TypeScript type definitions
- `moment@2.x` - Date handling (used in occupant manager for missing document computation)

### Development Dependencies

- `vitest@2.1.0` - Unit testing framework
- `@vitest/coverage-v8@2.1.0` - Code coverage
- `fast-check@3.x` - Property-based testing library (already added)

### No New Runtime Dependencies

The implementation requires no new runtime dependencies. All functionality is built on existing packages.

## Performance Considerations

### Query Performance

Using `.lean()` for queries provides performance benefits:

1. **Faster**: Skips Mongoose document hydration
2. **Less Memory**: Plain objects are lighter than Mongoose documents
3. **Serialization**: Plain objects serialize to JSON faster

### Aggregation Performance

The aggregation pipeline is complex and involves multiple joins:

1. **Preserved Logic**: The aggregation pipeline is preserved exactly as-is to maintain performance characteristics
2. **Indexes**: Existing indexes on realmId, leaseId, and other fields continue to be used
3. **Population**: Mongoose population happens after aggregation, which is efficient for small result sets

### Update Performance

The `update()` method uses `updateOne()` which is efficient:

1. **Single Operation**: Updates document in one database call
2. **No Hydration**: Doesn't load the full document into memory
3. **Atomic**: Update is atomic at the database level

### No Performance Regression

The refactoring should not significantly impact performance:

1. Same Mongoose queries under the hood
2. `.lean()` is actually faster than returning full documents
3. Aggregation pipeline is identical to current implementation
4. No additional network calls or processing


## Security Considerations

### Realm-Scoped Operations

All repository methods enforce realm-scoped filtering:

1. **Create**: Requires realmId in tenant data
2. **Query**: All queries filter by realmId
3. **Update**: Updates only affect tenants in the specified realm
4. **Delete**: Deletes only affect tenants in the specified realm

This prevents cross-realm data access and maintains multi-tenancy security.

### No New Security Risks

The refactoring introduces no new security risks:

1. Same validation logic (in occupant manager)
2. Same query patterns (Mongoose queries with realm filtering)
3. Same transaction handling (MongoDB sessions)
4. No exposure of sensitive data in plain objects
5. Document deletion still requires proper authorization headers

### Transaction Safety

MongoDB transactions continue to work correctly:

1. Transaction sessions are still created using Collections.startSession()
2. Repository operations participate in transactions when called within a session context
3. Rollback behavior is preserved for failed deletions

## Special Considerations

### Aggregation Pipeline Complexity

The `findWithAggregation()` method is the most complex part of this refactoring:

1. **Nested Lookups**: Joins tenants → templates → documents
2. **Variable Passing**: Uses `let` and `$$` syntax for variable passing between pipeline stages
3. **Population**: Uses Mongoose populate after aggregation for lease and property references
4. **Post-Processing**: Missing document flags are computed in the occupant manager after aggregation

The aggregation pipeline must be preserved exactly to maintain functionality.

### Document Operations Migrated

Document operations are migrated to DocumentRepository:

1. **Scope**: DocumentRepository provides methods for querying documents by tenant IDs
2. **Projection Support**: Supports MongoDB projection for efficient queries (e.g., only fetching _id field)
3. **Realm-Scoped**: All queries are filtered by realmId for security
4. **Reusability**: DocumentRepository can be used by other managers (lease, document, etc.)

### MongoDB Session Management Migrated

Session management is migrated to SessionManager:

1. **Abstraction**: SessionManager provides clean API for transaction management
2. **Automatic Cleanup**: `withTransaction()` method handles session lifecycle automatically
3. **Error Handling**: Transactions are automatically rolled back on errors
4. **Reusability**: SessionManager can be used by other managers for transactional operations

### Contract Generation Remains in Manager

Contract generation logic remains in the occupant manager:

1. **Reason**: Contract generation is business logic, not data access
2. **Dependencies**: Uses Contract.create() and Contract.update() utilities
3. **Complexity**: Involves complex date calculations and rent schedule generation

This is appropriate separation of concerns - repositories handle data access, managers handle business logic.


## Migration Path for Other Managers

This refactoring continues the systematic migration of API service managers to use the data access layer. The pattern established here can be applied to remaining managers:

1. **Lease Manager** - extend with LeaseRepository and TemplateRepository, use existing DocumentRepository
2. **Rent Manager** - extend TenantRepository with rent-specific aggregation methods
3. **Accounting Manager** - extend TenantRepository with accounting aggregation methods
4. **Document Manager** - use existing DocumentRepository, may need additional methods

The DocumentRepository and SessionManager created in this refactoring are immediately available for use by other managers, accelerating their migration to the data access layer.

Each manager can be refactored independently without affecting others.

## Summary

This design provides a comprehensive approach to refactoring the occupant manager to use the data access layer while:

1. **Complete Decoupling**: Occupant manager will have zero direct MongoDB/Mongoose dependencies
2. **Maintaining Functionality**: All existing business logic is preserved
3. **Improving Separation**: Data access is cleanly separated from business logic
4. **Ensuring Testability**: Repositories can be easily mocked for testing
5. **Preserving Performance**: No performance regression from the refactoring
6. **Maintaining Security**: Realm-scoped operations prevent cross-realm access
7. **Supporting Future Work**: DocumentRepository and SessionManager can be reused by other managers
8. **Accelerating Migration**: New utilities make it easier to migrate remaining managers

The refactoring is comprehensive and complete - it migrates all database operations (tenant, property, document) and transaction management to the data access layer, making the occupant manager a model for future manager refactorings.
