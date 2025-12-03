# Implementation Plan

- [x] 1. Refactor email manager to use TenantRepository
  - Replace `Collections.Tenant.find()` with `tenantRepository.findByIds()`
  - Update imports to use `DataAccess` instead of `Collections`
  - Obtain TenantRepository instance via `DataAccess.getTenantRepository()`
  - Pass `tenantIds` array and `realmId` string as separate parameters
  - Remove `.lean()` call since repository returns plain objects
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.1 Write property test for tenant query security
  - **Property 1: Tenant query security**
  - **Validates: Requirements 3.2**

- [x] 1.2 Write property test for email sending completeness
  - **Property 2: Email sending completeness**
  - **Validates: Requirements 4.4**

- [x] 1.3 Write property test for term calculation consistency
  - **Property 3: Term calculation consistency**
  - **Validates: Requirements 6.1, 6.2**

- [x] 1.4 Write property test for error isolation
  - **Property 4: Error isolation**
  - **Validates: Requirements 5.1**

- [x] 1.5 Write property test for response format consistency
  - **Property 5: Response format consistency**
  - **Validates: Requirements 10.1, 10.2, 10.3**

- [x] 1.6 Write unit tests for email manager
  - Test repository integration (correct parameters passed)
  - Test email sending with custom terms
  - Test email sending with default term calculation
  - Test per-tenant error isolation
  - Test overall response status (500 if any failed, 200 if all succeeded)
  - Test error message extraction from emailer service
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.3, 6.4, 6.5_

- [x] 2. Verify backward compatibility
  - Ensure HTTP API contract is unchanged
  - Ensure response format is unchanged
  - Ensure error handling behavior is unchanged
  - Ensure logging behavior is unchanged
  - Ensure emailer service integration is unchanged
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 3. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
