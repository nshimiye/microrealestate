# Requirements Document

## Introduction

This specification defines the requirements for isolating MongoDB/Mongoose-specific logic from the API service's rent manager (`services/api/src/managers/rentmanager.js`) by leveraging the existing data access layer in the `services/common` package. Currently, the rent manager directly uses Mongoose models (`Collections.Tenant`) for database operations, creating tight coupling between business logic and data persistence. This refactoring will improve maintainability, testability, and separation of concerns by using the repository pattern that abstracts database operations, following the same approach successfully implemented for the realm manager. This continues the data access layer refactoring initiative across the API service managers.

## Glossary

- **API Service**: The main landlord-facing REST API microservice responsible for managing properties, tenants, leases, rents, and documents (`services/api`)
- **Rent Manager**: The business logic module in the API service responsible for managing rent payments, rent calculations, and rent data retrieval (`services/api/src/managers/rentmanager.js`)
- **Data Access Layer (DAL)**: A software layer that provides an abstraction between business logic and data persistence, implemented using the repository pattern
- **Repository**: A class that encapsulates data access logic for a specific entity (e.g., TenantRepository for Tenant operations)
- **Mongoose Model**: A MongoDB ODM (Object-Document Mapper) model that provides an interface to interact with MongoDB collections
- **Collections**: The current namespace in `@microrealestate/common` that exports Mongoose models directly
- **Common Package**: The shared backend utilities package (`@microrealestate/common`) that provides reusable code across all services
- **Tenant/Occupant**: An entity representing a renter who occupies properties and has associated rent records
- **Rent**: A payment record associated with a tenant for a specific term (month/quarter/year)
- **Term**: A time period identifier in YYYYMMDDHH format (e.g., 2024010100 for January 2024)
- **Contract**: The lease agreement details including frequency, dates, discount, VAT rate, and properties
- **Settlement**: Payment adjustments including payments, debts, discounts, and descriptions applied to a rent term

## Requirements

### Requirement 1

**User Story:** As a developer, I want the rent manager to use existing repository methods, so that it is decoupled from Mongoose implementation details.

#### Acceptance Criteria

1. WHEN the rent manager needs to query tenants THEN the system SHALL use TenantRepository methods instead of direct Mongoose model calls
2. WHEN the rent manager needs to find tenants by filter THEN the system SHALL use TenantRepository methods that return plain JavaScript objects
3. WHEN the rent manager needs to update tenant rent data THEN the system SHALL use TenantRepository methods that handle persistence logic
4. WHEN the rent manager performs operations THEN the system SHALL maintain all existing business logic functionality without behavioral changes
5. WHEN the rent manager queries tenants THEN the system SHALL preserve all existing filtering, sorting, and projection behavior

### Requirement 2

**User Story:** As a developer, I want to extend the existing TenantRepository with methods needed by the rent manager, so that all tenant operations are consistently abstracted.

#### Acceptance Criteria

1. WHEN TenantRepository is extended THEN the system SHALL provide a `find(filter, options)` method for querying multiple tenants with optional sorting
2. WHEN TenantRepository is extended THEN the system SHALL provide a `findOne(filter)` method for querying a single tenant
3. WHEN TenantRepository is extended THEN the system SHALL provide a `findOneAndUpdate(filter, update, options)` method for atomic updates
4. WHEN TenantRepository methods are called THEN the system SHALL return plain JavaScript objects using `.lean()`
5. WHEN TenantRepository.find is called with sort.name option THEN the system SHALL sort results by tenant name in the specified direction (asc or desc)

### Requirement 3

**User Story:** As a developer, I want TenantRepository to support simplified query filters, so that the rent manager can filter tenants by realm, ID, and rent terms without using MongoDB syntax.

#### Acceptance Criteria

1. WHEN TenantRepository.find is called with realmId THEN the system SHALL filter by realmId field
2. WHEN TenantRepository.find is called with tenantId THEN the system SHALL filter by _id field
3. WHEN TenantRepository.find is called with startTerm and endTerm THEN the system SHALL filter by rents.term range
4. WHEN TenantRepository.find is called with only startTerm THEN the system SHALL filter by exact rents.term match
5. WHEN TenantRepository.find is called with multiple filter properties THEN the system SHALL combine all filters

### Requirement 4

**User Story:** As a developer, I want the rent manager refactored to use repositories, so that it no longer directly depends on Mongoose models.

#### Acceptance Criteria

1. WHEN the rent manager is refactored THEN the system SHALL replace `Collections.Tenant.find()` with `tenantRepository.find()`
2. WHEN the rent manager is refactored THEN the system SHALL replace `Collections.Tenant.findOne()` with `tenantRepository.findOne()`
3. WHEN the rent manager is refactored THEN the system SHALL replace `Collections.Tenant.findOneAndUpdate()` with `tenantRepository.findOneAndUpdate()`
4. WHEN the rent manager is refactored THEN the system SHALL remove direct imports of `Collections` from rentmanager.js
5. WHEN the rent manager is refactored THEN the system SHALL import repositories from `DataAccess` namespace

### Requirement 5

**User Story:** As a developer, I want TenantRepository to support atomic updates, so that rent payment updates are safely persisted.

#### Acceptance Criteria

1. WHEN TenantRepository.findOneAndUpdate is called THEN the system SHALL update the tenant document atomically
2. WHEN TenantRepository.findOneAndUpdate is called with `{ returnUpdated: true }` option THEN the system SHALL return the updated document
3. WHEN TenantRepository.findOneAndUpdate is called THEN the system SHALL support updating nested rent arrays
4. WHEN TenantRepository.findOneAndUpdate returns data THEN the system SHALL convert the document to a plain object using `.lean()`
5. WHEN TenantRepository operations fail THEN the system SHALL propagate errors to the caller for handling at the service layer

### Requirement 6

**User Story:** As a developer, I want the rent manager to continue calculating rents correctly, so that payment logic remains unchanged.

#### Acceptance Criteria

1. WHEN rents are updated THEN the system SHALL apply settlements (payments, debts, discounts) using Contract.payTerm
2. WHEN rents are updated THEN the system SHALL calculate VAT-adjusted amounts for discounts and extra charges
3. WHEN rents are updated THEN the system SHALL filter and validate payment amounts (must be > 0)
4. WHEN rents are updated THEN the system SHALL preserve contract details (frequency, dates, discount, VAT rate, properties)
5. WHEN rents are updated THEN the system SHALL update the tenant's rents array with calculated values

### Requirement 7

**User Story:** As a developer, I want the rent manager to continue filtering rent data correctly, so that term-based queries work as expected.

#### Acceptance Criteria

1. WHEN rents are queried by term range THEN the system SHALL filter rents where term >= startTerm AND term <= endTerm
2. WHEN rents are queried by single term THEN the system SHALL filter rents where term equals the specified term
3. WHEN tenants are retrieved THEN the system SHALL filter tenant.rents array to match the requested term range
4. WHEN tenants are retrieved THEN the system SHALL convert tenant._id to string format
5. WHEN tenants are retrieved THEN the system SHALL sort results by tenant name in ascending order

### Requirement 8

**User Story:** As a developer, I want the rent manager to continue computing rent overviews correctly, so that dashboard statistics are accurate.

#### Acceptance Criteria

1. WHEN rent overview is computed THEN the system SHALL count all rents (countAll)
2. WHEN rent overview is computed THEN the system SHALL count paid rents (totalAmount <= 0 OR newBalance >= 0)
3. WHEN rent overview is computed THEN the system SHALL count partially paid rents (payment > 0 AND newBalance < 0)
4. WHEN rent overview is computed THEN the system SHALL count unpaid rents (payment = 0 AND newBalance < 0)
5. WHEN rent overview is computed THEN the system SHALL sum totalToPay, totalPaid, and totalNotPaid amounts

### Requirement 9

**User Story:** As a developer, I want the rent manager to continue integrating with email service correctly, so that email status tracking works.

#### Acceptance Criteria

1. WHEN rents are retrieved THEN the system SHALL fetch email status from emailer service
2. WHEN email status is fetched THEN the system SHALL pass authorization header, organizationId, and locale
3. WHEN email status is fetched THEN the system SHALL handle errors gracefully and continue without email data
4. WHEN email status is available THEN the system SHALL map status by recordId and templateName
5. WHEN rent data is returned THEN the system SHALL include email status in FD.toRentData transformation

### Requirement 10

**User Story:** As a developer, I want the refactoring to be backward compatible, so that other managers and services are not affected.

#### Acceptance Criteria

1. WHEN the data access layer is extended THEN the system SHALL keep existing Collections exports unchanged
2. WHEN the data access layer is extended THEN the system SHALL export both Collections and DataAccess from common package
3. WHEN other managers use Collections THEN the system SHALL continue to support direct Mongoose model access
4. WHEN the rent manager is migrated THEN the system SHALL not require changes to other managers or services
5. WHEN the common package is built THEN the system SHALL compile successfully with extended repositories

### Requirement 11

**User Story:** As a developer, I want clear documentation for the extended repository methods, so that I can understand how to use them.

#### Acceptance Criteria

1. WHEN TenantRepository methods are added THEN the system SHALL include JSDoc comments describing purpose and parameters
2. WHEN TenantRepository methods are added THEN the system SHALL include TypeScript type annotations for all signatures
3. WHEN TenantRepository methods handle complex filters THEN the system SHALL document expected filter structure
4. WHEN TenantRepository methods handle errors THEN the system SHALL document expected error conditions
5. WHEN repositories are exported THEN the system SHALL maintain clear import paths in the common package index

### Requirement 12

**User Story:** As a developer, I want the rent manager to continue handling edge cases correctly, so that error handling remains robust.

#### Acceptance Criteria

1. WHEN tenant is not found THEN the system SHALL throw ServiceError with 404 status code
2. WHEN rent is not found for a term THEN the system SHALL throw ServiceError with 404 status code
3. WHEN promo or extracharge is invalid THEN the system SHALL default to 0 and clear notes
4. WHEN email service is unavailable in demo mode THEN the system SHALL fallback to empty email status
5. WHEN email service is unavailable in production THEN the system SHALL propagate the error
