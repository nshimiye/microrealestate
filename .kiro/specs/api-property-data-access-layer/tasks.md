# Implementation Plan

- [x] 1. Create PropertyRepository class
  - Create `services/common/src/dataAccess/PropertyRepository.ts` file
  - Implement `create(propertyData)` method that returns plain objects
  - Implement `update(propertyId, realmId, updateData)` method with realm-scoped filtering
  - Implement `delete(propertyIds, realmId)` method with realm-scoped filtering
  - Implement `findById(propertyId, realmId)` method with realm-scoped filtering
  - Implement `findAll(realmId)` method with sorting by name ascending
  - Include JSDoc comments and TypeScript type annotations for all methods
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.3, 7.4, 9.1, 9.3_

- [x] 1.1 Write unit tests for PropertyRepository
  - Test `create()` with valid property data
  - Test `update()` with existing property
  - Test `delete()` with property IDs
  - Test `findById()` returns correct property
  - Test `findAll()` returns sorted properties
  - Test error handling for invalid inputs
  - Test realm-scoped security (can't access other realm's properties)
  - _Requirements: 2.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.3, 7.4_

- [x] 1.2 Write property test for plain object returns
  - **Property 1: Plain object returns**
  - **Validates: Requirements 2.1**

- [x] 1.3 Write property test for realmId persistence
  - **Property 2: RealmId persistence**
  - **Validates: Requirements 3.1**

- [x] 1.4 Write property test for realm-scoped update security
  - **Property 3: Realm-scoped update security**
  - **Validates: Requirements 3.2**

- [x] 1.5 Write property test for realm-scoped delete security
  - **Property 4: Realm-scoped delete security**
  - **Validates: Requirements 3.3**

- [x] 1.6 Write property test for realm-scoped query security
  - **Property 5: Realm-scoped query security**
  - **Validates: Requirements 3.4**

- [x] 1.7 Write property test for findAll sorting
  - **Property 6: FindAll sorting**
  - **Validates: Requirements 3.5**

- [x] 1.8 Write property test for invalid input error handling
  - **Property 10: Invalid input error handling**
  - **Validates: Requirements 7.1**

- [x] 2. Extend TenantRepository with findByPropertyIds method
  - Add `findByPropertyIds(propertyIds, realmId)` method to `services/common/src/dataAccess/TenantRepository.ts`
  - Implement query that filters by realmId and properties.propertyId array
  - Return plain JavaScript objects using `.lean()`
  - Include JSDoc comments and TypeScript type annotations
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.2, 9.3_

- [x] 2.1 Write unit tests for TenantRepository.findByPropertyIds
  - Test method returns tenants with matching property IDs
  - Test realm filtering works correctly
  - Test returns plain objects
  - Test returns empty array when no matches
  - _Requirements: 4.2, 4.3, 4.4_

- [x] 2.2 Write property test for tenant property filtering
  - **Property 7: Tenant property filtering**
  - **Validates: Requirements 4.2**

- [x] 2.3 Write property test for tenant realm filtering
  - **Property 8: Tenant realm filtering**
  - **Validates: Requirements 4.3**

- [x] 3. Add PropertyRepository to DataAccess exports
  - Import PropertyRepository in `services/common/src/dataAccess/index.ts`
  - Create singleton instance variable
  - Implement `getPropertyRepository()` function
  - Export the function
  - _Requirements: 8.1, 8.2, 9.5_

- [x] 4. Refactor property manager to use repositories
- [x] 4.1 Update property manager imports
  - Replace `Collections` import with `DataAccess` import in `services/api/src/managers/propertymanager.js`
  - Get repository instances using `DataAccess.getPropertyRepository()` and `DataAccess.getTenantRepository()`
  - _Requirements: 5.7, 5.8_

- [x] 4.2 Refactor add() function
  - Replace `new Collections.Property()` and `property.save()` with `propertyRepository.create()`
  - Maintain existing data transformation with `_toPropertiesData()`
  - _Requirements: 5.1, 6.1, 10.1_

- [x] 4.3 Refactor update() function
  - Replace `Collections.Property.findOneAndUpdate()` with `propertyRepository.update()`
  - Maintain existing data transformation with `_toPropertiesData()`
  - _Requirements: 5.2, 6.1, 10.2_

- [x] 4.4 Refactor remove() function
  - Replace `Collections.Property.deleteMany()` with `propertyRepository.delete()`
  - Maintain existing response status code (200)
  - _Requirements: 5.3, 10.3_

- [x] 4.5 Refactor all() function
  - Replace `Collections.Property.find()` with `propertyRepository.findAll()`
  - Maintain existing data transformation with `_toPropertiesData()`
  - _Requirements: 5.5, 6.1, 10.4_

- [x] 4.6 Refactor one() function
  - Replace `Collections.Property.findOne()` with `propertyRepository.findById()`
  - Maintain existing data transformation with `_toPropertiesData()`
  - _Requirements: 5.4, 6.1, 10.5_

- [x] 4.7 Refactor _toPropertiesData() helper function
  - Replace `Collections.Tenant.find()` with `tenantRepository.findByPropertyIds()`
  - Maintain existing tenant sorting logic (by termination date or end date descending)
  - Maintain existing data transformation with `FD.toProperty()`
  - _Requirements: 5.6, 6.2, 6.3, 6.4_

- [x] 4.8 Write property test for tenant sorting
  - **Property 9: Tenant sorting by date**
  - **Validates: Requirements 6.4**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Write integration tests for property manager
  - Test `add()` endpoint creates property and returns transformed data
  - Test `update()` endpoint updates property and returns transformed data
  - Test `remove()` endpoint deletes properties
  - Test `all()` endpoint returns all properties with tenant data
  - Test `one()` endpoint returns single property with tenant data
  - Verify API responses match format before refactoring
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
