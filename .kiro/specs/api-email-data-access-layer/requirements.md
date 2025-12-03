# Requirements Document

## Introduction

This specification defines the requirements for isolating MongoDB/Mongoose-specific logic from the API service's email manager (`services/api/src/managers/emailmanager.js`) by leveraging the existing data access layer in the `services/common` package. Currently, the email manager directly uses the Mongoose model (`Collections.Tenant`) for database operations, creating tight coupling between business logic and data persistence. This refactoring will improve maintainability, testability, and separation of concerns by using the repository pattern that abstracts database operations, following the same approach successfully implemented for the realm manager, property manager, lease manager, and occupant manager. This continues the systematic refactoring of all managers in the API service to use the repository pattern.

## Glossary

- **API Service**: The main landlord-facing REST API microservice responsible for managing properties, tenants, leases, rents, and documents (`services/api`)
- **Email Manager**: The business logic module in the API service responsible for sending emails to tenants via the emailer microservice (`services/api/src/managers/emailmanager.js`)
- **Data Access Layer (DAL)**: A software layer that provides an abstraction between business logic and data persistence, implemented using the repository pattern
- **Repository**: A class that encapsulates data access logic for a specific entity (e.g., TenantRepository for Tenant operations)
- **Mongoose Model**: A MongoDB ODM (Object-Document Mapper) model that provides an interface to interact with MongoDB collections
- **Collections**: The current namespace in `@microrealestate/common` that exports Mongoose models directly
- **Common Package**: The shared backend utilities package (`@microrealestate/common`) that provides reusable code across all services
- **Tenant**: An occupant/renter entity that has contact information and is associated with properties and leases
- **Emailer Service**: A microservice responsible for generating and sending emails to tenants using templates
- **Document Template**: A predefined email template (e.g., invoice, notice, receipt) used by the emailer service
- **Term**: A time period identifier in YYYYMMDDHH format representing a billing/rent period

## Requirements

### Requirement 1

**User Story:** As a developer, I want the email manager to use the existing TenantRepository, so that it is decoupled from Mongoose implementation details.

#### Acceptance Criteria

1. WHEN the email manager needs to query tenants THEN the system SHALL use TenantRepository.findByIds() instead of direct Mongoose model calls
2. WHEN the email manager queries tenants THEN the system SHALL pass tenantIds and realmId to the repository method
3. WHEN the email manager receives tenant data THEN the system SHALL work with plain JavaScript objects returned by the repository
4. WHEN the email manager performs operations THEN the system SHALL maintain all existing business logic functionality without behavioral changes
5. WHEN the email manager imports dependencies THEN the system SHALL import TenantRepository from DataAccess namespace

### Requirement 2

**User Story:** As a developer, I want the email manager refactored to use repositories, so that it no longer directly depends on Mongoose models.

#### Acceptance Criteria

1. WHEN the email manager is refactored THEN the system SHALL replace `Collections.Tenant.find()` with `tenantRepository.findByIds()`
2. WHEN the email manager is refactored THEN the system SHALL remove direct imports of `Collections` from emailmanager.js
3. WHEN the email manager is refactored THEN the system SHALL import `DataAccess` from `@microrealestate/common`
4. WHEN the email manager is refactored THEN the system SHALL obtain TenantRepository instance via `DataAccess.getTenantRepository()`
5. WHEN the email manager is refactored THEN the system SHALL maintain the same query semantics (filtering by IDs and realmId)

### Requirement 3

**User Story:** As a developer, I want the email manager to continue handling tenant data correctly, so that emails are sent to the right recipients.

#### Acceptance Criteria

1. WHEN tenants are queried THEN the system SHALL filter by the provided array of tenant IDs
2. WHEN tenants are queried THEN the system SHALL filter by the current realm ID for security
3. WHEN tenant data is retrieved THEN the system SHALL access tenant.name for logging and response
4. WHEN tenant data is retrieved THEN the system SHALL convert tenant._id to string for the emailer service
5. WHEN tenant data is used THEN the system SHALL maintain compatibility with the emailer service API

### Requirement 4

**User Story:** As a developer, I want the email manager to continue sending emails correctly, so that tenants receive notifications.

#### Acceptance Criteria

1. WHEN the send function is called THEN the system SHALL accept document, tenantIds, terms, year, and month parameters
2. WHEN emails are sent THEN the system SHALL call the emailer service with correct template name, recordId, and term
3. WHEN emails are sent THEN the system SHALL pass authorization, organizationid, and Accept-Language headers
4. WHEN emails are sent THEN the system SHALL handle multiple tenants in parallel using Promise.all
5. WHEN emails are sent THEN the system SHALL return status information for each tenant

### Requirement 5

**User Story:** As a developer, I want the email manager to continue handling errors correctly, so that failures are properly reported.

#### Acceptance Criteria

1. WHEN email sending fails for a tenant THEN the system SHALL catch the error and include it in the response
2. WHEN email sending fails THEN the system SHALL log the error with tenant name and details
3. WHEN any email fails THEN the system SHALL return HTTP 500 status with the full status list
4. WHEN all emails succeed THEN the system SHALL return HTTP 200 status with the status list
5. WHEN the emailer service returns an error THEN the system SHALL extract the error message from response.data or error.message

### Requirement 6

**User Story:** As a developer, I want the email manager to continue calculating terms correctly, so that emails reference the correct billing period.

#### Acceptance Criteria

1. WHEN terms are not provided THEN the system SHALL calculate a default term from year and month parameters
2. WHEN the default term is calculated THEN the system SHALL use moment to format as YYYYMMDDHH
3. WHEN terms are provided THEN the system SHALL use the term at the corresponding index for each tenant
4. WHEN terms are provided THEN the system SHALL fall back to the default term if index is out of bounds
5. WHEN terms are used THEN the system SHALL convert them to numbers before passing to the emailer service

### Requirement 7

**User Story:** As a developer, I want the email manager to continue logging correctly, so that email operations can be debugged.

#### Acceptance Criteria

1. WHEN emails are sent successfully THEN the system SHALL log the data sent to the emailer service at debug level
2. WHEN emails are sent successfully THEN the system SHALL log the response from the emailer service at debug level
3. WHEN email sending fails THEN the system SHALL log the POST URL at error level
4. WHEN email sending fails THEN the system SHALL log the data sent at error level
5. WHEN email sending fails THEN the system SHALL log the error message at error level

### Requirement 8

**User Story:** As a developer, I want the refactoring to be backward compatible, so that other managers and services are not affected.

#### Acceptance Criteria

1. WHEN the email manager is migrated THEN the system SHALL not require changes to other managers or services
2. WHEN the email manager is migrated THEN the system SHALL maintain the same HTTP API contract
3. WHEN the email manager is migrated THEN the system SHALL maintain the same response format
4. WHEN the email manager is migrated THEN the system SHALL maintain the same error handling behavior
5. WHEN the common package is used THEN the system SHALL use the existing TenantRepository without modifications

### Requirement 9

**User Story:** As a developer, I want the email manager to continue working with the emailer service correctly, so that email generation and delivery functions properly.

#### Acceptance Criteria

1. WHEN calling the emailer service THEN the system SHALL POST to the EMAILER_URL from environment configuration
2. WHEN calling the emailer service THEN the system SHALL send templateName, recordId, and params in the request body
3. WHEN calling the emailer service THEN the system SHALL include term in the params object
4. WHEN calling the emailer service THEN the system SHALL forward authorization and organizationid headers
5. WHEN calling the emailer service THEN the system SHALL forward Accept-Language header for internationalization

### Requirement 10

**User Story:** As a developer, I want the email manager to continue formatting responses correctly, so that the API client receives consistent data.

#### Acceptance Criteria

1. WHEN emails are sent successfully THEN the system SHALL map emailer response to include document, tenantId, term, email, and status
2. WHEN emails are sent successfully THEN the system SHALL include tenant name in the response
3. WHEN email sending fails THEN the system SHALL include tenant name, tenantId, document, term, and error in the response
4. WHEN email sending fails THEN the system SHALL extract error status and message from the emailer service response
5. WHEN email sending fails THEN the system SHALL provide a default error message if the emailer service doesn't return one
