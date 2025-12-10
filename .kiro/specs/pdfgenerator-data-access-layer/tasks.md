# Implementation Plan

- [x] 1. Extend DocumentRepository in common package
  - Add findAll method to retrieve all documents for a realm
  - Add findById method to retrieve a single document by ID and realm
  - Add create method to create a new document
  - Add update method to update an existing document
  - Add deleteMany method to delete multiple documents
  - Ensure all methods return plain JavaScript objects (use .lean())
  - _Requirements: 1.1, 3.1, 3.5_

- [x] 2. Extend TemplateRepository in common package
  - Add findAll method to retrieve all templates for a realm
  - Add findById method to retrieve a single template by ID and realm
  - Add create method to create a new template
  - Add replace method to replace an existing template (findOneAndReplace)
  - Ensure all methods return plain JavaScript objects (use .lean())
  - _Requirements: 1.2, 3.2, 3.5_

- [x] 3. Extend TenantRepository in common package
  - Add findByIdWithProperties method to retrieve tenant with populated properties
  - Ensure method returns plain JavaScript object with populated propertyId references
  - _Requirements: 1.3, 3.3, 3.5_

- [x] 4. Build common package
  - Run `yarn workspace @microrealestate/common build` to compile TypeScript
  - Verify no compilation errors
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 5. Create helper functions in pdfgenerator documents route
  - Create `_getTemplate(organization, templateId)` helper that uses TemplateRepository
  - Create `_getTemplateValues(organization, tenantId, leaseId)` helper that uses TenantRepository and LeaseRepository
  - Ensure helpers use DataAccess.getXRepository() to obtain repository instances
  - Preserve existing business logic for computing template values
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.5_

- [x] 6. Refactor documents route GET / endpoint
  - Replace `Collections.Document.find()` with `documentRepository.findAll()`
  - Update imports: remove Collections, add DataAccess
  - Test endpoint returns same response structure
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 4.1, 5.1, 5.2, 5.4_

- [x] 7. Refactor documents route GET /:id endpoint
  - Replace `Collections.Document.findOne()` with `documentRepository.findById()`
  - Preserve file download logic for file-type documents
  - Test endpoint returns same response structure
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 4.1, 5.1, 5.2, 5.4_

- [x] 8. Refactor documents route POST / endpoint (create document)
  - Replace `Collections.Template.findOne()` with `templateRepository.findById()` via `_getTemplate()` helper
  - Replace `Collections.Tenant.findOne().populate()` with `tenantRepository.findByIdWithProperties()` via `_getTemplateValues()` helper
  - Replace `Collections.Lease.findOne()` with `leaseRepository.findById()` via `_getTemplateValues()` helper
  - Replace `Collections.Document.create()` with `documentRepository.create()`
  - Test endpoint returns same response structure
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 4.1, 5.1, 5.2, 5.4_

- [x] 9. Refactor documents route PATCH / endpoint (update document)
  - Replace `Collections.Document.findOneAndUpdate()` with `documentRepository.update()`
  - Test endpoint returns same response structure
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 4.1, 5.1, 5.2, 5.4_

- [x] 10. Refactor documents route DELETE /:ids endpoint
  - Replace `Collections.Document.find()` with `documentRepository.findByIds()` (may need to add this method)
  - Replace `Collections.Document.deleteMany()` with `documentRepository.deleteMany()`
  - Preserve file system and S3 cleanup logic
  - Test endpoint returns same response structure
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 4.1, 5.1, 5.2, 5.4_

- [x] 11. Refactor templates route GET / endpoint
  - Replace `Collections.Template.find()` with `templateRepository.findAll()`
  - Update imports: remove Collections, add DataAccess
  - Test endpoint returns same response structure
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 4.2, 5.1, 5.2, 5.4_

- [x] 12. Refactor templates route GET /:id endpoint
  - Replace `Collections.Template.findOne()` with `templateRepository.findById()`
  - Test endpoint returns same response structure
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 4.2, 5.1, 5.2, 5.4_

- [x] 13. Refactor templates route POST / endpoint (create template)
  - Replace `Collections.Template.create()` with `templateRepository.create()`
  - Test endpoint returns same response structure
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 4.2, 5.1, 5.2, 5.4_

- [x] 14. Refactor templates route PATCH / endpoint (update template)
  - Replace `Collections.Template.findOneAndReplace()` with `templateRepository.replace()`
  - Test endpoint returns same response structure
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 4.2, 5.1, 5.2, 5.4_

- [x] 15. Refactor templates route DELETE /:ids endpoint
  - Replace `Collections.Template.deleteMany()` with `templateRepository.deleteMany()`
  - Test endpoint returns same response structure
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 4.2, 5.1, 5.2, 5.4_

- [x] 16. Verify no Collections imports remain
  - Search for `Collections` imports in pdfgenerator service files
  - Ensure all route files import DataAccess instead
  - Verify service still initializes with `useMongo: true`
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 17. Test backward compatibility
  - Test all document endpoints return same responses as before refactoring
  - Test all template endpoints return same responses as before refactoring
  - Test PDF generation still works correctly
  - Test file upload functionality still works correctly
  - Test error responses have same status codes and messages
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 18. Final verification and cleanup
  - Run pdfgenerator service in development mode
  - Verify all endpoints work correctly
  - Check for any console errors or warnings
  - Update any inline comments to reflect new architecture
  - _Requirements: All_
