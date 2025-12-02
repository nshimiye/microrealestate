# Requirements Document

## Introduction

This specification defines the requirements for isolating MongoDB/Mongoose-specific logic from the API service's realm manager (`services/api/src/managers/realmmanager.js`) by leveraging the existing data access layer in the `services/common` package. Currently, the realm manager directly uses Mongoose models (`Collections.Realm`, `Collections.Account`) for database operations, creating tight coupling between business logic and data persistence. This refactoring will improve maintainability, testability, and separation of concerns by using the repository pattern that abstracts database operations, following the same approach successfully implemented for the authenticator service. This is a focused pilot refactoring - if successful, the pattern will be applied to other managers in the API service.

## Glossary

- **API Service**: The main landlord-facing REST API microservice responsible for managing properties, tenants, leases, rents, and documents (`services/api`)
- **Realm Manager**: The business logic module in the API service responsible for managing organizations/landlords (`services/api/src/managers/realmmanager.js`)
- **Data Access Layer (DAL)**: A software layer that provides an abstraction between business logic and data persistence, implemented using the repository pattern
- **Repository**: A class that encapsulates data access logic for a specific entity (e.g., RealmRepository for Realm operations, AccountRepository for Account operations)
- **Mongoose Model**: A MongoDB ODM (Object-Document Mapper) model that provides an interface to interact with MongoDB collections
- **Collections**: The current namespace in `@microrealestate/common` that exports Mongoose models directly
- **Common Package**: The shared backend utilities package (`@microrealestate/common`) that provides reusable code across all services
- **Realm**: An organization/landlord entity that contains members, applications, third-party integrations, and settings
- **Third-Party Secrets**: Encrypted credentials for external services (Gmail, SMTP, Mailgun, Backblaze B2) stored in realm.thirdParties

## Requirements

### Requirement 1

**User Story:** As a developer, I want the realm manager to use existing repository methods, so that it is decoupled from Mongoose implementation details.

#### Acceptance Criteria

1. WHEN the realm manager needs to query realms THEN the system SHALL use RealmRepository methods instead of direct Mongoose model calls
2. WHEN the realm manager needs to create realms THEN the system SHALL use RealmRepository methods that return plain JavaScript objects
3. WHEN the realm manager needs to update realms THEN the system SHALL use RealmRepository methods that handle persistence logic
4. WHEN the realm manager needs to query accounts THEN the system SHALL use AccountRepository methods instead of direct Mongoose model calls
5. WHEN the realm manager performs operations THEN the system SHALL maintain all existing business logic functionality without behavioral changes

### Requirement 2

**User Story:** As a developer, I want to extend the existing RealmRepository with methods needed by the realm manager, so that all realm operations are consistently abstracted.

#### Acceptance Criteria

1. WHEN RealmRepository is extended THEN the system SHALL provide a `create(realmData)` method for creating new realms
2. WHEN RealmRepository is extended THEN the system SHALL provide an `update(realmId, updateData)` method for updating existing realms
3. WHEN RealmRepository is extended THEN the system SHALL provide a `findOne(filter)` method for querying a single realm
4. WHEN RealmRepository methods are called THEN the system SHALL return plain JavaScript objects using `.lean()` or `.toObject()`
5. WHEN RealmRepository methods are called THEN the system SHALL preserve Mongoose middleware behavior (pre-save hooks for hashing application secrets)

### Requirement 3

**User Story:** As a developer, I want to extend the existing AccountRepository with methods needed by the realm manager, so that account lookups are consistently abstracted.

#### Acceptance Criteria

1. WHEN AccountRepository is extended THEN the system SHALL provide a `findAll()` method for retrieving all accounts
2. WHEN AccountRepository.findAll is called THEN the system SHALL return plain JavaScript objects with email, firstname, and lastname fields
3. WHEN AccountRepository methods are called THEN the system SHALL use `.lean()` to return plain objects
4. WHEN AccountRepository is used THEN the system SHALL maintain backward compatibility with existing authenticator service usage
5. WHEN AccountRepository is extended THEN the system SHALL include JSDoc comments and TypeScript type annotations

### Requirement 4

**User Story:** As a developer, I want the realm manager refactored to use repositories, so that it no longer directly depends on Mongoose models.

#### Acceptance Criteria

1. WHEN the realm manager is refactored THEN the system SHALL replace `new Collections.Realm()` with `realmRepository.create()`
2. WHEN the realm manager is refactored THEN the system SHALL replace `Collections.Realm.findOne()` with `realmRepository.findOne()`
3. WHEN the realm manager is refactored THEN the system SHALL replace `realm.save()` with `realmRepository.update()`
4. WHEN the realm manager is refactored THEN the system SHALL replace `Collections.Account.find()` with `accountRepository.findAll()`
5. WHEN the realm manager is refactored THEN the system SHALL remove direct imports of `Collections` from realmmanager.js
6. WHEN the realm manager is refactored THEN the system SHALL import repositories from `DataAccess` namespace

### Requirement 5

**User Story:** As a developer, I want repositories to handle Mongoose document operations correctly, so that the realm manager's update logic continues to work.

#### Acceptance Criteria

1. WHEN RealmRepository.update is called THEN the system SHALL support updating an existing Mongoose document with new data
2. WHEN RealmRepository.update is called THEN the system SHALL use `.set()` method to update the document before saving
3. WHEN RealmRepository.update is called THEN the system SHALL trigger Mongoose pre-save hooks for application secret hashing
4. WHEN RealmRepository.update returns data THEN the system SHALL convert the saved document to a plain object
5. WHEN RealmRepository operations fail THEN the system SHALL propagate errors to the caller for handling at the service layer

### Requirement 6

**User Story:** As a developer, I want the realm manager to continue handling secrets correctly, so that third-party credentials remain encrypted.

#### Acceptance Criteria

1. WHEN realms are created THEN the system SHALL encrypt third-party secrets (Gmail, SMTP, Mailgun, B2) before persistence
2. WHEN realms are updated THEN the system SHALL preserve existing encrypted secrets when not updated
3. WHEN realms are updated THEN the system SHALL encrypt new secrets when provided
4. WHEN realms are returned to clients THEN the system SHALL escape secrets with placeholder values
5. WHEN application credentials are created THEN the system SHALL hash client secrets via Mongoose pre-save hooks

### Requirement 7

**User Story:** As a developer, I want the realm manager to continue validating data correctly, so that invalid realms are rejected.

#### Acceptance Criteria

1. WHEN realms are created THEN the system SHALL validate required fields (name, members, currency, locale, administrator)
2. WHEN realms are created THEN the system SHALL check for duplicate realm names
3. WHEN realms are updated THEN the system SHALL validate required fields
4. WHEN realms are updated THEN the system SHALL check for duplicate names if name is changed
5. WHEN validation fails THEN the system SHALL throw ServiceError with appropriate status codes (422, 409)

### Requirement 8

**User Story:** As a developer, I want the realm manager to continue populating member information correctly, so that registered members are identified.

#### Acceptance Criteria

1. WHEN realms are updated THEN the system SHALL query all accounts to build a username map
2. WHEN realms are updated THEN the system SHALL populate member names from the username map
3. WHEN realms are updated THEN the system SHALL set member.registered to true for accounts that exist
4. WHEN realms are updated THEN the system SHALL set member.registered to false for accounts that don't exist
5. WHEN realms are updated THEN the system SHALL set member.name to empty string for unregistered members

### Requirement 9

**User Story:** As a developer, I want the refactoring to be backward compatible, so that other managers and services are not affected.

#### Acceptance Criteria

1. WHEN the data access layer is extended THEN the system SHALL keep existing Collections exports unchanged
2. WHEN the data access layer is extended THEN the system SHALL export both Collections and DataAccess from common package
3. WHEN other managers use Collections THEN the system SHALL continue to support direct Mongoose model access
4. WHEN the realm manager is migrated THEN the system SHALL not require changes to other managers or services
5. WHEN the common package is built THEN the system SHALL compile successfully with extended repositories

### Requirement 10

**User Story:** As a developer, I want clear documentation for the extended repository methods, so that I can understand how to use them.

#### Acceptance Criteria

1. WHEN RealmRepository methods are added THEN the system SHALL include JSDoc comments describing purpose and parameters
2. WHEN AccountRepository methods are added THEN the system SHALL include JSDoc comments describing purpose and parameters
3. WHEN repository methods are added THEN the system SHALL include TypeScript type annotations for all signatures
4. WHEN repository methods handle errors THEN the system SHALL document expected error conditions
5. WHEN repositories are exported THEN the system SHALL maintain clear import paths in the common package index
