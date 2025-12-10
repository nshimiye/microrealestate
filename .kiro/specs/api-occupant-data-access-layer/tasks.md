# Implementation Plan

- [x] 1. Extend TenantRepository with new methods
  - Add `create()`, `update()`, `findByIds()`, `deleteMany()`, and `findWithAggregation()` methods to TenantRepository
  - Use `.lean()` for queries to return plain objects
  - Use `.toObject()` for create operations
  - Implement complex aggregation pipeline for `findWithAggregation()`
  - Include JSDoc comments and TypeScript type annotations
  - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 3.8_

- [x] 1.1 Write unit tests for TenantRepository methods
  - Test `create()` with valid tenant data
  - Test `update()` returns modification count
  - Test `findByIds()` with multiple tenant IDs
  - Test `deleteMany()` returns deletion count
  - Test `findWithAggregation()` returns properly structured data
  - Test realm-scoped filtering
  - Test error handling for invalid inputs
  - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7_

- [x] 1.2 Write property test for TenantRepository plain objects
  - **Property 1: Plain object returns**
  - **Validates: Requirements 3.8**

- [x] 1.3 Write property test for tenant creation persistence
  - **Property 2: Tenant creation persistence**
  - **Validates: Requirements 3.1**

- [x] 1.4 Write property test for tenant update persistence
  - **Property 3: Tenant update persistence**
  - **Validates: Requirements 3.2**

- [x] 1.5 Write property test for realm-scoped queries
  - **Property 4: Realm-scoped queries**
  - **Validates: Requirements 1.2, 3.5**

- [x] 2. Create DocumentRepository
  - Create new `DocumentRepository.ts` in `services/common/src/dataAccess/`
  - Implement `findByTenantIds()` method with projection support
  - Use `.lean()` to return plain objects
  - Include realm-scoped filtering for security
  - Include JSDoc comments and TypeScript type annotations
  - _Requirements: 15.1, 15.2, 15.3_

- [x] 2.1 Write unit tests for DocumentRepository
  - Test `findByTenantIds()` with multiple tenant IDs
  - Test projection parameter works correctly
  - Test realm-scoped filtering
  - Test empty results return empty array
  - Test error handling for invalid inputs
  - _Requirements: 15.2, 15.3_

- [x] 2.2 Write property test for document queries
  - **Property 9: Document query by tenant IDs**
  - **Validates: Requirements 15.2**

- [x] 3. Create SessionManager utility
  - Create new `SessionManager.ts` in `services/common/src/dataAccess/`
  - Implement `startSession()` method that wraps mongoose.startSession()
  - Implement `withTransaction()` method with automatic lifecycle management
  - Handle transaction commit on success and abort on error
  - Ensure session cleanup in finally block
  - Include JSDoc comments and TypeScript type annotations
  - _Requirements: 10.5, 15.5_

- [x] 3.1 Write unit tests for SessionManager
  - Test `startSession()` returns a valid session
  - Test `withTransaction()` commits on success
  - Test `withTransaction()` aborts on error
  - Test session is always ended in finally block
  - Test transaction result is returned correctly
  - _Requirements: 10.5, 15.5_

- [x] 3.2 Write property test for transaction atomicity
  - **Property 10: Transaction atomicity**
  - **Validates: Requirements 10.5, 15.5**

- [x] 4. Update DataAccess index exports
  - Add `getDocumentRepository()` function to `services/common/src/dataAccess/index.ts`
  - Add `getSessionManager()` function to `services/common/src/dataAccess/index.ts`
  - Follow singleton pattern used by other repositories
  - Export new functions from DataAccess namespace
  - _Requirements: 13.2, 14.4_

- [x] 5. Build common package
  - Run `yarn workspace @microrealestate/common build` to compile TypeScript
  - Verify no compilation errors
  - Verify new repositories are exported correctly
  - _Requirements: 13.5_

- [x] 6. Refactor _buildPropertyMap helper function
  - Replace `Collections.Property.find()` with `propertyRepository.findAll()`
  - Keep property map building logic in occupant manager
  - Keep string conversion of property IDs
  - Test that property map works correctly
  - _Requirements: 2.1, 7.1, 7.2, 7.3_

- [x] 7. Refactor _fetchTenants helper function
  - Replace `Collections.Tenant.aggregate()` with `tenantRepository.findWithAggregation()`
  - Keep missing document computation logic in occupant manager
  - Keep moment-based date calculations
  - Test that aggregation results are correct
  - _Requirements: 1.1, 9.1, 9.2, 9.3, 9.4_

- [x] 8. Refactor occupant manager add() function
  - Import `DataAccess` from `@microrealestate/common`
  - Get repository instances using `DataAccess.getTenantRepository()` and `DataAccess.getPropertyRepository()`
  - Replace `Collections.Tenant.create()` with `tenantRepository.create()`
  - Use refactored `_buildPropertyMap()` helper
  - Use refactored `_fetchTenants()` helper
  - Keep all validation, formatting, and contract generation logic
  - Test add flow works correctly
  - _Requirements: 1.1, 5.1, 6.1, 6.2, 8.1_

- [x] 9. Refactor occupant manager update() function
  - Replace `Collections.Tenant.findOne()` with `tenantRepository.findById()`
  - Replace `Collections.Tenant.updateOne()` with `tenantRepository.update()`
  - Use refactored `_buildPropertyMap()` helper
  - Use refactored `_fetchTenants()` helper
  - Keep all validation, formatting, and contract generation logic
  - Test update flow works correctly
  - _Requirements: 1.2, 5.2, 5.3, 8.2, 8.3_

- [x] 10. Refactor occupant manager remove() function
  - Replace `Collections.Tenant.find()` with `tenantRepository.findByIds()`
  - Replace `Collections.Document.find()` with `documentRepository.findByTenantIds()`
  - Replace `Collections.Tenant.deleteMany()` with `tenantRepository.deleteMany()`
  - Replace `Collections.startSession()` with `sessionManager.withTransaction()`
  - Refactor transaction logic to use `withTransaction()` callback pattern
  - Keep PDF generator service call via axios
  - Keep validation logic for paid rents
  - Test remove flow works correctly with transactions
  - _Requirements: 1.3, 5.4, 5.5, 10.1, 10.2, 10.3, 10.4, 10.5, 15.2, 15.3, 15.4, 15.5_

- [x] 11. Refactor occupant manager all() function
  - Use refactored `_fetchTenants()` helper
  - Keep FD.toOccupantData() transformation
  - Test all flow works correctly
  - _Requirements: 1.4, 9.5_

- [x] 12. Refactor occupant manager one() function
  - Use refactored `_fetchTenants()` helper with tenantId parameter
  - Keep FD.toOccupantData() transformation
  - Test one flow works correctly
  - _Requirements: 1.4, 9.5_

- [x] 13. Refactor occupant manager overview() function
  - Replace `Collections.Tenant.find()` with `tenantRepository.findAll()`
  - Keep moment-based date calculations for active/inactive counts
  - Keep overview statistics computation logic
  - Test overview flow works correctly
  - _Requirements: 1.4, 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 14. Remove Collections imports from occupant manager
  - Remove `Collections` from import statement
  - Verify no direct Mongoose/Collections usage remains
  - Verify occupant manager only imports from DataAccess
  - Run linter to check for any remaining issues
  - _Requirements: 5.8, 5.9, 13.1_

- [x] 15. Verify complete decoupling
  - Search occupant manager for any `Collections.` references
  - Search occupant manager for any `mongoose` imports
  - Verify all database operations go through repositories
  - Verify all transactions go through SessionManager
  - Run all tests to ensure functionality is preserved
  - _Requirements: 1.5, 13.4_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise
