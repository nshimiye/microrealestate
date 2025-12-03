# Design Document

## Overview

This design document outlines the technical approach for refactoring the API service's dashboard manager (`services/api/src/managers/dashboardmanager.js`) to use the existing data access layer in the `services/common` package. The dashboard manager currently uses direct Mongoose model calls (`Collections.Tenant.find()`, `Collections.Property.find().count()`) which creates tight coupling between business logic and data persistence.

The refactoring will extend the existing `TenantRepository` and `PropertyRepository` classes with additional methods needed by the dashboard manager, then update the dashboard manager to use these repository methods instead of direct Mongoose calls. This follows the same pattern successfully implemented for the realm manager and other managers in the API service.

The dashboard manager computes analytics and metrics for the landlord dashboard, including:
- Active tenant counts
- Property counts and occupancy rates
- Year-to-date revenues
- Top 5 unpaid tenants
- Monthly revenue trends

All business logic for computing these metrics will remain in the dashboard manager - only data access will be abstracted.

## Architecture

### Current Architecture

```
┌─────────────────────────────────┐
│  API Service                    │
│  (services/api)                 │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Dashboard Manager        │ │
│  │  dashboardmanager.js      │ │
│  │                           │ │
│  │  Direct Mongoose Calls:   │ │
│  │  Collections.Tenant.      │ │
│  │    find()                 │ │
│  │  Collections.Property.    │ │
│  │    find().count()         │ │
│  │                           │ │
│  │  Business Logic:          │ │
│  │  - Filter active tenants  │ │
│  │  - Compute occupancy      │ │
│  │  - Sum revenues           │ │
│  │  - Find top unpaid        │ │
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
│  │  - Property Model         │ │
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
│  │  Dashboard Manager        │ │
│  │  dashboardmanager.js      │ │
│  │                           │ │
│  │  Repository Calls:        │ │
│  │  tenantRepository.        │ │
│  │    findAll()              │ │
│  │  propertyRepository.      │ │
│  │    countByRealmId()       │ │
│  │                           │ │
│  │  Business Logic:          │ │
│  │  - Filter active tenants  │ │
│  │  - Compute occupancy      │ │
│  │  - Sum revenues           │ │
│  │  - Find top unpaid        │ │
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
│  │    (existing findAll)     │ │
│  │  - PropertyRepository     │ │
│  │    (add countByRealmId)   │ │
│  └───────────────────────────┘ │
│         │                       │
│         │ Internal Use          │
│         ▼                       │
│  ┌───────────────────────────┐ │
│  │  Collections              │ │
│  │  - Tenant Model           │ │
│  │  - Property Model         │ │
│  │  (Mongoose Models)        │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### Key Architectural Decisions

1. **Reuse Existing TenantRepository.findAll()**: The TenantRepository already has a `findAll(realmId)` method that returns all tenants for a realm
2. **Extend PropertyRepository**: Add `countByRealmId()` method for efficient property counting
3. **Plain Objects**: Repositories return plain JavaScript objects (using `.lean()`) to avoid leaking Mongoose abstractions
4. **Business Logic Stays in Manager**: All filtering, calculations, and aggregations remain in the dashboard manager
5. **Backward Compatibility**: Existing Collections exports remain unchanged, allowing other managers to continue using direct Mongoose calls
6. **No Data Transformation in Repositories**: Repositories return raw tenant/property data; dashboard manager performs all transformations

## Components and Interfaces

### TenantRepository Interface (Existing)

The TenantRepository already has the method we need:

```typescript
export class TenantRepository {
  // Existing method - already implemented
  /**
   * Find all tenants in a realm
   * 
   * Returns all tenants that belong to the specified realm.
   * 
   * @param realmId - Realm ID
   * @returns Array of tenant objects (may be empty if no matches found)
   * @throws Error if realmId is invalid
   */
  async findAll(realmId: string): Promise<Tenant[]>;
}
```

### Extended PropertyRepository Interface

```typescript
export class PropertyRepository {
  // Existing methods
  async create(propertyData: Partial<Property>): Promise<Property>;
  async update(propertyId: string, realmId: string, updateData: Partial<Property>): Promise<Property | null>;
  async delete(propertyIds: string[], realmId: string): Promise<number>;
  async findById(propertyId: string, realmId: string): Promise<Property | null>;
  async findAll(realmId: string): Promise<Property[]>;

  // New method for dashboard manager
  
  /**
   * Count properties in a realm
   * 
   * Returns the total number of properties belonging to the specified realm.
   * Uses efficient countDocuments() method for performance.
   * 
   * @param realmId - Realm ID
   * @returns Number of properties in the realm
   * @throws Error if realmId is invalid
   * 
   * @example
   * ```typescript
   * const count = await propertyRepository.countByRealmId('507f1f77bcf86cd799439011');
   * console.log(`Total properties: ${count}`);
   * ```
   */
  async countByRealmId(realmId: string): Promise<number>;
}
```

## Data Models

The repositories use existing Mongoose models internally but return plain JavaScript objects.

### Tenant Type (Relevant Fields for Dashboard)

```typescript
interface Tenant {
  _id: string;
  realmId: string;
  name: string;
  terminationDate?: Date;
  endDate: Date;
  properties: Array<{
    propertyId: string;
    entryDate: Date;
    exitDate: Date;
  }>;
  rents: Array<{
    term: number;  // Format: YYYYMMDDHH
    total: {
      payment: number;
      grandTotal: number;
    };
    payments: Array<{
      date: string;  // Format: DD/MM/YYYY
      amount: number;
    }>;
  }>;
}
```

### Property Type

```typescript
interface Property {
  _id: string;
  realmId: string;
  name: string;
  type: string;
  surface: number;
  price: number;
  // ... other fields
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: TenantRepository.findAll returns all tenants

*For any* realmId, calling `TenantRepository.findAll(realmId)` should return all tenants in that realm as plain JavaScript objects
**Validates: Requirements 1.1, 1.2**

### Property 2: PropertyRepository.countByRealmId returns correct count

*For any* realmId, calling `PropertyRepository.countByRealmId(realmId)` should return the exact number of properties in that realm
**Validates: Requirements 2.1, 2.2**

### Property 3: Active tenant filtering preserves logic

*For any* set of tenants and current date, filtering active tenants (terminationDate or endDate >= current date) should produce the same results before and after refactoring
**Validates: Requirements 6.1, 6.2**

### Property 4: Occupancy rate calculation preserves logic

*For any* set of active tenants and property count, computing occupancy rate (unique rented properties / total properties) should produce the same results before and after refactoring
**Validates: Requirements 7.1, 7.2**

### Property 5: Year revenue calculation preserves logic

*For any* set of tenants and year boundaries, summing all rent payments within the year should produce the same results before and after refactoring
**Validates: Requirements 8.1, 8.2**

### Property 6: Top unpaid calculation preserves logic

*For any* set of active tenants and current month, finding top 5 tenants with negative balance should produce the same results before and after refactoring
**Validates: Requirements 9.1, 9.2**

### Property 7: Monthly revenues calculation preserves logic

*For any* set of tenants and year, computing monthly paid/notPaid amounts should produce the same results before and after refactoring
**Validates: Requirements 10.1, 10.2**

### Property 8: Response structure preservation

*For any* dashboard request, the response structure (overview, topUnpaid, revenues) should match the existing API contract
**Validates: Requirements 11.1, 11.2**

## Error Handling

### Repository Error Patterns

Repositories handle errors consistently:

1. **Invalid Input**: Methods throw `Error` with descriptive message for invalid input (e.g., empty realmId)
2. **Database Errors**: Methods propagate Mongoose/MongoDB errors to the caller for handling at the service layer
3. **Empty Results**: Methods return empty arrays or 0 for count when no data exists (not an error)

### Example Error Handling

```typescript
// In PropertyRepository
async countByRealmId(realmId: string): Promise<number> {
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  try {
    const count = await PropertyModel.countDocuments({ realmId });
    return count;
  } catch (error) {
    // Propagate database errors
    throw error;
  }
}
```

### Dashboard Manager Error Handling

The dashboard manager continues to use its existing error handling patterns:

```javascript
// Existing pattern in dashboard manager
export async function all(req, res) {
  try {
    const tenantRepository = DataAccess.getTenantRepository();
    const propertyRepository = DataAccess.getPropertyRepository();
    
    const allTenants = await tenantRepository.findAll(req.headers.organizationid);
    const propertyCount = await propertyRepository.countByRealmId(req.headers.organizationid);
    
    // ... business logic ...
    
    res.json({ overview, topUnpaid, revenues });
  } catch (error) {
    // Error propagates to Express error handler
    throw error;
  }
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify repository method behaviors and dashboard manager business logic:

1. **PropertyRepository.countByRealmId Tests**
   - Test counting properties in a realm with multiple properties
   - Test counting properties in an empty realm (returns 0)
   - Test error handling for invalid realmId
   - Test that count matches actual number of properties

2. **Dashboard Manager Business Logic Tests**
   - Mock TenantRepository.findAll() and PropertyRepository.countByRealmId()
   - Test active tenant filtering with various date scenarios
   - Test occupancy rate calculation with different tenant/property combinations
   - Test year revenue calculation with various payment dates
   - Test top unpaid tenant sorting and filtering
   - Test monthly revenue aggregation and sorting
   - Test response structure with and without data

### Property-Based Testing

Property-based tests will verify universal properties using **fast-check**:

1. **Count Consistency Property**
   - Generate random realm data with properties
   - Call countByRealmId()
   - Call findAll() and count results
   - Verify counts match
   - Run 100+ iterations

2. **Active Tenant Filtering Property**
   - Generate random tenants with various dates
   - Generate random current date
   - Filter active tenants
   - Verify all returned tenants have terminationDate/endDate >= current date
   - Run 100+ iterations

3. **Occupancy Rate Bounds Property**
   - Generate random tenants and properties
   - Compute occupancy rate
   - Verify rate is between 0 and 1 (inclusive)
   - Verify rate is undefined when propertyCount is 0
   - Run 100+ iterations

4. **Revenue Calculation Property**
   - Generate random tenants with payments
   - Compute year revenues
   - Verify sum is non-negative
   - Verify only payments within year boundaries are included
   - Run 100+ iterations

5. **Top Unpaid Sorting Property**
   - Generate random tenants with balances
   - Compute top unpaid
   - Verify results are sorted by balance ascending
   - Verify all results have negative balance
   - Verify at most 5 results returned
   - Run 100+ iterations

### Integration Testing

Integration tests will verify the dashboard manager works correctly with repositories:

1. **Dashboard All Endpoint**
   - Test complete dashboard flow with real database
   - Verify overview metrics are computed correctly
   - Verify topUnpaid list is correct
   - Verify revenues array is correct
   - Test with empty database (returns null overview, empty arrays)

2. **Backward Compatibility**
   - Compare dashboard responses before and after refactoring
   - Verify identical JSON structure
   - Verify identical metric values

### Test Configuration

- Property-based tests will run a minimum of 100 iterations per property
- Each property-based test will be tagged with a comment referencing the design document property
- Tag format: `// Feature: api-dashboard-data-access-layer, Property X: [property text]`
- Tests will use the existing Vitest framework configured in services/common and services/api

## Implementation Notes

### Dashboard Manager Business Logic

The dashboard manager contains complex business logic that will remain unchanged:

#### 1. Active Tenant Filtering

```javascript
const activeTenants = allTenants.reduce((acc, tenant) => {
  const terminationMoment = tenant.terminationDate
    ? moment(tenant.terminationDate)
    : moment(tenant.endDate);

  if (terminationMoment.isSameOrAfter(now, 'day')) {
    acc.push(tenant);
  }

  return acc;
}, []);
```

This logic:
- Uses terminationDate if set, otherwise uses endDate
- Compares with current date using moment.js
- Filters tenants whose lease is still active

#### 2. Occupancy Rate Calculation

```javascript
let occupancyRate;
if (propertyCount > 0) {
  const countPropertyRented = activeTenants.reduce(
    (acc, { properties = [] }) => {
      properties.forEach(({ propertyId }) => acc.add(propertyId));
      return acc;
    },
    new Set()
  ).size;
  occupancyRate = countPropertyRented / propertyCount;
}
```

This logic:
- Uses Set to count unique properties rented by active tenants
- Divides by total property count
- Returns undefined if no properties exist

#### 3. Year Revenue Calculation

```javascript
totalYearRevenues = allTenants.reduce((total, { rents }) => {
  let sumPayments = 0;
  rents.forEach((rent) => {
    rent.payments.forEach((payment) => {
      if (!payment.date || payment.amount === 0) {
        return;
      }

      const paymentMoment = moment(payment.date, 'DD/MM/YYYY');
      if (
        paymentMoment.isBetween(beginOfTheYear, endOfTheYear, 'day', '[]')
      ) {
        sumPayments = sumPayments + payment.amount;
      }
    });
  });

  return total + sumPayments;
}, 0);
```

This logic:
- Iterates through all tenants' rents and payments
- Filters payments by date within current year
- Skips payments with no date or zero amount
- Sums all valid payments

#### 4. Top Unpaid Tenants

```javascript
const topUnpaid = activeTenants
  .reduce((acc, tenant) => {
    const currentRent = tenant.rents.find((rent) => {
      const termMoment = rent.term && moment(rent.term, 'YYYYMMDDHH');
      return (
        termMoment &&
        termMoment.isBetween(
          beginOfTheMonth,
          endOfTheMonth,
          'day',
          '[]'
        )
      );
    });
    if (currentRent) {
      acc.push({
        tenant: tenant.toObject(),
        balance:
          currentRent.total.payment - currentRent.total.grandTotal,
        rent: currentRent
      });
    }
    return acc;
  }, [])
  .sort((t1, t2) => t1.balance - t2.balance)
  .filter((t) => t.balance < 0)
  .slice(0, 5);
```

This logic:
- Finds current month rent for each active tenant
- Calculates balance (payment - grandTotal)
- Sorts by balance ascending (most negative first)
- Filters to only negative balances
- Takes top 5

**Note**: The code calls `tenant.toObject()` which is a Mongoose method. After refactoring, tenants will already be plain objects, so this call will need to be removed or handled gracefully.

#### 5. Monthly Revenues

```javascript
const emptyRevenues = moment.months().reduce((acc, month, index) => {
  const key = moment(`${index + 1}/${now.year()}`, 'MM/YYYYY').format(
    'MMYYYY'
  );
  acc[key] = {
    month: key,
    paid: 0,
    notPaid: 0
  };
  return acc;
}, {});

const revenues = Object.entries(
  allTenants.reduce((acc, { rents }) => {
    rents.forEach((rent) => {
      const termMoment = moment(rent.term, 'YYYYMMDDHH');
      if (!termMoment.isBetween(beginOfTheYear, endOfTheYear, 'day', '[]')) {
        return;
      }
      const key = termMoment.format('MMYYYY');
      const revenue = {
        month: key,
        paid: rent.total.payment,
        notPaid:
          rent.total.payment - rent.total.grandTotal < 0
            ? rent.total.payment - rent.total.grandTotal
            : 0
      };
      if (acc[key]) {
        acc[key].paid += revenue.paid;
        acc[key].notPaid += revenue.notPaid;
      } else {
        acc[key] = revenue;
      }
    });
    return acc;
  }, emptyRevenues)
)
  .map(([, value]) => ({
    ...value,
    paid: value.paid > 0 ? Math.round(value.paid * 100) / 100 : value.paid,
    notPaid:
      value.notPaid < 0
        ? Math.round(value.notPaid * 100) / 100
        : value.notPaid
  }))
  .sort((r1, r2) =>
    moment(r1.month, 'MMYYYY').isBefore(moment(r2.month, 'MMYYYY')) ? -1 : 1
  );
```

This logic:
- Creates empty revenue entries for all 12 months
- Iterates through all tenants' rents
- Filters rents by term within current year
- Aggregates paid and notPaid amounts by month
- Rounds amounts to 2 decimal places
- Sorts by month chronologically

### Repository Implementation Strategy

#### PropertyRepository.countByRealmId()

Use `.countDocuments()` for efficient counting:

```typescript
async countByRealmId(realmId: string): Promise<number> {
  if (!realmId || typeof realmId !== 'string') {
    throw new Error('Realm ID must be a non-empty string');
  }
  
  const count = await PropertyModel.countDocuments({ realmId });
  return count;
}
```

The `.countDocuments()` method:
1. Is more efficient than `.find().count()` (deprecated)
2. Returns an integer count without loading documents
3. Uses database-level counting for performance

### Dashboard Manager Refactoring Strategy

The refactoring will happen in phases:

1. **Phase 1**: Add PropertyRepository.countByRealmId() method
2. **Phase 2**: Add unit tests for PropertyRepository.countByRealmId()
3. **Phase 3**: Refactor dashboard manager to use repositories
4. **Phase 4**: Handle `.toObject()` call on plain objects
5. **Phase 5**: Add unit tests for dashboard manager business logic
6. **Phase 6**: Add property-based tests for dashboard calculations
7. **Phase 7**: Run integration tests to verify behavior unchanged
8. **Phase 8**: Remove Collections imports from dashboard manager

### Handling .toObject() on Plain Objects

The current code calls `tenant.toObject()` in the topUnpaid calculation:

```javascript
acc.push({
  tenant: tenant.toObject(),
  balance: currentRent.total.payment - currentRent.total.grandTotal,
  rent: currentRent
});
```

After refactoring, tenants will already be plain objects (from `.lean()`), so `.toObject()` will fail. We have two options:

**Option 1: Remove .toObject() call**
```javascript
acc.push({
  tenant: tenant,  // Already a plain object
  balance: currentRent.total.payment - currentRent.total.grandTotal,
  rent: currentRent
});
```

**Option 2: Add defensive check**
```javascript
acc.push({
  tenant: typeof tenant.toObject === 'function' ? tenant.toObject() : tenant,
  balance: currentRent.total.payment - currentRent.total.grandTotal,
  rent: currentRent
});
```

We'll use **Option 1** since repositories guarantee plain objects.

### Backward Compatibility

To maintain backward compatibility:

1. Collections namespace remains exported from services/common
2. Other managers continue using Collections directly
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

const allTenants = await Collections.Tenant.find({
  realmId: req.headers.organizationid
});

const propertyCount = await Collections.Property.find({
  realmId: req.headers.organizationid
}).count();
```

**After (Repository):**
```javascript
import { DataAccess } from '@microrealestate/common';

const tenantRepository = DataAccess.getTenantRepository();
const propertyRepository = DataAccess.getPropertyRepository();

const allTenants = await tenantRepository.findAll(req.headers.organizationid);
const propertyCount = await propertyRepository.countByRealmId(req.headers.organizationid);
```

## Dependencies

### Existing Dependencies

The extended repositories use existing dependencies from services/common:

- `mongoose@6.13.6` - MongoDB ODM
- `@microrealestate/types` - TypeScript type definitions

The dashboard manager uses:
- `moment@2.x` - Date manipulation and formatting

### Development Dependencies

- `vitest@2.1.0` - Unit testing framework
- `@vitest/coverage-v8@2.1.0` - Code coverage
- `fast-check@3.x` - Property-based testing library

### No New Runtime Dependencies

The implementation requires no new runtime dependencies. All functionality is built on existing packages.

## Performance Considerations

### Query Performance

Using `.lean()` for tenant queries provides performance benefits:

1. **Faster**: Skips Mongoose document hydration
2. **Less Memory**: Plain objects are lighter than Mongoose documents
3. **Serialization**: Plain objects serialize to JSON faster

Using `.countDocuments()` for property counting provides performance benefits:

1. **Database-level counting**: No document loading
2. **Efficient**: Uses MongoDB's count operation
3. **Scalable**: Performance doesn't degrade with large collections

### No Performance Regression

The refactoring should not significantly impact performance:

1. Same Mongoose queries under the hood
2. `.lean()` is actually faster than returning full documents
3. `.countDocuments()` is more efficient than `.find().count()`
4. No additional network calls or processing
5. Business logic remains identical

### Dashboard Response Time

The dashboard endpoint is already relatively slow due to:
- Loading all tenants for a realm
- Iterating through all rents and payments
- Multiple date comparisons and calculations

The refactoring will not make this worse and may slightly improve it due to `.lean()` and `.countDocuments()` optimizations.

## Security Considerations

### Multi-Tenancy Security

All repository methods are realm-scoped:

1. TenantRepository.findAll() filters by realmId
2. PropertyRepository.countByRealmId() filters by realmId
3. No cross-realm data leakage possible
4. Realm ID comes from authenticated request headers

### No New Security Risks

The refactoring introduces no new security risks:

1. Same query patterns (Mongoose queries)
2. Same realm-scoping logic
3. Same authentication/authorization flow
4. No exposure of sensitive data in plain objects

### Data Exposure

The dashboard endpoint returns:
- Aggregate metrics (counts, rates, sums)
- Top 5 unpaid tenants (already filtered by realm)
- Monthly revenue trends (already filtered by realm)

All data is already realm-scoped and authorized.

## Migration Path for Other Managers

If this refactoring is successful, other managers can follow the same pattern. The dashboard manager is a good candidate because:

1. **Read-only operations**: Only queries data, no updates
2. **Simple data access**: Just findAll() and count()
3. **Complex business logic**: Good test of keeping logic in manager
4. **High-value endpoint**: Dashboard is frequently accessed

Other managers that could follow:
1. **Accounting Manager** - similar aggregation logic
2. **Rent Manager** - similar tenant/rent queries
3. **Document Manager** - could use DocumentRepository

Each manager can be refactored independently without affecting others.
