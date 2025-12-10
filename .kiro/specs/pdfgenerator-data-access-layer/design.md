# Design Document

## Overview

This design outlines the refactoring of the pdfgenerator service to implement a data access layer using the repository pattern. The refactoring will separate MongoDB/Mongoose-specific logic from business logic by introducing repository classes that abstract database operations. This follows the architectural pattern already established in the authenticator service and promotes better separation of concerns, testability, and maintainability.

The refactoring will be performed incrementally, ensuring backward compatibility at each step. All existing functionality will be preserved while improving the internal code structure.

## Architecture

### Current Architecture

```
┌─────────────────────────────────────┐
│   PDFGenerator Service Routes       │
│  (documents.js, templates.js)       │
│                                      │
│  Direct Mongoose Operations:        │
│  - Collections.Document.find()      │
│  - Collections.Template.create()    │
│  - Collections.Tenant.findOne()     │
│  - .lean(), .populate()             │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│      MongoDB (via Mongoose)          │
└─────────────────────────────────────┘
```

### Target Architecture

```
┌─────────────────────────────────────┐
│   PDFGenerator Service Routes       │
│  (documents.js, templates.js)       │
│                                      │
│  Repository Usage:                   │
│  - DataAccess.getDocumentRepository()│
│  - documentRepo.findAll()            │
│  - templateRepo.create()             │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│    Data Access Layer (Common Pkg)   │
│                                      │
│  - DocumentRepository                │
│  - TemplateRepository                │
│  - TenantRepository                  │
│  - LeaseRepository                   │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│      MongoDB (via Mongoose)          │
└─────────────────────────────────────┘
```

## Components and Interfaces

### 1. Repository Extensions (Common Package)

The following repository methods need to be added to the common package to support pdfgenerator operations:

#### DocumentRepository

**New Methods:**
```typescript
// Find all documents in a realm
async findAll(realmId: string): Promise<CollectionTypes.Document[]>

// Find a single document by ID and realm
async findById(documentId: string, realmId: string): Promise<CollectionTypes.Document | null>

// Create a new document
async create(documentData: Partial<CollectionTypes.Document>): Promise<CollectionTypes.Document>

// Update a document
async update(documentId: string, realmId: string, updateData: Partial<CollectionTypes.Document>): Promise<CollectionTypes.Document | null>

// Delete multiple documents
async deleteMany(documentIds: string[], realmId: string): Promise<number>
```

#### TemplateRepository

**New Methods:**
```typescript
// Find all templates in a realm
async findAll(realmId: string): Promise<CollectionTypes.Template[]>

// Find a single template by ID and realm
async findById(templateId: string, realmId: string): Promise<CollectionTypes.Template | null>

// Create a new template
async create(templateData: Partial<CollectionTypes.Template>): Promise<CollectionTypes.Template>

// Replace a template (findOneAndReplace)
async replace(templateId: string, realmId: string, templateData: Partial<CollectionTypes.Template>): Promise<CollectionTypes.Template | null>
```

**Existing Methods (already available):**
- `findByLinkedResources(resourceIds: string[], realmId: string)`
- `deleteMany(templateIds: string[], realmId: string, session?)`
- `updateMany(filter, update, session?)`

#### TenantRepository

**New Methods:**
```typescript
// Find tenant by ID and realm with populated properties
async findByIdWithProperties(tenantId: string, realmId: string): Promise<CollectionTypes.Tenant | null>
```

**Existing Methods (already available):**
- `findById(id: string)`
- `findOne(filter: { tenantId: string; realmId: string })`
- Many other methods for tenant operations

#### LeaseRepository

**Existing Methods (already available):**
- `findById(leaseId: string, realmId: string)`
- All necessary lease operations are already implemented

### 2. Helper Functions (PDFGenerator Service)

Helper functions will encapsulate complex data operations that involve multiple repositories:

```javascript
// In documents.js

/**
 * Fetch template by ID and realm
 * @private
 */
async function _getTemplate(organization, templateId) {
  const templateRepository = DataAccess.getTemplateRepository();
  return await templateRepository.findById(templateId, organization._id);
}

/**
 * Fetch and compute template values from tenant, lease, and properties
 * @private
 */
async function _getTemplateValues(organization, tenantId, leaseId) {
  const tenantRepository = DataAccess.getTenantRepository();
  const leaseRepository = DataAccess.getLeaseRepository();
  
  // Fetch tenant with populated properties
  const tenant = await tenantRepository.findByIdWithProperties(tenantId, organization._id);
  
  // Fetch lease
  const lease = await leaseRepository.findById(leaseId, organization._id);
  
  // Compute and format template values
  // ... (existing logic remains the same)
  
  return templateValues;
}
```

### 3. Route Handler Refactoring

Each route handler will be refactored to use repositories instead of direct Mongoose calls:

**Before:**
```javascript
const documentsFound = await Collections.Document.find({
  realmId: organizationId
});
```

**After:**
```javascript
const documentRepository = DataAccess.getDocumentRepository();
const documentsFound = await documentRepository.findAll(organizationId);
```

## Data Models

No changes to data models are required. The refactoring only affects how data is accessed, not the structure of the data itself.

### Document Model
- Remains unchanged
- Accessed via DocumentRepository

### Template Model
- Remains unchanged
- Accessed via TemplateRepository

### Tenant Model
- Remains unchanged
- Accessed via TenantRepository

### Lease Model
- Remains unchanged
- Accessed via LeaseRepository

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, most acceptance criteria are structural requirements (code organization) rather than functional requirements. However, we can define a few key properties for the testable criteria:

### Property 1: Repository methods return plain JavaScript objects

*For any* repository method that returns data, the returned objects should be plain JavaScript objects without Mongoose-specific properties (like `$__`, `$isNew`, `_doc`) or methods (like `save()`, `toObject()`).

**Validates: Requirements 3.5**

**Rationale:** This ensures that the data access layer properly abstracts Mongoose implementation details and returns clean data objects suitable for business logic processing.

### Property 2: Backward compatibility for document operations

*For any* valid document operation (create, read, update, delete), the refactored service should return responses with the same structure and content as the original implementation when given identical inputs.

**Validates: Requirements 4.1**

**Rationale:** This ensures that clients of the pdfgenerator service are not affected by the internal refactoring.

### Property 3: Backward compatibility for template operations

*For any* valid template operation (create, read, update, delete), the refactored service should return responses with the same structure and content as the original implementation when given identical inputs.

**Validates: Requirements 4.2**

**Rationale:** This ensures that clients of the pdfgenerator service are not affected by the internal refactoring.

### Property 4: Error handling consistency

*For any* error condition (invalid input, missing resource, permission denied), the refactored service should throw ServiceError instances with the same error messages and status codes as the original implementation.

**Validates: Requirements 4.5**

**Rationale:** This ensures that error handling behavior remains consistent and clients can rely on the same error responses.

## Error Handling

Error handling will remain unchanged from the current implementation:

1. **ServiceError Usage**: All route handlers will continue to throw `ServiceError` instances with appropriate status codes
2. **Error Messages**: Error messages will remain identical to preserve backward compatibility
3. **Repository Errors**: Repository methods will throw standard JavaScript errors that will be caught and wrapped in ServiceError by route handlers

**Error Flow:**
```
Repository Method Error
    ↓
Caught by Route Handler
    ↓
Wrapped in ServiceError
    ↓
Returned to Client
```

## Testing Strategy

### Unit Testing

Unit tests will focus on verifying that:

1. **Repository Methods Work Correctly**: Test each new repository method with example inputs
   - DocumentRepository.findAll() returns all documents for a realm
   - TemplateRepository.create() creates a template and returns it
   - TenantRepository.findByIdWithProperties() populates properties correctly

2. **Helper Functions Use Repositories**: Test that helper functions delegate to repositories
   - `_getTemplate()` uses TemplateRepository
   - `_getTemplateValues()` uses TenantRepository and LeaseRepository

3. **Route Handlers Use DataAccess**: Test that route handlers obtain repositories via DataAccess
   - Verify DataAccess.getDocumentRepository() is called
   - Verify no direct Collections imports exist

### Integration Testing

Integration tests will verify end-to-end functionality:

1. **Document CRUD Operations**: Test full document lifecycle through HTTP endpoints
2. **Template CRUD Operations**: Test full template lifecycle through HTTP endpoints
3. **PDF Generation**: Test that PDF generation still works with refactored data access
4. **File Upload**: Test that file upload functionality remains intact

### Property-Based Testing

Property-based tests will verify the correctness properties defined above:

1. **Plain Object Property**: Generate random repository calls and verify returned objects are plain
2. **Backward Compatibility**: Compare responses before and after refactoring with various inputs
3. **Error Consistency**: Trigger error conditions and verify error types and codes match

**Testing Framework**: Vitest with fast-check for property-based testing

**Test Configuration**: Minimum 100 iterations per property test to ensure thorough coverage

## Implementation Plan

### Phase 1: Extend Repository Classes (Common Package)

1. Add new methods to DocumentRepository
2. Add new methods to TemplateRepository
3. Add new methods to TenantRepository
4. Build common package to make new methods available

### Phase 2: Create Helper Functions (PDFGenerator Service)

1. Create `_getTemplate()` helper function
2. Create `_getTemplateValues()` helper function
3. Ensure helpers use repositories exclusively

### Phase 3: Refactor Documents Route

1. Replace Collections.Document calls with DocumentRepository
2. Replace Collections.Template calls with TemplateRepository (for document creation)
3. Replace Collections.Tenant calls with TenantRepository
4. Replace Collections.Lease calls with LeaseRepository
5. Update imports (remove Collections, add DataAccess)
6. Test all document endpoints

### Phase 4: Refactor Templates Route

1. Replace Collections.Template calls with TemplateRepository
2. Update imports (remove Collections, add DataAccess)
3. Test all template endpoints

### Phase 5: Verification and Cleanup

1. Verify no Collections imports remain in pdfgenerator routes
2. Run full test suite
3. Verify backward compatibility
4. Update documentation

## Migration Strategy

The refactoring will be performed incrementally with the following safeguards:

1. **No Breaking Changes**: All existing functionality must continue to work
2. **Incremental Testing**: Test after each route file is refactored
3. **Rollback Plan**: Keep git history clean with atomic commits for easy rollback
4. **Documentation**: Update inline comments to reflect new architecture

## Performance Considerations

The refactoring should have minimal performance impact:

1. **Repository Overhead**: Negligible - repositories are thin wrappers around Mongoose
2. **Object Conversion**: `.lean()` is already used in repositories, so no additional overhead
3. **Caching**: Repository instances are singletons, so no repeated instantiation

## Security Considerations

Security will be maintained through:

1. **Realm Filtering**: All repository methods enforce realm-based filtering
2. **Input Validation**: Validation logic remains in route handlers
3. **Authorization**: Middleware-based authorization remains unchanged

## Dependencies

- **@microrealestate/common**: Must be built before pdfgenerator service
- **Mongoose**: Remains as underlying database driver
- **No New Dependencies**: Refactoring uses existing packages

## Rollout Plan

1. **Development**: Implement and test in development environment
2. **Staging**: Deploy to staging for integration testing
3. **Production**: Deploy to production with monitoring
4. **Monitoring**: Watch for errors or performance degradation
5. **Rollback**: Revert if issues are detected

## Future Enhancements

After this refactoring is complete, future improvements could include:

1. **Unit Tests for Repositories**: Add comprehensive unit tests for all repository methods
2. **Transaction Support**: Add transaction support for multi-document operations
3. **Caching Layer**: Add caching at the repository level for frequently accessed data
4. **Query Optimization**: Optimize repository queries based on usage patterns
