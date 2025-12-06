# @microrealestate/common

Shared utilities and data access layer for MicroRealEstate services.

## Contents

- **Data Access Layer**: Repository pattern implementations for MongoDB and DynamoDB
- **Utilities**: Logger, environment config, error handling, and DynamoDB helpers
- **Models**: Shared data models and interfaces

## Data Access Layer

The data access layer supports both MongoDB and DynamoDB backends through a factory pattern. The active backend is selected via the `USE_DYNAMODB` environment variable.

### Supported Entities

- Account
- Realm
- Lease
- Property
- Template
- Tenant
- Document

### DynamoDB Implementation

The DynamoDB implementation uses a single-table design with composite keys (PK/SK) and Global Secondary Indexes (GSIs) for efficient querying.

**Getting Started**: See [DYNAMODB_SETUP.md](./DYNAMODB_SETUP.md) for complete setup instructions including:
- Local development with DynamoDB Local
- AWS DynamoDB table creation
- Environment configuration
- Troubleshooting guide

#### Important Constraints

DynamoDB has specific constraints that differ from MongoDB:

- **Item Size Limit**: 400KB maximum per item (validated before writes)
- **Empty Strings**: Not supported as attribute values
- **Reserved Words**: ~500 reserved words require expression attribute names
- **Batch Operations**: Limited to 25 items per batch

See [DYNAMODB_CONSTRAINTS.md](./DYNAMODB_CONSTRAINTS.md) for detailed information about DynamoDB-specific constraints and how they are handled.

#### Empty String Handling

**Status**: Currently deferred

Empty string handling is intentionally not implemented as it requires system-wide changes to data transformation logic. The application currently validates inputs to avoid storing empty strings.

When implementing this feature in the future, use the utility functions in `src/utils/dynamodb-helpers.ts`:
- `sanitizeEmptyStrings()` - Convert empty strings to null
- `removeEmptyStrings()` - Omit empty string attributes
- `findEmptyStrings()` - Validate data before writing

See [DYNAMODB_CONSTRAINTS.md](./DYNAMODB_CONSTRAINTS.md) for implementation guidance.

## Usage

### Repository Factory Pattern

```typescript
import { getAccountRepository } from '@microrealestate/common/data-access-layer/account';

// Returns MongoDB or DynamoDB implementation based on USE_DYNAMODB env var
const accountRepo = getAccountRepository();

// Use the repository (interface is identical for both backends)
const account = await accountRepo.findByEmail('user@example.com');
```

### Environment Configuration

```typescript
import EnvironmentConfig from '@microrealestate/common/utils/environmentconfig';

const config = EnvironmentConfig.getInstance();
const dbUrl = config.MONGO_URL;
```

### Logging

```typescript
import logger from '@microrealestate/common/utils/logger';

logger.info('Operation completed', { userId: '123', duration: 45 });
logger.error('Operation failed', { error: err.message });
```

## Development

### Building

```bash
yarn workspace @microrealestate/common build
```

### Testing

```bash
# Run all tests
yarn workspace @microrealestate/common test

# Run tests in watch mode
yarn workspace @microrealestate/common test:watch

# Run with coverage
yarn workspace @microrealestate/common test:coverage
```

### Test Coverage

The common package includes:
- Unit tests for repository implementations
- Property-based tests for data transformations
- Integration tests for database operations

## Dependencies

- **MongoDB**: Mongoose 6.x for MongoDB operations
- **DynamoDB**: AWS SDK v3 for DynamoDB operations
- **Testing**: Vitest 2.x with fast-check for property-based testing
- **Utilities**: bcrypt for password hashing, winston for logging

## Architecture

```
services/common/
├── src/
│   ├── data-access-layer/     # Repository implementations
│   │   ├── account/
│   │   ├── realm/
│   │   ├── lease/
│   │   ├── property/
│   │   ├── template/
│   │   ├── tenant/
│   │   └── document/
│   ├── models/                 # Mongoose models (MongoDB)
│   ├── utils/                  # Shared utilities
│   │   ├── dynamodbclient.ts
│   │   ├── dynamodb-helpers.ts
│   │   ├── logger.ts
│   │   ├── environmentconfig.ts
│   │   └── serviceerror.ts
│   └── __tests__/              # Test files
├── DYNAMODB_CONSTRAINTS.md     # DynamoDB constraint documentation
└── package.json
```

## Contributing

When adding new repositories or utilities:

1. Implement both MongoDB and DynamoDB versions
2. Ensure interface compatibility between implementations
3. Add comprehensive tests (unit + property-based)
4. Update documentation
5. Consider DynamoDB constraints (see DYNAMODB_CONSTRAINTS.md)

## License

See the main project LICENSE file.
