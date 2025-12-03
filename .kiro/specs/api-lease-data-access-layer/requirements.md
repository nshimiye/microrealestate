# Requirements Document

## Introduction

This specification defines the requirements for isolating MongoDB/Mongoose-specific logic from the API service's lease manager (`services/api/src/managers/leasemanager.js`) by creating a new data access layer in the `services/common` package. Currently, the lease manager directly uses Mongoose models (`Collections.Lease`, `Collections.Tenant`, `Collections.Template`) for database operations, creating tight coupling between business logic and data persistence. This refactoring will improve maintainability, testability, and separation of concerns by using the repository pattern that abstracts database operations, following the same approach successfully implemented for realm manager and occupant manager. This continues the systematic refactoring of API service managers to use the repository pattern.

## Glossary

- **API Service**: The main landlord-facing REST API microservice responsible for managing properties, tenants, leases, rents, and documents (`services/api`)
- **Lease Manager**: The business logic module in the API service responsible for managing lease templates (`services/api/src/managers/leasemanager.js`)
- **Data Access Layer (DAL)**: A software layer that provides an abstraction between business logic and data persistence, implemented using the repository pattern
- **Repository**: A class that encapsulates data access logic for a specific entity (e.g., LeaseRepository for Lease operations, TemplateRepository for Template operations)
- **Mongoose Model**: A MongoDB ODM (Object-Document Mapper) model that provides an interface to interact with MongoDB collections
- **Collections**: The current namespace in `@microrealestate/common` that exports Mongoose models directly
- **Common Package**: The shared backend utilities package (`@microrealestate/common`) that provides reusable code across all services
- **Lease**: A rental agreement template that defines the terms, duration, and payment schedule for properties
- **Template**: A document template (letter, notice, contract, invoice) that can be linked to one or more leases
- **Tenant**: An occupant entity that references a lease through the `leaseId` field
- **Realm**: An organization/landlord entity that owns leases, templates, and tenants
- **Transaction**: A MongoDB session-based transaction that ensures atomicity across multiple operations

## Requirements

### Requirement 1

**User Story:** As a developer, I want to create a LeaseRepository in the common package, so that lease database operations are abstracted from the lease manager.

#### Acceptance Criteria

1. WHEN LeaseRepository is created THEN the system SHALL provide a `create(leaseData)` method for creating new leases
2. WHEN LeaseRepository is created THEN the system SHALL provide a `findById(leaseId, realmId)` method for querying a single lease
3. WHEN LeaseRepository is created THEN the system SHALL provide a `findAll(realmId)` method for querying all leases in a realm
4. WHEN LeaseRepository is created THEN the system SHALL provide an `update(leaseId, realmId, updateData)` method for updating leases
5. WHEN LeaseRepository is created THEN the system SHALL provide a `deleteMany(leaseIds, realmId)` method for deleting multiple leases
6. WHEN LeaseRepository methods are called THEN the system SHALL return plain JavaScript objects using `.lean()` or `.toObject()`

### Requirement 2

**User Story:** As a developer, I want to create a TemplateRepository in the common package, so that template database operations are abstracted from the lease manager.

#### Acceptance Criteria

1. WHEN TemplateRepository is created THEN the system SHALL provide a `findByLinkedResources(leaseIds, realmId)` method for finding templates linked to leases
2. WHEN TemplateRepository is created THEN the system SHALL provide a `deleteMany(templateIds, realmId)` method for deleting multiple templates
3. WHEN TemplateRepository is created THEN the system SHALL provide an `updateMany(filter, update)` method for bulk updating templates
4. WHEN TemplateRepository methods are called THEN the system SHALL return plain JavaScript objects using `.lean()` or `.toObject()`
5. WHEN TemplateRepository is created THEN the system SHALL include JSDoc comments and TypeScript type annotations

### Requirement 3

**User Story:** As a developer, I want LeaseRepository to support checking lease usage by tenants, so that the lease manager can prevent deletion of active leases.

#### Acceptance Criteria

1. WHEN LeaseRepository is created THEN the system SHALL provide a `findLeaseIdsUsedByTenants(realmId)` method
2. WHEN `findLeaseIdsUsedByTenants` is called THEN the system SHALL query all tenants in the realm
3. WHEN `findLeaseIdsUsedByTenants` is called THEN the system SHALL return a Set of lease IDs that are referenced by tenants
4. WHEN `findLeaseIdsUsedByTenants` is called THEN the system SHALL use `.lean()` for performance
5. WHEN `findLeaseIdsUsedByTenants` is called THEN the system SHALL only project the `leaseId` field from tenant documents

### Requirement 4

**User Story:** As a developer, I want LeaseRepository to support transactional operations, so that lease deletion with related templates is atomic.

#### Acceptance Criteria

1. WHEN LeaseRepository is created THEN the system SHALL provide a `deleteWithTemplates(leaseIds, realmId, session)` method
2. WHEN `deleteWithTemplates` is called THEN the system SHALL accept a MongoDB session parameter for transaction support
3. WHEN `deleteWithTemplates` is called THEN the system SHALL delete leases within the provided transaction session
4. WHEN `deleteWithTemplates` is called THEN the system SHALL coordinate with TemplateRepository for template cleanup
5. WHEN `deleteWithTemplates` is called THEN the system SHALL return the number of leases deleted

### Requirement 5

**User Story:** As a developer, I want the lease manager refactored to use repositories, so that it no longer directly depends on Mongoose models.

#### Acceptance Criteria

1. WHEN the lease manager is refactored THEN the system SHALL replace `new Collections.Lease()` with `leaseRepository.create()`
2. WHEN the lease manager is refactored THEN the system SHALL replace `Collections.Lease.find()` with `leaseRepository.findAll()`
3. WHEN the lease manager is refactored THEN the system SHALL replace `Collections.Lease.findOne()` with `leaseRepository.findById()`
4. WHEN the lease manager is refactored THEN the system SHALL replace `Collections.Lease.findOneAndUpdate()` with `leaseRepository.update()`
5. WHEN the lease manager is refactored THEN the system SHALL replace `Collections.Lease.deleteMany()` with `leaseRepository.deleteMany()`
6. WHEN the lease manager is refactored THEN the system SHALL replace direct Tenant queries with `leaseRepository.findLeaseIdsUsedByTenants()`
7. WHEN the lease manager is refactored THEN the system SHALL replace direct Template queries with `templateRepository` methods
8. WHEN the lease manager is refactored THEN the system SHALL remove direct imports of `Collections` from leasemanager.js
9. WHEN the lease manager is refactored THEN the system SHALL import repositories from `DataAccess` namespace

### Requirement 6

**User Story:** As a developer, I want the lease manager to continue validating data correctly, so that invalid leases are rejected.

#### Acceptance Criteria

1. WHEN leases are created THEN the system SHALL validate that the lease name is provided
2. WHEN leases are updated THEN the system SHALL validate that the lease name is provided
3. WHEN leases are deleted THEN the system SHALL validate that lease IDs are provided
4. WHEN leases are deleted THEN the system SHALL check if leases are used by tenants
5. WHEN validation fails THEN the system SHALL throw ServiceError with appropriate status codes (422, 404)

### Requirement 7

**User Story:** As a developer, I want the lease manager to continue calculating lease active status correctly, so that lease availability is accurate.

#### Acceptance Criteria

1. WHEN leases are created THEN the system SHALL calculate active status based on numberOfTerms and timeRange
2. WHEN leases are updated THEN the system SHALL recalculate active status if not explicitly provided
3. WHEN leases are returned THEN the system SHALL include the active field
4. WHEN leases are returned THEN the system SHALL include the usedByTenants field
5. WHEN leases are queried THEN the system SHALL sort results by name in ascending order

### Requirement 8

**User Story:** As a developer, I want the lease manager to continue protecting leases used by tenants, so that active leases cannot be modified or deleted.

#### Acceptance Criteria

1. WHEN leases used by tenants are updated THEN the system SHALL only allow updates to name, description, active, and stepperMode fields
2. WHEN leases used by tenants are updated THEN the system SHALL preserve all other fields unchanged
3. WHEN leases used by tenants are deleted THEN the system SHALL reject the deletion with an error
4. WHEN leases not used by tenants are updated THEN the system SHALL allow full updates
5. WHEN leases not used by tenants are deleted THEN the system SHALL allow deletion

### Requirement 9

**User Story:** As a developer, I want the lease manager to continue handling template cleanup correctly, so that orphaned templates are removed.

#### Acceptance Criteria

1. WHEN leases are deleted THEN the system SHALL find all templates linked to those leases
2. WHEN templates are linked to only the deleted leases THEN the system SHALL delete those templates
3. WHEN templates are linked to other leases THEN the system SHALL remove the deleted lease IDs from linkedResourceIds
4. WHEN templates are linked to other leases THEN the system SHALL preserve the templates
5. WHEN lease and template deletion occurs THEN the system SHALL use a transaction to ensure atomicity

### Requirement 10

**User Story:** As a developer, I want the lease manager to continue using transactions correctly, so that lease deletion with templates is atomic.

#### Acceptance Criteria

1. WHEN leases are deleted THEN the system SHALL start a MongoDB session
2. WHEN leases are deleted THEN the system SHALL start a transaction on the session
3. WHEN all operations succeed THEN the system SHALL commit the transaction
4. WHEN any operation fails THEN the system SHALL abort the transaction
5. WHEN the transaction completes THEN the system SHALL end the session

### Requirement 11

**User Story:** As a developer, I want repositories to handle errors correctly, so that the lease manager can respond appropriately.

#### Acceptance Criteria

1. WHEN repository operations fail THEN the system SHALL propagate errors to the caller
2. WHEN leases are not found THEN the system SHALL return null or empty arrays as appropriate
3. WHEN invalid input is provided THEN the system SHALL throw descriptive errors
4. WHEN database errors occur THEN the system SHALL propagate the original error
5. WHEN transaction errors occur THEN the system SHALL ensure the transaction is aborted

### Requirement 12

**User Story:** As a developer, I want the refactoring to be backward compatible, so that other managers and services are not affected.

#### Acceptance Criteria

1. WHEN the data access layer is extended THEN the system SHALL keep existing Collections exports unchanged
2. WHEN the data access layer is extended THEN the system SHALL export both Collections and DataAccess from common package
3. WHEN other managers use Collections THEN the system SHALL continue to support direct Mongoose model access
4. WHEN the lease manager is migrated THEN the system SHALL not require changes to other managers or services
5. WHEN the common package is built THEN the system SHALL compile successfully with new repositories

### Requirement 13

**User Story:** As a developer, I want clear documentation for the repository methods, so that I can understand how to use them.

#### Acceptance Criteria

1. WHEN LeaseRepository methods are added THEN the system SHALL include JSDoc comments describing purpose and parameters
2. WHEN TemplateRepository methods are added THEN the system SHALL include JSDoc comments describing purpose and parameters
3. WHEN repository methods are added THEN the system SHALL include TypeScript type annotations for all signatures
4. WHEN repository methods handle errors THEN the system SHALL document expected error conditions
5. WHEN repositories are exported THEN the system SHALL maintain clear import paths in the common package index
