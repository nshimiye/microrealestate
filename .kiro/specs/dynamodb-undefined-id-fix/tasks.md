# Implementation Plan

- [x] 1. Standardize UUID generation across all repositories
  - Replace all `uuid.v4()` imports with `crypto.randomUUID()`
  - Remove uuid package dependency from repositories that only use it for ID generation
  - Verify all repositories use consistent UUID generation
  - _Requirements: 2.1, 2.2_

- [x] 2. Add ID validation to base repository create method
  - [x] 2.1 Update BaseOthersCRUDRepository.create() to validate entity._id
    - Add check that entity._id is defined before calling toItem()
    - Throw ServiceError with descriptive message if _id is undefined
    - Add entity ID to debug log message
    - _Requirements: 1.1, 2.4, 4.1_

  - [x] 2.2 Update BaseRealmCRUDRepository.create() to validate entity._id
    - Add check that entity._id is defined before calling toItem()
    - Throw ServiceError with descriptive message if _id is undefined
    - Add entity ID to debug log message
    - _Requirements: 1.1, 2.4, 4.1_

- [x] 3. Enhance concrete repository create methods with explicit ID generation
  - [x] 3.1 Update DocumentRepository.create()
    - Extract ID generation to separate variable: `const documentId = documentData._id || randomUUID()`
    - Add validation that documentId is defined
    - Use validated documentId in entity construction
    - _Requirements: 1.1, 2.3_

  - [x] 3.2 Update TenantRepository.create()
    - Extract ID generation to separate variable: `const tenantId = tenantData._id || randomUUID()`
    - Add validation that tenantId is defined
    - Use validated tenantId in entity construction
    - _Requirements: 1.1, 2.3_

  - [x] 3.3 Update PropertyRepository.create()
    - Extract ID generation to separate variable: `const propertyId = propertyData._id || randomUUID()`
    - Add validation that propertyId is defined
    - Use validated propertyId in entity construction
    - _Requirements: 1.1, 2.3_

  - [x] 3.4 Update LeaseRepository.create()
    - Extract ID generation to separate variable: `const leaseId = leaseData._id || randomUUID()`
    - Add validation that leaseId is defined
    - Use validated leaseId in entity construction
    - _Requirements: 1.1, 2.3_

  - [x] 3.5 Update TemplateRepository.create()
    - Extract ID generation to separate variable: `const templateId = templateData._id || randomUUID()`
    - Add validation that templateId is defined
    - Use validated templateId in entity construction
    - _Requirements: 1.1, 2.3_

  - [x] 3.6 Update RealmRepository.create()
    - Extract ID generation to separate variable: `const realmId = realmData._id || randomUUID()`
    - Add validation that realmId is defined
    - Use validated realmId in entity construction
    - _Requirements: 1.1, 2.3_

  - [x] 3.7 Update AccountRepository.create()
    - Extract ID generation to separate variable (if applicable)
    - Add validation that ID is defined
    - Use validated ID in entity construction
    - _Requirements: 1.1, 2.3_

- [ ] 4. Add defensive validation to toItem methods
  - [ ] 4.1 Update DocumentBaseRepository.toItem()
    - Add check that entity._id is defined at start of method
    - Throw descriptive error if _id is undefined
    - Include entity type in error message
    - _Requirements: 1.2, 4.1, 4.4_

  - [ ] 4.2 Update TenantBaseRepository.toItem()
    - Add check that entity._id is defined at start of method
    - Throw descriptive error if _id is undefined
    - Include entity type in error message
    - _Requirements: 1.2, 4.1, 4.4_

  - [ ] 4.3 Update PropertyBaseRepository.toItem()
    - Add check that entity._id is defined at start of method
    - Throw descriptive error if _id is undefined
    - Include entity type in error message
    - _Requirements: 1.2, 4.1, 4.4_

  - [ ] 4.4 Update LeaseBaseRepository.toItem()
    - Add check that entity._id is defined at start of method
    - Throw descriptive error if _id is undefined
    - Include entity type in error message
    - _Requirements: 1.2, 4.1, 4.4_

  - [ ] 4.5 Update TemplateBaseRepository.toItem()
    - Add check that entity._id is defined at start of method
    - Throw descriptive error if _id is undefined
    - Include entity type in error message
    - _Requirements: 1.2, 4.1, 4.4_

  - [ ] 4.6 Update RealmBaseRepository.toItem()
    - Add check that entity._id is defined at start of method
    - Throw descriptive error if _id is undefined
    - Include entity type in error message
    - _Requirements: 1.2, 4.1, 4.4_

  - [ ] 4.7 Update AccountBaseRepository.toItem()
    - Add check that entity._id is defined at start of method
    - Throw descriptive error if _id is undefined
    - Include entity type in error message
    - _Requirements: 1.2, 4.1, 4.4_

- [ ] 5. Add parameter validation to key building methods
  - [ ] 5.1 Update all buildPK methods
    - Add validation that id parameter is defined
    - Add validation that realmId parameter is defined (where applicable)
    - Throw descriptive error with parameter name if undefined
    - _Requirements: 4.2, 4.4_

  - [ ] 5.2 Update all buildSK methods
    - Add validation that id parameter is defined
    - Throw descriptive error with parameter name if undefined
    - _Requirements: 4.2, 4.4_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Write property-based tests for ID generation and validation
  - [ ] 7.1 Write property test for ID generation
    - **Property 1: ID Generation for Missing IDs**
    - **Validates: Requirements 1.1, 2.3**
    - Generate random entity data without _id field
    - Create entity using repository
    - Verify resulting entity has valid UUID _id (not undefined, null, or empty)
    - Run with minimum 100 iterations

  - [ ] 7.2 Write property test for toItem ID extraction
    - **Property 2: toItem Receives Defined IDs**
    - **Validates: Requirements 1.2, 1.3**
    - Generate random entities with valid _id values
    - Call toItem on each entity
    - Verify returned DynamoDB item has defined ID attribute (DocumentId, TenantId, etc.)
    - Run with minimum 100 iterations

  - [ ] 7.3 Write property test for round-trip ID preservation
    - **Property 3: Round-trip ID Preservation**
    - **Validates: Requirements 1.4**
    - Generate random entities with valid _id values
    - Apply fromItem(toItem(entity))
    - Verify _id field is preserved exactly
    - Run with minimum 100 iterations

  - [ ] 7.4 Write property test for MongoDB-DynamoDB consistency
    - **Property 4: MongoDB-DynamoDB ID Consistency**
    - **Validates: Requirements 1.5**
    - Generate random entity data
    - Create entity with both MongoDB and DynamoDB repositories
    - Verify both resulting entities have defined _id values
    - Run with minimum 100 iterations

  - [ ] 7.5 Write property test for ID validation
    - **Property 5: ID Validation Before toItem**
    - **Validates: Requirements 2.4**
    - Generate entities with undefined or null _id
    - Attempt to call toItem
    - Verify either ID is auto-generated or descriptive error is thrown
    - Run with minimum 100 iterations

- [ ] 8. Write unit tests for error handling
  - [ ] 8.1 Test create with undefined _id
    - Create entity data without _id field
    - Call repository.create()
    - Verify entity is created with valid UUID _id
    - _Requirements: 1.1_

  - [ ] 8.2 Test create with explicit _id
    - Create entity data with specific _id value
    - Call repository.create()
    - Verify returned entity has the same _id
    - _Requirements: 1.1_

  - [ ] 8.3 Test toItem with undefined _id
    - Create entity with undefined _id
    - Call toItem directly
    - Verify descriptive error is thrown
    - Verify error message includes entity type
    - _Requirements: 4.1, 4.4_

  - [ ] 8.4 Test buildPK with undefined parameters
    - Call buildPK with undefined id or realmId
    - Verify descriptive error is thrown
    - Verify error message includes parameter name
    - _Requirements: 4.2, 4.4_

  - [ ] 8.5 Test buildSK with undefined parameters
    - Call buildSK with undefined id
    - Verify descriptive error is thrown
    - Verify error message includes parameter name
    - _Requirements: 4.2, 4.4_

- [ ] 9. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
