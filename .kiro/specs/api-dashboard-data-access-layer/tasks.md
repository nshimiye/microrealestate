# Implementation Plan

- [x] 1. Extend PropertyRepository with countByRealmId method
  - [x] 1.1 Add countByRealmId method to PropertyRepository
    - Implement `countByRealmId(realmId: string)` method
    - Add input validation for realmId
    - Use `.countDocuments()` for efficient counting
    - Add JSDoc comments and TypeScript type annotations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1_

  - [x] 1.2 Write property test for countByRealmId
    - **Property 2: PropertyRepository.countByRealmId returns correct count**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 1.3 Write unit tests for countByRealmId
    - Test countByRealmId with realm containing multiple properties
    - Test countByRealmId returns 0 for empty realm
    - Test countByRealmId throws error for invalid realmId
    - Test that count matches actual number of properties
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 14.2_

- [x] 2. Checkpoint - Ensure repository tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Refactor dashboard manager to use repositories
  - [x] 3.1 Update dashboard manager imports
    - Import DataAccess from @microrealestate/common
    - Remove Collections from import statement
    - _Requirements: 4.3, 4.4, 5.1, 5.5_

  - [x] 3.2 Replace tenant query with repository call
    - Get tenantRepository instance from DataAccess
    - Replace `Collections.Tenant.find({ realmId })` with `tenantRepository.findAll(realmId)`
    - Use `req.headers.organizationid` as realmId parameter
    - _Requirements: 1.1, 1.2, 5.1, 5.2_

  - [x] 3.3 Replace property count with repository call
    - Get propertyRepository instance from DataAccess
    - Replace `Collections.Property.find({ realmId }).count()` with `propertyRepository.countByRealmId(realmId)`
    - Use `req.headers.organizationid` as realmId parameter
    - _Requirements: 2.1, 2.2, 5.1, 5.2_

  - [x] 3.4 Remove .toObject() call on plain tenant objects
    - Find the line `tenant: tenant.toObject()` in topUnpaid calculation
    - Replace with `tenant: tenant` since tenants are already plain objects
    - _Requirements: 1.2, 5.3_

  - [x] 3.5 Verify all business logic remains unchanged
    - Verify active tenant filtering logic is unchanged
    - Verify occupancy rate calculation is unchanged
    - Verify year revenue calculation is unchanged
    - Verify top unpaid calculation is unchanged
    - Verify monthly revenues calculation is unchanged
    - _Requirements: 5.5, 6.1, 7.1, 8.1, 9.1, 10.1_

- [x] 4. Add unit tests for dashboard manager business logic
  - [x] 4.1 Set up test file and mocks
    - Create test file at `services/api/src/__tests__/managers/dashboardmanager.test.js`
    - Mock TenantRepository.findAll()
    - Mock PropertyRepository.countByRealmId()
    - Mock req and res objects
    - _Requirements: 15.1_

  - [x] 4.2 Write tests for active tenant filtering
    - Test filtering tenants with terminationDate >= current date
    - Test filtering tenants with endDate >= current date when no terminationDate
    - Test filtering excludes tenants with past dates
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 15.2_

  - [x] 4.3 Write tests for occupancy rate calculation
    - Test occupancy rate with multiple active tenants
    - Test occupancy rate with no properties (returns undefined)
    - Test occupancy rate with no active tenants (returns 0)
    - Test unique property counting using Set
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 15.3_

  - [x] 4.4 Write tests for year revenue calculation
    - Test summing payments within current year
    - Test excluding payments outside year boundaries
    - Test skipping payments with no date
    - Test skipping payments with zero amount
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 15.4_

  - [x] 4.5 Write tests for top unpaid calculation
    - Test finding current month rent for active tenants
    - Test calculating balance (payment - grandTotal)
    - Test sorting by balance ascending
    - Test filtering to negative balances only
    - Test limiting to top 5 results
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 15.5_

  - [x] 4.6 Write tests for monthly revenues calculation
    - Test creating entries for all 12 months
    - Test summing paid and notPaid per month
    - Test filtering rents by current year
    - Test rounding to 2 decimal places
    - Test sorting by month chronologically
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 4.7 Write tests for response structure
    - Test overview object structure with data
    - Test overview is null when no tenants/properties
    - Test topUnpaid array structure
    - Test topUnpaid is empty array when no tenants/properties
    - Test revenues array structure
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 5. Add property-based tests for dashboard calculations
  - [x] 5.1 Write property test for active tenant filtering
    - **Property 3: Active tenant filtering preserves logic**
    - **Validates: Requirements 6.1, 6.2**

  - [x] 5.2 Write property test for occupancy rate bounds
    - **Property 4: Occupancy rate calculation preserves logic**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 5.3 Write property test for revenue calculation
    - **Property 5: Year revenue calculation preserves logic**
    - **Validates: Requirements 8.1, 8.2**

  - [x] 5.4 Write property test for top unpaid sorting
    - **Property 6: Top unpaid calculation preserves logic**
    - **Validates: Requirements 9.1, 9.2**

  - [x] 5.5 Write property test for monthly revenues
    - **Property 7: Monthly revenues calculation preserves logic**
    - **Validates: Requirements 10.1, 10.2**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Final verification
  - [ ] 7.1 Build common package
    - Run `yarn workspace @microrealestate/common build`
    - Verify TypeScript compilation succeeds
    - Verify both Collections and DataAccess are exported
    - _Requirements: 12.5_

  - [ ] 7.2 Verify API service
    - Verify service runs without errors (JavaScript, no build step)
    - _Requirements: 12.4_

  - [ ] 7.3 Run test suites
    - Run `yarn workspace @microrealestate/common test`
    - Verify all repository tests pass
    - Run `yarn workspace @microrealestate/api test`
    - Verify all dashboard manager tests pass
    - _Requirements: 12.5, 14.3, 14.4, 14.5_

  - [ ] 7.4 Manual testing of dashboard endpoint
    - Start the application in dev mode
    - Test dashboard endpoint returns correct data
    - Verify overview metrics are accurate
    - Verify topUnpaid list is correct
    - Verify revenues array is correct
    - Test with empty database returns null overview and empty arrays
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
