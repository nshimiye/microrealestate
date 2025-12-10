# DynamoDB Constraints and Handling

This document describes how the MicroRealEstate data access layer handles DynamoDB-specific constraints.

## Empty String Handling

### DynamoDB Restriction

DynamoDB does not support empty strings (`""`) as attribute values. Attempting to store an empty string will result in a `ValidationException` with the message:

```
One or more parameter values were invalid: An AttributeValue may not contain an empty string
```

### Current Implementation Status

**Status**: Deferred - Not Currently Implemented

The empty string handling is intentionally deferred because it requires system-wide changes to data transformation logic across all repositories.

### Current Configuration

The DynamoDB Document Client is configured with:

```typescript
marshallOptions: {
  removeUndefinedValues: true,
  convertEmptyValues: false  // Empty strings are NOT automatically converted
}
```

This means:
- `undefined` values are automatically removed from items before writing
- Empty strings (`""`) are **not** automatically converted and will cause errors if present

### Why This Is Deferred

1. **System-Wide Impact**: Empty string handling would need to be implemented in every repository's `toItem()` method
2. **Data Consistency**: Converting empty strings to `null` or omitting them changes the data model and could affect application logic
3. **MongoDB Compatibility**: MongoDB allows empty strings, so converting them in DynamoDB could break interface compatibility
4. **Current Workaround**: The application currently validates inputs and avoids storing empty strings

### Future Implementation Approach

When implementing empty string handling, consider these approaches:

#### Option 1: Convert Empty Strings to Null

```typescript
function sanitizeEmptyStrings(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj === '' ? null : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeEmptyStrings);
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitized = sanitizeEmptyStrings(value);
    if (sanitized !== '') {
      result[key] = sanitized;
    }
  }
  return result;
}
```

#### Option 2: Omit Empty String Attributes

```typescript
function removeEmptyStrings(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeEmptyStrings).filter(item => item !== '');
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === '') {
      continue; // Skip empty strings
    }
    result[key] = removeEmptyStrings(value);
  }
  return result;
}
```

#### Option 3: Use AWS SDK's convertEmptyValues

Enable automatic conversion in the DynamoDB client:

```typescript
marshallOptions: {
  removeUndefinedValues: true,
  convertEmptyValues: true  // Automatically convert empty strings to DynamoDB NULL
}
```

**Note**: This converts empty strings to DynamoDB's `NULL` type, which unmarshalls back to `null` in JavaScript, potentially breaking compatibility with MongoDB behavior.

### Recommended Approach

When implementing this feature:

1. **Add utility function** to `services/common/src/utils/dynamodb-helpers.ts`
2. **Apply in base repositories** - Call the utility in `BaseRepository.toItem()` before writing
3. **Update fromItem methods** - Ensure `null` values are handled consistently
4. **Test thoroughly** - Verify MongoDB/DynamoDB parity is maintained
5. **Document behavior** - Update API documentation to clarify empty string handling

### Related Constraints

See also:
- **Item Size Validation** - Implemented in `DynamoDBClient.putItem()` and base repositories
- **Reserved Word Handling** - Handled via expression attribute names where needed
- **Nested Object Preservation** - Implemented in all repository `toItem()`/`fromItem()` methods

## Other DynamoDB Constraints

### Item Size Limit (400KB)

**Status**: ✅ Implemented

Items exceeding 400KB are rejected before attempting to write to DynamoDB.

Implementation: `DynamoDBClient.putItem()` and `BaseRepository` classes validate item size.

### Reserved Words

**Status**: ⚠️ Partially Implemented

DynamoDB has ~500 reserved words that cannot be used as attribute names without expression attribute names.

Current approach: Expression attribute names are used in update operations and queries where needed.

### Nested Attribute Depth

**Status**: ✅ No Action Needed

DynamoDB supports up to 32 levels of nesting, which is sufficient for our data models.

### Attribute Name Length

**Status**: ✅ No Action Needed

Attribute names must be ≤ 255 characters. Our data models comply with this limit.

### Number Precision

**Status**: ✅ Handled by AWS SDK

The AWS SDK automatically handles JavaScript number precision issues when marshalling/unmarshalling.

Configuration: `wrapNumbers: false` - Numbers are returned as JavaScript numbers, not wrapped objects.

## Testing Empty String Handling

When empty string handling is implemented, add these test cases:

```typescript
describe('Empty String Handling', () => {
  it('should convert empty strings to null in top-level attributes', async () => {
    const entity = { name: '', description: 'test' };
    const item = repository.toItem(entity);
    expect(item.name).toBeNull();
    expect(item.description).toBe('test');
  });

  it('should convert empty strings in nested objects', async () => {
    const entity = { 
      address: { 
        street: '', 
        city: 'NYC' 
      } 
    };
    const item = repository.toItem(entity);
    expect(item.address.street).toBeNull();
    expect(item.address.city).toBe('NYC');
  });

  it('should convert empty strings in arrays', async () => {
    const entity = { tags: ['tag1', '', 'tag2'] };
    const item = repository.toItem(entity);
    expect(item.tags).toEqual(['tag1', null, 'tag2']);
  });

  it('should round-trip null values correctly', async () => {
    const entity = { name: null, description: 'test' };
    const item = repository.toItem(entity);
    const restored = repository.fromItem(item);
    expect(restored.name).toBeNull();
    expect(restored.description).toBe('test');
  });
});
```

## References

- [DynamoDB Data Types](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html)
- [DynamoDB Limits](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html)
- [AWS SDK Document Client Options](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-dynamodb/)
