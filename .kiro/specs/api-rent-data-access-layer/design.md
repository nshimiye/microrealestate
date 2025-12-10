# Design Document

## Overview

This design document outlines the technical approach for refactoring the API service's rent manager (`services/api/src/managers/rentmanager.js`) to use the existing data access layer in the `services/common` package. The rent manager currently uses direct Mongoose model calls (`Collections.Tenant`) which creates tight coupling between business logic and data persistence.

The refactoring will extend the existing `TenantRepository` class with additional methods needed by the rent manager, then update the rent manager to use these repository methods instead of direct Mongoose calls. This follows the same pattern successfully implemented for the realm manager refactoring.

This continues the data access layer refactoring initiative across the API service managers, improving maintainability, testability, and separation of concerns.

## Architecture

### Current Architecture

```
┌─────────────────────────────────┐
│  API Service                    │
│  (services/api)                 │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Rent Manager             │ │
│  │  rentmanager.js           │ │
│  │                           │ │
│  │  Direct Mongoose Calls:   │ │
│  │  Collections.Tenant.      │ │
│  │    find()                 │ │
│  │  Collections.Tenant.      │ │
│  │    findOne()              │ │
│  │  Collections.Tenant.      │ │
│  │    findOneAndUpdate()     │ │
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
│  │  Rent Manager             │ │
│  │  rentmanager.js           │ │
│  │                           │ │
│  │  Repository Calls:        │ │
│  │  tenantRepository.find()  │ │
│  │  tenantRepository.        │ │
│  │    findOne()              │ │
│  │  tenantRepository.        │ │
│  │    findOneAndUpdate()     │ │
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
│  │  - TenantRepository       │ │
│  │    (extended)             │ │
│  └───────────────────────────┘ │
│         │                       │
│         │ Internal Use          │
│         ▼                       │
│  ┌───────────────────────────┐ │
│  │  Collections              │ │
│  │  - Tenant Model           │ │
│  │  (Mongoose Models)        │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### Key Architectural Decisions

1. **Extend Existing Repository**: Add methods to existing `TenantRepository` rather than creating a new one
2. **Plain Objects**: Repository returns plain JavaScript objects (using `.lean()`) to avoid leaking Mongoose abstractions
3. **Complex Query Support**: Repository supports MongoDB query operators ($and, $gte, $lte) for term-based filtering
4. **Atomic Updates**: Use `findOneAndUpdate()` for atomic rent payment updates
5. **Backward Compatibility**: Existing Collections exports remain unchanged, allowing other managers to continue using direct Mongoose calls
6. **No Business Logic in Repository**: Rent calculations, email integration, and data transformations remain in the rent manager

## Components and Interfaces

### Extended TenantRepository Interface

```typescript
export class TenantRepository {
  // Existing methods
  async findByContactEmail(email: string): Promise<Tenant[]>;
  async findById(id: string): Promise<Tenant | null>;

  // New methods for rent manager
  
  /**
   * Find multiple tenants with filtering and sorting
   * 
   * Supports filtering by:
   * - realmId (required)
   * - tenantId (optional)
   * - startTerm and endTerm for rent term ranges (optional)
   * - Sorting by name in ascending or descending order
   * 
   * @param filter - Tenant query filter
   * @param filter.realmId - Organization/realm ID (required)
   * @param filter.tenantId - Specific tenant ID (optional)
   * @param filter.startTerm - Start of rent term range in YYYYMMDDHH format (optional)
   * @param filter.endTerm - End of rent term range in YYYYMMDDHH format (optional)
   * @param options - Query options
   * @param options.sort - Sort configuration
   * @param options.sort.name - Sort by name: 'asc' for ascending, 'desc' for descending
   * @returns Array of tenant objects
   * 
   * @example
   * ```typescript
   * // Find all tenants in a realm, sorted by name ascending
   * const tenants = await tenantRepository.find(
   *   { realmId: '507f1f77bcf86cd799439011' },
   *   { sort: { name: 'asc' } }
   * );
   * 
   * // Find tenants with rents in a specific term range
   * const tenants = await tenantRepository.find(
   *   {
   *     realmId: '507f1f77bcf86cd799439011',
   *     startTerm: 2024010100,
   *     endTerm: 2024123100
   *   },
   *   { sort: { name: 'asc' } }
   * );
   * 
   * // Find a specific tenant (no sorting needed)
   * const tenants = await tenantRepository.find(
   *   {
   *     realmId: '507f1f77bcf86cd799439011',
   *     tenantId: '507f1f77bcf86cd799439012'
   *   }
   * );
   * ```
   */
  async find(
    filter: {
      realmId: string;
      tenantId?: string;
      startTerm?: number;
      endTerm?: number;
    },
    options?: { sort?: { name?: 'asc' | 'desc' } }
  ): Promise<Tenant[]>;

  /**
   * Find a single tenant by ID and realm
   * 
   * @param filter - Tenant query filter
   * @param filter.tenantId - Tenant ID (required)
   * @param filter.realmId - Organization/realm ID (required)
   * @returns Tenant object or null if not found
   * 
   * @example
   * ```typescript
   * const tenant = await tenantRepository.findOne({
   *   tenantId: '507f1f77bcf86cd799439011',
   *   realmId: '507f1f77bcf86cd799439012'
   * });
   * ```
   */
  async findOne(filter: {
    tenantId: string;
    realmId: string;
  }): Promise<Tenant | null>;

  /**
   * Find and update a tenant atomically
   * 
   * This method performs an atomic update and returns the updated document.
   * Used for updating tenant rent arrays after payment processing.
   * 
   * @param filter - Tenant query filter
   * @param filter.tenantId - Tenant ID (required)
   * @param filter.realmId - Organization/realm ID (required)
   * @param update - Update data (partial tenant object)
   * @param options - Update options
   * @param options.returnUpdated - If true, return the updated document; if false, return the original
   * @returns Updated tenant object or null if not found
   * 
   * @example
   * ```typescript
   * const updated = await tenantRepository.findOneAndUpdate(
   *   {
   *     tenantId: '507f1f77bcf86cd799439011',
   *     realmId: '507f1f77bcf86cd799439012'
   *   },
   *   { rents: updatedRents },
   *   { returnUpdated: true }
   * );
   * ```
   */
  async findOneAndUpdate(
    filter: {
      tenantId: string;
      realmId: string;
    },
    update: Partial<Tenant>,
    options?: { returnUpdated?: boolean }
  ): Promise<Tenant | null>;
}
```

## Data Models

The repository uses existing Mongoose models internally but returns plain JavaScript objects.

### Tenant Type

```typescript
interface Tenant {
  _id?: string;
  realmId: string;
  name: string;
  isCompany?: boolean;
  companyInfo?: {
    name: string;
    legalStructure: string;
    legalRepresentative: string;
    capital: number;
    ein: string;
    dos: string;
    vatNumber: string;
  };
  manager?: string;
  contacts?: Array<{
    name: string;
    email: string;
    phone1: string;
    phone2: string;
  }>;
  addresses?: Array<{
    street1: string;
    street2: string;
    zipCode: string;
    city: string;
    state: string;
    country: string;
  }>;
  contract?: string;
  beginDate: string;
  endDate: string;
  terminationDate?: string;
  properties: Array<{
    propertyId: string;
    entryDate: string;
    exitDate: string;
    rent: number;
    expenses: Array<{
      title: string;
      amount: number;
    }>;
  }>;
  rents: Array<{
    term: number;  // YYYYMMDDHH format
    month: number;
    year: number;
    payment: number;
    promo: number;
    extracharge: number;
    notepromo: string;
    noteextracharge: string;
    description: string;
    totalAmount: number;
    totalWithoutBalanceAmount: number;
    totalToPay: number;
    newBalance: number;
    payments: Array<{
      date: string;
      amount: number;
      type: string;
      reference: string;
      description: string;
    }>;
    debts: Array<{
      description: string;
      amount: number;
    }>;
    discounts: Array<{
      origin: string;
      description: string;
      amount: number;
    }>;
  }>;
  discount?: number;
  vatRatio?: number;
  frequency?: string;  // 'months', 'quarters', 'years'
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Plain object returns

*For any* TenantRepository method that returns data, the returned object should be a plain JavaScript object without Mongoose-specific methods (such as `.save()`, `.$isNew`, `.toObject()`)
**Validates: Requirements 1.2, 2.4, 5.4**

### Property 2: Sorting correctness

*For any* set of tenants and sort criteria, calling `TenantRepository.find(filter, { sort })` should return tenants ordered according to the sort criteria
**Validates: Requirements 2.5, 7.5**

### Property 3: Realm filtering

*For any* realmId and set of tenants, calling `TenantRepository.find({ realmId })` should return only tenants where tenant.realmId equals the specified realmId
**Validates: Requirements 3.1**

### Property 4: Tenant ID filtering

*For any* tenant _id and set of tenants, calling `TenantRepository.find({ _id })` should return only the tenant with that specific _id
**Validates: Requirements 3.2**

### Property 5: Term range filtering

*For any* startTerm and endTerm, calling `TenantRepository.find()` with `{ 'rents.term': { $gte: startTerm, $lte: endTerm } }` should return only tenants that have at least one rent with term in that range
**Validates: Requirements 3.3, 7.1, 7.3**

### Property 6: Single term filtering

*For any* term value, calling `TenantRepository.find()` with `{ 'rents.term': term }` should return only tenants that have at least one rent with that exact term
**Validates: Requirements 3.4, 7.2**

### Property 7: Multiple filter combination

*For any* set of filters, calling `TenantRepository.find({ $and: [filter1, filter2, ...] })` should return only tenants matching all filters
**Validates: Requirements 3.5**

### Property 8: Atomic update persistence

*For any* existing tenant and update data, calling `TenantRepository.findOneAndUpdate(filter, update, { new: true })` should persist the changes such that subsequent queries return the updated data
**Validates: Requirements 5.1, 5.2**

### Property 9: Nested array update support

*For any* tenant with rents array and new rents data, calling `TenantRepository.findOneAndUpdate()` with `{ rents: newRents }` should update the entire rents array
**Validates: Requirements 5.3**

### Property 10: Error propagation

*For any* repository method, when an error condition occurs (invalid input, database error), the method should throw an error that can be caught by the caller
**Validates: Requirements 5.5**

### Property 11: ID string conversion

*For any* tenant retrieved from the repository, the _id field should be convertible to string format
**Validates: Requirements 7.4**

### Property 12: Invalid promo normalization

*For any* payment data where promo is null, undefined, or <= 0, the rent manager should normalize promo to 0 and clear notepromo
**Validates: Requirements 12.3**

## Error Handling

### Repository Error Patterns

Repositories handle errors consistently:

1. **Not Found**: Methods that query return `null` or empty array when no matching documents are found (not an error)
2. **Invalid Input**: Methods throw `Error` with descriptive message for invalid input (e.g., empty filter, invalid data)
3. **Database Errors**: Methods propagate Mongoose/MongoDB errors to the caller for handling at the service layer
4. **Validation Errors**: Mongoose validation errors are propagated as-is to maintain existing error handling behavior

### Example Error Handling

```typescript
// In repository
async findOne(filter: {
  tenantId: string;
  realmId: string;
}): Promise<Tenant | null> {
  if (!filter?.tenantId || typeof filter.tenantId !== 'string') {
    throw new Error('tenantId is required and must be a string');
  }
  if (!filter?.realmId || typeof filter.realmId !== 'string') {
    throw new Error('realmId is required and must be a string');
  }
  
  try {
    const tenant = await TenantModel.findOne({
      _id: filter.tenantId,
      realmId: filter.realmId
    }).lean();
    return tenant;
  } catch (error) {
    // Propagate database errors
    throw error;
  }
}
```

### Rent Manager Error Handling

The rent manager continues to use its existing error handling patterns:

```javascript
// Existing pattern in rent manager
const dbOccupants = await _findOccupants(realm, tenantId, Number(term));

if (!dbOccupants.length) {
  throw new ServiceError('tenant not found', 404);
}

const dbOccupant = dbOccupants[0];

if (!dbOccupant.rents.length) {
  throw new ServiceError('rent not found', 404);
}
```

### Email Service Error Handling

Email service errors are handled gracefully:

```javascript
// Demo mode fallback
try {
  const emailStatus = await _getEmailStatus(...);
  return emailStatus;
} catch (error) {
  logger.error(error);
  if (DEMO_MODE) {
    logger.info('email status fallback workflow activated in demo mode');
    return {};
  } else {
    throw error.data;
  }
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify repository method behaviors:

1. **TenantRepository Method Tests**
   - Test `find()` with various filters (realmId, _id, term ranges)
   - Test `find()` with sort options
   - Test `findOne()` with various filters
   - Test `findOneAndUpdate()` with rent array updates
   - Test that plain objects are returned (no Mongoose methods)
   - Test error handling for invalid inputs

2. **Query Filter Tests**
   - Test realm filtering returns only matching tenants
   - Test tenant ID filtering returns specific tenant
   - Test term range filtering with $gte and $lte
   - Test single term exact match filtering
   - Test combined filters with $and operator

3. **Update Tests**
   - Test atomic updates persist correctly
   - Test `{ new: true }` option returns updated document
   - Test nested rent array updates work correctly
   - Test update returns plain object

### Property-Based Testing

Property-based tests will verify universal properties using **fast-check**:

1. **Plain Object Property**
   - Generate random tenant data
   - Call repository methods (find, findOne, findOneAndUpdate)
   - Verify all returned objects are plain (no Mongoose methods)
   - Run 100+ iterations

2. **Sorting Property**
   - Generate random array of tenants with various names
   - Insert tenants into database
   - Query with sort: { name: 1 }
   - Verify results are sorted in ascending order
   - Run 100+ iterations

3. **Realm Filtering Property**
   - Generate random tenants with different realmIds
   - Insert tenants into database
   - Query by specific realmId
   - Verify all returned tenants have that realmId
   - Run 100+ iterations

4. **Term Range Filtering Property**
   - Generate random tenants with various rent terms
   - Insert tenants into database
   - Generate random startTerm and endTerm
   - Query with term range filter
   - Verify all returned tenants have at least one rent in range
   - Run 100+ iterations

5. **Update Persistence Property**
   - Generate random tenant data
   - Create tenant via repository
   - Generate random rent updates
   - Update tenant via findOneAndUpdate
   - Retrieve tenant and verify updates persisted
   - Run 100+ iterations

6. **ID String Conversion Property**
   - Generate random tenant data
   - Create tenant via repository
   - Retrieve tenant
   - Verify _id can be converted to string
   - Verify string conversion produces valid MongoDB ObjectId format
   - Run 100+ iterations

### Integration Testing

Integration tests will verify the rent manager works correctly with repositories:

1. **Find Occupants Flow**
   - Test `_findOccupants()` with various filters
   - Verify realm filtering works
   - Verify tenant ID filtering works
   - Verify term range filtering works
   - Verify sorting by name works
   - Verify _id is converted to string

2. **Update Rent Flow**
   - Test `_updateByTerm()` complete flow
   - Verify tenant is found correctly
   - Verify rent calculations work (Contract.payTerm)
   - Verify atomic update persists changes
   - Verify email status integration works
   - Verify response data transformation works

3. **Get Rents Data Flow**
   - Test `_getRentsDataByTerm()` complete flow
   - Verify tenants are filtered by term range
   - Verify rent overview calculations are correct
   - Verify email status is included
   - Verify data transformation works

4. **Error Handling Flows**
   - Test tenant not found returns 404
   - Test rent not found returns 404
   - Test invalid promo/extracharge normalization
   - Test email service fallback in demo mode
   - Test email service error propagation in production

### Test Configuration

- Property-based tests will run a minimum of 100 iterations per property
- Each property-based test will be tagged with a comment referencing the design document property
- Tag format: `// Feature: api-rent-data-access-layer, Property X: [property text]`
- Tests will use the existing Vitest framework configured in services/common and services/api

## Implementation Notes

### Repository Implementation Strategy

#### For Queries (find, findOne)

Use `.lean()` to return plain objects and build MongoDB queries from simple filters:

```typescript
async find(
  filter: {
    realmId: string;
    tenantId?: string;
    startTerm?: number;
    endTerm?: number;
  },
  options?: { sort?: { name?: 'asc' | 'desc' } }
): Promise<Tenant[]> {
  if (!filter?.realmId || typeof filter.realmId !== 'string') {
    throw new Error('realmId is required and must be a string');
  }

  // Build MongoDB query from simple filter
  const mongoQuery: any = {
    $and: [{ realmId: filter.realmId }]
  };

  if (filter.tenantId) {
    mongoQuery.$and.push({ _id: filter.tenantId });
  }

  if (filter.startTerm && filter.endTerm) {
    mongoQuery.$and.push({ 'rents.term': { $gte: filter.startTerm } });
    mongoQuery.$and.push({ 'rents.term': { $lte: filter.endTerm } });
  } else if (filter.startTerm) {
    mongoQuery.$and.push({ 'rents.term': filter.startTerm });
  }

  let query = TenantModel.find(mongoQuery);
  
  if (options?.sort?.name) {
    query = query.sort({ name: options.sort.name === 'asc' ? 1 : -1 });
  }
  
  const tenants = await query.lean();
  return tenants as Tenant[];
}

async findOne(filter: {
  tenantId: string;
  realmId: string;
}): Promise<Tenant | null> {
  if (!filter?.tenantId || typeof filter.tenantId !== 'string') {
    throw new Error('tenantId is required and must be a string');
  }
  if (!filter?.realmId || typeof filter.realmId !== 'string') {
    throw new Error('realmId is required and must be a string');
  }

  const tenant = await TenantModel.findOne({
    _id: filter.tenantId,
    realmId: filter.realmId
  }).lean();
  
  return tenant as Tenant | null;
}
```

#### For Atomic Updates (findOneAndUpdate)

Use `.lean()` with the update operation:

```typescript
async findOneAndUpdate(
  filter: {
    tenantId: string;
    realmId: string;
  },
  update: Partial<Tenant>,
  options?: { returnUpdated?: boolean }
): Promise<Tenant | null> {
  if (!filter?.tenantId || typeof filter.tenantId !== 'string') {
    throw new Error('tenantId is required and must be a string');
  }
  if (!filter?.realmId || typeof filter.realmId !== 'string') {
    throw new Error('realmId is required and must be a string');
  }
  if (!update || typeof update !== 'object') {
    throw new Error('Update must be an object');
  }

  const tenant = await TenantModel.findOneAndUpdate(
    { _id: filter.tenantId, realmId: filter.realmId },
    update,
    { new: options?.returnUpdated ?? false, lean: true }
  );
  
  return tenant as Tenant | null;
}
```

The `findOneAndUpdate()` method:
1. Performs atomic update (single database operation)
2. Returns updated document when `{ returnUpdated: true }` is specified
3. Returns plain object due to `lean: true` option
4. Returns null if no matching document found

### Rent Manager Refactoring Strategy

The refactoring will happen in phases:

1. **Phase 1**: Extend TenantRepository with new methods (find, findOne, findOneAndUpdate)
2. **Phase 2**: Add unit tests for new repository methods
3. **Phase 3**: Add property-based tests for new repository methods
4. **Phase 4**: Refactor `_findOccupants()` helper function to use repository
5. **Phase 5**: Refactor `_updateByTerm()` function to use repository
6. **Phase 6**: Run integration tests to verify behavior unchanged
7. **Phase 7**: Remove Collections imports from rent manager

### Handling Unrelated Issues

During refactoring, existing issues unrelated to the data access layer migration may be discovered:

- **Document, Don't Fix**: If an existing bug or issue is found that is unrelated to the refactoring work, document it in the `bugs/` folder with a clear description
- **Stay Focused**: Do not attempt to fix unrelated issues during this refactoring to maintain scope and reduce risk
- **Separate Concerns**: Unrelated issues should be addressed in separate pull requests/tasks after the refactoring is complete
- **Examples of Unrelated Issues**:
  - Business logic bugs in rent calculations
  - Incorrect email status handling
  - Missing validation in payment data
  - Issues with Contract.payTerm() calculations

This approach ensures the refactoring remains focused on its primary goal: isolating MongoDB/Mongoose logic from business logic.

### Rent Manager Business Logic Preservation

The following business logic remains in the rent manager (not moved to repositories):

1. **Rent Calculations**
   - `Contract.payTerm()` - calculates rent amounts with settlements
   - VAT adjustments for discounts and extra charges
   - Payment filtering and validation

2. **Data Filtering**
   - Post-query filtering of tenant.rents arrays by term
   - ID string conversion for response data
   - Rent term matching logic

3. **Overview Calculations**
   - Counting paid/unpaid/partially paid rents
   - Summing totalToPay, totalPaid, totalNotPaid
   - Rent status determination logic

4. **Email Integration**
   - Fetching email status from emailer service
   - Mapping email status by recordId and templateName
   - Error handling with demo mode fallback

5. **Data Transformation**
   - `FD.toRentData()` - transforms rent data for API response
   - `FD.toOccupantData()` - transforms occupant data for API response
   - Adding active flag to current term rent

6. **Input Normalization**
   - Defaulting invalid promo/extracharge to 0
   - Clearing notes when amounts are invalid
   - Building settlements object from payment data

### Simplified Query Building

The rent manager uses a simplified filter interface instead of MongoDB query syntax:

```javascript
// Before (in rent manager)
const filter = {
  $query: {
    $and: [{ realmId: realm._id }]
  }
};

if (tenantId) {
  filter['$query']['$and'].push({ _id: tenantId });
}

if (startTerm && endTerm) {
  filter['$query']['$and'].push({ 'rents.term': { $gte: startTerm } });
  filter['$query']['$and'].push({ 'rents.term': { $lte: endTerm } });
} else if (startTerm) {
  filter['$query']['$and'].push({ 'rents.term': startTerm });
}

const dbTenants = await Collections.Tenant.find(filter.$query)
  .sort({ name: 1 })
  .lean();
```

```javascript
// After (using repository)
const filter = {
  realmId: realm._id
};

if (tenantId) {
  filter.tenantId = tenantId;
}

if (startTerm && endTerm) {
  filter.startTerm = startTerm;
  filter.endTerm = endTerm;
} else if (startTerm) {
  filter.startTerm = startTerm;
}

const tenantRepository = DataAccess.getTenantRepository();
const dbTenants = await tenantRepository.find(filter, { sort: { name: 'asc' } });
```

The repository abstracts MongoDB query syntax, providing a cleaner interface that's easier to test and maintain.

### Backward Compatibility

To maintain backward compatibility:

1. Collections namespace remains exported from services/common
2. Other managers (property, lease, occupant, etc.) continue using Collections directly
3. Both Collections and DataAccess are exported from common package index
4. Future manager refactorings can use the same pattern
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

### Usage Examples

**Before (Direct Mongoose):**
```javascript
import { Collections } from '@microrealestate/common';

// Query with complex filter
const dbTenants = await Collections.Tenant.find({
  $and: [
    { realmId: realm._id },
    { 'rents.term': { $gte: startTerm } },
    { 'rents.term': { $lte: endTerm } }
  ]
})
  .sort({ name: 1 })
  .lean();

// Find one tenant
const occupant = await Collections.Tenant.findOne({
  _id: paymentData._id,
  realmId: realm._id
}).lean();

// Atomic update
const savedOccupant = await Collections.Tenant.findOneAndUpdate(
  { _id: occupant._id, realmId: realm._id },
  occupant,
  { new: true }
).lean();
```

**After (Repository):**
```javascript
import { DataAccess } from '@microrealestate/common';

const tenantRepository = DataAccess.getTenantRepository();

// Query with simplified filter
const dbTenants = await tenantRepository.find(
  {
    realmId: realm._id,
    startTerm: startTerm,
    endTerm: endTerm
  },
  { sort: { name: 'asc' } }
);

// Find one tenant
const occupant = await tenantRepository.findOne({
  tenantId: paymentData._id,
  realmId: realm._id
});

// Atomic update
const savedOccupant = await tenantRepository.findOneAndUpdate(
  {
    tenantId: occupant._id,
    realmId: realm._id
  },
  occupant,
  { returnUpdated: true }
);
```

## Dependencies

### Existing Dependencies

The extended repository uses existing dependencies from services/common:

- `mongoose@6.13.6` - MongoDB ODM
- `@microrealestate/types` - TypeScript type definitions

### Development Dependencies

- `vitest@2.1.0` - Unit testing framework
- `@vitest/coverage-v8@2.1.0` - Code coverage
- `fast-check@3.x` - Property-based testing library

### No New Runtime Dependencies

The implementation requires no new runtime dependencies. All functionality is built on existing packages.

## Performance Considerations

### Query Performance

Using `.lean()` for queries provides performance benefits:

1. **Faster**: Skips Mongoose document hydration
2. **Less Memory**: Plain objects are lighter than Mongoose documents
3. **Serialization**: Plain objects serialize to JSON faster

### Update Performance

The `findOneAndUpdate()` method is efficient:

1. **Atomic**: Single database operation (no race conditions)
2. **Efficient**: Updates and returns document in one round-trip
3. **Lean Option**: Returns plain object without hydration overhead

### No Performance Regression

The refactoring should not significantly impact performance:

1. Same Mongoose queries under the hood
2. `.lean()` is actually faster than returning full documents
3. `findOneAndUpdate()` is same as current implementation
4. No additional network calls or processing

### Query Optimization

The repository supports MongoDB query optimization:

1. Indexes on realmId and rents.term fields (existing)
2. Compound queries use $and for efficient filtering
3. Sorting happens at database level (not in application)
4. Projection can be added in future if needed

## Security Considerations

### Data Access Control

The rent manager continues to enforce access control:

1. Realm-based filtering ensures tenants are scoped to organization
2. User authentication happens in middleware (before manager)
3. Authorization checks remain in manager layer
4. Repository provides no additional access beyond what's requested

### No New Security Risks

The refactoring introduces no new security risks:

1. Same query patterns (Mongoose queries)
2. Same validation logic (in rent manager)
3. Same error handling patterns
4. No exposure of sensitive data in plain objects
5. Repository doesn't bypass any existing security checks

### Input Validation

Input validation remains in the rent manager:

1. Promo/extracharge normalization
2. Payment amount validation (must be > 0)
3. Term format validation (YYYYMMDDHH)
4. Realm and tenant ID validation

## Migration Path for Other Managers

If this refactoring is successful, other managers can follow the same pattern:

1. **Property Manager** - extend PropertyRepository with query methods
2. **Lease Manager** - extend LeaseRepository and TemplateRepository
3. **Occupant Manager** - extend TenantRepository with additional methods
4. **Accounting Manager** - extend TenantRepository with aggregation methods
5. **Document Manager** - extend DocumentRepository with query methods

Each manager can be refactored independently without affecting others.

## Related Refactorings

This refactoring builds on previous work:

1. **Realm Manager Refactoring** - established the repository pattern for API service
2. **Authenticator Refactoring** - established the repository pattern for services
3. **TenantRepository Creation** - created base repository with findByContactEmail and findById

Future refactorings will continue this pattern across all API service managers.
