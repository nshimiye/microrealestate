# Data Access Layer

This directory contains the data access layer implementation for MicroRealEstate, providing a clean abstraction over different database backends (MongoDB and DynamoDB).

## Architecture

The data access layer follows the Repository pattern with database-agnostic interfaces. This design allows the application to switch between MongoDB and DynamoDB without changing business logic code.

### Design Principles

- **Interface-based**: All repositories implement well-defined interfaces
- **Database-agnostic**: Business logic depends only on interfaces, not implementations
- **Factory pattern**: Runtime selection of database implementation via environment configuration
- **Type-safe**: Full TypeScript support with shared types from `@microrealestate/types`
- **Consistent patterns**: All entities follow the same structural conventions

## Directory Structure

```
data-access-layer/
├── index.ts                          # Main exports (public API)
├── README.md                         # This file
│
├── dynamo/                           # Shared DynamoDB utilities
│   └── base.ts                       # BaseRepository abstract class
│
├── <entity>/                         # Per-entity structure
│   ├── interface.ts                  # Repository interface (IEntityRepository)
│   ├── index.ts                      # Factory function (getEntityRepository)
│   ├── mongodb/
│   │   └── repository.ts             # MongoDB/Mongoose implementation
│   └── dynamodb/
│       ├── base-repository.ts        # Entity-specific base (extends BaseRepository)
│       └── repository.ts             # DynamoDB implementation
│
├── realm/                            # Realm entity (organization/tenant)
│   ├── interface.ts                  # IRealmRepository
│   ├── index.ts                      # getRealmRepository()
│   ├── mongodb/
│   │   └── repository.ts
│   └── dynamodb/
│       ├── base-repository.ts
│       └── repository.ts
│
└── lease/                            # Lease entity (lease templates)
    ├── interface.ts                  # ILeaseRepository
    ├── index.ts                      # getLeaseRepository()
    ├── mongodb/
    │   └── repository.ts
    └── dynamodb/
        ├── base-repository.ts
        └── repository.ts
```

## Current Entities

### Realm
- **Interface**: `IRealmRepository`
- **Factory**: `getRealmRepository()`
- **Purpose**: Manages organization/tenant data, members, and applications
- **Key Operations**:
  - `findById(id)` - Get realm by ID
  - `findOne(filter)` - Query single realm
  - `create(realmData)` - Create new realm
  - `update(realmId, updateData)` - Update realm
  - `updateMemberRegistration(email, name)` - Update member registration status

### Lease
- **Interface**: `ILeaseRepository`
- **Factory**: `getLeaseRepository()`
- **Purpose**: Manages lease templates and configurations
- **Key Operations**:
  - `create(leaseData)` - Create new lease
  - `findById(leaseId, realmId)` - Get lease by ID
  - `findAll(realmId)` - Get all leases in realm
  - `findByIds(leaseIds, realmId)` - Get multiple leases
  - `update(leaseId, realmId, updateData)` - Update lease
  - `deleteMany(leaseIds, realmId, session?)` - Delete multiple leases
  - `findLeaseIdsUsedByTenants(realmId)` - Check lease usage

## Usage Examples

### Basic Usage

```typescript
import { getRealmRepository, getLeaseRepository } from '@microrealestate/common/data-access-layer';

// Get repository instances (automatically selects MongoDB or DynamoDB)
const realmRepo = getRealmRepository();
const leaseRepo = getLeaseRepository();

// Use repositories
const realm = await realmRepo.findById('507f1f77bcf86cd799439011');
const leases = await leaseRepo.findAll(realm._id);
```

### Creating Entities

```typescript
const newRealm = await realmRepo.create({
  name: 'My Organization',
  members: [{
    name: 'John Doe',
    email: 'john@example.com',
    role: 'administrator',
    registered: true
  }],
  locale: 'en',
  currency: 'USD'
});

const newLease = await leaseRepo.create({
  realmId: newRealm._id,
  name: '12 Month Lease',
  numberOfTerms: 12,
  timeRange: 'months',
  active: true
});
```

### Updating Entities

```typescript
const updatedRealm = await realmRepo.update(realmId, {
  name: 'Updated Organization Name',
  locale: 'fr'
});

const updatedLease = await leaseRepo.update(leaseId, realmId, {
  name: 'Updated Lease Name',
  active: false
});
```

### Querying

```typescript
// Find all leases in a realm
const allLeases = await leaseRepo.findAll(realmId);

// Find specific leases
const specificLeases = await leaseRepo.findByIds(
  ['lease1', 'lease2'],
  realmId
);

// Check which leases are in use
const usedLeaseIds = await leaseRepo.findLeaseIdsUsedByTenants(realmId);
if (usedLeaseIds.has(leaseId)) {
  console.log('Cannot delete: lease is in use');
}
```

## Configuration

The factory functions automatically select the correct implementation based on the `USE_DYNAMODB` environment variable:

- `USE_DYNAMODB=true` - Uses DynamoDB repositories
- `USE_DYNAMODB=false` or unset - Uses MongoDB repositories (default)

### DynamoDB Configuration

When using DynamoDB, additional environment variables are required:

```bash
USE_DYNAMODB=true
DYNAMODB_TABLE_NAME=microrealestate-table
DYNAMODB_REGION=us-east-1
DYNAMODB_ENDPOINT=http://localhost:8000  # Optional, for local development
```

## Implementation Details

### MongoDB Implementation

- Uses Mongoose models and schemas
- Returns plain JavaScript objects (via `.lean()` or `.toObject()`)
- Leverages Mongoose middleware (pre-save hooks, validation)
- Supports transactions via sessions

### DynamoDB Implementation

- Extends `BaseRepository<T>` abstract class
- Uses single-table design with composite keys (PK/SK)
- Key patterns:
  - Realm: `PK=REALM#<realmId>`, `SK=REALM#<realmId>`
  - Lease: `PK=REALM#<realmId>`, `SK=LEASE#<leaseId>`
- Validates item size (400KB limit)
- Uses conditional updates to prevent race conditions

### BaseRepository Pattern

The `dynamo/base.ts` provides a reusable abstract class with:

- **Abstract methods** (must implement):
  - `buildPK(id, realmId?)` - Construct partition key
  - `buildSK(id)` - Construct sort key
  - `toItem(entity)` - Transform entity to DynamoDB item
  - `fromItem(item)` - Transform DynamoDB item to entity

- **Concrete methods** (inherited):
  - `create(entity)` - Create new item
  - `findById(id, realmId?)` - Get item by ID
  - `update(id, updates, realmId?)` - Update item
  - `delete(id, realmId?)` - Delete item
  - `findByRealm(realmId, entityPrefix)` - Query all items in realm
  - `validateItemSize(item)` - Ensure item doesn't exceed 400KB

## Adding New Entities

To add a new entity to the data access layer:

### 1. Create Entity Directory Structure

```bash
mkdir -p data-access-layer/<entity-name>/mongodb
mkdir -p data-access-layer/<entity-name>/dynamodb
```

### 2. Define Interface (`<entity-name>/interface.ts`)

```typescript
import { CollectionTypes } from '@microrealestate/types';

export interface IEntityRepository {
  create(data: Partial<CollectionTypes.Entity>): Promise<CollectionTypes.Entity>;
  findById(id: string, realmId: string): Promise<CollectionTypes.Entity | null>;
  findAll(realmId: string): Promise<CollectionTypes.Entity[]>;
  update(id: string, realmId: string, data: Partial<CollectionTypes.Entity>): Promise<CollectionTypes.Entity | null>;
  delete(id: string, realmId: string): Promise<void>;
}
```

### 3. Implement MongoDB Repository (`<entity-name>/mongodb/repository.ts`)

```typescript
import { Entity } from '../../models/index.js';
import { IEntityRepository } from '../interface.js';
import { CollectionTypes } from '@microrealestate/types';

export default class MongoRepository implements IEntityRepository {
  async create(data: Partial<CollectionTypes.Entity>): Promise<CollectionTypes.Entity> {
    const entity = new Entity(data);
    await entity.save();
    return entity.toObject();
  }

  async findById(id: string, realmId: string): Promise<CollectionTypes.Entity | null> {
    const entity = await Entity.findOne({ _id: id, realmId }).lean();
    return entity;
  }

  // ... implement other methods
}
```

### 4. Implement DynamoDB Base Repository (`<entity-name>/dynamodb/base-repository.ts`)

```typescript
import { BaseRepository } from '../../dynamo/base.js';
import { CollectionTypes } from '@microrealestate/types';

export abstract class EntityBaseRepository extends BaseRepository<CollectionTypes.Entity> {
  protected buildPK(id: string, realmId?: string): string {
    return `REALM#${realmId}`;
  }

  protected buildSK(id: string): string {
    return `ENTITY#${id}`;
  }

  protected toItem(entity: CollectionTypes.Entity): Record<string, any> {
    return {
      PK: this.buildPK(entity._id, entity.realmId),
      SK: this.buildSK(entity._id),
      _id: entity._id,
      realmId: entity.realmId,
      // ... map other fields
    };
  }

  protected fromItem(item: Record<string, any>): CollectionTypes.Entity {
    return {
      _id: item._id,
      realmId: item.realmId,
      // ... map other fields
    };
  }
}
```

### 5. Implement DynamoDB Repository (`<entity-name>/dynamodb/repository.ts`)

```typescript
import { EntityBaseRepository } from './base-repository.js';
import { IEntityRepository } from '../interface.js';
import { CollectionTypes } from '@microrealestate/types';

export default class DynamoRepository extends EntityBaseRepository implements IEntityRepository {
  async findAll(realmId: string): Promise<CollectionTypes.Entity[]> {
    return this.findByRealm(realmId, 'ENTITY#');
  }

  // ... implement entity-specific methods
}
```

### 6. Create Factory Function (`<entity-name>/index.ts`)

```typescript
import MongoRepository from './mongodb/repository.js';
import DynamoRepository from './dynamodb/repository.js';
import { IEntityRepository } from './interface.js';
import Service from '../../utils/service.js';

export { IEntityRepository } from './interface.js';

export function getEntityRepository(): IEntityRepository {
  const service = Service.getInstance();
  const { USE_DYNAMODB } = service.envConfig.getValues();
  const useDynamoDB = USE_DYNAMODB && String(USE_DYNAMODB) === 'true';

  if (useDynamoDB) {
    return new DynamoRepository();
  }
  return new MongoRepository();
}
```

### 7. Export from Main Index (`data-access-layer/index.ts`)

```typescript
export { getEntityRepository, IEntityRepository } from './entity/index.js';
```

## Testing

Each repository implementation should be tested independently:

```typescript
import { getEntityRepository } from '@microrealestate/common/data-access-layer';

describe('EntityRepository', () => {
  let repo: IEntityRepository;

  beforeEach(() => {
    repo = getEntityRepository();
  });

  it('should create entity', async () => {
    const entity = await repo.create({ name: 'Test' });
    expect(entity._id).toBeDefined();
  });

  // ... more tests
});
```

## Migration Considerations

When migrating from direct model access to repositories:

1. Replace direct Mongoose model imports with repository factory functions
2. Update method calls to match repository interface
3. Remove `.lean()` calls (repositories return plain objects)
4. Update transaction handling to use repository sessions
5. Test thoroughly with both MongoDB and DynamoDB configurations

## Best Practices

- Always use factory functions (`getEntityRepository()`) instead of direct imports
- Keep interfaces database-agnostic (no Mongoose or DynamoDB-specific types)
- Return plain JavaScript objects, not database-specific documents
- Use TypeScript types from `@microrealestate/types`
- Validate inputs in repository methods
- Log operations for debugging and monitoring
- Handle errors consistently across implementations
- Document all public methods with JSDoc comments
