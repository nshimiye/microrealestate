# Requirements Document

## Introduction

This specification defines the requirements for isolating MongoDB/Mongoose-specific logic from the API service's dashboard manager (`services/api/src/managers/dashboardmanager.js`) by leveraging the data access layer in the `services/common` package. Currently, the dashboard manager directly uses Mongoose models (`Collections.Tenant`, `Collections.Property`) for database operations, creating tight coupling between business logic and data persistence. This refactoring will improve maintainability, testability, and separation of concerns by using the repository pattern that abstracts database operations, following the same approach successfully implemented for the realm manager and other managers in the API service.

## Glossary

- **API Service**: The main landlord-facing REST API microservice responsible for managing properties, tenants, leases, rents, and documents (`services/api`)
- **Dashboard Manager**: The business logic module in the API service responsible for computing dashboard metrics and analytics (`services/api/src/managers/dashboardmanager.js`)
- **Data Access Layer (DAL)**: A software layer that provides an abstraction between business logic and data persistence, implemented using the repository pattern
- **Repository**: A class that encapsulates data access logic for a specific entity (e.g., TenantRepository for Tenant operations, PropertyRepository for Property operations)
- **Mongoose Model**: A MongoDB ODM (Object-Document Mapper) model that provides an interface to interact with MongoDB collections
- **Collections**: The current namespace in `@microrealestate/common` that exports Mongoose models directly
- **Common Package**: The shared backend utilities package (`@microrealestate/common`) that provides reusable code across all services
- **Tenant**: A renter entity that contains personal information, lease details, and rent payment history
- **Property**: A real estate entity that can be rented to tenants
- **Realm**: An organization/landlord entity identified by `realmId` (organizationId)
- **Active Tenant**: A tenant whose termination date or end date is on or after the current date
- **Occupancy Rate**: The ratio of rented properties to total properties
- **Dashboard Metrics**: Aggregated statistics including tenant count, property count, occupancy rate, revenues, and unpaid rents

## Requirements

### Requirement 1

**User Story:** As a developer, I want the dashboard manager to use repository methods for tenant queries, so that it is decoupled from Mongoose implementation details.

#### Acceptance Criteria

1. WHEN the dashboard manager needs to query tenants by realm THEN the system SHALL use TenantRepository methods instead of direct Mongoose model calls
2. WHEN TenantRepository returns tenant data THEN the system SHALL return plain JavaScript objects with all necessary fields (terminationDate, endDate, properties, rents)
3. WHEN the dashboard manager filters active tenants THEN the system SHALL receive tenant data that includes date fields for comparison
4. WHEN the dashboard manager accesses tenant properties THEN the system SHALL receive tenant data with populated properties array containing propertyId
5. WHEN the dashboard manager accesses tenant rents THEN the system SHALL receive tenant data with populated rents array containing term, payments, and total fields

### Requirement 2

**User Story:** As a developer, I want the dashboard manager to use repository methods for property queries, so that property counting is abstracted from Mongoose.

#### Acceptance Criteria

1. WHEN the dashboard manager needs to count properties by realm THEN the system SHALL use PropertyRepository methods instead of direct Mongoose model calls
2. WHEN PropertyRepository counts properties THEN the system SHALL return an integer count value
3. WHEN PropertyRepository is called with realmId THEN the system SHALL filter properties by the specified realm
4. WHEN PropertyRepository methods are called THEN the system SHALL use efficient query operations for counting
5. WHEN PropertyRepository is used THEN the system SHALL maintain backward compatibility with existing property manager usage

### Requirement 3

**User Story:** As a developer, I want to extend the existing TenantRepository with methods needed by the dashboard manager, so that all tenant operations are consistently abstracted.

#### Acceptance Criteria

1. WHEN TenantRepository is extended THEN the system SHALL provide a `findByRealmId(realmId)` method for retrieving all tenants in a realm
2. WHEN TenantRepository.findByRealmId is called THEN the system SHALL return plain JavaScript objects using `.lean()`
3. WHEN TenantRepository.findByRealmId returns data THEN the system SHALL include all tenant fields needed for dashboard calculations
4. WHEN TenantRepository methods are called THEN the system SHALL include JSDoc comments and TypeScript type annotations
5. WHEN TenantRepository is extended THEN the system SHALL maintain existing methods used by other managers

### Requirement 4

**User Story:** As a developer, I want to extend the existing PropertyRepository with methods needed by the dashboard manager, so that property counting is consistently abstracted.

#### Acceptance Criteria

1. WHEN PropertyRepository is extended THEN the system SHALL provide a `countByRealmId(realmId)` method for counting properties in a realm
2. WHEN PropertyRepository.countByRealmId is called THEN the system SHALL return an integer count
3. WHEN PropertyRepository.countByRealmId is called THEN the system SHALL use efficient Mongoose `.countDocuments()` method
4. WHEN PropertyRepository methods are called THEN the system SHALL include JSDoc comments and TypeScript type annotations
5. WHEN PropertyRepository is extended THEN the system SHALL maintain existing methods used by other managers

### Requirement 5

**User Story:** As a developer, I want the dashboard manager refactored to use repositories, so that it no longer directly depends on Mongoose models.

#### Acceptance Criteria

1. WHEN the dashboard manager is refactored THEN the system SHALL replace `Collections.Tenant.find()` with `tenantRepository.findByRealmId()`
2. WHEN the dashboard manager is refactored THEN the system SHALL replace `Collections.Property.find().count()` with `propertyRepository.countByRealmId()`
3. WHEN the dashboard manager is refactored THEN the system SHALL remove direct imports of `Collections` from dashboardmanager.js
4. WHEN the dashboard manager is refactored THEN the system SHALL import repositories from `DataAccess` namespace
5. WHEN the dashboard manager is refactored THEN the system SHALL maintain all existing business logic for computing metrics

### Requirement 6

**User Story:** As a developer, I want the dashboard manager to continue computing active tenants correctly, so that tenant counts remain accurate.

#### Acceptance Criteria

1. WHEN the dashboard manager computes active tenants THEN the system SHALL filter tenants whose terminationDate or endDate is on or after the current date
2. WHEN the dashboard manager computes active tenants THEN the system SHALL use moment.js for date comparisons
3. WHEN the dashboard manager computes active tenants THEN the system SHALL handle tenants with terminationDate set
4. WHEN the dashboard manager computes active tenants THEN the system SHALL handle tenants without terminationDate by using endDate
5. WHEN the dashboard manager computes active tenants THEN the system SHALL return the count of active tenants

### Requirement 7

**User Story:** As a developer, I want the dashboard manager to continue computing occupancy rate correctly, so that property utilization metrics remain accurate.

#### Acceptance Criteria

1. WHEN the dashboard manager computes occupancy rate THEN the system SHALL count unique properties rented by active tenants
2. WHEN the dashboard manager computes occupancy rate THEN the system SHALL divide rented property count by total property count
3. WHEN the dashboard manager computes occupancy rate THEN the system SHALL handle cases where propertyCount is zero
4. WHEN the dashboard manager computes occupancy rate THEN the system SHALL use Set data structure to ensure unique property counting
5. WHEN the dashboard manager computes occupancy rate THEN the system SHALL return undefined when no properties exist

### Requirement 8

**User Story:** As a developer, I want the dashboard manager to continue computing year revenues correctly, so that financial metrics remain accurate.

#### Acceptance Criteria

1. WHEN the dashboard manager computes year revenues THEN the system SHALL sum all rent payments made in the current year
2. WHEN the dashboard manager computes year revenues THEN the system SHALL iterate through all tenants' rents and payments
3. WHEN the dashboard manager computes year revenues THEN the system SHALL filter payments by date within the current year boundaries
4. WHEN the dashboard manager computes year revenues THEN the system SHALL skip payments with no date or zero amount
5. WHEN the dashboard manager computes year revenues THEN the system SHALL use moment.js for date range comparisons

### Requirement 9

**User Story:** As a developer, I want the dashboard manager to continue computing top unpaid tenants correctly, so that collections tracking remains accurate.

#### Acceptance Criteria

1. WHEN the dashboard manager computes top unpaid THEN the system SHALL find active tenants with current month rent
2. WHEN the dashboard manager computes top unpaid THEN the system SHALL calculate balance as payment minus grandTotal
3. WHEN the dashboard manager computes top unpaid THEN the system SHALL sort tenants by balance ascending
4. WHEN the dashboard manager computes top unpaid THEN the system SHALL filter tenants with negative balance
5. WHEN the dashboard manager computes top unpaid THEN the system SHALL return top 5 tenants with largest unpaid amounts

### Requirement 10

**User Story:** As a developer, I want the dashboard manager to continue computing monthly revenues correctly, so that revenue trends remain accurate.

#### Acceptance Criteria

1. WHEN the dashboard manager computes monthly revenues THEN the system SHALL create entries for all 12 months of the current year
2. WHEN the dashboard manager computes monthly revenues THEN the system SHALL sum paid and notPaid amounts per month
3. WHEN the dashboard manager computes monthly revenues THEN the system SHALL filter rents by term within the current year
4. WHEN the dashboard manager computes monthly revenues THEN the system SHALL round amounts to 2 decimal places
5. WHEN the dashboard manager computes monthly revenues THEN the system SHALL sort results by month chronologically

### Requirement 11

**User Story:** As a developer, I want the dashboard manager to continue returning correct response structure, so that the API contract is maintained.

#### Acceptance Criteria

1. WHEN the dashboard manager returns data THEN the system SHALL include overview object with tenantCount, propertyCount, occupancyRate, totalYearRevenues
2. WHEN the dashboard manager returns data THEN the system SHALL include topUnpaid array with tenant, balance, and rent objects
3. WHEN the dashboard manager returns data THEN the system SHALL include revenues array with month, paid, and notPaid values
4. WHEN the dashboard manager returns data THEN the system SHALL return null for overview when no tenants or properties exist
5. WHEN the dashboard manager returns data THEN the system SHALL return empty array for topUnpaid when no tenants or properties exist

### Requirement 12

**User Story:** As a developer, I want the refactoring to be backward compatible, so that other managers and services are not affected.

#### Acceptance Criteria

1. WHEN the data access layer is extended THEN the system SHALL keep existing Collections exports unchanged
2. WHEN the data access layer is extended THEN the system SHALL export both Collections and DataAccess from common package
3. WHEN other managers use Collections THEN the system SHALL continue to support direct Mongoose model access
4. WHEN the dashboard manager is migrated THEN the system SHALL not require changes to other managers or services
5. WHEN the common package is built THEN the system SHALL compile successfully with extended repositories

### Requirement 13

**User Story:** As a developer, I want clear documentation for the extended repository methods, so that I can understand how to use them.

#### Acceptance Criteria

1. WHEN TenantRepository methods are added THEN the system SHALL include JSDoc comments describing purpose and parameters
2. WHEN PropertyRepository methods are added THEN the system SHALL include JSDoc comments describing purpose and parameters
3. WHEN repository methods are added THEN the system SHALL include TypeScript type annotations for all signatures
4. WHEN repository methods handle errors THEN the system SHALL document expected error conditions
5. WHEN repositories are exported THEN the system SHALL maintain clear import paths in the common package index

### Requirement 14

**User Story:** As a developer, I want unit tests for the extended repository methods, so that data access logic is verified.

#### Acceptance Criteria

1. WHEN TenantRepository.findByRealmId is implemented THEN the system SHALL include unit tests verifying correct realm filtering
2. WHEN PropertyRepository.countByRealmId is implemented THEN the system SHALL include unit tests verifying correct counting
3. WHEN repository tests are written THEN the system SHALL use Vitest as the testing framework
4. WHEN repository tests are written THEN the system SHALL mock Mongoose models to avoid database dependencies
5. WHEN repository tests are written THEN the system SHALL verify that plain JavaScript objects are returned

### Requirement 15

**User Story:** As a developer, I want unit tests for the refactored dashboard manager, so that business logic is verified independently of data access.

#### Acceptance Criteria

1. WHEN dashboard manager tests are written THEN the system SHALL mock TenantRepository and PropertyRepository
2. WHEN dashboard manager tests are written THEN the system SHALL verify active tenant filtering logic
3. WHEN dashboard manager tests are written THEN the system SHALL verify occupancy rate calculation
4. WHEN dashboard manager tests are written THEN the system SHALL verify revenue calculations
5. WHEN dashboard manager tests are written THEN the system SHALL verify top unpaid tenant sorting and filtering
