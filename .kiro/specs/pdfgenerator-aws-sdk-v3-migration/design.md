# Design Document

## Overview

This design document outlines the migration of the pdfgenerator service from AWS SDK for JavaScript v2 to v3. The migration focuses on updating S3 operations (upload, download, delete) while maintaining backward compatibility with existing functionality and configurations.

AWS SDK v3 introduces a modular architecture where each service is a separate package, reducing bundle size and improving performance. The migration will replace the monolithic `aws-sdk` package with specific v3 packages: `@aws-sdk/client-s3` for S3 operations.

## Architecture

### Current Architecture (AWS SDK v2)

```
┌─────────────────────────────────────┐
│   pdfgenerator Service              │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  src/utils/s3.js             │  │
│  │                              │  │
│  │  - _initS3()                 │  │
│  │  - uploadFile()              │  │
│  │  - downloadFile()            │  │
│  │  - deleteFiles()             │  │
│  │  - isEnabled()               │  │
│  └──────────────────────────────┘  │
│           │                         │
│           ▼                         │
│  ┌──────────────────────────────┐  │
│  │  aws-sdk (v2)                │  │
│  │  - AWS.S3                    │  │
│  │  - AWS.Credentials           │  │
│  │  - AWS.Endpoint              │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

### New Architecture (AWS SDK v3)

```
┌─────────────────────────────────────┐
│   pdfgenerator Service              │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  src/utils/s3.js             │  │
│  │                              │  │
│  │  - _initS3()                 │  │
│  │  - uploadFile()              │  │
│  │  - downloadFile()            │  │
│  │  - deleteFiles()             │  │
│  │  - isEnabled()               │  │
│  └──────────────────────────────┘  │
│           │                         │
│           ▼                         │
│  ┌──────────────────────────────┐  │
│  │  @aws-sdk/client-s3 (v3)    │  │
│  │  - S3Client                  │  │
│  │  - PutObjectCommand          │  │
│  │  - GetObjectCommand          │  │
│  │  - DeleteObjectsCommand      │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Components and Interfaces

### 1. S3 Utility Module (`src/utils/s3.js`)

This module provides S3 operations for the pdfgenerator service. It will be updated to use AWS SDK v3.

#### Functions

**`_initS3(b2Config)`**
- **Purpose**: Initialize and configure S3 client
- **Current Implementation**: Creates AWS.S3 instance with credentials and endpoint
- **New Implementation**: Creates S3Client instance with credentials and endpoint configuration
- **Parameters**:
  - `b2Config`: Object containing B2/S3 configuration
    - `keyId`: Encrypted access key ID
    - `applicationKey`: Encrypted secret access key
    - `endpoint`: S3 endpoint URL
    - `bucket`: Bucket name
- **Returns**: Configured S3Client instance

**`uploadFile(b2Config, { file, fileName, url })`**
- **Purpose**: Upload a file to S3
- **Current Implementation**: Uses `s3.putObject()` with callback
- **New Implementation**: Uses `PutObjectCommand` with async/await
- **Parameters**:
  - `b2Config`: S3 configuration object
  - `file`: File object with path property
  - `fileName`: Name for the uploaded file
  - `url`: S3 key (path) for the file
- **Returns**: Promise resolving to upload result with VersionId

**`downloadFile(b2Config, url)`**
- **Purpose**: Download a file from S3
- **Current Implementation**: Uses `s3.getObject().createReadStream()`
- **New Implementation**: Uses `GetObjectCommand` and returns Body stream
- **Parameters**:
  - `b2Config`: S3 configuration object
  - `url`: S3 key (path) for the file
- **Returns**: Readable stream of file content

**`deleteFiles(b2Config, urlsIds)`**
- **Purpose**: Delete multiple files from S3
- **Current Implementation**: Uses `s3.deleteObjects()` with callback
- **New Implementation**: Uses `DeleteObjectsCommand` with async/await
- **Parameters**:
  - `b2Config`: S3 configuration object
  - `urlsIds`: Array of objects with `url` and `versionId` properties
- **Returns**: Promise resolving when deletion completes

**`isEnabled(b2Config)`**
- **Purpose**: Check if S3 storage is configured
- **Current Implementation**: Checks for required configuration properties
- **New Implementation**: No changes needed
- **Parameters**:
  - `b2Config`: S3 configuration object
- **Returns**: Boolean indicating if S3 is enabled

### 2. Package Dependencies

**Remove**:
- `aws-sdk@2.1677.0`

**Add**:
- `@aws-sdk/client-s3@^3.943.0` (matches version used in common package)

### 3. Integration Points

The S3 utility module is used by:
- `src/routes/documents.js`: Document upload, download, and deletion endpoints
- `src/utils/uploadmiddleware.js`: File upload middleware (no direct S3 usage, only path construction)

No changes are required to these integration points as the S3 utility module maintains the same interface.

## Data Models

### B2 Configuration Object

```javascript
{
  keyId: string,           // Encrypted access key ID
  applicationKey: string,  // Encrypted secret access key
  endpoint: string,        // S3 endpoint URL (e.g., "https://s3.us-west-000.backblazeb2.com")
  bucket: string          // Bucket name
}
```

### Upload Result

```javascript
{
  VersionId: string  // S3 object version identifier
}
```

### Delete Request

```javascript
[
  {
    url: string,       // S3 key (path)
    versionId: string  // S3 object version identifier
  }
]
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: S3 client initialization with valid configuration

*For any* valid B2 configuration object with encrypted credentials and endpoint, initializing the S3 client should produce a configured S3Client instance without throwing errors.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 2: File upload preserves file content

*For any* file uploaded to S3, downloading the file immediately after upload should return the same content as the original file.

**Validates: Requirements 3.1, 3.2, 4.1, 4.2**

### Property 3: Batch deletion removes all specified files

*For any* array of file identifiers, calling deleteFiles should result in all specified files being removed from S3.

**Validates: Requirements 5.1, 5.2**

### Property 4: Configuration format compatibility

*For any* B2 configuration object in the existing format, the new S3 client initialization should accept it without requiring modifications to the configuration structure.

**Validates: Requirements 7.1, 7.4**

### Property 5: Upload response structure consistency

*For any* successful file upload, the response should contain a VersionId property matching the format returned by AWS SDK v2.

**Validates: Requirements 3.2, 7.2, 7.3**

### Property 6: Error handling preserves behavior

*For any* S3 operation that fails, the error handling should produce the same error messages and logging behavior as the AWS SDK v2 implementation.

**Validates: Requirements 3.3, 4.3, 4.4, 5.4**

## Error Handling

### Error Categories

1. **Configuration Errors**
   - Missing or invalid credentials
   - Invalid endpoint URL
   - Missing bucket name
   - **Handling**: Throw error during initialization, log error message

2. **Upload Errors**
   - File not found
   - Insufficient permissions
   - Network errors
   - **Handling**: Reject promise with error, log error with context

3. **Download Errors**
   - Object not found (404)
   - Insufficient permissions
   - Network errors
   - **Handling**: Reject promise with error, log error with context

4. **Deletion Errors**
   - Object not found (ignored, as deletion is idempotent)
   - Insufficient permissions
   - Network errors
   - **Handling**: Reject promise with error, log error with context

### Error Handling Strategy

AWS SDK v3 uses a different error structure than v2. The migration will:

1. **Preserve error logging**: Maintain the same log messages and context
2. **Handle SDK-specific errors**: Map v3 error types to appropriate responses
3. **Maintain async patterns**: Continue using promises for all operations
4. **Graceful degradation**: For deletion operations, log errors but don't block database cleanup

### Example Error Handling

```javascript
// Upload error handling
try {
  const result = await client.send(new PutObjectCommand(params));
  return result;
} catch (error) {
  logger.error(`cannot upload file ${url} to s3`, error);
  throw error;
}

// Download error handling
try {
  const result = await client.send(new GetObjectCommand(params));
  return result.Body;
} catch (error) {
  logger.error(`cannot download file ${url} from s3`, error);
  throw error;
}

// Deletion error handling (non-blocking)
try {
  await client.send(new DeleteObjectsCommand(params));
} catch (error) {
  logger.error('error deleting files from s3', error);
  // Don't throw - allow database cleanup to proceed
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify the S3 utility module functions work correctly with AWS SDK v3. Tests will use mocking to avoid actual S3 calls.

**Test Framework**: Vitest (already configured in pdfgenerator service)

**Mocking Strategy**: Mock `@aws-sdk/client-s3` module to intercept S3Client and command calls

**Test Coverage**:
1. S3 client initialization with valid configuration
2. S3 client initialization with invalid configuration
3. File upload success
4. File upload failure
5. File download success
6. File download failure
7. Batch file deletion success
8. Batch file deletion failure
9. isEnabled() with valid configuration
10. isEnabled() with invalid configuration

### Property-Based Testing

Property-based tests will verify universal properties hold across all inputs using the `fast-check` library (already used in the gateway service).

**Test Framework**: Vitest with fast-check

**Properties to Test**:
1. **Client initialization idempotence**: Initializing the client multiple times with the same configuration should produce equivalent clients
2. **Upload-download round trip**: For any file content, uploading then downloading should return the same content
3. **Deletion idempotence**: Deleting the same file multiple times should not cause errors
4. **Configuration validation**: For any configuration object, isEnabled() should return true only when all required fields are present

### Integration Testing

Integration tests are covered by the existing E2E Cypress tests which test document upload, download, and deletion through the full application stack.

**No changes required** to E2E tests as the S3 utility module maintains the same interface.

### Manual Testing

Manual testing checklist:
1. Upload a document through the landlord UI
2. Download the uploaded document
3. Verify the document content is correct
4. Delete the document
5. Verify the document is removed from S3
6. Check application logs for AWS SDK v2 deprecation warnings (should be absent)

## Migration Steps

### Phase 1: Update Dependencies
1. Remove `aws-sdk` from package.json
2. Add `@aws-sdk/client-s3` to package.json
3. Run `yarn install` to update dependencies

### Phase 2: Update S3 Utility Module
1. Update imports to use AWS SDK v3 packages
2. Refactor `_initS3()` to use S3Client
3. Refactor `uploadFile()` to use PutObjectCommand
4. Refactor `downloadFile()` to use GetObjectCommand
5. Refactor `deleteFiles()` to use DeleteObjectsCommand
6. Keep `isEnabled()` unchanged

### Phase 3: Add Unit Tests
1. Create test file `src/utils/s3.test.js`
2. Implement unit tests for all S3 operations
3. Implement property-based tests for key properties
4. Run tests and verify all pass

### Phase 4: Verification
1. Build the service
2. Run unit tests
3. Start the service and verify no deprecation warnings
4. Run E2E tests
5. Perform manual testing

### Phase 5: Documentation
1. Update any relevant documentation
2. Add migration notes to CHANGELOG.md

## Backward Compatibility

The migration maintains 100% backward compatibility:

1. **Configuration Format**: No changes to B2 configuration structure
2. **API Interface**: S3 utility functions maintain the same signatures
3. **Response Format**: Upload results maintain the same structure
4. **Error Handling**: Error messages and logging remain consistent
5. **Environment Variables**: No changes required
6. **Database Schema**: No changes to stored URLs or version IDs

## Performance Considerations

AWS SDK v3 offers several performance improvements:

1. **Smaller Bundle Size**: Modular architecture reduces package size
2. **Faster Initialization**: S3Client initialization is more efficient
3. **Better Memory Usage**: Streaming operations are more memory-efficient
4. **Improved Error Handling**: More detailed error information

Expected performance impact:
- **Bundle size**: Reduction of ~50% (from ~50MB to ~25MB for S3 operations)
- **Memory usage**: Slight reduction due to more efficient streaming
- **Execution time**: No significant change (operations are I/O bound)

## Security Considerations

1. **Credentials Handling**: Continue using encrypted credentials with Crypto.decrypt()
2. **Endpoint Validation**: Validate endpoint URLs to prevent SSRF attacks
3. **Error Messages**: Avoid exposing sensitive information in error messages
4. **Dependency Updates**: AWS SDK v3 receives regular security updates

## Rollback Plan

If issues are discovered after deployment:

1. **Immediate Rollback**: Revert to previous Docker image
2. **Code Rollback**: Revert the S3 utility module changes
3. **Dependency Rollback**: Restore `aws-sdk` v2 in package.json
4. **Verification**: Run tests to ensure rollback is successful

The rollback is straightforward because:
- No database schema changes
- No configuration changes
- No API changes
- Docker images are versioned and immutable
