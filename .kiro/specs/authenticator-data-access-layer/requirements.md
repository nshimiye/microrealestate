# Requirements Document

## Introduction

This specification defines the requirements for isolating MongoDB/Mongoose-specific logic from the authenticator service by creating a dedicated data access layer in the `services/common` package. Currently, the authenticator service directly uses Mongoose models (`Collections.Account`, `Collections.Realm`, `Collections.Tenant`) for database operations, creating tight coupling between business logic and data persistence. This refactoring will improve maintainability, testability, and separation of concerns by introducing a repository pattern that abstracts database operations.

## Glossary

- **Authenticator Service**: The microservice responsible for user authentication, token management, and password reset functionality (`services/authenticator`)
- **Data Access Layer (DAL)**: A software layer that provides an abstraction between business logic and data persistence, implemented using the repository pattern
- **Repository**: A class that encapsulates data access logic for a specific entity (e.g., AccountRepository for Account operations)
- **Mongoose Model**: A MongoDB ODM (Object-Document Mapper) model that provides an interface to interact with MongoDB collections
- **Collections**: The current namespace in `@microrealestate/common` that exports Mongoose models directly
- **Business Logic**: The authentication-related operations in the authenticator service (sign in, sign up, token generation, password reset)
- **Common Package**: The shared backend utilities package (`@microrealestate/common`) that provides reusable code across all services

## Requirements

### Requirement 1

**User Story:** As a developer, I want database operations abstracted into a data access layer, so that the authenticator service is decoupled from Mongoose implementation details.

#### Acceptance Criteria

1. WHEN the authenticator service needs to query accounts THEN the system SHALL use repository methods instead of direct Mongoose model calls
2. WHEN the authenticator service needs to create accounts THEN the system SHALL use repository methods that return plain JavaScript objects instead of Mongoose documents
3. WHEN the authenticator service needs to find tenants by email THEN the system SHALL use repository methods that encapsulate the query logic
4. WHEN the authenticator service needs to find realms THEN the system SHALL use repository methods that hide MongoDB-specific query syntax
5. WHEN the authenticator service needs to update accounts THEN the system SHALL use repository methods that handle the persistence logic

### Requirement 2

**User Story:** As a developer, I want a repository pattern implemented in the common package, so that all services can benefit from consistent data access patterns.

#### Acceptance Criteria

1. WHEN creating the data access layer THEN the system SHALL implement an AccountRepository class in `services/common/src/dataAccess/`
2. WHEN creating the data access layer THEN the system SHALL implement a TenantRepository class in `services/common/src/dataAccess/`
3. WHEN creating the data access layer THEN the system SHALL implement a RealmRepository class in `services/common/src/dataAccess/`
4. WHEN repositories are created THEN the system SHALL export them from `services/common/src/index.ts` for use by other services
5. WHEN repositories perform operations THEN the system SHALL return plain JavaScript objects (using `.lean()` or `.toObject()`) instead of Mongoose documents

### Requirement 3

**User Story:** As a developer, I want repository methods to match the current usage patterns in the authenticator service, so that the refactoring is straightforward and maintains existing functionality.

#### Acceptance Criteria

1. WHEN AccountRepository is implemented THEN the system SHALL provide a `findByEmail(email: string)` method that returns an account or null
2. WHEN AccountRepository is implemented THEN the system SHALL provide a `create(accountData)` method that creates and returns a new account
3. WHEN AccountRepository is implemented THEN the system SHALL provide a `findById(id: string)` method for retrieving accounts by ID
4. WHEN TenantRepository is implemented THEN the system SHALL provide a `findByContactEmail(email: string)` method that returns matching tenants
5. WHEN RealmRepository is implemented THEN the system SHALL provide a `findById(id: string)` method that returns a realm with its applications

### Requirement 4

**User Story:** As a developer, I want the authenticator service refactored to use the new repositories, so that it no longer directly depends on Mongoose models.

#### Acceptance Criteria

1. WHEN the authenticator service is refactored THEN the system SHALL replace all `Collections.Account` calls with `AccountRepository` methods
2. WHEN the authenticator service is refactored THEN the system SHALL replace all `Collections.Tenant` calls with `TenantRepository` methods
3. WHEN the authenticator service is refactored THEN the system SHALL replace all `Collections.Realm` calls with `RealmRepository` methods
4. WHEN the authenticator service is refactored THEN the system SHALL remove direct imports of `Collections` from route files
5. WHEN the authenticator service is refactored THEN the system SHALL maintain all existing authentication functionality without behavioral changes

### Requirement 5

**User Story:** As a developer, I want the data access layer to handle Mongoose-specific concerns, so that business logic remains clean and focused.

#### Acceptance Criteria

1. WHEN repositories perform queries THEN the system SHALL handle email normalization (lowercase conversion) within the repository layer
2. WHEN repositories return data THEN the system SHALL convert Mongoose documents to plain objects before returning to callers
3. WHEN repositories encounter errors THEN the system SHALL throw appropriate errors that can be caught by the service layer
4. WHEN repositories are initialized THEN the system SHALL use the existing Mongoose models from the Collections namespace
5. WHEN repositories perform operations THEN the system SHALL maintain all existing Mongoose middleware behavior (pre-save hooks, post-save hooks)

### Requirement 6

**User Story:** As a developer, I want the refactoring to be backward compatible, so that other services using Collections directly are not affected.

#### Acceptance Criteria

1. WHEN the data access layer is added THEN the system SHALL keep the existing Collections exports in `services/common` unchanged
2. WHEN the data access layer is added THEN the system SHALL export both Collections and Repositories from the common package
3. WHEN other services use Collections THEN the system SHALL continue to support direct Mongoose model access for services not yet migrated
4. WHEN the authenticator service is migrated THEN the system SHALL not require changes to other services (api, tenantapi, etc.)
5. WHEN the common package is built THEN the system SHALL compile both the Collections and DataAccess modules successfully

### Requirement 7

**User Story:** As a developer, I want clear documentation and examples, so that I can understand how to use the new data access layer.

#### Acceptance Criteria

1. WHEN repositories are created THEN the system SHALL include JSDoc comments describing each method's purpose and parameters
2. WHEN repositories are created THEN the system SHALL include TypeScript type annotations for all method signatures
3. WHEN the refactoring is complete THEN the system SHALL provide examples of repository usage in the authenticator service
4. WHEN repositories handle errors THEN the system SHALL document expected error conditions and return types
5. WHEN repositories are exported THEN the system SHALL include clear import paths in the common package index file
