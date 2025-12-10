# Requirements Document

## Introduction

This specification defines the requirements for isolating MongoDB/Mongoose-specific logic from the API service's property manager (`services/api/src/managers/propertymanager.js`) by creating a new data access layer in the `services/common` package. Currently, the property manager directly uses Mongoose models (`Collections.Property`, `Collections.Tenant`) for database operations, creating tight coupling between business logic and data persistence. This refactoring will improve maintainability, testability, and separation of concerns by using the repository pattern that abstracts database operations, following the same approach successfully implemented for the realm manager and authenticator service.

## Glossary

- **API Service**: The main landlord-facing REST API microservice responsible for managing properties, tenants, leases, rents, and documents (`services/api`)
- **Property Manager**: The business logic module in the API service responsible for managing properties (`services/api/src/managers/propertymanager.js`)
- **Data Access Layer (DAL)**: A software layer that provides an abstraction between business logic and data persistence, implemented using the repository pattern
- **Repository**: A class that encapsulates data access logic for a specific entity (e.g., PropertyRepository for Property operations, TenantRepository for Tenant operations)
- **Mongoose Model**: A MongoDB ODM (Object-Document Mapper) model that provides an interface to interact with MongoDB collections
- **Collections**: The current namespace in `@microrealestate/common` that exports Mongoose models directly
- **Common Package**: The shared backend utilities package (`@microrealestate/common`) that provides reusable code across all services
- **Property**: A real estate property entity that contains details like name, type, address, surface area, and price
- **Tenant**: A tenant/occupant entity that has relationships with properties through the `properties` array field
- **Front Data (FD)**: Utility functions that transform database entities into API response formats

## Requirements

### Requirement 1

**User Story:** As a developer, I want to create a PropertyRepository in the common package, so that property database operations are abstracted from the property manager.

#### Acceptance Criteria

1. WHEN PropertyRepository is created THEN the system SHALL provide a `create(propertyData)` method for creating new properties
2. WHEN PropertyRepository is created THEN the system SHALL provide an `update(propertyId, updateData)` method for updating existing properties
3. WHEN PropertyRepository is created THEN the system SHALL provide a `delete(propertyIds, realmId)` method for deleting properties
4. WHEN PropertyRepository is created THEN the system SHALL provide a `findById(propertyId, realmId)` method for querying a single property
5. WHEN PropertyRepository is created THEN the system SHALL provide a `findAll(realmId)` method for querying all properties in a realm

### Requirement 2

**User Story:** As a developer, I want PropertyRepository methods to return plain JavaScript objects, so that the property manager is not coupled to Mongoose document instances.

#### Acceptance Criteria

1. WHEN PropertyRepository methods return data THEN the system SHALL use `.lean()` or `.toObject()` to return plain JavaScript objects
2. WHEN PropertyRepository methods return data THEN the system SHALL NOT return Mongoose document instances with methods like `.save()`
3. WHEN PropertyRepository.create is called THEN the system SHALL return a plain object representation of the created property
4. WHEN PropertyRepository.update is called THEN the system SHALL return a plain object representation of the updated property
5. WHEN PropertyRepository query methods are called THEN the system SHALL return plain objects without Mongoose-specific properties

### Requirement 3

**User Story:** As a developer, I want PropertyRepository to handle realm-scoped queries, so that properties are always filtered by organization.

#### Acceptance Criteria

1. WHEN PropertyRepository.create is called THEN the system SHALL include the realmId in the created property document
2. WHEN PropertyRepository.update is called THEN the system SHALL filter by both propertyId and realmId
3. WHEN PropertyRepository.delete is called THEN the system SHALL filter by both propertyIds and realmId
4. WHEN PropertyRepository.findById is called THEN the system SHALL filter by both propertyId and realmId
5. WHEN PropertyRepository.findAll is called THEN the system SHALL filter by realmId and sort by name ascending

### Requirement 4

**User Story:** As a developer, I want to extend the existing TenantRepository with methods needed by the property manager, so that tenant lookups are consistently abstracted.

#### Acceptance Criteria

1. WHEN TenantRepository is extended THEN the system SHALL provide a `findByPropertyIds(propertyIds, realmId)` method for finding tenants by property IDs
2. WHEN TenantRepository.findByPropertyIds is called THEN the system SHALL return tenants that have any of the specified property IDs in their properties array
3. WHEN TenantRepository.findByPropertyIds is called THEN the system SHALL filter by realmId
4. WHEN TenantRepository.findByPropertyIds is called THEN the system SHALL return plain JavaScript objects using `.lean()`
5. WHEN TenantRepository is extended THEN the system SHALL maintain backward compatibility with existing authenticator service usage

### Requirement 5

**User Story:** As a developer, I want the property manager refactored to use repositories, so that it no longer directly depends on Mongoose models.

#### Acceptance Criteria

1. WHEN the property manager is refactored THEN the system SHALL replace `new Collections.Property()` with `propertyRepository.create()`
2. WHEN the property manager is refactored THEN the system SHALL replace `Collections.Property.findOneAndUpdate()` with `propertyRepository.update()`
3. WHEN the property manager is refactored THEN the system SHALL replace `Collections.Property.deleteMany()` with `propertyRepository.delete()`
4. WHEN the property manager is refactored THEN the system SHALL replace `Collections.Property.findOne()` with `propertyRepository.findById()`
5. WHEN the property manager is refactored THEN the system SHALL replace `Collections.Property.find()` with `propertyRepository.findAll()`
6. WHEN the property manager is refactored THEN the system SHALL replace `Collections.Tenant.find()` with `tenantRepository.findByPropertyIds()`
7. WHEN the property manager is refactored THEN the system SHALL remove direct imports of `Collections` from propertymanager.js
8. WHEN the property manager is refactored THEN the system SHALL import repositories from `DataAccess` namespace

### Requirement 6

**User Story:** As a developer, I want the property manager to continue transforming data correctly, so that API responses maintain their current format.

#### Acceptance Criteria

1. WHEN properties are returned THEN the system SHALL continue using `FD.toProperty()` to transform data
2. WHEN properties are transformed THEN the system SHALL include the most recent tenant information
3. WHEN properties are transformed THEN the system SHALL include all tenants associated with the property
4. WHEN tenants are sorted THEN the system SHALL sort by termination date or end date in descending order
5. WHEN the property manager returns data THEN the system SHALL maintain the exact same response format as before refactoring

### Requirement 7

**User Story:** As a developer, I want PropertyRepository to handle errors correctly, so that the property manager can respond with appropriate error messages.

#### Acceptance Criteria

1. WHEN PropertyRepository methods receive invalid input THEN the system SHALL throw Error with descriptive messages
2. WHEN PropertyRepository methods encounter database errors THEN the system SHALL propagate errors to the caller
3. WHEN PropertyRepository.findById finds no matching property THEN the system SHALL return null
4. WHEN PropertyRepository.findAll finds no properties THEN the system SHALL return an empty array
5. WHEN PropertyRepository operations fail THEN the system SHALL allow the property manager to handle errors at the service layer

### Requirement 8

**User Story:** As a developer, I want the refactoring to be backward compatible, so that other managers and services are not affected.

#### Acceptance Criteria

1. WHEN the data access layer is extended THEN the system SHALL keep existing Collections exports unchanged
2. WHEN the data access layer is extended THEN the system SHALL export both Collections and DataAccess from common package
3. WHEN other managers use Collections THEN the system SHALL continue to support direct Mongoose model access
4. WHEN the property manager is migrated THEN the system SHALL not require changes to other managers or services
5. WHEN the common package is built THEN the system SHALL compile successfully with new repositories

### Requirement 9

**User Story:** As a developer, I want clear documentation for the repository methods, so that I can understand how to use them.

#### Acceptance Criteria

1. WHEN PropertyRepository methods are added THEN the system SHALL include JSDoc comments describing purpose and parameters
2. WHEN TenantRepository methods are added THEN the system SHALL include JSDoc comments describing purpose and parameters
3. WHEN repository methods are added THEN the system SHALL include TypeScript type annotations for all signatures
4. WHEN repository methods handle errors THEN the system SHALL document expected error conditions
5. WHEN repositories are exported THEN the system SHALL maintain clear import paths in the common package index

### Requirement 10

**User Story:** As a developer, I want the property manager to maintain its current API contract, so that existing API clients are not affected.

#### Acceptance Criteria

1. WHEN the property manager add endpoint is called THEN the system SHALL return the same response format as before
2. WHEN the property manager update endpoint is called THEN the system SHALL return the same response format as before
3. WHEN the property manager remove endpoint is called THEN the system SHALL return the same status code (200) as before
4. WHEN the property manager all endpoint is called THEN the system SHALL return the same response format as before
5. WHEN the property manager one endpoint is called THEN the system SHALL return the same response format as before
