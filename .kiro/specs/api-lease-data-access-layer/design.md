# Design Document

## Overview

This design document outlines the technical approach for refactoring the API service's lease manager (`services/api/src/managers/leasemanager.js`) to use a new data access layer in the `services/common` package. The lease manager currently uses direct Mongoose model calls (`Collections.Lease`, `Collections.Tenant`, `Collections.Template`) which creates tight coupling between business logic and data persistence.

The refactoring will create new `LeaseRepository` and `TemplateRepository` classes in the common package, then update the lease manager to use these repository methods instead of direct Mongoose calls. This follows the same pattern successfully implemented for realm manager, property manager, and occupant manager.

The lease manager has unique complexity due to:
1. Cross-entity queries (checking if leases are used by tenants)
2. Transactional operations (deleting leases with related templates atomically)
3. Conditional update logic (protecting leases used by tenants)
4. Template cleanup logic (removing orphaned templates)

## Architecture

### Current Architecture

```
┌─────────────────────────────────┐
│  API Service                    │
│  (services/api)                 │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Lease Manager            │ │
│  │  leasemanager.js          │ │
│  │                           │ │
│  │  Direct Mongoose Calls:   │ │
│  │  new Collections.Lease()  │ │
│  │  Collections.Lease.       │ │
│  │    find()                 │ │
│  │  Collections.Lease.       │ │
│  │    findOneAndUpdate()     │ │
│  │  Collections.Tenant.      │ │
│  │    find()                 │ │
│  │  Collections.Template.    │ │
│  │    find()                 │ │
│  │  Collections.             │ │
│  │    startSession()         │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
         │
         │ Direct Import
         ▼
┌─────────────────────────────────┐
│  Common Package                 │
│  (@microrealestate/common)      │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Collections              │ │
│  │  - Lease Model            │ │
│  │  - Tenant Model           │ │
│  │  - Template Model         │ │
│  │  (Mongoose Models)        │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### Proposed Architecture

```
┌─────────────────────────────────┐
│  API Service                    │
│  (services/api)                 │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Lease Manager            │ │
│  │  leasemanager.js          │ │
│  │                           │ │
│  │  Repository Calls:        │ │
│  │  leaseRepository.create() │ │
│  │  leaseRepository.         │ │
│  │    findAll()              │ │
│  │  leaseRepository.         │ │
│  │    update()               │ │
│  │  leaseRepository.         │ │
│  │    findLeaseIdsUsedBy     │ │
│  │    Tenants()              │ │
│  │  templateRepository.      │ │
│  │    findByLinkedResources()│ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
         │
         │ Clean API
         ▼
┌─────────────────────────────────┐
│  Common Package                 │
│  (@microrealestate/common)      │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Data Access Layer        │ │
│  │  - LeaseRepository (new)  │ │
│  │  - TemplateRepository     │ │
│  │    (new)                  │ │
│  │  - TenantRepository       │ │
│  │    (existing)             │ │
│  └───────────────────────────┘ │
│         │                       │
│         │ Internal Use          │
│         ▼                       │
│  ┌───────────────────────────┐ │
│  │  Collections              │ │
│  │  - Lease Model            │ │
│  │  - Tenant Model           │ │
│  │  - Template Model         │ │
│  │  (Mongoose Models)        │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### Key Architectural Decisions

1. **Create New Repositories**: Create `LeaseRepository` and `TemplateRepository` as new classes in the data access layer
2. **Plain Objects**: Repositories return plain JavaScript objects (using `.lean()` or `.toObject()`) to avoid leaking Mongoose abstractions
3. **Transaction Support**: Repositories accept optional MongoDB session parameters for transactional operations
4. **Cross-Entity Queries**: LeaseRepository provides a method to check lease usage by tenants without exposing Tenant model
5. **Backward Compatibility**: Existing Collections exports remain unchanged, allowing other managers to continue using direct Mongoose calls
6. **No Business Logic in Repositories**: Validation, active status calculation, and conditional update logic remain in the lease manager

## Components and Interfaces

### Database Session Abstraction

To avoid exposing MongoDB-specific types in the repository interface, we use a marker interface pattern:

**Design Decision**: The `DatabaseSession` interface is intentionally minimal (a marker interface) to abstract the underlying database implementation. This provides several benefits:

1. **Database Agnostic**: Repository interfaces don't depend on MongoDB-specific types
2. **Clean API**: Consumers of repositories don't need to import MongoDB types
3. **Future Flexibility**: Could support different database implementations without changing the interface
4. **Type Safety**: TypeScript still provides type checking at the interface boundary

**Implementation**: Internally, repositories cast the `DatabaseSession` to MongoDB's `ClientSession` when passing to Mongoose methods. This is safe because:
- The session is always created by `Collections.startSession()` which returns a MongoDB ClientSession
- The cast is isolated within repository implementations
- The interface contract is maintained

### Database Session Interface

To avoid exposing MongoDB-specific types in the repository interface, we define a generic session interface:

```typescript
/**
 * Generic database session interface for transaction support
 * 
 * This interface abstracts the underlying database session implementation,
 * allowing repositories to support transactions without depending on
 * MongoDB-specific types.
 */
export interface DatabaseSession {
  // Marker interface - the actual session object is passed through
  // but repositories don't need to know its specific type
}
```

### LeaseRepository Interface

```typescript
export class LeaseRepository {
  /**
   * Create a new lease
   * 
   * @param leaseData - Lease creation data
   * @returns Created lease object
   * @throws Error if leaseData is invalid
   * 
   * @example
   * ```typescript
   * const lease = await leaseRepository.create({
   *   realmId: '507f1f77bcf86cd799439011',
   *   name: '12 Month Lease',
   *   numberOfTerms: 12,
   *   timeRange: 'months',
   *   active: true
   * });
   * ```
   */
  async create(leaseData: Partial<Lease>): Promise<Lease>;

  /**
   * Find a lease by ID within a realm
   * 
   * @param leaseId - Lease ID
   * @param realmId - Realm ID
   * @returns Lease object or null if not found
   * @throws Error if leaseId or realmId is invalid
   * 
   * @example
   * ```typescript
   * const lease = await leaseRepository.findById(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012'
   * );
   * ```
   */
  async findById(leaseId: string, realmId: string): Promise<Lease | null>;

  /**
   * Find all leases in a realm
   * 
   * Returns leases sorted by name in ascending order.
   * 
   * @param realmId - Realm ID
   * @returns Array of lease objects
   * @throws Error if realmId is invalid
   * 
   * @example
   * ```typescript
   * const leases = await leaseRepository.findAll('507f1f77bcf86cd799439011');
   * ```
   */
  async findAll(realmId: string): Promise<Lease[]>;

  /**
   * Update a lease
   * 
   * @param leaseId - Lease ID
   * @param realmId - Realm ID
   * @param updateData - Data to update
   * @returns Updated lease object or null if not found
   * @throws Error if leaseId, realmId, or updateData is invalid
   * 
   * @example
   * ```typescript
   * const updated = await leaseRepository.update(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012',
   *   { name: 'Updated Lease Name', active: false }
   * );
   * ```
   */
  async update(
    leaseId: string,
    realmId: string,
    updateData: Partial<Lease>
  ): Promise<Lease | null>;

  /**
   * Delete multiple leases
   * 
   * @param leaseIds - Array of lease IDs to delete
   * @param realmId - Realm ID
   * @param session - Optional database session for transactions
   * @returns Number of leases deleted
   * @throws Error if leaseIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const count = await leaseRepository.deleteMany(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * ```
   */
  async deleteMany(
    leaseIds: string[],
    realmId: string,
    session?: DatabaseSession
  ): Promise<number>;

  /**
   * Find lease IDs that are used by tenants
   * 
   * Queries all tenants in the realm and returns a Set of lease IDs
   * that are referenced by at least one tenant.
   * 
   * @param realmId - Realm ID
   * @returns Set of lease IDs used by tenants
   * @throws Error if realmId is invalid
   * 
   * @example
   * ```typescript
   * const usedLeaseIds = await leaseRepository.findLeaseIdsUsedByTenants(
   *   '507f1f77bcf86cd799439011'
   * );
   * if (usedLeaseIds.has(leaseId)) {
   *   console.log('Lease is in use');
   * }
   * ```
   */
  async findLeaseIdsUsedByTenants(realmId: string): Promise<Set<string>>;

  /**
   * Find multiple leases by IDs
   * 
   * @param leaseIds - Array of lease IDs
   * @param realmId - Realm ID
   * @returns Array of lease objects
   * @throws Error if leaseIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const leases = await leaseRepository.findByIds(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * ```
   */
  async findByIds(leaseIds: string[], realmId: string): Promise<Lease[]>;
}
```

### TemplateRepository Interface

```typescript
export class TemplateRepository {
  /**
   * Find templates linked to specific resources (leases)
   * 
   * @param resourceIds - Array of resource IDs (lease IDs)
   * @param realmId - Realm ID
   * @returns Array of template objects
   * @throws Error if resourceIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const templates = await templateRepository.findByLinkedResources(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * ```
   */
  async findByLinkedResources(
    resourceIds: string[],
    realmId: string
  ): Promise<Template[]>;

  /**
   * Delete multiple templates
   * 
   * @param templateIds - Array of template IDs to delete
   * @param realmId - Realm ID
   * @param session - Optional database session for transactions
   * @returns Number of templates deleted
   * @throws Error if templateIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const count = await templateRepository.deleteMany(
   *   ['507f1f77bcf86cd799439011'],
   *   '507f1f77bcf86cd799439012',
   *   session
   * );
   * ```
   */
  async deleteMany(
    templateIds: string[],
    realmId: string,
    session?: DatabaseSession
  ): Promise<number>;

  /**
   * Update multiple templates
   * 
   * @param filter - Query filter
   * @param update - Update operations
   * @param session - Optional database session for transactions
   * @returns Number of templates modified
   * @throws Error if filter or update is invalid
   * 
   * @example
   * ```typescript
   * const count = await templateRepository.updateMany(
   *   { realmId: '507f1f77bcf86cd799439011', linkedResourceIds: { $in: leaseIds } },
   *   { $pull: { linkedResourceIds: { $in: leaseIds } } },
   *   session
   * );
   * ```
   */
  async updateMany(
    filter: Record<string, any>,
    update: Record<string, any>,
    session?: DatabaseSession
  ): Promise<number>;
}
```

## Data Models

The repositories use existing Mongoose models internally but return plain JavaScript objects.

### Lease Type

```typescript
interface Lease {
  _id: string;
  realmId: string;
  name: string;
  description: string;
  numberOfTerms: number;
  timeRange: 'days' | 'weeks' | 'months' | 'years';
  active: boolean;
  stepperMode: boolean;
  
  // Added by lease manager (not persisted)
  usedByTenants?: boolean;
}
```

### Template Type

```typescript
interface Template {
  _id: string;
  realmId: string;
  name: string;
  type: string;
  description: string;
  hasExpiryDate: boolean;
  contents: Record<string, never>;
  html: string;
  linkedResourceIds: string[];  // Array of lease IDs
  required: boolean;
  requiredOnceContractTerminated: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Lease creation persistence

*For any* valid lease data, calling `LeaseRepository.create(leaseData)` should persist the lease such that it can be retrieved by subsequent queries
**Validates: Requirements 1.1**

### Property 2: Lease retrieval by ID

*For any* created lease, calling `LeaseRepository.findById(leaseId, realmId)` should return the lease with matching data
**Validates: Requirements 1.2**

### Property 3: Find all leases returns all leases in realm

*For any* realm with multiple leases, calling `LeaseRepository.findAll(realmId)` should return all leases belonging to that realm sorted by name
**Validates: Requirements 1.3, 7.5**

### Property 4: Lease update persistence

*For any* existing lease and valid update data, calling `LeaseRepository.update(leaseId, realmId, updateData)` should persist the changes such that subsequent queries return the updated data
**Validates: Requirements 1.4**

### Property 5: Lease deletion removes leases

*For any* set of lease IDs, calling `LeaseRepository.deleteMany(leaseIds, realmId)` should remove those leases such that subsequent queries do not return them
**Validates: Requirements 1.5, 4.5**

### Property 6: Plain object returns

*For any* LeaseRepository or TemplateRepository method that returns data, the returned objects should be plain JavaScript objects without Mongoose-specific methods (such as `.save()`, `.$isNew`, `.toObject()`)
**Validates: Requirements 1.6, 2.4**

### Property 7: Template lookup by linked resources

*For any* set of lease IDs, calling `TemplateRepository.findByLinkedResources(leaseIds, realmId)` should return all templates where linkedResourceIds contains at least one of the provided lease IDs
**Validates: Requirements 2.1**

### Property 8: Template deletion removes templates

*For any* set of template IDs, calling `TemplateRepository.deleteMany(templateIds, realmId)` should remove those templates such that subsequent queries do not return them
**Validates: Requirements 2.2**

### Property 9: Template bulk update modifies templates

*For any* filter and update operation, calling `TemplateRepository.updateMany(filter, update)` should modify all matching templates according to the update operation
**Validates: Requirements 2.3**

### Property 10: Lease usage detection

*For any* realm with tenants, calling `LeaseRepository.findLeaseIdsUsedByTenants(realmId)` should return a Set containing exactly the lease IDs that are referenced by at least one tenant
**Validates: Requirements 3.1, 3.3**

### Property 11: Transaction support for deletions

*For any* MongoDB session, calling `LeaseRepository.deleteMany()` or `TemplateRepository.deleteMany()` with the session parameter should execute the deletion within that transaction session
**Validates: Requirements 4.2, 4.3**

### Property 12: Transaction rollback on failure

*For any* transaction that encounters an error, aborting the transaction should rollback all operations such that no changes are persisted
**Validates: Requirements 9.5, 10.4**

### Property 13: Repository error propagation

*For any* repository method, when an error condition occurs (invalid input, database error), the method should throw an error that can be caught by the caller
**Validates: Requirements 11.1, 11.4**

### Property 14: Not found returns null or empty

*For any* query method, when no matching documents are found, the method should return null (for single queries) or an empty array (for multi queries) without throwing an error
**Validates: Requirements 11.2**

### Property 15: Invalid input validation

*For any* repository method, when invalid input is provided (empty strings, null values, wrong types), the method should throw a descriptive error
**Validates: Requirements 11.3**

## Error Handling

### Repository Error Patterns

Repositories handle errors consistently:

1. **Not Found**: Methods that query return `null` (single) or `[]` (multiple) when no matching documents are found (not an error)
2. **Invalid Input**: Methods throw `Error` with descriptive message for invalid input (e.g., empty ID, invalid data)
3. **Database Errors**: Methods propagate Mongoose/MongoDB errors to the caller for handling at the service layer
4. **Transaction Errors**: Methods propagate transaction errors, allowing the caller to handle rollback

### Example Error Handling

```typescript
// In repository
async create(leaseData: Partial<Lease>): Promise<Lease> {
  if (!leaseData || typeof leaseData !== 'object') {
    throw new Error('Lease data must be an object');
  }
  
  if (!leaseData.realmId) {
    throw new Error('Realm ID is required');
  }
  
  try {
    const doc = await LeaseModel.create(leaseData);
    return doc.toObject();
  } catch (error) {
    // Propagate database/validation errors
    throw error;
  }
}
```

### Lease Manager Error Handling

The lease manager continues to use its existing error handling patterns:

```javascript
// Existing pattern in lease manager
try {
  if (!lease.name) {
    throw new ServiceError('missing fields', 422);
  }
  
  const savedLease = await leaseRepository.create(lease);
  res.json(savedLease);
} catch (error) {
  // ServiceError thrown by validation
  // or database errors from repository
  throw error;
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify repository method behaviors:

1. **LeaseRepository Method Tests**
   - Test `create()` with valid lease data
   - Test `findById()` returns correct lease
   - Test `findAll()` returns all leases sorted by name
   - Test `update()` persists changes
   - Test `deleteMany()` removes leases
   - Test `findLeaseIdsUsedByTenants()` returns correct Set
   - Test `findByIds()` returns multiple leases
   - Test that plain objects are returned (no Mongoose methods)
   - Test error handling for invalid inputs

2. **TemplateRepository Method Tests**
   - Test `findByLinkedResources()` returns correct templates
   - Test `deleteMany()` removes templates
   - Test `updateMany()` modifies templates
   - Test that plain objects are returned
   - Test error handling for invalid inputs

3. **Transaction Tests**
   - Verify operations within session are transactional
   - Verify rollback on error
   - Verify commit on success

### Property-Based Testing

Property-based tests will verify universal properties using **fast-check**:

1. **Plain Object Property**
   - Generate random lease and template data
   - Call repository methods
   - Verify all returned objects are plain (no Mongoose methods)
   - Run 100+ iterations
   - **Feature: api-lease-data-access-layer, Property 6: Plain object returns**

2. **Round-trip Property**
   - Generate random lease data
   - Create lease via repository
   - Retrieve lease by ID and by findAll
   - Verify retrieved data matches created data
   - Run 100+ iterations
   - **Feature: api-lease-data-access-layer, Property 1: Lease creation persistence**
   - **Feature: api-lease-data-access-layer, Property 2: Lease retrieval by ID**

3. **Update Persistence Property**
   - Generate random lease data
   - Create lease via repository
   - Generate random update data
   - Update lease via repository
   - Retrieve lease and verify updates persisted
   - Run 100+ iterations
   - **Feature: api-lease-data-access-layer, Property 4: Lease update persistence**

4. **Deletion Property**
   - Generate random lease data
   - Create multiple leases via repository
   - Delete some leases
   - Verify deleted leases are not returned by queries
   - Verify non-deleted leases are still returned
   - Run 100+ iterations
   - **Feature: api-lease-data-access-layer, Property 5: Lease deletion removes leases**

5. **Lease Usage Detection Property**
   - Generate random realm with tenants and leases
   - Some tenants reference leases, some don't
   - Call findLeaseIdsUsedByTenants
   - Verify returned Set contains exactly the leases referenced by tenants
   - Run 100+ iterations
   - **Feature: api-lease-data-access-layer, Property 10: Lease usage detection**

6. **Template Linked Resources Property**
   - Generate random templates with linkedResourceIds
   - Call findByLinkedResources with various lease IDs
   - Verify only templates linked to those leases are returned
   - Run 100+ iterations
   - **Feature: api-lease-data-access-layer, Property 7: Template lookup by linked resources**

7. **Transaction Rollback Property**
   - Start a transaction
   - Perform repository operations
   - Abort transaction
   - Verify no changes were persisted
   - Run 100+ iterations
   - **Feature: api-lease-data-access-layer, Property 12: Transaction rollback on failure**

### Integration Testing

Integration tests will verify the lease manager works correctly with repositories:

1. **Add Lease Flow**
   - Test complete add lease flow using repositories
   - Verify lease is created with correct active status
   - Verify usedByTenants field is added
   - Verify validation works correctly

2. **Update Lease Flow**
   - Test complete update lease flow using repositories
   - Verify lease is updated correctly
   - Verify conditional update logic (protecting leases used by tenants)
   - Verify active status recalculation

3. **Delete Lease Flow**
   - Test complete delete lease flow using repositories
   - Verify leases are deleted
   - Verify templates are cleaned up correctly
   - Verify orphaned templates are removed
   - Verify templates linked to other leases are preserved
   - Verify transaction atomicity

4. **Query Lease Flow**
   - Test `one()` endpoint returns correct lease
   - Test `all()` endpoint returns all leases sorted by name
   - Verify usedByTenants field is populated

### Test Configuration

- Property-based tests will run a minimum of 100 iterations per property
- Each property-based test will be tagged with a comment referencing the design document property
- Tag format: `// Feature: api-lease-data-access-layer, Property X: [property text]`
- Tests will use the existing Vitest framework configured in services/common

## Implementation Notes

### Repository Implementation Strategy

#### For Queries

Use `.lean()` to return plain objects:

```typescript
async findById(leaseId: string, realmId: string): Promise<Lease | null> {
  if (!leaseId || typeof leaseId !== 'string') {
    throw new Error('Lease ID must be a non-empty string');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const lease = await LeaseModel.findOne({
    _id: leaseId,
    realmId: realmId
  }).lean();
  
  return lease;
}

async findAll(realmId: string): Promise<Lease[]> {
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const leases = await LeaseModel.find({ realmId: realmId })
    .sort({ name: 1 })
    .lean();
  
  return leases;
}
```

#### For Creates

Use `.create()` then convert to plain object:

```typescript
async create(leaseData: Partial<Lease>): Promise<Lease> {
  if (!leaseData || typeof leaseData !== 'object') {
    throw new Error('Lease data must be an object');
  }
  
  if (!leaseData.realmId) {
    throw new Error('Realm ID is required');
  }
  
  const doc = await LeaseModel.create(leaseData);
  return doc.toObject();
}
```

#### For Updates

Use `findOneAndUpdate()` with `{ new: true }` and `.lean()`:

```typescript
async update(
  leaseId: string,
  realmId: string,
  updateData: Partial<Lease>
): Promise<Lease | null> {
  if (!leaseId || typeof leaseId !== 'string') {
    throw new Error('Lease ID must be a non-empty string');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  if (!updateData || typeof updateData !== 'object') {
    throw new Error('Update data must be an object');
  }
  
  const lease = await LeaseModel.findOneAndUpdate(
    { _id: leaseId, realmId: realmId },
    updateData,
    { new: true }
  ).lean();
  
  return lease;
}
```

**Note**: Unlike realm manager, lease manager doesn't need `.save()` because there are no pre-save hooks on the Lease model.

#### For Deletions with Transactions

Accept optional session parameter (typed as DatabaseSession but cast internally to MongoDB ClientSession):

```typescript
async deleteMany(
  leaseIds: string[],
  realmId: string,
  session?: DatabaseSession
): Promise<number> {
  if (!Array.isArray(leaseIds) || leaseIds.length === 0) {
    throw new Error('Lease IDs must be a non-empty array');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  // Cast DatabaseSession to MongoDB ClientSession internally
  const result = await LeaseModel.deleteMany(
    { _id: { $in: leaseIds }, realmId: realmId },
    { session: session as any }
  );
  
  return result.deletedCount || 0;
}
```

**Note**: The `DatabaseSession` interface is a marker interface that abstracts the database-specific session type. Internally, repositories cast it to the appropriate type (MongoDB's `ClientSession`) when passing to Mongoose methods. This keeps the repository interface clean and database-agnostic.

#### For Cross-Entity Queries

Query tenants to find lease usage:

```typescript
async findLeaseIdsUsedByTenants(realmId: string): Promise<Set<string>> {
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const tenants = await TenantModel.find(
    { realmId: realmId },
    { leaseId: 1 }  // Project only leaseId field
  ).lean();
  
  return tenants.reduce((acc, { leaseId }) => {
    if (leaseId) {
      acc.add(leaseId.toString());
    }
    return acc;
  }, new Set<string>());
}
```

### Lease Manager Refactoring Strategy

The refactoring will happen in phases:

1. **Phase 1**: Create LeaseRepository with basic CRUD methods
2. **Phase 2**: Create TemplateRepository with query and update methods
3. **Phase 3**: Add unit tests for LeaseRepository methods
4. **Phase 4**: Add unit tests for TemplateRepository methods
5. **Phase 5**: Add property-based tests for repositories
6. **Phase 6**: Refactor lease manager `add()` function
7. **Phase 7**: Refactor lease manager `update()` function
8. **Phase 8**: Refactor lease manager `remove()` function (most complex - transactions)
9. **Phase 9**: Refactor lease manager `all()` function
10. **Phase 10**: Refactor lease manager `one()` function
11. **Phase 11**: Run integration tests to verify behavior unchanged
12. **Phase 12**: Remove Collections imports from lease manager

### Lease Manager Business Logic Preservation

The following business logic remains in the lease manager (not moved to repositories):

1. **Validation**
   - Checking for required lease name
   - Checking for required lease IDs
   - Checking if leases are used by tenants before deletion

2. **Active Status Calculation**
   - Calculating `active` based on `numberOfTerms` and `timeRange`
   - Recalculating `active` on update if not provided

3. **Conditional Update Logic**
   - Restricting updates to name, description, active, stepperMode for leases used by tenants
   - Allowing full updates for leases not used by tenants

4. **Template Cleanup Logic**
   - Finding templates linked to deleted leases
   - Identifying orphaned templates (linked only to deleted leases)
   - Removing lease IDs from templates linked to other leases
   - Deleting orphaned templates

5. **Transaction Orchestration**
   - Starting MongoDB session
   - Starting transaction
   - Coordinating lease and template deletions
   - Committing or aborting transaction
   - Ending session

6. **Response Enrichment**
   - Adding `usedByTenants` field to lease responses
   - Converting Mongoose documents to JSON

### Transaction Flow

The lease manager's `remove()` function orchestrates a complex transaction:

```javascript
// Pseudo-code for transaction flow
const session = await Collections.startSession();
session.startTransaction();

try {
  // 1. Delete leases
  await leaseRepository.deleteMany(leaseIds, realmId, session);
  
  // 2. Delete orphaned templates
  await templateRepository.deleteMany(templateIdsToRemove, realmId, session);
  
  // 3. Update templates linked to other leases
  await templateRepository.updateMany(
    { realmId, linkedResourceIds: { $in: leaseIds } },
    { $pull: { linkedResourceIds: { $in: leaseIds } } },
    session
  );
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw new ServiceError(error, 500);
} finally {
  session.endSession();
}
```

### Backward Compatibility

To maintain backward compatibility:

1. Collections namespace remains exported from services/common
2. Other managers continue using Collections directly
3. Both Collections and DataAccess are exported from common package index
4. Future manager refactorings can use the same pattern
5. Gradual migration of other managers can happen independently

### Export Structure

The existing export structure is extended:

```typescript
// services/common/src/dataAccess/index.ts
import LeaseRepository from './LeaseRepository.js';
import TemplateRepository from './TemplateRepository.js';
import TenantRepository from './TenantRepository.js';
import PropertyRepository from './PropertyRepository.js';
import DocumentRepository from './DocumentRepository.js';
import RealmRepository from './RealmRepository.js';
import AccountRepository from './AccountRepository.js';

const leaseRepository = new LeaseRepository();
const templateRepository = new TemplateRepository();
const tenantRepository = new TenantRepository();
const propertyRepository = new PropertyRepository();
const documentRepository = new DocumentRepository();
const realmRepository = new RealmRepository();
const accountRepository = new AccountRepository();

export function getLeaseRepository() {
  return leaseRepository;
}

export function getTemplateRepository() {
  return templateRepository;
}

export function getTenantRepository() {
  return tenantRepository;
}

export function getPropertyRepository() {
  return propertyRepository;
}

export function getDocumentRepository() {
  return documentRepository;
}

export function getRealmRepository() {
  return realmRepository;
}

export function getAccountRepository() {
  return accountRepository;
}
```

### Usage Examples

**Before (Direct Mongoose):**
```javascript
import { Collections } from '@microrealestate/common';

// Create
const dbLease = new Collections.Lease({
  ...lease,
  active: !!lease.active && !!lease.numberOfTerms && !!lease.timeRange,
  realmId: realm._id
});
const savedLease = await dbLease.save();

// Query
const dbLease = await Collections.Lease.findOne({
  _id: leaseId,
  realmId: realm._id
}).lean();

// Update
const dbLease = await Collections.Lease.findOneAndUpdate(
  { realmId: realm._id, _id: lease._id },
  updateData,
  { new: true }
).lean();

// Delete with transaction
const session = await Collections.startSession();
session.startTransaction();
await Collections.Lease.deleteMany({
  _id: { $in: leaseIds },
  realmId: realm._id
});
await session.commitTransaction();

// Check usage
const tenants = await Collections.Tenant.find(
  { realmId: realm._id },
  { realmId: 1, leaseId: 1 }
).lean();
```

**After (Repository):**
```javascript
import { DataAccess } from '@microrealestate/common';

const leaseRepository = DataAccess.getLeaseRepository();
const templateRepository = DataAccess.getTemplateRepository();

// Create
const savedLease = await leaseRepository.create({
  ...lease,
  active: !!lease.active && !!lease.numberOfTerms && !!lease.timeRange,
  realmId: realm._id
});

// Query
const dbLease = await leaseRepository.findById(leaseId, realm._id);

// Update
const dbLease = await leaseRepository.update(
  lease._id,
  realm._id,
  updateData
);

// Delete with transaction
const session = await Collections.startSession();
session.startTransaction();
await leaseRepository.deleteMany(leaseIds, realm._id, session);
await session.commitTransaction();

// Check usage
const usedLeaseIds = await leaseRepository.findLeaseIdsUsedByTenants(realm._id);
```

## Dependencies

### Existing Dependencies

The new repositories use existing dependencies from services/common:

- `mongoose@6.13.6` - MongoDB ODM
- `@microrealestate/types` - TypeScript type definitions

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

### Projection Optimization

The `findLeaseIdsUsedByTenants()` method uses field projection to only retrieve the `leaseId` field from tenant documents, reducing data transfer and memory usage.

### Transaction Performance

Transactions add overhead but are necessary for data consistency. The lease manager uses transactions only for the `remove()` operation where atomicity is critical.

### No Performance Regression

The refactoring should not significantly impact performance:

1. Same Mongoose queries under the hood
2. `.lean()` is actually faster than returning full documents
3. Update operation uses `findOneAndUpdate()` (same as current)
4. No additional network calls or processing

## Security Considerations

### Realm Isolation

All repository methods require a `realmId` parameter and include it in queries, ensuring:

1. Leases can only be accessed within their realm
2. Templates can only be accessed within their realm
3. Cross-realm data access is prevented
4. Multi-tenant isolation is maintained

### Input Validation

Repositories validate input parameters:

1. Check for required parameters (IDs, data objects)
2. Check for correct types (strings, objects, arrays)
3. Throw descriptive errors for invalid input
4. Prevent injection attacks through type checking

### No New Security Risks

The refactoring introduces no new security risks:

1. Same validation logic (in lease manager)
2. Same query patterns (Mongoose queries)
3. Same realm isolation (realmId in all queries)
4. No exposure of sensitive data in plain objects

## Migration Path for Other Managers

This refactoring continues the systematic migration of API service managers to use the repository pattern. Completed migrations:

1. ✅ **Realm Manager** - uses RealmRepository and AccountRepository
2. ✅ **Property Manager** - uses PropertyRepository
3. ✅ **Occupant Manager** - uses TenantRepository and DocumentRepository
4. 🔄 **Lease Manager** - uses LeaseRepository and TemplateRepository (this spec)

Remaining managers to migrate:

5. **Rent Manager** - will extend TenantRepository with aggregation methods
6. **Accounting Manager** - will extend TenantRepository with aggregation methods
7. **Contract Manager** - may need new ContractRepository

Each manager can be refactored independently without affecting others.
