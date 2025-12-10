# Implementation Plan

- [x] 1. Extend TenantRepository with new methods
  - [x] 1.1 Add find method to TenantRepository
    - Implement `find(filter, options)` method with simplified filter interface
    - Filter accepts: realmId (required), tenantId (optional), startTerm (optional), endTerm (optional)
    - Options accepts: sort.name ('asc' | 'desc')
    - Build MongoDB query from simple filter parameters
    - Add input validation for filter.realmId
    - Use `.lean()` to return plain objects
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.2 Write property test for plain object returns
    - **Property 1: Plain object returns**
    - **Validates: Requirements 1.2, 2.4, 5.4**

  - [x] 1.3 Write property test for sorting correctness
    - **Property 2: Sorting correctness**
    - **Validates: Requirements 2.5, 7.5**

  - [x] 1.4 Write property test for realm filtering
    - **Property 3: Realm filtering**
    - **Validates: Requirements 3.1**

  - [x] 1.5 Write property test for tenant ID filtering
    - **Property 4: Tenant ID filtering**
    - **Validates: Requirements 3.2**

  - [x] 1.6 Write property test for term range filtering
    - **Property 5: Term range filtering**
    - **Validates: Requirements 3.3, 7.1, 7.3**

  - [x] 1.7 Write property test for single term filtering
    - **Property 6: Single term filtering**
    - **Validates: Requirements 3.4, 7.2**

  - [x] 1.8 Write property test for multiple filter combination
    - **Property 7: Multiple filter combination**
    - **Validates: Requirements 3.5**

  - [x] 1.9 Write unit tests for find
    - Test find with realmId only
    - Test find with realmId and tenantId
    - Test find with realmId and term range
    - Test find with realmId and single term
    - Test find with sort.name 'asc' and 'desc'
    - Test find throws error for missing realmId
    - Test that plain objects are returned
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.10 Add findOne method to TenantRepository
    - Implement `findOne(filter)` method with simplified filter interface
    - Filter accepts: tenantId (required), realmId (required)
    - Add input validation for both tenantId and realmId
    - Use `.lean()` to return plain objects
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 2.2, 2.4_

  - [x] 1.11 Write unit tests for findOne
    - Test findOne with valid tenantId and realmId
    - Test findOne returns null for non-existent tenant
    - Test findOne throws error for missing tenantId
    - Test findOne throws error for missing realmId
    - Test that plain objects are returned
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 2.2, 2.4_

  - [x] 1.12 Add findOneAndUpdate method to TenantRepository
    - Implement `findOneAndUpdate(filter, update, options)` method
    - Filter accepts: tenantId (required), realmId (required)
    - Options accepts: returnUpdated (boolean)
    - Add input validation for tenantId, realmId, and update
    - Use `findOneAndUpdate()` with `lean: true` option
    - Map returnUpdated option to Mongoose `new` option
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 2.3, 2.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 1.13 Write property test for atomic update persistence
    - **Property 8: Atomic update persistence**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 1.14 Write property test for nested array update support
    - **Property 9: Nested array update support**
    - **Validates: Requirements 5.3**

  - [x] 1.15 Write property test for ID string conversion
    - **Property 11: ID string conversion**
    - **Validates: Requirements 7.4**

  - [x] 1.16 Write unit tests for findOneAndUpdate
    - Test findOneAndUpdate with valid filter and update
    - Test findOneAndUpdate with returnUpdated: true returns updated document
    - Test findOneAndUpdate with returnUpdated: false returns original document
    - Test findOneAndUpdate with nested rents array update
    - Test findOneAndUpdate returns null for non-existent tenant
    - Test findOneAndUpdate throws error for missing tenantId
    - Test findOneAndUpdate throws error for missing realmId
    - Test that plain objects are returned
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 2.3, 2.4, 5.1, 5.2, 5.3, 5.4_

- [x] 2. Checkpoint - Ensure all repository tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Refactor _findOccupants helper function
  - [x] 3.1 Update _findOccupants to use TenantRepository
    - Import DataAccess from @microrealestate/common
    - Get tenantRepository instance
    - Build simplified filter object from parameters
    - Set filter.realmId from realm._id
    - Set filter.tenantId if tenantId parameter provided
    - Set filter.startTerm and filter.endTerm if term range provided
    - Set filter.startTerm only if single term provided
    - Replace `Collections.Tenant.find().sort().lean()` with `tenantRepository.find(filter, { sort: { name: 'asc' } })`
    - Keep post-query filtering of tenant.rents arrays
    - Keep _id string conversion logic
    - _Requirements: 4.1, 4.2, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 3.2 Write integration test for _findOccupants
    - Test _findOccupants with realm only
    - Test _findOccupants with realm and tenantId
    - Test _findOccupants with realm and term range
    - Test _findOccupants with realm and single term
    - Verify results are sorted by name
    - Verify _id is converted to string
    - Verify rents are filtered by term
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 4.1, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4. Refactor _updateByTerm function
  - [x] 4.1 Update _updateByTerm to use TenantRepository
    - Import DataAccess from @microrealestate/common
    - Get tenantRepository instance
    - Keep promo/extracharge normalization logic
    - Replace `Collections.Tenant.findOne().lean()` with `tenantRepository.findOne({ tenantId: paymentData._id, realmId: realm._id })`
    - Keep contract building logic
    - Keep settlements building logic
    - Keep Contract.payTerm call
    - Keep email status fetching
    - Replace `Collections.Tenant.findOneAndUpdate().lean()` with `tenantRepository.findOneAndUpdate({ tenantId, realmId }, occupant, { returnUpdated: true })`
    - Keep rent filtering and FD.toRentData transformation
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5, 12.3_

  - [x] 4.2 Write property test for invalid promo normalization
    - **Property 12: Invalid promo normalization**
    - **Validates: Requirements 12.3**

  - [x] 4.3 Write integration test for _updateByTerm
    - Test _updateByTerm with valid payment data
    - Test rent calculations are correct
    - Test atomic update persists changes
    - Test email status is included in response
    - Test invalid promo/extracharge are normalized
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5, 12.3_

- [x] 5. Remove Collections imports from rent manager
  - [x] 5.1 Clean up imports
    - Remove Collections from import statement
    - Verify DataAccess is imported
    - Verify no Collections usage remains in file
    - _Requirements: 4.4, 4.5_

  - [x] 5.2 Verify rent manager functionality
    - Test update endpoint manually or with existing tests
    - Test updateByTerm endpoint manually or with existing tests
    - Test rentsOfOccupant endpoint manually or with existing tests
    - Test rentOfOccupantByTerm endpoint manually or with existing tests
    - Test all endpoint manually or with existing tests
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 1.4, 1.5, 4.4, 4.5_

- [x] 6. Final verification
  - [x] 6.1 Build common package
    - Run `yarn workspace @microrealestate/common build`
    - Verify TypeScript compilation succeeds
    - Verify both Collections and DataAccess are exported
    - _Requirements: 10.5_

  - [x] 6.2 Build API service
    - Run `yarn workspace @microrealestate/api build`
    - Verify service compiles successfully (JavaScript, no build step)
    - _Requirements: 10.4_

  - [x] 6.3 Run test suites
    - Run `yarn workspace @microrealestate/common test`
    - Verify all repository tests pass
    - Run `yarn workspace @microrealestate/api test` (if tests exist)
    - Verify no regressions
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 10.5_

- [x] 7. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
