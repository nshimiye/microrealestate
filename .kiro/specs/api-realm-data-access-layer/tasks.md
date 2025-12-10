# Implementation Plan

- [x] 1. Extend RealmRepository with new methods
  - [x] 1.1 Add findOne method to RealmRepository
    - Implement `findOne(filter: { _id: string })` method
    - Add input validation for filter._id
    - Use `.lean()` to return plain objects
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 2.3, 2.4_

  - [x] 1.2 Write property test for findOne
    - **Property 6: Realm findOne returns correct realm**
    - **Validates: Requirements 2.3**

  - [x] 1.3 Write unit tests for findOne
    - Test findOne with valid _id
    - Test findOne returns null for non-existent realm
    - Test findOne throws error for invalid filter
    - Test that plain objects are returned
    - _Requirements: 2.3, 2.4_

  - [x] 1.4 Add create method to RealmRepository
    - Implement `create(realmData: Partial<Realm>)` method
    - Add input validation for realmData
    - Use `RealmModel.create()` then convert to plain object
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 1.5 Write property test for create persistence
    - **Property 2: Realm creation persistence**
    - **Validates: Requirements 2.1**

  - [x] 1.6 Write property test for application secret hashing on create
    - **Property 4: Application secret hashing**
    - **Validates: Requirements 2.5, 5.3**

  - [x] 1.7 Write unit tests for create
    - Test create with valid realm data
    - Test create with applications triggers secret hashing
    - Test create throws error for invalid data
    - Test that plain objects are returned
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 1.8 Add update method to RealmRepository
    - Implement `update(realmId: string, updateData: Partial<Realm>)` method
    - Find existing realm document
    - Use `.set()` to update document
    - Use `.save()` to trigger pre-save hooks
    - Convert to plain object before returning
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 2.2, 2.4, 2.5, 5.1, 5.2, 5.3, 5.4_

  - [x] 1.9 Write property test for update persistence
    - **Property 3: Realm update persistence**
    - **Validates: Requirements 2.2, 5.1**

  - [x] 1.10 Write property test for application secret hashing on update
    - **Property 4: Application secret hashing**
    - **Validates: Requirements 2.5, 5.3**

  - [x] 1.11 Write unit tests for update
    - Test update with valid realm and data
    - Test update with new applications triggers secret hashing
    - Test update throws error for non-existent realm
    - Test update throws error for invalid data
    - Test that plain objects are returned
    - _Requirements: 2.2, 2.4, 2.5, 5.1, 5.2, 5.3, 5.4_

- [x] 2. Extend AccountRepository with findAll method
  - [x] 2.1 Add findAll method to AccountRepository
    - Implement `findAll()` method
    - Use `.lean()` to return plain objects
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.2 Write property test for findAll
    - **Property 5: Account findAll returns all accounts**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 2.3 Write unit tests for findAll
    - Test findAll returns all accounts
    - Test findAll returns empty array for empty database
    - Test that plain objects are returned
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Checkpoint - Ensure all repository tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Refactor realm manager add function
  - [x] 4.1 Update add function to use RealmRepository
    - Import DataAccess from @microrealestate/common
    - Get realmRepository instance
    - Replace `new Collections.Realm(req.body)` with plain object
    - Keep validation calls (_hasRequiredFields, _isNameAlreadyTaken)
    - Keep secret encryption logic (Crypto.encrypt)
    - Replace `await newRealm.save()` with `await realmRepository.create(newRealm)`
    - Keep _escapeSecrets call on response
    - _Requirements: 4.1, 4.6, 6.1, 6.2, 6.3_

  - [x] 4.2 Write integration test for add function
    - Test complete add realm flow with repositories
    - Verify realm is created with encrypted secrets
    - Verify application secrets are hashed
    - Verify validation works correctly
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 4.1, 6.1, 6.2, 6.3_

- [x] 5. Refactor realm manager update function
  - [x] 5.1 Update update function to use repositories
    - Import DataAccess from @microrealestate/common
    - Get realmRepository and accountRepository instances
    - Replace `Collections.Realm.findOne()` with `realmRepository.findOne()`
    - Replace `previousRealm.toObject()` with plain object spread
    - Keep validation calls (_hasRequiredFields, _isNameAlreadyTaken)
    - Keep secret encryption/preservation logic
    - Replace `Collections.Account.find().lean()` with `accountRepository.findAll()`
    - Keep member population logic
    - Keep application credential protection logic
    - Replace `previousRealm.set()` and `previousRealm.save()` with `realmRepository.update()`
    - Keep _escapeSecrets call on response
    - _Requirements: 4.2, 4.3, 4.4, 4.6, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 5.2 Write integration test for update function
    - Test complete update realm flow with repositories
    - Verify realm is updated correctly
    - Verify secret handling (preserve existing, encrypt new)
    - Verify member population from accounts
    - Verify application credential protection
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 6. Remove Collections imports from realm manager
  - [x] 6.1 Clean up imports
    - Remove Collections from import statement
    - Verify DataAccess is imported
    - Verify no Collections usage remains in file
    - _Requirements: 4.5_

  - [x] 6.2 Verify realm manager functionality
    - Test add endpoint manually or with existing tests
    - Test update endpoint manually or with existing tests
    - Test one endpoint (should still work, uses req.realms)
    - Test all endpoint (should still work, uses req.realms)
    - _Requirements: 1.5, 4.5_

- [x] 7. Final verification
  - [x] 7.1 Build common package
    - Run `yarn workspace @microrealestate/common build`
    - Verify TypeScript compilation succeeds
    - Verify both Collections and DataAccess are exported
    - _Requirements: 9.5_

  - [x] 7.2 Build API service
    - Run `yarn workspace @microrealestate/api build`
    - Verify service compiles successfully (JavaScript, no build step)
    - _Requirements: 9.4_

  - [x] 7.3 Run test suites
    - Run `yarn workspace @microrealestate/common test`
    - Verify all repository tests pass
    - Run `yarn workspace @microrealestate/api test` (if tests exist)
    - Verify no regressions
    - When you find a bug unrelated to your task, document it in bugs folder
    - _Requirements: 9.5_

- [x] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
