# Design Document

## Overview

This design document outlines the technical approach for refactoring the API service's email manager (`services/api/src/managers/emailmanager.js`) to use the existing data access layer in the `services/common` package. The email manager currently uses direct Mongoose model calls (`Collections.Tenant`) which creates tight coupling between business logic and data persistence.

The refactoring will use the existing `TenantRepository.findByIds()` method to replace the direct Mongoose query, then update the email manager to use this repository method instead of direct Mongoose calls. This follows the same pattern successfully implemented for the realm manager, property manager, lease manager, and occupant manager.

This is a straightforward refactoring that requires no changes to the repository layer - the existing `TenantRepository.findByIds()` method already provides exactly the functionality needed by the email manager.

## Architecture

### Current Architecture

```
┌─────────────────────────────────┐
│  API Service                    │
│  (services/api)                 │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Email Manager            │ │
│  │  emailmanager.js          │ │
│  │                           │ │
│  │  Direct Mongoose Call:    │ │
│  │  Collections.Tenant.      │ │
│  │    find({                 │ │
│  │      _id: { $in: ids },   │ │
│  │      realmId: realm._id   │ │
│  │    }).lean()              │ │
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
│  │  (Mongoose Model)         │ │
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
│  │  Email Manager            │ │
│  │  emailmanager.js          │ │
│  │                           │ │
│  │  Repository Call:         │ │
│  │  tenantRepository.        │ │
│  │    findByIds(             │ │
│  │      tenantIds,           │ │
│  │      realmId              │ │
│  │    )                      │ │
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
│  │    (existing)             │ │
│  └───────────────────────────┘ │
│         │                       │
│         │ Internal Use          │
│         ▼                       │
│  ┌───────────────────────────┐ │
│  │  Collections              │ │
│  │  - Tenant Model           │ │
│  │  (Mongoose Model)         │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### Key Architectural Decisions

1. **Use Existing Repository**: No changes needed to `TenantRepository` - the `findByIds()` method already exists and provides the exact functionality needed
2. **Plain Objects**: Repository returns plain JavaScript objects (using `.lean()`) to avoid leaking Mongoose abstractions
3. **Backward Compatibility**: Existing Collections exports remain unchanged, allowing other managers to continue using direct Mongoose calls
4. **No Business Logic in Repositories**: Email sending, term calculation, error handling, and response formatting remain in the email manager
5. **Simple Refactoring**: Only one Mongoose query needs to be replaced

## Components and Interfaces

### Existing TenantRepository Interface

The email manager will use this existing method from `TenantRepository`:

```typescript
export class TenantRepository {
  /**
   * Find tenants by IDs with realm filtering
   * 
   * Returns all tenants with the specified IDs that belong to the given realm.
   * 
   * @param tenantIds - Array of tenant IDs
   * @param realmId - Realm ID for security filtering
   * @returns Array of tenant objects (may be empty if no matches found)
   * @throws Error if tenantIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const tenants = await tenantRepository.findByIds(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * console.log(`Found ${tenants.length} tenants`);
   * ```
   */
  async findByIds(tenantIds: string[], realmId: string): Promise<Tenant[]>;
}
```

This method:
- Takes an array of tenant IDs and a realm ID
- Returns plain JavaScript objects (uses `.lean()`)
- Filters by both tenant IDs and realm ID for security
- Returns empty array if no matches found
- Throws error for invalid inputs

### Email Manager Interface

The email manager exports a single function:

```javascript
/**
 * Send emails to multiple tenants
 * 
 * @param req - Express request object
 * @param req.realm - Current realm object
 * @param req.body.document - Document template name (e.g., 'invoice', 'notice')
 * @param req.body.tenantIds - Array of tenant IDs to send emails to
 * @param req.body.terms - Optional array of terms (one per tenant)
 * @param req.body.year - Year for default term calculation
 * @param req.body.month - Month for default term calculation
 * @param res - Express response object
 */
export async function send(req, res);
```

## Data Models

### Tenant Type

The email manager uses a subset of the Tenant model fields:

```typescript
interface Tenant {
  _id: string;           // Used for tenantId in email
  name: string;          // Used for logging and response
  realmId: string;       // Used for security filtering
  // Other fields exist but are not used by email manager
}
```

### Email Status Response

The email manager returns status information for each tenant:

```typescript
interface EmailStatus {
  name: string;          // Tenant name
  tenantId: string;      // Tenant ID
  document: string;      // Document template name
  term: number;          // Term in YYYYMMDDHH format
  email?: string;        // Email address (on success)
  status?: string;       // Status from emailer service (on success)
  error?: {              // Error details (on failure)
    status: number;
    message: string;
  };
}
```

### Emailer Service Request

The email manager sends this payload to the emailer service:

```typescript
interface EmailerRequest {
  templateName: string;  // Document template name
  recordId: string;      // Tenant ID
  params: {
    term: number;        // Term in YYYYMMDDHH format
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tenant query security

*For any* array of tenant IDs and realm ID, calling `tenantRepository.findByIds(tenantIds, realmId)` should return only tenants that belong to the specified realm
**Validates: Requirements 3.2**

### Property 2: Email sending completeness

*For any* array of tenant IDs, the email manager should attempt to send an email to each tenant and return a status for each one
**Validates: Requirements 4.4**

### Property 3: Term calculation consistency

*For any* year and month, the default term calculation should produce a valid YYYYMMDDHH format term
**Validates: Requirements 6.1, 6.2**

### Property 4: Error isolation

*For any* tenant in the list, if email sending fails for that tenant, it should not prevent emails from being sent to other tenants
**Validates: Requirements 5.1**

### Property 5: Response format consistency

*For any* email sending operation, the response should contain exactly one status object per tenant in the input list
**Validates: Requirements 10.1, 10.2, 10.3**

## Error Handling

### Repository Error Patterns

The `TenantRepository.findByIds()` method handles errors consistently:

1. **Not Found**: Returns empty array when no matching tenants are found (not an error)
2. **Invalid Input**: Throws `Error` with descriptive message for invalid input (empty array, invalid realm ID)
3. **Database Errors**: Propagates Mongoose/MongoDB errors to the caller

### Email Manager Error Handling

The email manager has two levels of error handling:

#### 1. Per-Tenant Error Handling

Each tenant's email sending is wrapped in a try-catch:

```javascript
try {
  const status = await _sendEmail(req, {
    name: tenant.name,
    tenantId,
    document,
    term
  });
  return {
    name: tenant.name,
    tenantId,
    document,
    term,
    ...status
  };
} catch (error) {
  logger.error(error);
  return {
    name: tenant.name,
    tenantId,
    document,
    term,
    error: error.response?.data || {
      status: 500,
      message: `Something went wrong when sending the email to ${tenant.name}`
    }
  };
}
```

This ensures:
- One tenant's failure doesn't affect others
- Each tenant gets a status in the response
- Errors are logged for debugging

#### 2. Overall Response Status

After all emails are processed:

```javascript
if (statusList.some((status) => !!status.error)) {
  res.status(500).json(statusList);
} else {
  res.json(statusList);
}
```

This ensures:
- HTTP 500 if any email failed
- HTTP 200 if all emails succeeded
- Full status list returned in both cases

### Emailer Service Error Handling

The `_sendEmail()` function handles emailer service errors:

```javascript
try {
  const response = await axios.post(EMAILER_URL, postData, { headers });
  return response.data.map(/* transform */);
} catch (error) {
  const errorMessage = error.response?.data?.message || error.message;
  logger.error(`POST ${EMAILER_URL} failed`);
  logger.error(`data sent: ${JSON.stringify(postData)}`);
  logger.error(errorMessage);
  throw new Error(errorMessage);
}
```

This ensures:
- Network errors are caught
- Emailer service errors are extracted
- Errors are logged with context
- Errors are re-thrown for per-tenant handling

## Testing Strategy

### Unit Testing

Unit tests will verify the email manager's refactored behavior:

1. **Repository Integration Tests**
   - Test that email manager calls `tenantRepository.findByIds()` with correct parameters
   - Test that email manager handles empty tenant list
   - Test that email manager handles tenants not found
   - Test that email manager works with plain objects from repository

2. **Email Sending Tests**
   - Test successful email sending to multiple tenants
   - Test email sending with custom terms
   - Test email sending with default term calculation
   - Test parallel email sending (Promise.all)

3. **Error Handling Tests**
   - Test per-tenant error isolation
   - Test overall response status (500 if any failed)
   - Test error message extraction from emailer service
   - Test default error message when emailer service doesn't provide one

4. **Term Calculation Tests**
   - Test default term calculation from year/month
   - Test custom terms array usage
   - Test fallback to default term when terms array is short

### Property-Based Testing

Property-based tests will verify universal properties using **fast-check**:

1. **Tenant Query Security Property**
   - Generate random tenant IDs and realm IDs
   - Call repository method
   - Verify all returned tenants have matching realmId
   - Run 100+ iterations
   - **Feature: api-email-data-access-layer, Property 1: Tenant query security**

2. **Email Sending Completeness Property**
   - Generate random tenant ID arrays
   - Mock emailer service responses
   - Call email manager
   - Verify response has exactly one status per input tenant
   - Run 100+ iterations
   - **Feature: api-email-data-access-layer, Property 2: Email sending completeness**

3. **Term Calculation Consistency Property**
   - Generate random year/month combinations
   - Calculate default term
   - Verify format is YYYYMMDDHH (10 digits)
   - Verify year and month are correctly encoded
   - Run 100+ iterations
   - **Feature: api-email-data-access-layer, Property 3: Term calculation consistency**

4. **Error Isolation Property**
   - Generate random tenant arrays
   - Mock emailer service to fail for random tenants
   - Call email manager
   - Verify all tenants get a status (success or error)
   - Verify failures don't prevent other emails
   - Run 100+ iterations
   - **Feature: api-email-data-access-layer, Property 4: Error isolation**

5. **Response Format Consistency Property**
   - Generate random tenant arrays and email results
   - Call email manager
   - Verify each status has required fields (name, tenantId, document, term)
   - Verify success statuses have email and status fields
   - Verify error statuses have error field
   - Run 100+ iterations
   - **Feature: api-email-data-access-layer, Property 5: Response format consistency**

### Integration Testing

Integration tests will verify the email manager works correctly with the repository and emailer service:

1. **End-to-End Email Flow**
   - Test complete email sending flow with real database
   - Verify tenants are queried correctly
   - Verify emails are sent to emailer service
   - Verify response format is correct

2. **Multi-Tenant Scenarios**
   - Test sending to multiple tenants in same realm
   - Test sending with mixed success/failure
   - Test sending with custom terms per tenant

3. **Security Scenarios**
   - Test that tenants from other realms are not included
   - Test that invalid tenant IDs are handled gracefully

### Test Configuration

- Property-based tests will run a minimum of 100 iterations per property
- Each property-based test will be tagged with a comment referencing the design document property
- Tag format: `// Feature: api-email-data-access-layer, Property X: [property text]`
- Tests will use the existing Vitest framework configured in services/api

## Implementation Notes

### Email Manager Refactoring Strategy

The refactoring is straightforward and involves minimal changes:

#### Before (Direct Mongoose):

```javascript
import { Collections, logger, Service } from '@microrealestate/common';

const tenants = await Collections.Tenant.find({
  _id: { $in: tenantIds },
  realmId: realm._id
}).lean();
```

#### After (Repository):

```javascript
import { DataAccess, logger, Service } from '@microrealestate/common';

const tenantRepository = DataAccess.getTenantRepository();
const tenants = await tenantRepository.findByIds(tenantIds, String(realm._id));
```

### Key Changes

1. **Import Change**: Replace `Collections` with `DataAccess`
2. **Repository Instance**: Get repository via `DataAccess.getTenantRepository()`
3. **Method Call**: Replace `Collections.Tenant.find()` with `tenantRepository.findByIds()`
4. **Parameters**: Pass `tenantIds` array and `realmId` string as separate parameters
5. **No `.lean()` needed**: Repository already returns plain objects

### Business Logic Preservation

All business logic remains in the email manager:

1. **Term Calculation**
   - Default term calculation from year/month using moment
   - Custom terms array handling with fallback to default

2. **Email Sending**
   - Calling emailer service via axios
   - Passing correct headers (authorization, organizationid, Accept-Language)
   - Transforming emailer response to status format

3. **Error Handling**
   - Per-tenant error isolation
   - Error message extraction
   - Overall response status determination

4. **Logging**
   - Debug logging for successful sends
   - Error logging for failures
   - Logging data sent and responses

5. **Response Formatting**
   - Mapping emailer response to status objects
   - Including tenant name and ID
   - Including error details on failure

### No Repository Changes Needed

The existing `TenantRepository.findByIds()` method provides exactly the functionality needed:

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

This method:
- Takes the same parameters the email manager needs
- Performs the same query (filter by IDs and realm)
- Returns plain objects (uses `.lean()`)
- Has proper error handling

### Backward Compatibility

To maintain backward compatibility:

1. Collections namespace remains exported from services/common
2. Other managers continue using Collections directly
3. Both Collections and DataAccess are exported from common package index
4. Email manager is the only file that changes
5. No changes to emailer service or API contracts

### Implementation Phases

The refactoring will happen in phases:

1. **Phase 1**: Add unit tests for email manager (if not already present)
2. **Phase 2**: Refactor email manager to use TenantRepository
3. **Phase 3**: Add property-based tests for email manager
4. **Phase 4**: Run integration tests to verify behavior unchanged
5. **Phase 5**: Remove Collections import from email manager

## Dependencies

### Existing Dependencies

The email manager uses existing dependencies:

- `@microrealestate/common` - For DataAccess, logger, Service
- `axios@1.7.x` - For HTTP requests to emailer service
- `moment@2.x` - For term date formatting

### Development Dependencies

- `vitest@2.1.0` - Unit testing framework
- `@vitest/coverage-v8@2.1.0` - Code coverage
- `fast-check@3.x` - Property-based testing library

### No New Runtime Dependencies

The implementation requires no new runtime dependencies. All functionality is built on existing packages.

## Performance Considerations

### Query Performance

Using `TenantRepository.findByIds()` has the same performance as the current implementation:

1. **Same Query**: Uses identical MongoDB query under the hood
2. **Same Index**: Uses same indexes on `_id` and `realmId`
3. **Same `.lean()`**: Returns plain objects for fast serialization

### No Performance Regression

The refactoring should have zero performance impact:

1. Same Mongoose query
2. Same query parameters
3. Same result transformation
4. No additional processing
5. No additional network calls

### Email Sending Performance

Email sending performance is unchanged:

1. Same parallel processing with `Promise.all()`
2. Same axios HTTP requests
3. Same error handling overhead
4. Same response transformation

## Security Considerations

### Realm Isolation

The repository method enforces realm isolation:

1. Queries filter by both tenant IDs and realm ID
2. Tenants from other realms are never returned
3. Security is enforced at the data access layer
4. Email manager doesn't need to implement security checks

### No New Security Risks

The refactoring introduces no new security risks:

1. Same query filters (tenant IDs + realm ID)
2. Same authorization headers passed to emailer service
3. Same error handling (no information leakage)
4. No exposure of sensitive data in plain objects

### Existing Security Measures

The email manager continues to use existing security measures:

1. Authorization header forwarded to emailer service
2. Organization ID header forwarded to emailer service
3. Realm ID from authenticated request context
4. No tenant data exposed in error messages

## Migration Path for Other Managers

This refactoring demonstrates the simplest case of repository adoption:

1. **No Repository Changes**: Existing repository method is sufficient
2. **Minimal Code Changes**: Only one query to replace
3. **No Business Logic Changes**: All logic stays in manager
4. **Easy Testing**: Straightforward unit and property tests

Other managers with similar patterns can follow this approach:

1. **Accounting Manager** - uses `Collections.Tenant.find()` for rent calculations
2. **Dashboard Manager** - uses `Collections.Tenant.find()` for statistics
3. **Report Manager** - uses `Collections.Tenant.find()` for report generation

Each manager can be refactored independently without affecting others.

## Comparison with Other Refactorings

### Simpler than Realm Manager

The email manager refactoring is simpler than the realm manager refactoring:

1. **No Repository Extensions**: Uses existing `findByIds()` method
2. **No Middleware Concerns**: No pre-save hooks to preserve
3. **No Secret Handling**: No encryption or hashing logic
4. **Single Query**: Only one Mongoose call to replace
5. **No Create/Update**: Only read operations

### Similar to Property/Lease/Occupant Managers

The email manager refactoring follows the same pattern as other manager refactorings:

1. **Use Existing Repositories**: Leverage existing data access layer
2. **Plain Objects**: Work with plain JavaScript objects
3. **Business Logic in Manager**: Keep validation and processing in manager
4. **Backward Compatible**: Don't affect other managers
5. **Incremental Migration**: Refactor one manager at a time

## Conclusion

This refactoring is a straightforward application of the repository pattern to the email manager. It requires no changes to the repository layer and minimal changes to the email manager itself. The existing `TenantRepository.findByIds()` method provides exactly the functionality needed, making this one of the simplest refactorings in the series.

The refactoring will improve:
- **Maintainability**: Cleaner separation between business logic and data access
- **Testability**: Easier to mock repository for unit tests
- **Consistency**: Follows same pattern as other refactored managers
- **Future-proofing**: Easier to change data access implementation later

The implementation preserves all existing functionality, maintains backward compatibility, and introduces no performance or security regressions.
