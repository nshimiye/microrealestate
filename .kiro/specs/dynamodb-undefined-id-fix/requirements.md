# Requirements Document

## Introduction

This specification addresses a critical bug in the DynamoDB data access layer where entity IDs are being stored as `undefined` in DynamoDB records. This issue does not occur with MongoDB, indicating a difference in how ID generation is handled between the two database implementations. The problem affects all entities that use the DynamoDB repositories (documents, tenants, properties, leases, templates, etc.).

## Glossary

- **Entity**: A domain object (Document, Tenant, Property, Lease, Template, Realm, Account) stored in the database
- **Repository**: A data access layer class that handles CRUD operations for a specific entity type
- **DynamoDB Item**: The representation of an entity in DynamoDB format with PK (Partition Key) and SK (Sort Key)
- **toItem Method**: A method that transforms an application entity to a DynamoDB item
- **fromItem Method**: A method that transforms a DynamoDB item back to an application entity
- **UUID**: Universally Unique Identifier used as the primary identifier for entities
- **_id Field**: The primary identifier field on application entities (MongoDB convention)
- **DocumentId/TenantId/etc**: The DynamoDB attribute name for storing the entity's ID

## Requirements

### Requirement 1

**User Story:** As a developer, I want entity IDs to be properly generated and stored in DynamoDB, so that all database operations work correctly and data integrity is maintained.

#### Acceptance Criteria

1. WHEN a new entity is created without an `_id` field THEN the system SHALL generate a valid UUID and assign it to the entity's `_id` field before calling `toItem`
2. WHEN `toItem` is called on an entity THEN the system SHALL extract a defined (non-undefined) ID value from the entity's `_id` field
3. WHEN a DynamoDB item is created THEN the system SHALL store the entity ID in the appropriate attribute field (DocumentId, TenantId, etc.) with a defined value
4. WHEN an entity is retrieved from DynamoDB THEN the system SHALL correctly map the stored ID attribute back to the entity's `_id` field
5. WHEN comparing MongoDB and DynamoDB implementations THEN both SHALL produce entities with identical `_id` values for the same input data

### Requirement 2

**User Story:** As a developer, I want consistent ID generation across all entity types, so that the codebase is maintainable and follows a single pattern.

#### Acceptance Criteria

1. WHEN any repository creates an entity THEN the system SHALL use a consistent UUID generation method across all repositories
2. WHEN generating UUIDs THEN the system SHALL use either `uuid.v4()` or `crypto.randomUUID()` consistently (not a mix of both)
3. WHEN an entity's `_id` is undefined or null THEN the system SHALL generate a new UUID before storing the entity
4. WHEN validating entity data THEN the system SHALL ensure `_id` is defined before calling `toItem`
5. WHEN logging entity creation THEN the system SHALL include the generated ID in debug logs for traceability

### Requirement 3

**User Story:** As a developer, I want comprehensive tests that verify ID generation and storage, so that this bug cannot reoccur.

#### Acceptance Criteria

1. WHEN running unit tests THEN the system SHALL verify that created entities have defined `_id` values
2. WHEN running unit tests THEN the system SHALL verify that DynamoDB items have defined ID attribute values (DocumentId, TenantId, etc.)
3. WHEN testing the create flow THEN the system SHALL verify the round-trip: create entity → store in DynamoDB → retrieve from DynamoDB → verify `_id` matches
4. WHEN testing with partial entity data (missing `_id`) THEN the system SHALL verify that IDs are auto-generated
5. WHEN testing with explicit `_id` values THEN the system SHALL verify that the provided ID is preserved

### Requirement 4

**User Story:** As a developer, I want clear error messages when ID-related issues occur, so that I can quickly diagnose and fix problems.

#### Acceptance Criteria

1. WHEN `toItem` receives an entity with undefined `_id` THEN the system SHALL throw a descriptive error indicating the missing ID
2. WHEN `buildPK` or `buildSK` receives an undefined ID parameter THEN the system SHALL throw a descriptive error
3. WHEN logging entity operations THEN the system SHALL include entity IDs in all log messages for debugging
4. WHEN an ID validation fails THEN the error message SHALL include the entity type and the problematic ID value
5. WHEN debugging ID issues THEN developers SHALL be able to trace the ID through the entire create/update flow via logs
