# Design Document

## Overview

This design document outlines the technical approach for refactoring the API service's realm manager (`services/api/src/managers/realmmanager.js`) to use the existing data access layer in the `services/common` package. The realm manager currently uses direct Mongoose model calls (`Collections.Realm`, `Collections.Account`) which creates tight coupling between business logic and data persistence.

The refactoring will extend the existing `RealmRepository` and `AccountRepository` classes with additional methods needed by the realm manager, then update the realm manager to use these repository methods instead of direct Mongoose calls. This follows the same pattern successfully implemented for the authenticator service.

This is a focused pilot refactoring - if successful, the pattern will be applied to other managers in the API service (property manager, lease manager, occupant manager, etc.).

## Architecture

### Current Architecture

```
┌─────────────────────────────────┐
│  API Service                    │
│  (services/api)                 │
│                                 │
│  ┌───────────────────────────┐ │
│  │  Realm Manager            │ │
│  │  realmmanager.js          │ │
│  │                           │ │
│  │  Direct Mongoose Calls:   │ │
│  │  new Collections.Realm()  │ │
│  │  Collections.Realm.       │ │
│  │    findOne()              │ │
│  │  realm.save()             │ │
│  │  Collections.Account.     │ │
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
│  │  - Realm Model            │ │
│  │  - Account Model          │ │
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
│  │  Realm Manager            │ │
│  │  realmmanager.js          │ │
│  │                           │ │
│  │  Repository Calls:        │ │
│  │  realmRepository.create() │ │
│  │  realmRepository.         │ │
│  │    findOne()              │ │
│  │  realmRepository.update() │ │
│  │  accountRepository.       │ │
│  │    findAll()              │ │
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
│  │  - RealmRepository        │ │
│  │    (extended)             │ │
│  │  - AccountRepository      │ │
│  │    (extended)             │ │
│  └───────────────────────────┘ │
│         │                       │
│         │ Internal Use          │
│         ▼                       │
│  ┌───────────────────────────┐ │
│  │  Collections              │ │
│  │  - Realm Model            │ │
│  │  - Account Model          │ │
│  │  (Mongoose Models)        │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### Key Architectural Decisions

1. **Extend Existing Repositories**: Add methods to existing `RealmRepository` and `AccountRepository` rather than creating new ones
2. **Plain Objects**: Repositories return plain JavaScript objects (using `.lean()` or `.toObject()`) to avoid leaking Mongoose abstractions
3. **Mongoose Middleware Preservation**: The `update()` method must use `.save()` to trigger pre-save hooks for hashing application secrets
4. **Backward Compatibility**: Existing Collections exports remain unchanged, allowing other managers to continue using direct Mongoose calls
5. **No Business Logic in Repositories**: Validation, secret encryption, and member population remain in the realm manager

## Components and Interfaces

### Extended RealmRepository Interface

```typescript
export class RealmRepository {
  // Existing methods (from authenticator refactoring)
  async findById(id: string): Promise<Realm | null>;
  async updateMemberRegistration(email: string, name: string): Promise<number>;

  // New methods for realm manager
  
  /**
   * Find a single realm by ID filter
   * @param filter - Query filter with _id field
   * @returns Realm object or null if not found
   */
  async findOne(filter: { _id: string }): Promise<Realm | null>;

  /**
   * Create a new realm
   * @param realmData - Realm creation data
   * @returns Created realm object
   */
  async create(realmData: Partial<Realm>): Promise<Realm>;

  /**
   * Update an existing realm
   * 
   * This method retrieves the realm document, updates it using .set(),
   * then saves it. This ensures Mongoose pre-save hooks are triggered
   * (e.g., hashing application secrets).
   * 
   * @param realmId - Realm ID to update
   * @param updateData - Data to update
   * @returns Updated realm object
   */
  async update(realmId: string, updateData: Partial<Realm>): Promise<Realm>;
}
```

### Extended AccountRepository Interface

```typescript
export class AccountRepository {
  // Existing methods (from authenticator refactoring)
  async findByEmail(email: string): Promise<Account | null>;
  async findById(id: string): Promise<Account | null>;
  async create(accountData): Promise<Account>;
  async updatePassword(email: string, newPassword: string): Promise<Account | null>;

  // New method for realm manager
  
  /**
   * Find all accounts
   * 
   * Returns all accounts with email, firstname, and lastname fields.
   * Used by realm manager to build username map for member population.
   * 
   * @returns Array of account objects
   */
  async findAll(): Promise<Account[]>;
}
```

## Data Models

The repositories use existing Mongoose models internally but return plain JavaScript objects.

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
  addresses?: Array<{
    street1: string;
    street2: string;
    zipCode: string;
    city: string;
    state: string;
    country: string;
  }>;
  bankInfo?: {
    name: string;
    iban: string;
  };
  contacts?: Array<{
    name: string;
    email: string;
    phone1: string;
    phone2: string;
  }>;
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
  thirdParties?: {
    gmail?: {
      selected: boolean;
      email: string;
      appPassword: string;  // Encrypted by realm manager
      fromEmail: string;
      replyToEmail: string;
    };
    smtp?: {
      selected: boolean;
      server: string;
      port: number;
      secure: boolean;
      authentication: boolean;
      username: string;
      password: string;  // Encrypted by realm manager
      fromEmail: string;
      replyToEmail: string;
    };
    mailgun?: {
      selected: boolean;
      apiKey: string;  // Encrypted by realm manager
      domain: string;
      fromEmail: string;
      replyToEmail: string;
    };
    b2?: {
      keyId: string;  // Encrypted by realm manager
      applicationKey: string;  // Encrypted by realm manager
      endpoint: string;
      bucket: string;
    };
  };
  locale: string;
  currency: string;
}
```

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

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Plain object returns

*For any* RealmRepository method that returns data, the returned object should be a plain JavaScript object without Mongoose-specific methods (such as `.save()`, `.$isNew`, `.toObject()`)
**Validates: Requirements 2.4**

### Property 2: Realm creation persistence

*For any* valid realm data, calling `RealmRepository.create(realmData)` should persist the realm such that it can be retrieved by subsequent queries
**Validates: Requirements 2.1**

### Property 3: Realm update persistence

*For any* existing realm and valid update data, calling `RealmRepository.update(realmId, updateData)` should persist the changes such that subsequent queries return the updated data
**Validates: Requirements 2.2, 5.1**

### Property 4: Application secret hashing

*For any* realm with new applications, calling `RealmRepository.create()` or `RealmRepository.update()` should trigger Mongoose pre-save hooks that hash application client secrets
**Validates: Requirements 2.5, 5.3**

### Property 5: Account findAll returns all accounts

*For any* database state, calling `AccountRepository.findAll()` should return all accounts in the database as plain objects
**Validates: Requirements 3.1, 3.2**

### Property 6: Realm findOne returns correct realm

*For any* query filter, calling `RealmRepository.findOne(filter)` should return the first realm matching the filter or null if no match exists
**Validates: Requirements 2.3**

### Property 7: Repository error propagation

*For any* repository method, when an error condition occurs (invalid input, database error), the method should throw an error that can be caught by the caller
**Validates: Requirements 5.5**

## Error Handling

### Repository Error Patterns

Repositories handle errors consistently:

1. **Not Found**: Methods that query return `null` when no matching document is found (not an error)
2. **Invalid Input**: Methods throw `Error` with descriptive message for invalid input (e.g., empty ID, invalid data)
3. **Database Errors**: Methods propagate Mongoose/MongoDB errors to the caller for handling at the service layer
4. **Validation Errors**: Mongoose validation errors are propagated as-is to maintain existing error handling behavior

### Example Error Handling

```typescript
// In repository
async create(realmData: Partial<Realm>): Promise<Realm> {
  if (!realmData || typeof realmData !== 'object') {
    throw new Error('Realm data must be an object');
  }
  
  try {
    const doc = await RealmModel.create(realmData);
    return doc.toObject();
  } catch (error) {
    // Propagate database/validation errors
    throw error;
  }
}
```

### Realm Manager Error Handling

The realm manager continues to use its existing error handling patterns:

```javascript
// Existing pattern in realm manager
try {
  _hasRequiredFields(newRealm);
  _isNameAlreadyTaken(newRealm, req.realms);
  
  const realm = await realmRepository.create(newRealm);
  res.json(_escapeSecrets(realm));
} catch (error) {
  // ServiceError thrown by validation functions
  // or database errors from repository
  throw error;
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify repository method behaviors:

1. **RealmRepository Method Tests**
   - Test `create()` with valid realm data
   - Test `update()` with existing realm
   - Test `findOne()` with various filters
   - Test that plain objects are returned (no Mongoose methods)
   - Test error handling for invalid inputs

2. **AccountRepository Method Tests**
   - Test `findAll()` returns all accounts
   - Test that plain objects are returned
   - Test empty database returns empty array

3. **Mongoose Middleware Tests**
   - Verify application secret hashing occurs on realm creation
   - Verify application secret hashing occurs on realm update with new applications
   - Verify existing application secrets are not re-hashed

### Property-Based Testing

Property-based tests will verify universal properties using **fast-check**:

1. **Plain Object Property**
   - Generate random realm data
   - Call repository methods
   - Verify all returned objects are plain (no Mongoose methods)
   - Run 100+ iterations

2. **Round-trip Property**
   - Generate random realm data
   - Create realm via repository
   - Retrieve realm by ID and by filter
   - Verify retrieved data matches created data (except hashed secrets)
   - Run 100+ iterations

3. **Application Secret Hashing Property**
   - Generate random realm data with applications
   - Create realm via repository
   - Retrieve realm from database
   - Verify application clientSecret is hashed (not equal to original)
   - Run 100+ iterations

4. **Update Persistence Property**
   - Generate random realm data
   - Create realm via repository
   - Generate random update data
   - Update realm via repository
   - Retrieve realm and verify updates persisted
   - Run 100+ iterations

### Integration Testing

Integration tests will verify the realm manager works correctly with repositories:

1. **Add Realm Flow**
   - Test complete add realm flow using repositories
   - Verify realm is created with encrypted secrets
   - Verify application secrets are hashed
   - Verify validation works correctly

2. **Update Realm Flow**
   - Test complete update realm flow using repositories
   - Verify realm is updated correctly
   - Verify secret handling (preserve existing, encrypt new)
   - Verify member population from accounts
   - Verify application credential protection

3. **Query Realm Flow**
   - Test `one()` endpoint returns correct realm
   - Test `all()` endpoint returns all realms
   - Verify secrets are escaped in responses

### Test Configuration

- Property-based tests will run a minimum of 100 iterations per property
- Each property-based test will be tagged with a comment referencing the design document property
- Tag format: `// Feature: api-realm-data-access-layer, Property X: [property text]`
- Tests will use the existing Vitest framework configured in services/common

## Implementation Notes

### Mongoose Middleware Preservation

The existing Realm model has a critical pre-save hook that must continue to work:

**Realm Model Pre-Save Hook:**
```typescript
RealmSchema.pre('save', function (next) {
  for (const app of this.applications) {
    // Check if first save to hash secret
    if (!app.createdDate) {
      app.createdDate = new Date();
      app.clientSecret = bcrypt.hashSync(app.clientSecret, 10);
    }
  }
  next();
});
```

This hook:
1. Runs before every `.save()` call
2. Iterates through all applications
3. For new applications (no `createdDate`), sets the date and hashes the `clientSecret`
4. Existing applications are not re-hashed

### Repository Implementation Strategy

#### For Queries (findOne)

Use `.lean()` to return plain objects:

```typescript
async findOne(filter: { _id: string }): Promise<Realm | null> {
  if (!filter?._id || typeof filter._id !== 'string') {
    throw new Error('Filter must contain a valid _id string');
  }
  
  const realm = await RealmModel.findOne(filter).lean();
  return realm;
}
```

#### For Creates

Use `.create()` then convert to plain object:

```typescript
async create(realmData: Partial<Realm>): Promise<Realm> {
  const doc = await RealmModel.create(realmData);
  return doc.toObject();
}
```

The `.create()` method triggers the pre-save hook, so application secrets are hashed.

#### For Updates (Critical!)

**Must use `.save()` to trigger pre-save hooks:**

```typescript
async update(realmId: string, updateData: Partial<Realm>): Promise<Realm> {
  // 1. Find the existing document
  const realm = await RealmModel.findById(realmId);
  
  if (!realm) {
    throw new Error('Realm not found');
  }
  
  // 2. Update using .set() (Mongoose method)
  realm.set(updateData);
  
  // 3. Save (triggers pre-save hook)
  await realm.save();
  
  // 4. Return plain object
  return realm.toObject();
}
```

**Why not use `findOneAndUpdate()`?**

`findOneAndUpdate()` bypasses Mongoose middleware (pre-save hooks), so application secrets would not be hashed. The realm manager's update flow adds new applications to the `applications` array, and these need to be hashed by the pre-save hook.

### Realm Manager Refactoring Strategy

The refactoring will happen in phases:

1. **Phase 1**: Extend RealmRepository with new methods
2. **Phase 2**: Extend AccountRepository with findAll method
3. **Phase 3**: Add unit tests for new repository methods
4. **Phase 4**: Add property-based tests for new repository methods
5. **Phase 5**: Refactor realm manager `add()` function
6. **Phase 6**: Refactor realm manager `update()` function
7. **Phase 7**: Run integration tests to verify behavior unchanged
8. **Phase 8**: Remove Collections imports from realm manager

### Realm Manager Business Logic Preservation

The following business logic remains in the realm manager (not moved to repositories):

1. **Validation**
   - `_hasRequiredFields()` - validates required fields
   - `_isNameAlreadyTaken()` - checks for duplicate names

2. **Secret Encryption**
   - Encrypting third-party secrets (Gmail, SMTP, Mailgun, B2) using `Crypto.encrypt()`
   - Preserving existing encrypted secrets when not updated

3. **Secret Escaping**
   - `_escapeSecrets()` - replaces secrets with placeholder before sending to client

4. **Member Population**
   - Building username map from accounts
   - Populating member names and registered status

5. **Application Credential Protection**
   - Preventing updates to existing application credentials
   - Only allowing creation and deletion

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

// Create
const newRealm = new Collections.Realm(req.body);
// ... encrypt secrets ...
const saved = await newRealm.save();

// Query
const previousRealm = await Collections.Realm.findOne({
  _id: req.body._id
});

// Update
const updatedRealm = { ...previousRealm.toObject(), ...req.body };
previousRealm.set(updatedRealm);
await previousRealm.save();

// Query accounts
const dbAccounts = await Collections.Account.find().lean();
```

**After (Repository):**
```javascript
import { DataAccess } from '@microrealestate/common';

const realmRepository = DataAccess.getRealmRepository();
const accountRepository = DataAccess.getAccountRepository();

// Create
// ... encrypt secrets ...
const saved = await realmRepository.create(req.body);

// Query
const previousRealm = await realmRepository.findOne({
  _id: req.body._id
});

// Update
const updatedRealm = { ...previousRealm, ...req.body };
await realmRepository.update(req.body._id, updatedRealm);

// Query accounts
const dbAccounts = await accountRepository.findAll();
```

## Dependencies

### Existing Dependencies

The extended repositories use existing dependencies from services/common:

- `mongoose@6.13.6` - MongoDB ODM
- `bcrypt@5.1.1` - Password/secret hashing (used by Mongoose middleware)
- `@microrealestate/types` - TypeScript type definitions

### Development Dependencies

- `vitest@2.1.0` - Unit testing framework
- `@vitest/coverage-v8@2.1.0` - Code coverage
- `fast-check@3.x` - Property-based testing library (already added for authenticator)

### No New Runtime Dependencies

The implementation requires no new runtime dependencies. All functionality is built on existing packages.

## Performance Considerations

### Query Performance

Using `.lean()` for queries provides performance benefits:

1. **Faster**: Skips Mongoose document hydration
2. **Less Memory**: Plain objects are lighter than Mongoose documents
3. **Serialization**: Plain objects serialize to JSON faster

### Update Performance

The `update()` method uses `.save()` which is slightly slower than `findOneAndUpdate()` because it:
1. Requires two database operations (find + save)
2. Hydrates the full Mongoose document
3. Runs all middleware

However, this is necessary to trigger pre-save hooks for application secret hashing. The performance impact is negligible for realm updates (infrequent operation).

### No Performance Regression

The refactoring should not significantly impact performance:

1. Same Mongoose queries under the hood
2. `.lean()` is actually faster than returning full documents
3. Update operation is same as current implementation (uses `.save()`)
4. No additional network calls or processing

## Security Considerations

### Application Secret Security

Application secrets continue to be hashed via Mongoose pre-save hooks:

1. Secrets are hashed before storage (bcrypt with salt rounds = 10)
2. Repository methods return hashed secrets only
3. Secret comparison happens in service layer using bcrypt.compare()

### Third-Party Secret Security

Third-party secrets (Gmail, SMTP, Mailgun, B2) continue to be encrypted:

1. Encryption happens in realm manager before calling repository
2. Realm manager uses `Crypto.encrypt()` from common package
3. Repository stores encrypted values as-is
4. Decryption happens in services that need the secrets (emailer)

### Secret Escaping

Secrets are escaped before sending to client:

1. `_escapeSecrets()` function remains in realm manager
2. Replaces all secrets with `SECRET_PLACEHOLDER` ('**********')
3. Applied to all responses (add, update, one, all)

### No New Security Risks

The refactoring introduces no new security risks:

1. Same validation logic (in realm manager)
2. Same hashing logic (Mongoose middleware)
3. Same encryption logic (in realm manager)
4. Same query patterns (Mongoose queries)
5. No exposure of sensitive data in plain objects

## Migration Path for Other Managers

If this refactoring is successful, other managers can follow the same pattern:

1. **Property Manager** - extend with PropertyRepository
2. **Lease Manager** - extend with LeaseRepository and TemplateRepository
3. **Occupant Manager** - extend with TenantRepository and DocumentRepository
4. **Rent Manager** - extend TenantRepository with aggregation methods
5. **Accounting Manager** - extend TenantRepository with aggregation methods

Each manager can be refactored independently without affecting others.
