# Design Document

## Overview

This design addresses a critical bug in the DynamoDB data access layer where entity IDs are stored as `undefined` in DynamoDB records. The root cause is that the `toItem` method extracts the `_id` field from entities before the ID has been properly initialized. While MongoDB's Mongoose automatically generates IDs during the `create()` call, the DynamoDB implementation must explicitly ensure IDs are generated before transformation.

The fix involves adding ID validation and generation at the appropriate point in the entity creation flow, ensuring that `toItem` always receives entities with defined `_id` values.

## Architecture

### Current Flow (Buggy)

```
1. Service calls repository.create(partialEntityData)
2. Repository.create() builds full entity object
   - Sets _id: entityData._id || uuidv4()  ← ID generated here
3. Repository calls super.create(entity)
4. BaseRepository.create() calls this.toItem(entity)
5. toItem() extracts: const entityId = entity._id
   - If entity._id is undefined, entityId becomes undefined
6. toItem() stores: DocumentId: entityId  ← undefined stored!
7. DynamoDB receives item with undefined DocumentId
```

### Root Cause Analysis

The issue occurs in the concrete repository's `create` method (e.g., `DocumentRepository.create`). While it attempts to generate a UUID:

```typescript
const document: CollectionTypes.Document = {
  _id: documentData._id || uuidv4(),  // Should generate ID
  // ... other fields
};
return super.create(document);
```

The problem is that if `documentData._id` is explicitly `undefined` (not just missing), the `||` operator may not work as expected in all cases. Additionally, there's no validation to ensure the ID was actually set before calling `super.create()`.

### Proposed Flow (Fixed)

```
1. Service calls repository.create(partialEntityData)
2. Repository.create() validates and generates ID
   - Generate UUID if _id is undefined/null/empty
   - Validate that _id is now defined
3. Repository builds full entity object with guaranteed _id
4. Repository calls super.create(entity)
5. BaseRepository.create() validates entity has _id
6. BaseRepository.create() calls this.toItem(entity)
7. toItem() extracts defined entityId
8. toItem() stores defined DocumentId
9. DynamoDB receives valid item
```

## Components and Interfaces

### 1. Base Repository Enhancement

**File**: `services/common/src/data-access-layer/dynamo/base-others-crud.ts`

Add ID validation in the `create` method before calling `toItem`:

```typescript
async create(entity: T): Promise<T> {
  try {
    // Validate that entity has a defined _id
    if (!(entity as any)._id) {
      throw new ServiceError(
        'Entity must have a defined _id before creation',
        400
      );
    }
    
    const item = this.toItem(entity);
    this.validateItemSize(item);
    await this.client.putItem(item);
    
    logger.debug('Entity created successfully', {
      PK: item.PK,
      SK: item.SK,
      entityId: (entity as any)._id
    });
    
    return entity;
  } catch (error) {
    logger.error('Failed to create entity', { error });
    throw error;
  }
}
```

### 2. Concrete Repository Enhancement

**Files**: All concrete repository `create` methods (Document, Tenant, Property, Lease, Template)

Ensure ID generation is explicit and validated:

```typescript
async create(
  documentData: Partial<CollectionTypes.Document>
): Promise<CollectionTypes.Document> {
  // ... existing validation ...
  
  // Explicitly generate ID if not provided
  const documentId = documentData._id || uuidv4();
  
  // Validate ID was generated
  if (!documentId) {
    throw new Error('Failed to generate document ID');
  }
  
  const document: CollectionTypes.Document = {
    _id: documentId,  // Use the validated ID
    realmId: documentData.realmId,
    // ... other fields
  };
  
  return super.create(document);
}
```

### 3. toItem Method Enhancement

**Files**: All base repository `toItem` methods

Add defensive validation:

```typescript
protected toItem(entity: CollectionTypes.Document): Record<string, any> {
  const documentId = entity._id;
  
  // Defensive check - should never happen with proper create() validation
  if (!documentId) {
    throw new Error(
      'Document entity must have a defined _id. This indicates a bug in the create flow.'
    );
  }
  
  const realmId = entity.realmId;
  // ... rest of method
}
```

### 4. buildPK and buildSK Enhancement

**Files**: All base repository key building methods

Add parameter validation:

```typescript
protected buildPK(documentId: string, realmId: string): string {
  if (!realmId) {
    throw new Error('realmId is required for Document entities');
  }
  if (!documentId) {
    throw new Error('documentId is required for building partition key');
  }
  return `REALM#${realmId}`;
}

protected buildSK(documentId: string): string {
  if (!documentId) {
    throw new Error('documentId is required for building sort key');
  }
  return `DOCUMENT#${documentId}`;
}
```

## Data Models

No changes to data models are required. The fix ensures that existing data models are properly populated with IDs before storage.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: ID Generation for Missing IDs

*For any* entity data without an `_id` field, creating the entity should result in an entity with a valid UUID `_id` that is not undefined, null, or empty string.

**Validates: Requirements 1.1, 2.3**

### Property 2: toItem Receives Defined IDs

*For any* entity with a defined `_id`, calling `toItem` should extract a defined (non-undefined) ID value and include it in the returned DynamoDB item.

**Validates: Requirements 1.2, 1.3**

### Property 3: Round-trip ID Preservation

*For any* entity, the operation `fromItem(toItem(entity))` should preserve the `_id` field exactly.

**Validates: Requirements 1.4**

### Property 4: MongoDB-DynamoDB ID Consistency

*For any* entity data, creating the entity with both MongoDB and DynamoDB repositories should result in entities with defined `_id` values (though the actual UUID values will differ).

**Validates: Requirements 1.5**

### Property 5: ID Validation Before toItem

*For any* entity with undefined or null `_id`, attempting to call `toItem` should either auto-generate an ID or throw a descriptive error.

**Validates: Requirements 2.4**

## Error Handling

### Error Types

1. **Missing ID Error**: Thrown when `create()` is called with entity data that results in undefined `_id`
   - HTTP Status: 400 Bad Request
   - Message: "Entity must have a defined _id before creation"

2. **toItem Validation Error**: Thrown when `toItem()` receives entity with undefined `_id`
   - Message: "Document entity must have a defined _id. This indicates a bug in the create flow."

3. **buildPK/buildSK Validation Error**: Thrown when key building methods receive undefined parameters
   - Message: "documentId is required for building partition key/sort key"

### Error Message Format

All ID-related errors should include:
- Entity type (Document, Tenant, etc.)
- The problematic ID value (or "undefined")
- Context about where the error occurred (create, toItem, buildPK, etc.)

Example:
```
Error: Document entity must have a defined _id. This indicates a bug in the create flow.
Context: { entityType: 'Document', _id: undefined, operation: 'toItem' }
```

## Testing Strategy

### Unit Tests

Unit tests will verify specific scenarios:

1. **Creating entity without _id**: Verify UUID is generated
2. **Creating entity with explicit _id**: Verify provided ID is preserved
3. **toItem with undefined _id**: Verify error is thrown
4. **buildPK/buildSK with undefined ID**: Verify error is thrown
5. **Error message format**: Verify errors include entity type and ID value

### Property-Based Tests

Property-based tests will verify universal properties using fast-check:

1. **Property 1 Test**: Generate random entity data without _id, create entity, verify _id is valid UUID
2. **Property 2 Test**: Generate random entities with valid _ids, call toItem, verify DocumentId is defined
3. **Property 3 Test**: Generate random entities, verify fromItem(toItem(entity))._id === entity._id
4. **Property 4 Test**: Generate random entity data, create with both repos, verify both have defined _ids
5. **Property 5 Test**: Generate entities with undefined/null _id, verify toItem behavior

### Test Configuration

- Use Vitest as the testing framework (already configured in services/common)
- Use fast-check for property-based testing (already a dependency)
- Configure property tests to run minimum 100 iterations
- Tag each property test with: `**Feature: dynamodb-undefined-id-fix, Property N: [property text]**`

### Integration Tests

Integration tests will verify the complete flow:

1. Create entity via repository → Store in DynamoDB → Retrieve → Verify _id matches
2. Test with actual DynamoDB Local instance
3. Verify MongoDB and DynamoDB produce equivalent results

## Implementation Notes

### UUID Generation Consistency

Currently, the codebase uses both `uuid.v4()` (from uuid package) and `crypto.randomUUID()` (Node.js built-in). For consistency, we should standardize on one approach:

**Recommendation**: Use `crypto.randomUUID()` (Node.js built-in)
- No external dependency required
- Available in Node.js 14.17.0+ (project uses Node 20.x)
- Slightly better performance
- One less package to maintain

### Affected Repositories

The following repositories need to be updated:

1. `services/common/src/data-access-layer/document/dynamodb/repository.ts`
2. `services/common/src/data-access-layer/tenant/dynamodb/repository.ts`
3. `services/common/src/data-access-layer/property/dynamodb/repository.ts`
4. `services/common/src/data-access-layer/lease/dynamodb/repository.ts`
5. `services/common/src/data-access-layer/template/dynamodb/repository.ts`
6. `services/common/src/data-access-layer/realm/dynamodb/repository.ts`
7. `services/common/src/data-access-layer/account/dynamodb/repository.ts`

### Backward Compatibility

This fix is backward compatible:
- Existing entities with valid IDs will continue to work
- Only affects new entity creation
- No database migration required
- Existing tests should continue to pass (and catch the bug if present)

### Logging Enhancements

Add entity ID to all log messages:
- `logger.debug('Entity created successfully', { PK, SK, entityId })`
- `logger.error('Failed to create entity', { entityId, error })`
- `logger.debug('Entity updated successfully', { PK, SK, entityId })`

This enables tracing IDs through the entire operation flow.
