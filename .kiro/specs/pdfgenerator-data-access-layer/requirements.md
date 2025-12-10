# Requirements Document

## Introduction

This specification defines the refactoring of the pdfgenerator service to separate MongoDB/Mongoose-specific logic from the service layer by implementing a data access layer (repository pattern). This follows the same architectural pattern already established in the authenticator service, promoting separation of concerns, testability, and maintainability.

## Glossary

- **PDFGenerator Service**: The microservice responsible for generating PDF documents, managing document templates, and handling file uploads
- **Repository Pattern**: A design pattern that abstracts data access logic into separate repository classes
- **Data Access Layer**: An abstraction layer that provides a clean API for data operations without exposing database implementation details
- **Collections**: Direct Mongoose model references (e.g., `Collections.Document`, `Collections.Template`)
- **Common Package**: The shared `@microrealestate/common` package that provides repository implementations
- **Mongoose**: The MongoDB ODM (Object Document Mapper) library used for database operations
- **Service Layer**: The business logic layer in the pdfgenerator service (routes and handlers)

## Requirements

### Requirement 1

**User Story:** As a developer, I want the pdfgenerator service to use repository classes for data access, so that database logic is separated from business logic and the codebase follows consistent architectural patterns.

#### Acceptance Criteria

1. WHEN the pdfgenerator service needs to access document data THEN the system SHALL use DocumentRepository methods instead of direct Collections.Document calls
2. WHEN the pdfgenerator service needs to access template data THEN the system SHALL use TemplateRepository methods instead of direct Collections.Template calls
3. WHEN the pdfgenerator service needs to access tenant data THEN the system SHALL use TenantRepository methods instead of direct Collections.Tenant calls
4. WHEN the pdfgenerator service needs to access lease data THEN the system SHALL use LeaseRepository methods instead of direct Collections.Lease calls
5. WHEN the pdfgenerator service needs to access property data THEN the system SHALL use PropertyRepository methods through populated tenant relationships

### Requirement 2

**User Story:** As a developer, I want all Mongoose-specific operations removed from route handlers, so that the service layer contains only business logic and is easier to test.

#### Acceptance Criteria

1. WHEN examining route handler code THEN the system SHALL NOT contain direct Mongoose model method calls (find, findOne, create, update, delete)
2. WHEN examining route handler code THEN the system SHALL NOT contain Mongoose-specific methods like .lean() or .populate()
3. WHEN examining route handler code THEN the system SHALL use DataAccess.getXRepository() to obtain repository instances
4. WHEN a route handler needs to perform database operations THEN the system SHALL delegate to repository methods that return plain JavaScript objects
5. WHEN repository methods are insufficient THEN the system SHALL extend repository classes in the common package rather than adding Mongoose code to routes

### Requirement 3

**User Story:** As a developer, I want the common package to provide all necessary repository methods for the pdfgenerator service, so that data access logic is centralized and reusable.

#### Acceptance Criteria

1. WHEN DocumentRepository is accessed THEN the system SHALL provide methods for: findAll, findById, create, update, delete, and deleteMany operations
2. WHEN TemplateRepository is accessed THEN the system SHALL provide methods for: findAll, findById, findByIdAndRealm, create, update (replace), delete, and deleteMany operations
3. WHEN TenantRepository is accessed THEN the system SHALL provide methods for: findByIdWithProperties (with property population)
4. WHEN LeaseRepository is accessed THEN the system SHALL provide methods for: findById with realm filtering
5. WHEN repository methods return data THEN the system SHALL return plain JavaScript objects (not Mongoose documents)

### Requirement 4

**User Story:** As a developer, I want the refactoring to maintain backward compatibility, so that the pdfgenerator service continues to function identically after the changes.

#### Acceptance Criteria

1. WHEN the refactored service processes document requests THEN the system SHALL return the same response structure as before refactoring
2. WHEN the refactored service processes template requests THEN the system SHALL return the same response structure as before refactoring
3. WHEN the refactored service generates PDFs THEN the system SHALL produce identical output as before refactoring
4. WHEN the refactored service handles file uploads THEN the system SHALL maintain the same upload behavior as before refactoring
5. WHEN the refactored service encounters errors THEN the system SHALL throw the same ServiceError types with identical status codes as before refactoring

### Requirement 5

**User Story:** As a developer, I want the Collections import removed from pdfgenerator service files, so that there is no direct access to Mongoose models from the service layer.

#### Acceptance Criteria

1. WHEN examining pdfgenerator route files THEN the system SHALL NOT import Collections from @microrealestate/common
2. WHEN examining pdfgenerator route files THEN the system SHALL import DataAccess from @microrealestate/common
3. WHEN the service initializes THEN the system SHALL continue to use `useMongo: true` to establish database connection
4. WHEN repository instances are needed THEN the system SHALL obtain them via DataAccess.getXRepository() factory methods
5. WHEN all refactoring is complete THEN the system SHALL have zero direct Mongoose model references in route handlers

### Requirement 6

**User Story:** As a developer, I want helper functions that encapsulate complex data operations, so that route handlers remain clean and focused on HTTP concerns.

#### Acceptance Criteria

1. WHEN a route handler needs to fetch template data THEN the system SHALL use a helper function that internally uses TemplateRepository
2. WHEN a route handler needs to fetch template values (tenant, lease, properties) THEN the system SHALL use a helper function that internally uses multiple repositories
3. WHEN helper functions perform data operations THEN the system SHALL use repository methods exclusively (no direct Mongoose calls)
4. WHEN helper functions are defined THEN the system SHALL place them as private functions within the route module or in a separate utils module
5. WHEN helper functions return data THEN the system SHALL return plain JavaScript objects suitable for business logic processing
