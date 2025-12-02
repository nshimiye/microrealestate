# Implementation Plan

- [x] 1. Set up data access layer structure in services/common
  - Create `services/common/src/dataAccess/` directory
  - Create index file that will export factory functions
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. Implement AccountRepository
  - [x] 2.1 Create AccountRepository class with core methods
    - Implement `findByEmail(email: string)` method with email normalization
    - Implement `findById(id: string)` method
    - Implement `create(accountData)` method that returns plain objects
    - Implement `updatePassword(email: string, newPassword: string)` method
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 3.1, 3.2, 3.3, 5.1, 7.1, 7.2_

  - [x] 2.2 Write property test for plain object returns
    - **Property 1: Plain object returns**
    - **Validates: Requirements 1.2, 2.5, 5.2**

  - [x] 2.3 Write property test for email normalization
    - **Property 7: Email normalization consistency**
    - **Validates: Requirements 5.1**

  - [x] 2.4 Write property test for account creation persistence
    - **Property 3: Account creation persistence**
    - **Validates: Requirements 3.2**

  - [x] 2.5 Write property test for password hashing
    - **Property 9: Password hashing preservation**
    - **Validates: Requirements 5.5**

  - [x] 2.6 Write property test for realm member updates
    - **Property 10: Realm member update preservation**
    - **Validates: Requirements 5.5**

  - [x] 2.7 Write unit tests for AccountRepository methods
    - Test findByEmail with valid and invalid emails
    - Test findById with valid and invalid IDs
    - Test create with valid account data
    - Test updatePassword with existing and non-existing accounts
    - Test error handling for invalid inputs
    - _Requirements: 3.1, 3.2, 3.3, 5.3_

- [x] 3. Implement TenantRepository
  - [x] 3.1 Create TenantRepository class with core methods
    - Implement `findByContactEmail(email: string)` method
    - Implement `findById(id: string)` method
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 3.4, 7.1, 7.2_

  - [x] 3.2 Write property test for tenant contact email queries
    - **Property 5: Tenant findByContactEmail returns matching tenants**
    - **Validates: Requirements 3.4**

  - [x] 3.3 Write unit tests for TenantRepository methods
    - Test findByContactEmail with various email patterns
    - Test findById with valid and invalid IDs
    - Test that plain objects are returned
    - _Requirements: 3.4_

- [x] 4. Implement RealmRepository
  - [x] 4.1 Create RealmRepository class with core methods
    - Implement `findById(id: string)` method that includes applications
    - Implement `updateMemberRegistration(email: string, name: string)` method
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 3.5, 7.1, 7.2_

  - [x] 4.2 Write property test for realm queries with applications
    - **Property 6: Realm findById returns realm with applications**
    - **Validates: Requirements 3.5**

  - [x] 4.3 Write unit tests for RealmRepository methods
    - Test findById returns realm with applications array
    - Test updateMemberRegistration updates correct members
    - Test that plain objects are returned
    - _Requirements: 3.5_

- [x] 5. Create repository factory functions and exports
  - [x] 5.1 Implement singleton factory functions
    - Create `getAccountRepository()` factory function
    - Create `getTenantRepository()` factory function
    - Create `getRealmRepository()` factory function
    - Export factory functions from dataAccess/index.ts
    - _Requirements: 2.4_

  - [x] 5.2 Update common package exports
    - Add DataAccess namespace export to services/common/src/index.ts
    - Verify Collections namespace remains unchanged
    - _Requirements: 6.1, 6.2_

  - [x] 5.3 Write unit tests for factory functions
    - Test that factory functions return singleton instances
    - Test that multiple calls return same instance
    - Test that instances are properly initialized

- [x] 6. Checkpoint - Ensure all repository tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Refactor authenticator landlord routes to use repositories
  - [x] 7.1 Update signup endpoint
    - Replace `Collections.Account.findOne()` with `accountRepository.findByEmail()`
    - Replace `Collections.Account.create()` with `accountRepository.create()`
    - Remove Collections import, add DataAccess import
    - _Requirements: 4.1, 4.4_

  - [x] 7.2 Update signin endpoints
    - Replace `Collections.Account.findOne()` in `_userSignIn` with `accountRepository.findByEmail()`
    - Replace `Collections.Realm.findOne()` in `_applicationSignIn` with `realmRepository.findById()`
    - Update bcrypt.compare() calls to work with plain objects
    - _Requirements: 4.1, 4.3_

  - [x] 7.3 Update password reset endpoints
    - Replace `Collections.Account.findOne()` in forgotpassword with `accountRepository.findByEmail()`
    - Replace `Collections.Account.findOne()` and `.save()` in resetpassword with `accountRepository.updatePassword()`
    - _Requirements: 4.1_

  - [x] 7.4 Write integration tests for landlord authentication flows
    - Test complete signup flow with repositories
    - Test complete signin flow with repositories
    - Test complete password reset flow with repositories
    - Verify tokens are generated correctly
    - _Requirements: 4.5_

- [x] 8. Refactor authenticator tenant routes to use repositories
  - [x] 8.1 Update tenant signin endpoint
    - Replace `Collections.Tenant.find()` with `tenantRepository.findByContactEmail()`
    - Remove Collections import, add DataAccess import
    - _Requirements: 4.2, 4.4_

  - [x] 8.2 Write integration tests for tenant authentication flows
    - Test complete tenant signin flow with repositories
    - Test OTP generation and validation
    - Verify session tokens are generated correctly
    - _Requirements: 4.5_

- [x] 9. Final verification and cleanup
  - [x] 9.1 Verify authenticator service has no direct Collections usage
    - Search for `Collections.Account`, `Collections.Realm`, `Collections.Tenant` in authenticator service
    - Ensure all have been replaced with repository calls
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 9.2 Build and verify common package
    - Run `yarn workspace @microrealestate/common build`
    - Verify both Collections and DataAccess are exported
    - Verify TypeScript compilation succeeds
    - _Requirements: 6.5_

  - [x] 9.3 Build and verify authenticator service
    - Run `yarn workspace @microrealestate/authenticator build`
    - Verify service compiles successfully with new imports
    - _Requirements: 6.4_

  - [x] 9.4 Run full test suite
    - Run all unit tests in common package
    - Run all property-based tests
    - Run all integration tests in authenticator service
    - Verify all tests pass
    - _Requirements: 4.5_

- [x] 10. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
