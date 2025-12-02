# Design Document

## Overview

This design document outlines the technical approach for creating a data access layer (DAL) in the `services/common` package to isolate MongoDB/Mongoose-specific logic from the authenticator service. The implementation follows the Repository pattern, which provides a clean abstraction between business logic and data persistence.

The refactoring will introduce repository classes that encapsulate all database operations for Account, Tenant, and Realm entities. These repositories will use the existing Mongoose models internally but expose a clean, database-agnostic API that returns plain JavaScript objects instead of Mongoose documents.

## Architecture

### Current Architecture

```
┌─────────────────────────────────┐
│  Authenticator Service          │
│  (services/authenticator)       │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Route Handlers           │ │
│  │  - landlord.js            │ │
│  │  - tenant.js              │ │
│  │                           │ │
│  │  Direct Mongoose Calls:   │ │
│  │  Collections.Account      │ │
│  │  Collections.Realm        │ │
│  │  Collections.Tenant       │ │
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
│  │  - Account Model          │ │
│  │  - Realm Model            │ │
│  │  - Tenant Model           │ │
│  │  (Mongoose Models)        │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### Proposed Architecture

```
┌─────────────────────────────────┐
│  Authenticator Service          │
│  (services/authenticator)       │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Route Handlers           │ │
│  │  - landlord.js            │ │
│  │  - tenant.js              │ │
│  │                           │ │
│  │  Repository Calls:        │ │
│  │  AccountRepository        │ │
│  │  RealmRepository          │ │
│  │  TenantRepository         │ │
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
│  │  - AccountRepository      │ │
│  │  - RealmRepository        │ │
│  │  - TenantRepository       │ │
│  └───────────────────────────┘ │
│         │                       │
│         │ Internal Use          │
│         ▼                       │
│  ┌───────────────────────────┐ │
│  │  Collections              │ │
│  │  - Account Model          │ │
│  │  - Realm Model            │ │
│  │  - Tenant Model           │ │
│  │  (Mongoose Models)        │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### Key Architectural Decisions

1. **Repository Pattern**: Each entity (Account, Realm, Tenant) gets its own repository class that encapsulates all data access logic
2. **Backward Compatibility**: Existing Collections exports remain unchanged, allowing gradual migration of other services
3. **Plain Objects**: Repositories return plain JavaScript objects (using `.lean()` or `.toObject()`) to avoid leaking Mongoose abstractions
4. **TypeScript Implementation**: Repositories are implemented in TypeScript for type safety and better IDE support
5. **Centralized Location**: All repositories live in `services/common/src/dataAccess/` directory

## Components and Interfaces

### Directory Structure

```
services/common/src/
├── collections/           # Existing Mongoose models (unchanged)
│   ├── account.ts
│   ├── realm.ts
│   ├── tenant.ts
│   └── index.ts
├── dataAccess/           # New data access layer
│   ├── AccountRepository.ts
│   ├── RealmRepository.ts
│   ├── TenantRepository.ts
│   └── index.ts
├── utils/                # Existing utilities (unchanged)
└── index.ts              # Updated to export DataAccess
```

### AccountRepository Interface

```typescript
export class AccountRepository {
  /**
   * Find an account by email address
   * @param email - Email address (will be normalized to lowercase)
   * @returns Account object or null if not found
   */
  async findByEmail(email: string): Promise<Account | null>;

  /**
   * Find an account by ID
   * @param id - Account ID
   * @returns Account object or null if not found
   */
  async findById(id: string): Promise<Account | null>;

  /**
   * Create a new account
   * @param accountData - Account creation data
   * @returns Created account object
   */
  async create(accountData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
  }): Promise<Account>;

  /**
   * Update an account's password
   * @param email - Email address
   * @param newPassword - New password (will be hashed)
   * @returns Updated account object or null if not found
   */
  async updatePassword(email: string, newPassword: string): Promise<Account | null>;
}
```

### TenantRepository Interface

```typescript
export class TenantRepository {
  /**
   * Find tenants by contact email
   * @param email - Contact email address
   * @returns Array of tenant objects (may be empty)
   */
  async findByContactEmail(email: string): Promise<Tenant[]>;

  /**
   * Find a tenant by ID
   * @param id - Tenant ID
   * @returns Tenant object or null if not found
   */
  async findById(id: string): Promise<Tenant | null>;
}
```

### RealmRepository Interface

```typescript
export class RealmRepository {
  /**
   * Find a realm by ID
   * @param id - Realm ID (organization ID)
   * @returns Realm object or null if not found
   */
  async findById(id: string): Promise<Realm | null>;

  /**
   * Update realm members when an account is registered
   * @param email - Member email address
   * @param name - Member full name
   * @returns Number of realms updated
   */
  async updateMemberRegistration(email: string, name: string): Promise<number>;
}
```

## Data Models

The data access layer uses the existing Mongoose models internally but returns plain JavaScript objects. The type definitions come from `@microrealestate/types`.

### Account Type

```typescript
interface Account {
  _id?: string;
  firstname: string;
  lastname: string;
  email: string;
  password: string;  // Hashed by Mongoose pre-save hook
  createdDate?: Date;
}
```

### Tenant Type

```typescript
interface Tenant {
  _id?: string;
  realmId: string;
  name: string;
  isCompany?: boolean;
  company?: string;
  contacts: Array<{
    contact: string;
    phone: string;
    email: string;
  }>;
  // ... other fields
}
```

### Realm Type

```typescript
interface Realm {
  _id?: string;
  name: string;
  members: Array<{
    name: string;
    email: string;
    role: string;
    registered: boolean;
  }>;
  applications: Array<{
    name: string;
    role: string;
    clientId: string;
    clientSecret: string;  // Hashed by Mongoose pre-save hook
    createdDate: Date;
    expiryDate: Date;
  }>;
  // ... other fields
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Plain object returns

*For any* repository method that returns data, the returned object should be a plain JavaScript object without Mongoose-specific methods (such as `.save()`, `.$isNew`, `.toObject()`)
**Validates: Requirements 1.2, 2.5, 5.2**

### Property 2: Account findByEmail returns correct account

*For any* email address, calling `AccountRepository.findByEmail(email)` should return the account with that email (case-insensitive) or null if no such account exists
**Validates: Requirements 3.1**

### Property 3: Account creation persistence

*For any* valid account data, calling `AccountRepository.create(accountData)` should persist the account such that it can be retrieved by subsequent queries
**Validates: Requirements 3.2**

### Property 4: Account findById returns correct account

*For any* account ID, calling `AccountRepository.findById(id)` should return the account with that ID or null if no such account exists
**Validates: Requirements 3.3**

### Property 5: Tenant findByContactEmail returns matching tenants

*For any* email address, calling `TenantRepository.findByContactEmail(email)` should return all tenants that have that email in their contacts array
**Validates: Requirements 3.4**

### Property 6: Realm findById returns realm with applications

*For any* realm ID, calling `RealmRepository.findById(id)` should return the realm with that ID including its applications array, or null if no such realm exists
**Validates: Requirements 3.5**

### Property 7: Email normalization consistency

*For any* email address with mixed case, querying with the mixed-case version should return the same results as querying with the lowercase version
**Validates: Requirements 5.1**

### Property 8: Repository error handling

*For any* repository method, when an error condition occurs (invalid ID format, database connection error), the method should throw an error that can be caught by the caller
**Validates: Requirements 5.3**

### Property 9: Password hashing preservation

*For any* account created through `AccountRepository.create()`, the password field in the persisted account should be hashed (not equal to the plain text password provided)
**Validates: Requirements 5.5**

### Property 10: Realm member update preservation

*For any* account created through `AccountRepository.create()`, if a realm exists with a member matching that email, the member's `registered` field should be updated to true and the `name` field should be set
**Validates: Requirements 5.5**

## Error Handling

### Repository Error Patterns

Repositories will handle errors in a consistent manner:

1. **Not Found**: Methods that query by ID or email return `null` when no matching document is found (not an error)
2. **Invalid Input**: Methods throw `Error` with descriptive message for invalid input (e.g., empty email, malformed ID)
3. **Database Errors**: Methods propagate Mongoose/MongoDB errors to the caller for handling at the service layer
4. **Validation Errors**: Mongoose validation errors are propagated as-is to maintain existing error handling behavior

### Example Error Handling

```typescript
// In repository
async findByEmail(email: string): Promise<Account | null> {
  if (!email || typeof email !== 'string') {
    throw new Error('Email must be a non-empty string');
  }
  
  try {
    const account = await AccountModel.findOne({
      email: email.toLowerCase()
    }).lean();
    return account;
  } catch (error) {
    // Propagate database errors
    throw error;
  }
}
```

### Authenticator Service Error Handling

The authenticator service will continue to use its existing error handling patterns:

```typescript
// Existing pattern in authenticator service
try {
  const account = await accountRepository.findByEmail(email);
  if (!account) {
    throw new ServiceError('invalid credentials', 401);
  }
  // ... rest of logic
} catch (error) {
  logger.error(error);
  throw error;
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify specific repository behaviors and edge cases:

1. **Repository Method Tests**
   - Test each repository method with valid inputs
   - Test null returns for non-existent entities
   - Test error handling for invalid inputs
   - Test email normalization (mixed case, whitespace)

2. **Plain Object Tests**
   - Verify returned objects don't have Mongoose methods
   - Verify returned objects can be serialized to JSON
   - Verify returned objects match expected type structure

3. **Mongoose Middleware Tests**
   - Verify password hashing occurs on account creation
   - Verify realm member updates occur on account creation
   - Verify application secret hashing occurs on realm save

### Property-Based Testing

Property-based tests will verify universal properties across many inputs using **fast-check** (the property-based testing library for JavaScript/TypeScript):

1. **Plain Object Property**
   - Generate random account/tenant/realm data
   - Call repository methods
   - Verify all returned objects are plain (no Mongoose methods)
   - Run 100+ iterations with varied data

2. **Email Normalization Property**
   - Generate random email addresses with mixed case
   - Query with both original and lowercase versions
   - Verify results are identical
   - Run 100+ iterations

3. **Round-trip Property**
   - Generate random account data
   - Create account via repository
   - Retrieve account by email and by ID
   - Verify retrieved data matches created data (except hashed password)
   - Run 100+ iterations

4. **Password Hashing Property**
   - Generate random account data with random passwords
   - Create account via repository
   - Retrieve account from database
   - Verify password is hashed (not equal to original)
   - Run 100+ iterations

### Integration Testing

Integration tests will verify the authenticator service works correctly with repositories:

1. **Sign Up Flow**
   - Test complete sign up flow using repositories
   - Verify account is created and can be retrieved
   - Verify password is hashed
   - Verify realm members are updated

2. **Sign In Flow**
   - Test complete sign in flow using repositories
   - Verify authentication succeeds with correct credentials
   - Verify authentication fails with incorrect credentials
   - Verify tokens are generated correctly

3. **Password Reset Flow**
   - Test complete password reset flow using repositories
   - Verify password is updated
   - Verify new password is hashed
   - Verify authentication works with new password

### Test Configuration

- Property-based tests will run a minimum of 100 iterations per property
- Each property-based test will be tagged with a comment referencing the design document property
- Tag format: `// Feature: authenticator-data-access-layer, Property X: [property text]`
- Tests will use the existing Vitest framework configured in services/common

## Implementation Notes

### Mongoose Middleware Preservation

The existing Mongoose models have important middleware that must continue to work:

**Account Model Pre-Save Hook:**
```typescript
AccountSchema.pre('save', function (next) {
  if (!this.createdDate) {
    this.createdDate = new Date();
  }
  this.email = this.email.toLowerCase();
  this.password = bcrypt.hashSync(this.password, 10);
  next();
});
```

**Account Model Post-Save Hook:**
```typescript
AccountSchema.post('save', function (account) {
  const name = `${account.firstname} ${account.lastname}`;
  RealmModel.updateMany(
    {
      members: {
        $elemMatch: { email: account.email }
      }
    },
    {
      $set: {
        'members.$.registered': true,
        'members.$.name': name
      }
    },
    (error: CallbackError) => {
      if (error) {
        console.error(error);
      }
    }
  );
});
```

**Realm Model Pre-Save Hook:**
```typescript
RealmSchema.pre('save', function (next) {
  for (const app of this.applications) {
    if (!app.createdDate) {
      app.createdDate = new Date();
      app.clientSecret = bcrypt.hashSync(app.clientSecret, 10);
    }
  }
  next();
});
```

### Repository Implementation Strategy

Repositories will use Mongoose models internally but expose a clean API:

1. **For Queries**: Use `.lean()` to return plain objects
   ```typescript
   const account = await AccountModel.findOne({ email }).lean();
   ```

2. **For Creates**: Use `.create()` then convert to plain object
   ```typescript
   const doc = await AccountModel.create(accountData);
   return doc.toObject();
   ```

3. **For Updates**: Use `.findOneAndUpdate()` with `{ new: true, lean: true }`
   ```typescript
   const updated = await AccountModel.findOneAndUpdate(
     { email },
     { password: newPassword },
     { new: true, lean: true }
   );
   ```

### Migration Strategy

The migration will happen in phases:

1. **Phase 1**: Create repository classes in services/common
2. **Phase 2**: Add unit tests for repositories
3. **Phase 3**: Add property-based tests for repositories
4. **Phase 4**: Refactor authenticator service to use repositories
5. **Phase 5**: Run integration tests to verify behavior unchanged
6. **Phase 6**: Remove Collections imports from authenticator service

### Backward Compatibility

To maintain backward compatibility:

1. Collections namespace remains exported from services/common
2. Other services (api, tenantapi) continue using Collections directly
3. Both Collections and DataAccess are exported from common package index
4. Future services can choose to use DataAccess instead of Collections
5. Gradual migration of other services can happen independently

### Export Structure

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
export * as DataAccess from './dataAccess/index.js';    // New - exports factory functions
export { default as logger } from './utils/logger.js';
export { default as ServiceError } from './utils/serviceerror.js';
```

The DataAccess namespace will export factory functions:
- `getAccountRepository()` - Returns singleton AccountRepository instance
- `getTenantRepository()` - Returns singleton TenantRepository instance  
- `getRealmRepository()` - Returns singleton RealmRepository instance

### Repository Instance Management

Repositories will be exposed as singleton instances through factory functions:

```typescript
// services/common/src/dataAccess/index.ts
import AccountRepository from './AccountRepository.js';
import TenantRepository from './TenantRepository.js';
import RealmRepository from './RealmRepository.js';

let accountRepositoryInstance: AccountRepository | null = null;
let tenantRepositoryInstance: TenantRepository | null = null;
let realmRepositoryInstance: RealmRepository | null = null;

export function getAccountRepository(): AccountRepository {
  if (!accountRepositoryInstance) {
    accountRepositoryInstance = new AccountRepository();
  }
  return accountRepositoryInstance;
}

export function getTenantRepository(): TenantRepository {
  if (!tenantRepositoryInstance) {
    tenantRepositoryInstance = new TenantRepository();
  }
  return tenantRepositoryInstance;
}

export function getRealmRepository(): RealmRepository {
  if (!realmRepositoryInstance) {
    realmRepositoryInstance = new RealmRepository();
  }
  return realmRepositoryInstance;
}
```

### Usage Examples

**Before (Direct Mongoose):**
```javascript
import { Collections } from '@microrealestate/common';

const account = await Collections.Account.findOne({
  email: email.toLowerCase()
}).lean();
```

**After (Repository):**
```javascript
import { DataAccess } from '@microrealestate/common';

const accountRepository = DataAccess.getAccountRepository();
const account = await accountRepository.findByEmail(email);
```

## Dependencies

### Existing Dependencies

The data access layer will use existing dependencies from services/common:

- `mongoose@6.13.6` - MongoDB ODM
- `bcrypt@5.1.1` - Password hashing (used by Mongoose middleware)
- `@microrealestate/types` - TypeScript type definitions

### Development Dependencies

- `vitest@2.1.0` - Unit testing framework
- `@vitest/coverage-v8@2.1.0` - Code coverage
- `fast-check@3.x` - Property-based testing library (to be added)

### No New Runtime Dependencies

The implementation requires no new runtime dependencies. All functionality is built on existing packages.

## Performance Considerations

### Query Performance

Using `.lean()` for queries provides performance benefits:

1. **Faster**: Skips Mongoose document hydration
2. **Less Memory**: Plain objects are lighter than Mongoose documents
3. **Serialization**: Plain objects serialize to JSON faster

### Caching Opportunities

The repository pattern enables future caching implementations:

1. **Repository-level caching**: Add caching logic in repositories without changing service code
2. **Redis integration**: Repositories can check Redis before querying MongoDB
3. **Cache invalidation**: Repositories control when cache is invalidated

### No Performance Regression

The refactoring should not impact performance:

1. Same Mongoose queries under the hood
2. `.lean()` is actually faster than returning full documents
3. No additional network calls or processing
4. Middleware hooks continue to run as before

## Security Considerations

### Password Security

Password hashing continues to work via Mongoose pre-save hooks:

1. Passwords are hashed before storage (bcrypt with salt rounds = 10)
2. Repository methods never return plain text passwords
3. Password comparison happens in service layer using bcrypt.compare()

### Application Secret Security

Application secrets in Realm model continue to be hashed:

1. Secrets are hashed before storage via Mongoose pre-save hook
2. Repository methods return hashed secrets only
3. Secret comparison happens in service layer using bcrypt.compare()

### Email Normalization

Email normalization prevents case-sensitivity issues:

1. All emails stored in lowercase
2. Queries normalize emails to lowercase
3. Prevents duplicate accounts with different case emails

### No New Security Risks

The refactoring introduces no new security risks:

1. Same validation logic (Mongoose schemas)
2. Same hashing logic (Mongoose middleware)
3. Same query patterns (Mongoose queries)
4. No exposure of sensitive data in plain objects
