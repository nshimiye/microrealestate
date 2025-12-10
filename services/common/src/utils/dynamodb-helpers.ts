/**
 * DynamoDB Helper Utilities
 * 
 * This module contains utility functions for handling DynamoDB-specific constraints
 * and data transformations.
 */

/**
 * Sanitizes empty strings in an object by converting them to null.
 * 
 * DynamoDB does not support empty strings as attribute values. This function
 * recursively traverses an object and converts all empty strings to null.
 * 
 * @param obj - The object to sanitize
 * @returns A new object with empty strings converted to null
 * 
 * @example
 * ```typescript
 * const input = { name: '', description: 'test', nested: { value: '' } };
 * const output = sanitizeEmptyStrings(input);
 * // output: { name: null, description: 'test', nested: { value: null } }
 * ```
 * 
 * @remarks
 * This function is currently NOT used in the codebase. Empty string handling
 * is deferred as it requires system-wide changes. See DYNAMODB_CONSTRAINTS.md
 * for implementation details.
 * 
 * When implementing empty string handling:
 * 1. Call this function in BaseRepository.toItem() before writing to DynamoDB
 * 2. Update fromItem() methods to handle null values consistently
 * 3. Test thoroughly to ensure MongoDB/DynamoDB parity
 */
export function sanitizeEmptyStrings(obj: any): any {
  // Handle primitive types
  if (typeof obj !== 'object' || obj === null) {
    return obj === '' ? null : obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(sanitizeEmptyStrings);
  }

  // Handle objects
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeEmptyStrings(value);
  }
  return result;
}

/**
 * Removes empty string attributes from an object.
 * 
 * Alternative approach to handling empty strings - instead of converting to null,
 * this function omits empty string attributes entirely.
 * 
 * @param obj - The object to process
 * @returns A new object with empty string attributes removed
 * 
 * @example
 * ```typescript
 * const input = { name: '', description: 'test', nested: { value: '' } };
 * const output = removeEmptyStrings(input);
 * // output: { description: 'test', nested: {} }
 * ```
 * 
 * @remarks
 * This function is currently NOT used in the codebase. See DYNAMODB_CONSTRAINTS.md
 * for implementation details.
 * 
 * Note: This approach may not be suitable if the application logic expects
 * certain fields to always be present (even if empty).
 */
export function removeEmptyStrings(obj: any): any {
  // Handle primitive types
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  // Handle arrays - filter out empty strings
  if (Array.isArray(obj)) {
    return obj
      .map(removeEmptyStrings)
      .filter(item => item !== '');
  }

  // Handle objects - omit empty string attributes
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === '') {
      continue; // Skip empty strings
    }
    result[key] = removeEmptyStrings(value);
  }
  return result;
}

/**
 * Validates that an object does not contain any empty strings.
 * 
 * Useful for validating data before writing to DynamoDB to catch
 * empty string issues early.
 * 
 * @param obj - The object to validate
 * @param path - Current path in the object (for error messages)
 * @returns Array of paths where empty strings were found
 * 
 * @example
 * ```typescript
 * const data = { name: '', nested: { value: '' } };
 * const emptyPaths = findEmptyStrings(data);
 * // emptyPaths: ['name', 'nested.value']
 * ```
 */
export function findEmptyStrings(obj: any, path: string = ''): string[] {
  const emptyPaths: string[] = [];

  // Handle primitive types
  if (typeof obj !== 'object' || obj === null) {
    if (obj === '') {
      emptyPaths.push(path || 'root');
    }
    return emptyPaths;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      emptyPaths.push(...findEmptyStrings(item, itemPath));
    });
    return emptyPaths;
  }

  // Handle objects
  for (const [key, value] of Object.entries(obj)) {
    const keyPath = path ? `${path}.${key}` : key;
    emptyPaths.push(...findEmptyStrings(value, keyPath));
  }

  return emptyPaths;
}
