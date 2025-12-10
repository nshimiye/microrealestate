# Implementation Plan

- [x] 1. Update package dependencies
  - Remove `aws-sdk` v2 package from pdfgenerator service
  - Add `@aws-sdk/client-s3` v3 package to pdfgenerator service
  - Run yarn install to update dependencies
  - _Requirements: 1.1, 1.3_

- [x] 2. Migrate S3 client initialization
  - [x] 2.1 Update imports in src/utils/s3.js to use AWS SDK v3
    - Replace `import AWS from 'aws-sdk'` with S3Client and command imports
    - Import S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand from @aws-sdk/client-s3
    - _Requirements: 1.1, 2.1_

  - [x] 2.2 Refactor _initS3() function to use S3Client
    - Create S3Client instance with credentials and endpoint configuration
    - Use AWS SDK v3 credentials format
    - Configure custom endpoint for Backblaze B2 compatibility
    - Maintain encrypted credentials decryption using Crypto.decrypt()
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.1_

  - [x] 2.3 Write property test for S3 client initialization
    - **Property 1: S3 client initialization with valid configuration**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 3. Migrate file upload functionality
  - [x] 3.1 Refactor uploadFile() to use PutObjectCommand
    - Replace s3.putObject() callback pattern with async/await
    - Create PutObjectCommand with bucket, key, body, and content type
    - Use client.send() to execute the command
    - Return result with VersionId in the same format as v2
    - Handle errors and maintain logging behavior
    - _Requirements: 3.1, 3.2, 7.2, 7.3_

  - [x] 3.2 Write property test for file upload
    - **Property 2: File upload preserves file content**
    - **Validates: Requirements 3.1, 3.2, 4.1, 4.2**

  - [x] 3.3 Write property test for upload response structure
    - **Property 5: Upload response structure consistency**
    - **Validates: Requirements 3.2, 7.2, 7.3**

  - [x] 3.4 Write property test for upload error handling
    - **Property 6: Error handling preserves behavior**
    - **Validates: Requirements 3.3, 4.3, 4.4, 5.4**

- [x] 4. Migrate file download functionality
  - [x] 4.1 Refactor downloadFile() to use GetObjectCommand
    - Replace s3.getObject().createReadStream() with async/await
    - Create GetObjectCommand with bucket and key
    - Use client.send() to execute the command
    - Return Body stream for piping to response
    - Handle errors and maintain logging behavior
    - _Requirements: 4.1, 4.2_

  - [x] 4.2 Write unit test for download error handling
    - Test 404 error for missing files
    - Test S3 error handling
    - _Requirements: 4.3, 4.4_

- [x] 5. Migrate file deletion functionality
  - [x] 5.1 Refactor deleteFiles() to use DeleteObjectsCommand
    - Replace s3.deleteObjects() callback pattern with async/await
    - Create DeleteObjectsCommand with bucket and objects array
    - Map urlsIds to Objects format required by v3
    - Use client.send() to execute the command
    - Handle errors without blocking (log only)
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 5.2 Write property test for batch deletion
    - **Property 3: Batch deletion removes all specified files**
    - **Validates: Requirements 5.1, 5.2**

- [x] 6. Add comprehensive unit tests
  - [x] 6.1 Create test file src/utils/s3.test.js
    - Set up Vitest test suite
    - Configure mocks for @aws-sdk/client-s3
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.2 Write unit tests for client initialization
    - Test successful initialization with valid config
    - Test initialization with invalid config
    - Test credential decryption
    - Test endpoint configuration
    - _Requirements: 6.1, 6.5_

  - [x] 6.3 Write unit tests for upload operations
    - Test successful upload
    - Test upload with error
    - Test response structure
    - _Requirements: 6.2, 6.5_

  - [x] 6.4 Write unit tests for download operations
    - Test successful download
    - Test download with missing file
    - Test download with S3 error
    - _Requirements: 6.3, 6.5_

  - [x] 6.5 Write unit tests for deletion operations
    - Test successful batch deletion
    - Test deletion with errors (non-blocking)
    - _Requirements: 6.4, 6.5_

  - [x] 6.6 Write unit tests for isEnabled()
    - Test with valid configuration
    - Test with invalid/missing configuration
    - _Requirements: 6.1, 6.5_

- [x] 7. Verify backward compatibility
  - [x] 7.1 Write property test for configuration compatibility
    - **Property 4: Configuration format compatibility**
    - **Validates: Requirements 7.1, 7.4**

  - [x] 7.2 Verify no changes needed to routes/documents.js
    - Review integration points
    - Confirm S3 utility interface unchanged
    - _Requirements: 7.1, 7.4_

  - [x] 7.3 Verify no changes needed to environment variables
    - Review configuration loading
    - Confirm B2 config structure unchanged
    - _Requirements: 7.4_

- [ ] 8. Build and test the service
  - [ ] 8.1 Build the pdfgenerator service
    - Run yarn workspace @microrealestate/pdfgenerator build
    - Verify no compilation errors
    - _Requirements: 1.1_

  - [ ] 8.2 Run unit tests
    - Run yarn workspace @microrealestate/pdfgenerator test
    - Verify all tests pass
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 8.3 Run property-based tests
    - Verify all properties pass with 100+ iterations
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 9. Checkpoint - Ensure all tests pass, ask the user if questions arise

- [ ] 10. Integration verification
  - [ ] 10.1 Start the service and verify no deprecation warnings
    - Run yarn workspace @microrealestate/pdfgenerator dev
    - Check logs for AWS SDK v2 warnings (should be absent)
    - _Requirements: 1.2_

  - [ ] 10.2 Run E2E tests for document operations
    - Run yarn e2e:ci
    - Verify document upload, download, and deletion work correctly
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3_

  - [ ] 10.3 Manual testing checklist
    - Upload a document through landlord UI
    - Download the uploaded document
    - Verify document content is correct
    - Delete the document
    - Verify document is removed from S3
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3_

- [ ] 11. Final checkpoint - Ensure all tests pass, ask the user if questions arise
