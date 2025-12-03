# Design Document

## Overview

This design document outlines the technical approach for refactoring the API service's property manager (`services/api/src/managers/propertymanager.js`) to use a new data access layer in the `services/common` package. The property manager currently uses direct Mongoose model calls (`Collections.Property`, `Collections.Tenant`) which creates tight coupling between business logic and data persistence.

The refactoring will create a new `PropertyRepository` class and extend the existing `TenantRepository` class with additional methods needed by the property manager. The property manager will then be updated to use these repository methods instead of direct Mongoose calls. This follows the same pattern successfully implemented for the realm manager and authenticator service.

## Architecture

### Current Architecture

```
┌─────────────────────────────────┐
│  API Service                    │
│  (services/api)                 │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Property Manager         │ │
│  │  propertymanager.js       │ │
│  │                           │ │
│  │  Direct Mongoose Calls:   │ │
│  │  new Collections.         │ │
│  │    Property()             │ │
│  │  Collections.Property.    │ │
│  │    findOneAndUpdate()     │ │
│  │  Collections.Property.    │ │
│  │    deleteMany()           │ │
│  │  Collections.Tenant.      │ │
│  │    find()                 │ │
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
│  │  - Property Model         │ │
│  │  - Tenant Model           │ │
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
│  │  Property Manager         │ │
│  │  propertymanager.js       │ │
│  │                           │ │
│  │  Repository Calls:        │ │
│  │  propertyRepository.      │ │
│  │    create()               │ │
│  │  propertyRepository.      │ │
│  │    update()               │ │
│  │  propertyRepository.      │ │
│  │    delete()               │ │
│  │  tenantRepository.        │ │
│  │    findByPropertyIds()    │ │
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
│  │  - PropertyRepository     │ │
│  │    (new)                  │ │
│  │  - TenantRepository       │ │
│  │    (extended)             │ │
│  └───────────────────────────┘ │
│         │                       │
│         │ Internal Use          │
│         ▼                       │
│  ┌───────────────────────────┐ │
│  │  Collections              │ │
│  │  - Property Model         │ │
│  │  - Tenant Model           │ │
│  │  (Mongoose Models)        │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### Key Architectural Decisions

1. **Create New PropertyRepository**: Create a new repository class for property operations
2. **Extend TenantRepository**: Add `findByPropertyIds()` method to existing TenantRepository
3. **Plain Objects**: Repositories return plain JavaScript objects (using `.lean()` or `.toObject()`) to avoid leaking Mongoose abstractions
4. **Realm-Scoped Operations**: All repository methods filter by realmId to ensure multi-tenancy
5. **Backward Compatibility**: Existing Collections exports remain unchanged, allowing other managers to continue using direct Mongoose calls
6. **No Business Logic in Repositories**: Data transformation (FD.toProperty) remains in the property manager

## Components and Interfaces

### PropertyRepository Interface

```typescript
export class PropertyRepository {
  /**
   * Create a new property
   * @param propertyData - Property creation data (must include realmId)
   * @returns Created property object
   */
  async create(propertyData: Partial<Property>): Promise<Property>;

  /**
   * Update an existing property
   * @param propertyId - Property ID to update
   * @param realmId - Realm ID for security filtering
   * @param updateData - Data to update
   * @returns Updated property object or null if not found
   */
  async update(
    propertyId: string,
    realmId: string,
    updateData: Partial<Property>
  ): Promise<Property | null>;

  /**
   * Delete properties by IDs
   * @param propertyIds - Array of property IDs to delete
   * @param realmId - Realm ID for security filtering
   * @returns Number of properties deleted
   */
  async delete(propertyIds: string[], realmId: string): Promise<number>;

  /**
   * Find a property by ID
   * @param propertyId - Property ID
   * @param realmId - Realm ID for security filtering
   * @returns Property object or null if not found
   */
  async findById(propertyId: string, realmId: string): Promise<Property | null>;

  /**
   * Find all properties in a realm
   * @param realmId - Realm ID
   * @returns Array of property objects sorted by name ascending
   */
  async findAll(realmId: string): Promise<Property[]>;
}
```

### Extended TenantRepository Interface

```typescript
export class TenantRepository {
  // Existing methods
  async findByContactEmail(email: string): Promise<Tenant[]>;
  async findById(id: string): Promise<Tenant | null>;
  async find(filter, options?): Promise<Tenant[]>;
  async findOne(filter): Promise<Tenant | null>;
  async findOneAndUpdate(filter, update, options?): Promise<Tenant | null>;

  // New method for property manager
  
  /**
   * Find tenants by property IDs
   * 
   * Returns all tenants that have any of the specified property IDs
   * in their properties array.
   * 
   * @param propertyIds - Array of property IDs to search for
   * @param realmId - Realm ID for security filtering
   * @returns Array of tenant objects
   */
  async findByPropertyIds(propertyIds: string[], realmId: string): Promise<Tenant[]>;
}
```

## Data Models

The repositories use existing Mongoose models internally but return plain JavaScript objects.

### Property Type

```typescript
interface Property {
  _id?: string;
  realmId: string;
  type: string;
  name: string;
  description: string;
  surface: number;
  phone: string;
  digicode: string;
  address: {
    street1: string;
    street2: string;
    zipCode: string;
    city: string;
    state: string;
    country: string;
  };
  price: number;
}
```

### Tenant Type (Relevant Fields)

```typescript
interface Tenant {
  _id?: string;
  realmId: string;
  name: string;
  properties: Array<{
    propertyId: string;
    // ... other property-specific fields
  }>;
  entryDate: Date;
  exitDate: Date;
  terminationDate?: Date;
  endDate: Date;
  // ... other fields
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Plain object returns

*For any* PropertyRepository method that returns data, the returned object should be a plain JavaScript object without Mongoose-specific methods (such as `.save()`, `.$isNew`, `.toObject()`)
**Validates: Requirements 2.1**

### Property 2: RealmId persistence

*For any* property data with a realmId, calling `PropertyRepository.create(propertyData)` should persist the property such that retrieving it returns the same realmId
**Validates: Requirements 3.1**

### Property 3: Realm-scoped update security

*For any* property in realm A, attempting to update it using `PropertyRepository.update()` with realm B's ID should return null or fail to update the property
**Validates: Requirements 3.2**

### Property 4: Realm-scoped delete security

*For any* property in realm A, attempting to delete it using `PropertyRepository.delete()` with realm B's ID should not delete the property
**Validates: Requirements 3.3**

### Property 5: Realm-scoped query security

*For any* property in realm A, attempting to find it using `PropertyRepository.findById()` with realm B's ID should return null
**Validates: Requirements 3.4**

### Property 6: FindAll sorting

*For any* realm with multiple properties, calling `PropertyRepository.findAll(realmId)` should return properties sorted by name in ascending order
**Validates: Requirements 3.5**

### Property 7: Tenant property filtering

*For any* set of tenants with different property IDs, calling `TenantRepository.findByPropertyIds(propertyIds, realmId)` should return only tenants that have at least one of the specified property IDs in their properties array
**Validates: Requirements 4.2**

### Property 8: Tenant realm filtering

*For any* tenants in different realms, calling `TenantRepository.findByPropertyIds(propertyIds, realmId)` should return only tenants from the specified realm
**Validates: Requirements 4.3**

### Property 9: Tenant sorting by date

*For any* set of tenants associated with a property, sorting them by termination date or end date should result in descending order (most recent first)
**Validates: Requirements 6.4**

### Property 10: Invalid input error handling

*For any* PropertyRepository method, when called with invalid input (null, undefined, wrong type), the method should throw an Error with a descriptive message
**Validates: Requirements 7.1**

## Error Handling

### Repository Error Patterns

Repositories handle errors consistently:

1. **Not Found**: Methods that query return `null` when no matching document is found (not an error)
2. **Empty Results**: Methods that query multiple documents return empty array `[]` when no matches found
3. **Invalid Input**: Methods throw `Error` with descriptive message for invalid input (e.g., empty ID, invalid data)
4. **Database Errors**: Methods propagate Mongoose/MongoDB errors to the caller for handling at the service layer
5. **Validation Errors**: Mongoose validation errors are propagated as-is to maintain existing error handling behavior

### Example Error Handling

```typescript
// In PropertyRepository
async create(propertyData: Partial<Property>): Promise<Property> {
  if (!propertyData || typeof propertyData !== 'object') {
    throw new Error('Property data must be an object');
  }
  if (!propertyData.realmId) {
    throw new Error('Property data must include realmId');
  }
  
  try {
    const doc = await PropertyModel.create(propertyData);
    return doc.toObject();
  } catch (error) {
    // Propagate database/validation errors
    throw error;
  }
}

async findById(propertyId: string, realmId: string): Promise<Property | null> {
  if (!propertyId || typeof propertyId !== 'string') {
    throw new Error('Property ID must be a non-empty string');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const property = await PropertyModel.findOne({
    _id: propertyId,
    realmId: realmId
  }).lean();
  
  return property; // Returns null if not found
}
```

### Property Manager Error Handling

The property manager continues to use its existing error handling patterns:

```javascript
// Existing pattern in property manager
try {
  const property = await propertyRepository.create({
    ...req.body,
    realmId: realm._id
  });
  const properties = await _toPropertiesData(realm, [property]);
  res.json(properties[0]);
} catch (error) {
  // Database errors from repository
  throw error;
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify repository method behaviors:

1. **PropertyRepository Method Tests**
   - Test `create()` with valid property data
   - Test `update()` with existing property
   - Test `delete()` with property IDs
   - Test `findById()` with various filters
   - Test `findAll()` returns sorted properties
   - Test that plain objects are returned (no Mongoose methods)
   - Test error handling for invalid inputs
   - Test realm-scoped security (can't access other realm's properties)

2. **TenantRepository Method Tests**
   - Test `findByPropertyIds()` returns matching tenants
   - Test realm filtering works correctly
   - Test that plain objects are returned
   - Test empty results when no matches

3. **Property Manager Integration Tests**
   - Test `add()` endpoint creates property and returns transformed data
   - Test `update()` endpoint updates property and returns transformed data
   - Test `remove()` endpoint deletes properties
   - Test `all()` endpoint returns all properties with tenant data
   - Test `one()` endpoint returns single property with tenant data

### Property-Based Testing

Property-based tests will verify universal properties using **fast-check**:

1. **Plain Object Property**
   - Generate random property data
   - Call repository methods
   - Verify all returned objects are plain (no Mongoose methods)
   - Run 100+ iterations

2. **Round-trip Property**
   - Generate random property data
   - Create property via repository
   - Retrieve property by ID
   - Verify retrieved data matches created data
   - Run 100+ iterations

3. **Realm Security Property**
   - Generate random property data for realm A
   - Create property via repository
   - Try to access with realm B's ID
   - Verify access is denied (returns null)
   - Run 100+ iterations

4. **Sorting Property**
   - Generate random properties with different names
   - Create all properties in same realm
   - Call findAll
   - Verify results are sorted by name ascending
   - Run 100+ iterations

5. **Tenant Filtering Property**
   - Generate random tenants with different property IDs
   - Create tenants via repository
   - Call findByPropertyIds with subset of IDs
   - Verify only matching tenants are returned
   - Run 100+ iterations

### Test Configuration

- Property-based tests will run a minimum of 100 iterations per property
- Each property-based test will be tagged with a comment referencing the design document property
- Tag format: `// Feature: api-property-data-access-layer, Property X: [property text]`
- Tests will use the existing Vitest framework configured in services/common

## Implementation Notes

### PropertyRepository Implementation Strategy

#### For Queries (findById, findAll)

Use `.lean()` to return plain objects:

```typescript
async findById(propertyId: string, realmId: string): Promise<Property | null> {
  if (!propertyId || typeof propertyId !== 'string') {
    throw new Error('Property ID must be a non-empty string');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const property = await PropertyModel.findOne({
    _id: propertyId,
    realmId: realmId
  }).lean();
  
  return property;
}

async findAll(realmId: string): Promise<Property[]> {
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const properties = await PropertyModel.find({ realmId })
    .sort({ name: 1 })
    .lean();
  
  return properties;
}
```

#### For Creates

Use `.create()` then convert to plain object:

```typescript
async create(propertyData: Partial<Property>): Promise<Property> {
  if (!propertyData || typeof propertyData !== 'object') {
    throw new Error('Property data must be an object');
  }
  if (!propertyData.realmId) {
    throw new Error('Property data must include realmId');
  }
  
  const doc = await PropertyModel.create(propertyData);
  return doc.toObject();
}
```

#### For Updates

Use `findOneAndUpdate()` with `new: true` and `.lean()`:

```typescript
async update(
  propertyId: string,
  realmId: string,
  updateData: Partial<Property>
): Promise<Property | null> {
  if (!propertyId || typeof propertyId !== 'string') {
    throw new Error('Property ID must be a non-empty string');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  if (!updateData || typeof updateData !== 'object') {
    throw new Error('Update data must be an object');
  }
  
  const property = await PropertyModel.findOneAndUpdate(
    { _id: propertyId, realmId: realmId },
    updateData,
    { new: true, lean: true }
  );
  
  return property;
}
```

**Note**: Unlike RealmRepository, PropertyRepository doesn't need to use `.save()` because the Property model has no pre-save hooks that need to be triggered.

#### For Deletes

Use `deleteMany()` and return count:

```typescript
async delete(propertyIds: string[], realmId: string): Promise<number> {
  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    throw new Error('Property IDs must be a non-empty array');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const result = await PropertyModel.deleteMany({
    _id: { $in: propertyIds },
    realmId: realmId
  });
  
  return result.deletedCount || 0;
}
```

### TenantRepository Extension Strategy

Add the `findByPropertyIds()` method to the existing TenantRepository:

```typescript
async findByPropertyIds(propertyIds: string[], realmId: string): Promise<Tenant[]> {
  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    throw new Error('Property IDs must be a non-empty array');
  }
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const tenants = await TenantModel.find({
    realmId: realmId,
    'properties.propertyId': {
      $in: propertyIds
    }
  }).lean();
  
  return tenants;
}
```

### Property Manager Refactoring Strategy

The refactoring will happen in phases:

1. **Phase 1**: Create PropertyRepository class
2. **Phase 2**: Extend TenantRepository with findByPropertyIds method
3. **Phase 3**: Add PropertyRepository to DataAccess exports
4. **Phase 4**: Add unit tests for PropertyRepository methods
5. **Phase 5**: Add unit tests for TenantRepository.findByPropertyIds
6. **Phase 6**: Add property-based tests for repositories
7. **Phase 7**: Refactor property manager to use repositories
8. **Phase 8**: Run integration tests to verify behavior unchanged
9. **Phase 9**: Remove Collections imports from property manager

### Property Manager Business Logic Preservation

The following business logic remains in the property manager (not moved to repositories):

1. **Data Transformation**
   - `_toPropertiesData()` - transforms properties with tenant data
   - `FD.toProperty()` - formats property data for API responses

2. **Tenant Sorting**
   - Sorting tenants by termination date or end date in descending order
   - Selecting the most recent tenant for display

3. **Response Formatting**
   - Combining property data with tenant data
   - Returning transformed data to API clients

### Backward Compatibility

To maintain backward compatibility:

1. Collections namespace remains exported from services/common
2. Other managers (realm, lease, occupant, etc.) continue using Collections directly
3. Both Collections and DataAccess are exported from common package index
4. Future manager refactorings can use the same pattern
5. Gradual migration of other managers can happen independently

### Export Structure

The export structure will be extended:

```typescript
// services/common/src/dataAccess/index.ts
import AccountRepository from './AccountRepository.js';
import TenantRepository from './TenantRepository.js';
import RealmRepository from './RealmRepository.js';
import PropertyRepository from './PropertyRepository.js'; // NEW

// Singleton instances
let accountRepositoryInstance: AccountRepository | null = null;
let tenantRepositoryInstance: TenantRepository | null = null;
let realmRepositoryInstance: RealmRepository | null = null;
let propertyRepositoryInstance: PropertyRepository | null = null; // NEW

export function getAccountRepository(): AccountRepository { /* ... */ }
export function getTenantRepository(): TenantRepository { /* ... */ }
export function getRealmRepository(): RealmRepository { /* ... */ }

// NEW
export function getPropertyRepository(): PropertyRepository {
  if (!propertyRepositoryInstance) {
    propertyRepositoryInstance = new PropertyRepository();
  }
  return propertyRepositoryInstance;
}
```

### Usage Examples

**Before (Direct Mongoose):**
```javascript
import { Collections } from '@microrealestate/common';

// Create
const property = new Collections.Property({
  ...req.body,
  realmId: realm._id
});
await property.save();

// Update
const dbProperty = await Collections.Property.findOneAndUpdate(
  { realmId: realm._id, _id: property._id },
  property,
  { new: true }
).lean();

// Delete
await Collections.Property.deleteMany({
  _id: { $in: ids },
  realmId: realm._id
});

// Query one
const dbProperty = await Collections.Property.findOne({
  _id: tenantId,
  realmId: realm._id
}).lean();

// Query all
const dbProperties = await Collections.Property.find({
  realmId: realm._id
})
  .sort({ name: 1 })
  .lean();

// Query tenants
const allTenants = await Collections.Tenant.find({
  realmId: realm._id,
  'properties.propertyId': {
    $in: inputProperties.map(({ _id }) => _id)
  }
}).lean();
```

**After (Repository):**
```javascript
import { DataAccess } from '@microrealestate/common';

const propertyRepository = DataAccess.getPropertyRepository();
const tenantRepository = DataAccess.getTenantRepository();

// Create
const property = await propertyRepository.create({
  ...req.body,
  realmId: realm._id
});

// Update
const dbProperty = await propertyRepository.update(
  property._id,
  realm._id,
  property
);

// Delete
await propertyRepository.delete(ids, realm._id);

// Query one
const dbProperty = await propertyRepository.findById(
  tenantId,
  realm._id
);

// Query all
const dbProperties = await propertyRepository.findAll(realm._id);

// Query tenants
const allTenants = await tenantRepository.findByPropertyIds(
  inputProperties.map(({ _id }) => _id),
  realm._id
);
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

### Update Performance

The `update()` method uses `findOneAndUpdate()` which is efficient:
1. Single atomic database operation
2. No need to hydrate full document
3. Returns updated document directly

### No Performance Regression

The refactoring should not significantly impact performance:

1. Same Mongoose queries under the hood
2. `.lean()` is actually faster than returning full documents
3. No additional network calls or processing
4. Tenant query remains the same (single query with $in operator)

## Security Considerations

### Realm-Scoped Operations

All repository operations are scoped by realmId:

1. **Create**: RealmId is required and stored with property
2. **Update**: Both propertyId and realmId must match
3. **Delete**: Both propertyIds and realmId must match
4. **Query**: All queries filter by realmId

This ensures multi-tenancy security - users can only access properties in their own realm.

### No New Security Risks

The refactoring introduces no new security risks:

1. Same validation logic (in property manager)
2. Same query patterns (Mongoose queries with realm filtering)
3. No exposure of sensitive data in plain objects
4. Maintains existing authorization checks in middleware

## Migration Path for Other Managers

If this refactoring is successful, other managers can follow the same pattern:

1. **Lease Manager** - create LeaseRepository and TemplateRepository
2. **Occupant Manager** - extend TenantRepository and create DocumentRepository
3. **Rent Manager** - extend TenantRepository with aggregation methods
4. **Accounting Manager** - extend TenantRepository with aggregation methods

Each manager can be refactored independently without affecting others.
