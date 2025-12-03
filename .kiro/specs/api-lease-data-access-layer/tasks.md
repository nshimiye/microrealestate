# Implementation Plan

- [x] 1. Create DatabaseSession interface and LeaseRepository
  - Create DatabaseSession marker interface in common package
  - Create LeaseRepository class with CRUD methods
  - Implement create, findById, findAll, update, deleteMany methods
  - Implement findLeaseIdsUsedByTenants method
  - Implement findByIds method
  - All methods should return plain JavaScript objects using .lean() or .toObject()
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1_

- [x] 1.1 Write property test for lease creation persistence
  - **Property 1: Lease creation persistence**
  - **Validates: Requirements 1.1**

- [x] 1.2 Write property test for lease retrieval
  - **Property 2: Lease retrieval by ID**
  - **Validates: Requirements 1.2**

- [x] 1.3 Write property test for find all leases
  - **Property 3: Find all leases returns all leases in realm**
  - **Validates: Requirements 1.3, 7.5**

- [x] 1.4 Write property test for lease update persistence
  - **Property 4: Lease update persistence**
  - **Validates: Requirements 1.4**

- [x] 1.5 Write property test for lease deletion
  - **Property 5: Lease deletion removes leases**
  - **Validates: Requirements 1.5, 4.5**

- [x] 1.6 Write property test for plain object returns
  - **Property 6: Plain object returns**
  - **Validates: Requirements 1.6, 2.4**

- [x] 1.7 Write property test for lease usage detection
  - **Property 10: Lease usage detection**
  - **Validates: Requirements 3.1, 3.3**

- [x] 1.8 Write unit tests for LeaseRepository
  - Test create() with valid lease data
  - Test findById() returns correct lease
  - Test findAll() returns all leases sorted by name
  - Test update() persists changes
  - Test deleteMany() removes leases
  - Test findLeaseIdsUsedByTenants() returns correct Set
  - Test findByIds() returns multiple leases
  - Test error handling for invalid inputs
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1_

- [x] 2. Create TemplateRepository
  - Create TemplateRepository class with query and update methods
  - Implement findByLinkedResources method
  - Implement deleteMany method with transaction support
  - Implement updateMany method with transaction support
  - All methods should return plain JavaScript objects using .lean()
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2.1 Write property test for template lookup by linked resources
  - **Property 7: Template lookup by linked resources**
  - **Validates: Requirements 2.1**

- [x] 2.2 Write property test for template deletion
  - **Property 8: Template deletion removes templates**
  - **Validates: Requirements 2.2**

- [x] 2.3 Write property test for template bulk update
  - **Property 9: Template bulk update modifies templates**
  - **Validates: Requirements 2.3**

- [x] 2.4 Write unit tests for TemplateRepository
  - Test findByLinkedResources() returns correct templates
  - Test deleteMany() removes templates
  - Test updateMany() modifies templates
  - Test that plain objects are returned
  - Test error handling for invalid inputs
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Add transaction support tests
  - Test operations within session are transactional
  - Test rollback on error
  - Test commit on success
  - _Requirements: 4.2, 4.3, 9.5, 10.4_

- [x] 3.1 Write property test for transaction support
  - **Property 11: Transaction support for deletions**
  - **Validates: Requirements 4.2, 4.3**

- [x] 3.2 Write property test for transaction rollback
  - **Property 12: Transaction rollback on failure**
  - **Validates: Requirements 9.5, 10.4**

- [x] 4. Export repositories from DataAccess
  - Add getLeaseRepository() function to dataAccess/index.ts
  - Add getTemplateRepository() function to dataAccess/index.ts
  - Ensure repositories are singleton instances
  - Update common package exports
  - _Requirements: 12.1, 12.2, 12.5, 13.5_

- [x] 5. Refactor lease manager add() function
  - Import DataAccess instead of Collections
  - Replace new Collections.Lease() with leaseRepository.create()
  - Replace _leaseUsedByTenant() with leaseRepository.findLeaseIdsUsedByTenants()
  - Keep validation logic in lease manager
  - Keep active status calculation in lease manager
  - Keep usedByTenants field enrichment in lease manager
  - _Requirements: 5.1, 5.6, 5.9, 6.1, 7.1_

- [x] 6. Refactor lease manager update() function
  - Replace Collections.Lease.findOneAndUpdate() with leaseRepository.update()
  - Replace _leaseUsedByTenant() with leaseRepository.findLeaseIdsUsedByTenants()
  - Keep validation logic in lease manager
  - Keep active status recalculation in lease manager
  - Keep conditional update logic (protecting leases used by tenants) in lease manager
  - Keep usedByTenants field enrichment in lease manager
  - _Requirements: 5.4, 5.6, 5.9, 6.2, 7.2, 8.1, 8.2_

- [x] 7. Refactor lease manager remove() function
  - Replace Collections.Lease.find() with leaseRepository.findByIds()
  - Replace Collections.Lease.deleteMany() with leaseRepository.deleteMany()
  - Replace Collections.Template.find() with templateRepository.findByLinkedResources()
  - Replace Collections.Template.deleteMany() with templateRepository.deleteMany()
  - Replace Collections.Template.updateMany() with templateRepository.updateMany()
  - Replace _leaseUsedByTenant() with leaseRepository.findLeaseIdsUsedByTenants()
  - Keep validation logic in lease manager
  - Keep template cleanup logic in lease manager
  - Keep transaction orchestration in lease manager
  - Pass session to repository methods for transactional operations
  - _Requirements: 5.5, 5.7, 5.8, 5.9, 6.3, 6.4, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 8. Refactor lease manager all() function
  - Replace Collections.Lease.find() with leaseRepository.findAll()
  - Replace _leaseUsedByTenant() with leaseRepository.findLeaseIdsUsedByTenants()
  - Keep usedByTenants field enrichment in lease manager
  - _Requirements: 5.2, 5.6, 5.9, 7.4, 7.5_

- [x] 9. Refactor lease manager one() function
  - Replace Collections.Lease.findOne() with leaseRepository.findById()
  - Replace _leaseUsedByTenant() with leaseRepository.findLeaseIdsUsedByTenants()
  - Keep validation logic in lease manager
  - Keep usedByTenants field enrichment in lease manager
  - _Requirements: 5.3, 5.6, 5.9, 6.5, 7.4_

- [x] 10. Remove Collections imports from lease manager
  - Remove Collections import from leasemanager.js
  - Verify only DataAccess is imported for repository access
  - Keep Collections.startSession() usage for transaction management
  - _Requirements: 5.8, 5.9, 12.3_

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Write integration tests for lease manager
  - Test add lease flow with repositories
  - Test update lease flow with conditional logic
  - Test delete lease flow with transaction and template cleanup
  - Test query lease flows (all, one)
  - Verify behavior unchanged from original implementation
  - _Requirements: 5.5, 6.1, 6.2, 6.3, 7.1, 7.2, 8.1, 8.2, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 13. Write property tests for error handling
  - **Property 13: Repository error propagation**
  - **Property 14: Not found returns null or empty**
  - **Property 15: Invalid input validation**
  - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**
