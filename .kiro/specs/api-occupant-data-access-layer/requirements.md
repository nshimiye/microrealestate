# Requirements Document

## Introduction

This specification defines the requirements for isolating MongoDB/Mongoose-specific logic from the API service's occupant manager (`services/api/src/managers/occupantmanager.js`) by leveraging the data access layer in the `services/common` package. Currently, the occupant manager directly uses Mongoose models (`Collections.Tenant`, `Collections.Property`, `Collections.Document`) for database operations, creating tight coupling between business logic and data persistence. This refactoring will improve maintainability, testability, and separation of concerns by using the repository pattern that abstracts database operations, following the same approach successfully implemented for the realm manager and property manager. This continues the systematic refactoring of API service managers to use the data access layer.

## Glossary

- **API Service**: The main landlord-facing REST API microservice responsible for managing properties, tenants, leases, rents, and documents (`services/api`)
- **Occupant Manager**: The business logic module in the API service responsible for managing tenants/occupants (`services/api/src/managers/occupantmanager.js`)
- **Data Access Layer (DAL)**: A software layer that provides an abstraction between business logic and data persistence, implemented using the repository pattern
- **Repository**: A class that encapsulates data access logic for a specific entity (e.g., TenantRepository for Tenant operations, PropertyRepository for Property operations)
- **Mongoose Model**: A MongoDB ODM (Object-Document Mapper) model that provides an interface to interact with MongoDB collections
- **Collections**: The current namespace in `@microrealestate/common` that exports Mongoose models directly
- **Common Package**: The shared backend utilities package (`@microrealestate/common`) that provides reusable code across all services
- **Tenant/Occupant**: A person or company that rents properties from a landlord (terms used interchangeably in the codebase)
- **Contract**: A rental agreement with begin/end dates, frequency, properties, and generated rent schedule
- **Rent Schedule**: An array of rent objects generated from contract terms, containing payment information
- **Property Map**: A lookup object mapping property IDs to property documents, used for resolving property references
- **File Descriptor**: A template document that defines required files tenants must upload (e.g., insurance, ID)
- **Document**: An uploaded file associated with a tenant and lease

## Requirements

### Requirement 1

**User Story:** As a developer, I want the occupant manager to use repository methods for tenant operations, so that it is decoupled from Mongoose implementation details.

#### Acceptance Criteria

1. WHEN the occupant manager needs to create tenants THEN the system SHALL use TenantRepository methods instead of direct Mongoose model calls
2. WHEN the occupant manager needs to query tenants THEN the system SHALL use TenantRepository methods that return plain JavaScript objects
3. WHEN the occupant manager needs to update tenants THEN the system SHALL use TenantRepository methods that handle persistence logic
4. WHEN the occupant manager needs to delete tenants THEN the system SHALL use TenantRepository methods for removal operations
5. WHEN the occupant manager performs operations THEN the system SHALL maintain all existing business logic functionality without behavioral changes

### Requirement 2

**User Story:** As a developer, I want the occupant manager to use repository methods for property operations, so that property lookups are consistently abstracted.

#### Acceptance Criteria

1. WHEN the occupant manager needs to query properties THEN the system SHALL use PropertyRepository methods instead of direct Mongoose model calls
2. WHEN the occupant manager builds property maps THEN the system SHALL use PropertyRepository methods that return plain JavaScript objects
3. WHEN the occupant manager resolves property references THEN the system SHALL use repository-returned property data
4. WHEN PropertyRepository methods are called THEN the system SHALL return plain JavaScript objects using `.lean()`
5. WHEN PropertyRepository is used THEN the system SHALL maintain backward compatibility with existing property manager usage

### Requirement 3

**User Story:** As a developer, I want to create a TenantRepository with methods needed by the occupant manager, so that all tenant operations are consistently abstracted.

#### Acceptance Criteria

1. WHEN TenantRepository is created THEN the system SHALL provide a `create(tenantData)` method for creating new tenants
2. WHEN TenantRepository is created THEN the system SHALL provide an `update(tenantId, realmId, updateData)` method for updating existing tenants
3. WHEN TenantRepository is created THEN the system SHALL provide a `findById(tenantId, realmId)` method for querying a single tenant
4. WHEN TenantRepository is created THEN the system SHALL provide a `findAll(realmId)` method for querying all tenants in a realm
5. WHEN TenantRepository is created THEN the system SHALL provide a `findByIds(tenantIds, realmId)` method for querying multiple tenants
6. WHEN TenantRepository is created THEN the system SHALL provide a `deleteMany(tenantIds, realmId)` method for removing tenants
7. WHEN TenantRepository is created THEN the system SHALL provide a `findWithAggregation(realmId, tenantId?)` method for complex queries with file descriptors
8. WHEN TenantRepository methods are called THEN the system SHALL return plain JavaScript objects using `.lean()` or `.toObject()`

### Requirement 4

**User Story:** As a developer, I want to extend the existing PropertyRepository with methods needed by the occupant manager, so that property lookups are consistently abstracted.

#### Acceptance Criteria

1. WHEN PropertyRepository is extended THEN the system SHALL provide a `findByRealmId(realmId)` method for retrieving all properties in a realm
2. WHEN PropertyRepository.findByRealmId is called THEN the system SHALL return plain JavaScript objects with all property fields
3. WHEN PropertyRepository methods are called THEN the system SHALL use `.lean()` to return plain objects
4. WHEN PropertyRepository is extended THEN the system SHALL maintain backward compatibility with existing property manager usage
5. WHEN PropertyRepository is extended THEN the system SHALL include JSDoc comments and TypeScript type annotations

### Requirement 5

**User Story:** As a developer, I want the occupant manager refactored to use repositories, so that it no longer directly depends on Mongoose models.

#### Acceptance Criteria

1. WHEN the occupant manager is refactored THEN the system SHALL replace `Collections.Tenant.create()` with `tenantRepository.create()`
2. WHEN the occupant manager is refactored THEN the system SHALL replace `Collections.Tenant.findOne()` with `tenantRepository.findById()`
3. WHEN the occupant manager is refactored THEN the system SHALL replace `Collections.Tenant.updateOne()` with `tenantRepository.update()`
4. WHEN the occupant manager is refactored THEN the system SHALL replace `Collections.Tenant.find()` with `tenantRepository.findAll()` or `tenantRepository.findByIds()`
5. WHEN the occupant manager is refactored THEN the system SHALL replace `Collections.Tenant.deleteMany()` with `tenantRepository.deleteMany()`
6. WHEN the occupant manager is refactored THEN the system SHALL replace `Collections.Property.find()` with `propertyRepository.findByRealmId()`
7. WHEN the occupant manager is refactored THEN the system SHALL replace `Collections.Tenant.aggregate()` with `tenantRepository.findWithAggregation()`
8. WHEN the occupant manager is refactored THEN the system SHALL remove direct imports of `Collections` from occupantmanager.js
9. WHEN the occupant manager is refactored THEN the system SHALL import repositories from `DataAccess` namespace

### Requirement 6

**User Story:** As a developer, I want the occupant manager to continue handling tenant data formatting correctly, so that date conversions and reference generation work as expected.

#### Acceptance Criteria

1. WHEN tenants are created THEN the system SHALL convert date strings (DD/MM/YYYY) to Date objects
2. WHEN tenants are created THEN the system SHALL generate unique reference codes if not provided
3. WHEN tenants are created THEN the system SHALL format company vs individual tenant data correctly
4. WHEN tenants are created THEN the system SHALL format property entry/exit dates correctly
5. WHEN tenants are created THEN the system SHALL format property expense dates correctly

### Requirement 7

**User Story:** As a developer, I want the occupant manager to continue building property maps correctly, so that property references can be resolved efficiently.

#### Acceptance Criteria

1. WHEN property maps are built THEN the system SHALL query all properties for the realm using PropertyRepository
2. WHEN property maps are built THEN the system SHALL create a lookup object keyed by property ID
3. WHEN property maps are built THEN the system SHALL convert property _id to string for consistent lookups
4. WHEN property maps are used THEN the system SHALL resolve property references in tenant data
5. WHEN property maps are used THEN the system SHALL provide property data for rent calculations

### Requirement 8

**User Story:** As a developer, I want the occupant manager to continue generating rent schedules correctly, so that contract-based rent calculations work as expected.

#### Acceptance Criteria

1. WHEN tenants are created with valid contract data THEN the system SHALL generate rent schedules using Contract.create()
2. WHEN tenants are updated with valid contract data THEN the system SHALL regenerate rent schedules using Contract.update()
3. WHEN tenants have incomplete contract data THEN the system SHALL set rents to empty array
4. WHEN tenants have paid rents THEN the system SHALL prevent updates that would invalidate payment history
5. WHEN contract generation fails THEN the system SHALL throw ServiceError with status 409

### Requirement 9

**User Story:** As a developer, I want the occupant manager to continue handling tenant aggregation queries correctly, so that file descriptor data is populated.

#### Acceptance Criteria

1. WHEN tenants are fetched THEN the system SHALL use aggregation pipeline to join templates and documents
2. WHEN tenants are fetched THEN the system SHALL populate lease and property references
3. WHEN tenants are fetched THEN the system SHALL compute missing document flags based on requirements
4. WHEN tenants are fetched THEN the system SHALL handle expiry dates for document validation
5. WHEN tenants are fetched THEN the system SHALL sort results by tenant name

### Requirement 10

**User Story:** As a developer, I want the occupant manager to continue handling tenant deletion correctly, so that related documents are cleaned up.

#### Acceptance Criteria

1. WHEN tenants are deleted THEN the system SHALL prevent deletion if any rents have been paid
2. WHEN tenants are deleted THEN the system SHALL query related documents using Collections.Document
3. WHEN tenants are deleted THEN the system SHALL call PDF generator service to delete document files
4. WHEN tenants are deleted THEN the system SHALL delete tenant records using TenantRepository
5. WHEN tenant deletion fails THEN the system SHALL use MongoDB transactions to rollback changes

### Requirement 11

**User Story:** As a developer, I want the occupant manager to continue validating tenant data correctly, so that invalid tenants are rejected.

#### Acceptance Criteria

1. WHEN tenants are created THEN the system SHALL validate that name field is provided
2. WHEN tenants are updated THEN the system SHALL validate that name field is provided
3. WHEN tenants are deleted THEN the system SHALL validate that tenant IDs are provided
4. WHEN tenants are not found THEN the system SHALL throw ServiceError with status 404
5. WHEN validation fails THEN the system SHALL throw ServiceError with status 422

### Requirement 12

**User Story:** As a developer, I want the occupant manager to continue computing tenant overview statistics correctly, so that dashboard counts are accurate.

#### Acceptance Criteria

1. WHEN overview is requested THEN the system SHALL query all tenants for the realm using TenantRepository
2. WHEN overview is computed THEN the system SHALL count total tenants
3. WHEN overview is computed THEN the system SHALL count active tenants (not terminated)
4. WHEN overview is computed THEN the system SHALL count inactive tenants (terminated)
5. WHEN overview is computed THEN the system SHALL use termination date or end date for status determination

### Requirement 13

**User Story:** As a developer, I want the refactoring to be backward compatible, so that other managers and services are not affected.

#### Acceptance Criteria

1. WHEN the data access layer is extended THEN the system SHALL keep existing Collections exports unchanged
2. WHEN the data access layer is extended THEN the system SHALL export both Collections and DataAccess from common package
3. WHEN other managers use Collections THEN the system SHALL continue to support direct Mongoose model access
4. WHEN the occupant manager is migrated THEN the system SHALL not require changes to other managers or services
5. WHEN the common package is built THEN the system SHALL compile successfully with new TenantRepository

### Requirement 14

**User Story:** As a developer, I want clear documentation for the TenantRepository methods, so that I can understand how to use them.

#### Acceptance Criteria

1. WHEN TenantRepository methods are added THEN the system SHALL include JSDoc comments describing purpose and parameters
2. WHEN TenantRepository methods are added THEN the system SHALL include TypeScript type annotations for all signatures
3. WHEN TenantRepository methods handle errors THEN the system SHALL document expected error conditions
4. WHEN TenantRepository is exported THEN the system SHALL maintain clear import paths in the common package index
5. WHEN TenantRepository methods use aggregation THEN the system SHALL document the aggregation pipeline structure

### Requirement 15

**User Story:** As a developer, I want the occupant manager to continue handling document operations correctly, so that document queries and deletions work as expected.

#### Acceptance Criteria

1. WHEN documents are queried THEN the system SHALL continue using Collections.Document directly (not migrated in this refactoring)
2. WHEN documents are deleted THEN the system SHALL continue using Collections.Document.find() to get document IDs
3. WHEN documents are deleted THEN the system SHALL continue calling PDF generator service via axios
4. WHEN document operations fail THEN the system SHALL log errors appropriately
5. WHEN document operations are part of transactions THEN the system SHALL participate in MongoDB sessions
