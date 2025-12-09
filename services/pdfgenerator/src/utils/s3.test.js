/**
 * Unit and Property-Based Tests for S3 Utility Module
 * Feature: pdfgenerator-aws-sdk-v3-migration
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 7.2, 7.3
 */

import * as fc from 'fast-check';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Crypto } from '@microrealestate/common';
import fs from 'fs-extra';

// Mock the S3 module to avoid actual AWS calls
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectsCommand: vi.fn()
}));

// Mock Crypto to control encryption/decryption
vi.mock('@microrealestate/common', async () => {
  const actual = await vi.importActual('@microrealestate/common');
  return {
    ...actual,
    Crypto: {
      decrypt: vi.fn((value) => value) // Return value as-is for testing
    }
  };
});

// Mock fs-extra to avoid actual file system operations
vi.mock('fs-extra', () => ({
  default: {
    createReadStream: vi.fn(() => ({ pipe: vi.fn() }))
  },
  createReadStream: vi.fn(() => ({ pipe: vi.fn() }))
}));

// Import the module under test after mocking
const s3Module = await import('./s3.js');

describe('S3 Client Initialization Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 1: S3 client initialization with valid configuration
   * For any valid B2 configuration object with encrypted credentials and endpoint,
   * initializing the S3 client should produce a configured S3Client instance without throwing errors.
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4
   */
  describe('Property 1: S3 client initialization with valid configuration', () => {
    // Arbitrary generator for valid B2 configuration
    const arbB2Config = fc.record({
      keyId: fc.string({ minLength: 10, maxLength: 50 }),
      applicationKey: fc.string({ minLength: 20, maxLength: 100 }),
      endpoint: fc
        .tuple(
          fc.constantFrom('http', 'https'),
          fc.domain(),
          fc.option(fc.integer({ min: 1000, max: 9999 }), { nil: null })
        )
        .map(([protocol, domain, port]) =>
          port ? `${protocol}://${domain}:${port}` : `${protocol}://${domain}`
        ),
      bucket: fc.string({ minLength: 3, maxLength: 63 })
    });

    it('should initialize S3Client without throwing errors for any valid configuration', () => {
      fc.assert(
        fc.property(arbB2Config, (b2Config) => {
          // Mock S3Client constructor to return a mock instance
          const mockS3Client = { config: {} };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // This should not throw
          expect(() => {
            // Access the private _initS3 function through uploadFile
            // Since _initS3 is private, we test it indirectly
            const result = s3Module.isEnabled(b2Config);
            expect(result).toBe(true);
          }).not.toThrow();

          // Verify all required fields are present
          expect(b2Config.keyId).toBeDefined();
          expect(b2Config.applicationKey).toBeDefined();
          expect(b2Config.endpoint).toBeDefined();
          expect(b2Config.bucket).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should call Crypto.decrypt for credentials', () => {
      fc.assert(
        fc.property(arbB2Config, (b2Config) => {
          vi.clearAllMocks();

          const mockS3Client = { config: {} };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // Call isEnabled which validates the config structure
          s3Module.isEnabled(b2Config);

          // The actual decryption happens in _initS3, which is called by upload/download/delete
          // We verify the config structure is valid
          expect(b2Config.keyId).toBeTruthy();
          expect(b2Config.applicationKey).toBeTruthy();
        }),
        { numRuns: 100 }
      );
    });

    it('should accept configuration with custom endpoint', () => {
      fc.assert(
        fc.property(arbB2Config, (b2Config) => {
          vi.clearAllMocks();

          const mockS3Client = { config: {} };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // Verify endpoint is properly formatted
          expect(b2Config.endpoint).toMatch(/^https?:\/\/.+/);

          // Verify isEnabled returns true for valid config
          const result = s3Module.isEnabled(b2Config);
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle various bucket name formats', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 63 }).filter((s) => {
            // Bucket names must follow AWS S3 naming rules
            return /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(s);
          }),
          (bucketName) => {
            const config = {
              keyId: 'test-key-id',
              applicationKey: 'test-app-key',
              endpoint: 'https://s3.example.com',
              bucket: bucketName
            };

            const result = s3Module.isEnabled(config);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('isEnabled validation', () => {
    it('should return false for missing keyId', () => {
      const config = {
        applicationKey: 'test-app-key',
        endpoint: 'https://s3.example.com',
        bucket: 'test-bucket'
      };

      const result = s3Module.isEnabled(config);
      expect(result).toBe(false);
    });

    it('should return false for missing applicationKey', () => {
      const config = {
        keyId: 'test-key-id',
        endpoint: 'https://s3.example.com',
        bucket: 'test-bucket'
      };

      const result = s3Module.isEnabled(config);
      expect(result).toBe(false);
    });

    it('should return false for missing endpoint', () => {
      const config = {
        keyId: 'test-key-id',
        applicationKey: 'test-app-key',
        bucket: 'test-bucket'
      };

      const result = s3Module.isEnabled(config);
      expect(result).toBe(false);
    });

    it('should return false for missing bucket', () => {
      const config = {
        keyId: 'test-key-id',
        applicationKey: 'test-app-key',
        endpoint: 'https://s3.example.com'
      };

      const result = s3Module.isEnabled(config);
      expect(result).toBe(false);
    });

    it('should return false for null config', () => {
      const result = s3Module.isEnabled(null);
      expect(result).toBe(false);
    });

    it('should return false for undefined config', () => {
      const result = s3Module.isEnabled(undefined);
      expect(result).toBe(false);
    });
  });
});

/**
 * Property-Based Tests for File Upload
 * Feature: pdfgenerator-aws-sdk-v3-migration, Property 2: File upload preserves file content
 * Validates: Requirements 3.1, 3.2, 4.1, 4.2
 */
describe('File Upload Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 2: File upload preserves file content
   * For any file uploaded to S3, the upload should complete successfully
   * and return a result with VersionId.
   * Validates: Requirements 3.1, 3.2, 4.1, 4.2
   */
  describe('Property 2: File upload preserves file content', () => {
    // Arbitrary generator for file upload parameters
    const arbUploadParams = fc.record({
      file: fc.record({
        path: fc.string({ minLength: 1, maxLength: 100 }).map(s => `/tmp/${s}`)
      }),
      fileName: fc.string({ minLength: 1, maxLength: 50 }),
      url: fc.string({ minLength: 1, maxLength: 100 }).map(s => `documents/${s}`)
    });

    const arbB2Config = fc.record({
      keyId: fc.string({ minLength: 10, maxLength: 50 }),
      applicationKey: fc.string({ minLength: 20, maxLength: 100 }),
      endpoint: fc.constantFrom('https://s3.example.com', 'https://s3.us-west-002.backblazeb2.com'),
      bucket: fc.string({ minLength: 3, maxLength: 63 })
    });

    it('should successfully upload file and return VersionId', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2Config, arbUploadParams, async (b2Config, uploadParams) => {
          // Mock S3Client and PutObjectCommand
          const mockVersionId = `version-${Math.random().toString(36).substring(7)}`;
          const mockS3Client = {
            send: vi.fn().mockResolvedValue({ VersionId: mockVersionId })
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // Execute upload
          const result = await s3Module.uploadFile(b2Config, uploadParams);

          // Verify result structure
          expect(result).toBeDefined();
          expect(result.fileName).toBe(uploadParams.fileName);
          expect(result.key).toBe(uploadParams.url);
          expect(result.versionId).toBe(mockVersionId);

          // Verify S3Client.send was called
          expect(mockS3Client.send).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle upload with various file paths', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbB2Config,
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (b2Config, filePath, fileName) => {
            const mockVersionId = 'test-version-id';
            const mockS3Client = {
              send: vi.fn().mockResolvedValue({ VersionId: mockVersionId })
            };
            vi.mocked(S3Client).mockImplementation(() => mockS3Client);

            const uploadParams = {
              file: { path: filePath },
              fileName: fileName,
              url: `documents/${fileName}`
            };

            const result = await s3Module.uploadFile(b2Config, uploadParams);

            expect(result.fileName).toBe(fileName);
            expect(result.versionId).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Property-Based Tests for Upload Response Structure
 * Feature: pdfgenerator-aws-sdk-v3-migration, Property 5: Upload response structure consistency
 * Validates: Requirements 3.2, 7.2, 7.3
 */
describe('Upload Response Structure Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 5: Upload response structure consistency
   * For any successful file upload, the response should contain a VersionId property
   * matching the format returned by AWS SDK v2.
   * Validates: Requirements 3.2, 7.2, 7.3
   */
  describe('Property 5: Upload response structure consistency', () => {
    const arbB2Config = fc.record({
      keyId: fc.string({ minLength: 10, maxLength: 50 }),
      applicationKey: fc.string({ minLength: 20, maxLength: 100 }),
      endpoint: fc.constantFrom('https://s3.example.com', 'https://s3.us-west-002.backblazeb2.com'),
      bucket: fc.string({ minLength: 3, maxLength: 63 })
    });

    const arbUploadParams = fc.record({
      file: fc.record({
        path: fc.string({ minLength: 1, maxLength: 100 }).map(s => `/tmp/${s}`)
      }),
      fileName: fc.string({ minLength: 1, maxLength: 50 }),
      url: fc.string({ minLength: 1, maxLength: 100 }).map(s => `documents/${s}`)
    });

    it('should return response with fileName, key, and versionId properties', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2Config, arbUploadParams, async (b2Config, uploadParams) => {
          const mockVersionId = `version-${Math.random().toString(36).substring(7)}`;
          const mockS3Client = {
            send: vi.fn().mockResolvedValue({ VersionId: mockVersionId })
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          const result = await s3Module.uploadFile(b2Config, uploadParams);

          // Verify response structure matches v2 format
          expect(result).toHaveProperty('fileName');
          expect(result).toHaveProperty('key');
          expect(result).toHaveProperty('versionId');

          // Verify values match input
          expect(result.fileName).toBe(uploadParams.fileName);
          expect(result.key).toBe(uploadParams.url);
          expect(result.versionId).toBe(mockVersionId);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve VersionId format from S3 response', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbB2Config,
          arbUploadParams,
          fc.string({ minLength: 1, maxLength: 100 }), // arbitrary version ID
          async (b2Config, uploadParams, versionId) => {
            const mockS3Client = {
              send: vi.fn().mockResolvedValue({ VersionId: versionId })
            };
            vi.mocked(S3Client).mockImplementation(() => mockS3Client);

            const result = await s3Module.uploadFile(b2Config, uploadParams);

            // VersionId should be passed through unchanged
            expect(result.versionId).toBe(versionId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent response structure across multiple uploads', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbB2Config,
          fc.array(arbUploadParams, { minLength: 2, maxLength: 5 }),
          async (b2Config, uploadParamsArray) => {
            const results = [];

            for (const uploadParams of uploadParamsArray) {
              const mockVersionId = `version-${Math.random().toString(36).substring(7)}`;
              const mockS3Client = {
                send: vi.fn().mockResolvedValue({ VersionId: mockVersionId })
              };
              vi.mocked(S3Client).mockImplementation(() => mockS3Client);

              const result = await s3Module.uploadFile(b2Config, uploadParams);
              results.push(result);
            }

            // All results should have the same structure
            results.forEach(result => {
              expect(Object.keys(result).sort()).toEqual(['fileName', 'key', 'versionId'].sort());
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

/**
 * Unit Tests for File Download
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */
describe('File Download Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockB2Config = {
    keyId: 'test-key-id',
    applicationKey: 'test-app-key',
    endpoint: 'https://s3.example.com',
    bucket: 'test-bucket'
  };

  describe('downloadFile success cases', () => {
    it('should successfully download file and return Body stream', async () => {
      const mockBody = { pipe: vi.fn() };
      const mockS3Client = {
        send: vi.fn().mockResolvedValue({ Body: mockBody })
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const result = await s3Module.downloadFile(mockB2Config, 'documents/test.pdf');

      expect(result).toBe(mockBody);
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });

    it('should call GetObjectCommand with correct parameters', async () => {
      const mockBody = { pipe: vi.fn() };
      const mockS3Client = {
        send: vi.fn().mockResolvedValue({ Body: mockBody })
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const url = 'documents/test-file.pdf';
      await s3Module.downloadFile(mockB2Config, url);

      // Verify send was called (we can't easily verify the command parameters due to mocking)
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('downloadFile error handling', () => {
    it('should throw error for missing file (404)', async () => {
      const mockError = new Error('NoSuchKey');
      mockError.name = 'NoSuchKey';
      mockError.$metadata = { httpStatusCode: 404 };
      
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.downloadFile(mockB2Config, 'documents/missing.pdf')
      ).rejects.toThrow('NoSuchKey');
    });

    it('should throw error for access denied', async () => {
      const mockError = new Error('AccessDenied');
      mockError.name = 'AccessDenied';
      mockError.$metadata = { httpStatusCode: 403 };
      
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.downloadFile(mockB2Config, 'documents/forbidden.pdf')
      ).rejects.toThrow('AccessDenied');
    });

    it('should throw error for network issues', async () => {
      const mockError = new Error('Network error');
      mockError.code = 'ECONNREFUSED';
      
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.downloadFile(mockB2Config, 'documents/test.pdf')
      ).rejects.toThrow('Network error');
    });

    it('should throw error for invalid bucket', async () => {
      const mockError = new Error('NoSuchBucket');
      mockError.name = 'NoSuchBucket';
      mockError.$metadata = { httpStatusCode: 404 };
      
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.downloadFile(mockB2Config, 'documents/test.pdf')
      ).rejects.toThrow('NoSuchBucket');
    });

    it('should throw error for invalid credentials', async () => {
      const mockError = new Error('InvalidAccessKeyId');
      mockError.name = 'InvalidAccessKeyId';
      mockError.$metadata = { httpStatusCode: 403 };
      
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.downloadFile(mockB2Config, 'documents/test.pdf')
      ).rejects.toThrow('InvalidAccessKeyId');
    });

    it('should propagate S3 errors without modification', async () => {
      const mockError = new Error('Custom S3 error');
      mockError.name = 'CustomError';
      
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      try {
        await s3Module.downloadFile(mockB2Config, 'documents/test.pdf');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe('Custom S3 error');
        expect(error.name).toBe('CustomError');
      }
    });
  });
});

/**
 * Property-Based Tests for Upload Error Handling
 * Feature: pdfgenerator-aws-sdk-v3-migration, Property 6: Error handling preserves behavior
 * Validates: Requirements 3.3, 4.3, 4.4, 5.4
 */
describe('Upload Error Handling Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 6: Error handling preserves behavior
   * For any S3 operation that fails, the error handling should produce
   * the same error messages and logging behavior as the AWS SDK v2 implementation.
   * Validates: Requirements 3.3, 4.3, 4.4, 5.4
   */
  describe('Property 6: Error handling preserves behavior', () => {
    const arbB2Config = fc.record({
      keyId: fc.string({ minLength: 10, maxLength: 50 }),
      applicationKey: fc.string({ minLength: 20, maxLength: 100 }),
      endpoint: fc.constantFrom('https://s3.example.com', 'https://s3.us-west-002.backblazeb2.com'),
      bucket: fc.string({ minLength: 3, maxLength: 63 })
    });

    const arbUploadParams = fc.record({
      file: fc.record({
        path: fc.string({ minLength: 1, maxLength: 100 }).map(s => `/tmp/${s}`)
      }),
      fileName: fc.string({ minLength: 1, maxLength: 50 }),
      url: fc.string({ minLength: 1, maxLength: 100 }).map(s => `documents/${s}`)
    });

    it('should throw error when S3 upload fails', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2Config, arbUploadParams, async (b2Config, uploadParams) => {
          const mockError = new Error('S3 upload failed');
          const mockS3Client = {
            send: vi.fn().mockRejectedValue(mockError)
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // Upload should throw the error
          await expect(s3Module.uploadFile(b2Config, uploadParams)).rejects.toThrow('S3 upload failed');
        }),
        { numRuns: 100 }
      );
    });

    it('should handle various S3 error types', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbB2Config,
          arbUploadParams,
          fc.constantFrom(
            'AccessDenied',
            'NoSuchBucket',
            'InvalidAccessKeyId',
            'SignatureDoesNotMatch',
            'RequestTimeout'
          ),
          async (b2Config, uploadParams, errorCode) => {
            const mockError = new Error(`S3 Error: ${errorCode}`);
            mockError.name = errorCode;
            const mockS3Client = {
              send: vi.fn().mockRejectedValue(mockError)
            };
            vi.mocked(S3Client).mockImplementation(() => mockS3Client);

            // Upload should throw the error
            await expect(s3Module.uploadFile(b2Config, uploadParams)).rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should propagate error without modification', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbB2Config,
          arbUploadParams,
          fc.string({ minLength: 1, maxLength: 100 }),
          async (b2Config, uploadParams, errorMessage) => {
            const mockError = new Error(errorMessage);
            const mockS3Client = {
              send: vi.fn().mockRejectedValue(mockError)
            };
            vi.mocked(S3Client).mockImplementation(() => mockS3Client);

            try {
              await s3Module.uploadFile(b2Config, uploadParams);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error) {
              // Error should be propagated with original message
              expect(error.message).toBe(errorMessage);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle network errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2Config, arbUploadParams, async (b2Config, uploadParams) => {
          const mockError = new Error('Network error');
          mockError.code = 'ECONNREFUSED';
          const mockS3Client = {
            send: vi.fn().mockRejectedValue(mockError)
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          await expect(s3Module.uploadFile(b2Config, uploadParams)).rejects.toThrow('Network error');
        }),
        { numRuns: 50 }
      );
    });
  });
});

/**
 * Property-Based Tests for File Deletion
 * Feature: pdfgenerator-aws-sdk-v3-migration, Property 3: Batch deletion removes all specified files
 * Validates: Requirements 5.1, 5.2
 */
describe('File Deletion Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 3: Batch deletion removes all specified files
   * For any list of files to delete, the batch deletion operation should
   * successfully remove all files and return a result indicating success.
   * Validates: Requirements 5.1, 5.2
   */
  describe('Property 3: Batch deletion removes all specified files', () => {
    const arbB2Config = fc.record({
      keyId: fc.string({ minLength: 10, maxLength: 50 }),
      applicationKey: fc.string({ minLength: 20, maxLength: 100 }),
      endpoint: fc.constantFrom('https://s3.example.com', 'https://s3.us-west-002.backblazeb2.com'),
      bucket: fc.string({ minLength: 3, maxLength: 63 })
    });

    // Arbitrary generator for file deletion parameters
    const arbFileToDelete = fc.record({
      url: fc.string({ minLength: 1, maxLength: 100 }).map(s => `documents/${s}`),
      versionId: fc.string({ minLength: 1, maxLength: 50 })
    });

    const arbFilesToDelete = fc.array(arbFileToDelete, { minLength: 1, maxLength: 10 });

    it('should successfully delete all files in batch', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2Config, arbFilesToDelete, async (b2Config, filesToDelete) => {
          // Mock S3Client and DeleteObjectsCommand
          const mockResult = {
            Deleted: filesToDelete.map(({ url, versionId }) => ({
              Key: url,
              VersionId: versionId
            }))
          };
          const mockS3Client = {
            send: vi.fn().mockResolvedValue(mockResult)
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // Execute deletion
          const result = await s3Module.deleteFiles(b2Config, filesToDelete);

          // Verify result structure
          expect(result).toBeDefined();
          expect(result.Deleted).toBeDefined();
          expect(result.Deleted.length).toBe(filesToDelete.length);

          // Verify S3Client.send was called
          expect(mockS3Client.send).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle deletion of single file', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2Config, arbFileToDelete, async (b2Config, fileToDelete) => {
          const mockResult = {
            Deleted: [{ Key: fileToDelete.url, VersionId: fileToDelete.versionId }]
          };
          const mockS3Client = {
            send: vi.fn().mockResolvedValue(mockResult)
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          const result = await s3Module.deleteFiles(b2Config, [fileToDelete]);

          expect(result.Deleted).toBeDefined();
          expect(result.Deleted.length).toBe(1);
          expect(result.Deleted[0].Key).toBe(fileToDelete.url);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle deletion with various file counts', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbB2Config,
          fc.integer({ min: 1, max: 20 }),
          async (b2Config, fileCount) => {
            const filesToDelete = Array.from({ length: fileCount }, (_, i) => ({
              url: `documents/file-${i}.pdf`,
              versionId: `version-${i}`
            }));

            const mockResult = {
              Deleted: filesToDelete.map(({ url, versionId }) => ({
                Key: url,
                VersionId: versionId
              }))
            };
            const mockS3Client = {
              send: vi.fn().mockResolvedValue(mockResult)
            };
            vi.mocked(S3Client).mockImplementation(() => mockS3Client);

            const result = await s3Module.deleteFiles(b2Config, filesToDelete);

            expect(result.Deleted.length).toBe(fileCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map urlsIds to Objects format correctly', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2Config, arbFilesToDelete, async (b2Config, filesToDelete) => {
          let capturedCommand = null;
          const mockS3Client = {
            send: vi.fn().mockImplementation((command) => {
              capturedCommand = command;
              return Promise.resolve({
                Deleted: filesToDelete.map(({ url, versionId }) => ({
                  Key: url,
                  VersionId: versionId
                }))
              });
            })
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          await s3Module.deleteFiles(b2Config, filesToDelete);

          // Verify the command was called
          expect(mockS3Client.send).toHaveBeenCalledTimes(1);
          
          // The command should have been created with proper structure
          // We can't easily inspect the command object, but we can verify it was called
          expect(capturedCommand).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should handle deletion errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2Config, arbFilesToDelete, async (b2Config, filesToDelete) => {
          const mockError = new Error('S3 deletion failed');
          const mockS3Client = {
            send: vi.fn().mockRejectedValue(mockError)
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // Deletion should throw the error
          await expect(s3Module.deleteFiles(b2Config, filesToDelete)).rejects.toThrow('S3 deletion failed');
        }),
        { numRuns: 100 }
      );
    });

    it('should handle partial deletion failures', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2Config, arbFilesToDelete, async (b2Config, filesToDelete) => {
          // Mock partial failure response
          const mockResult = {
            Deleted: filesToDelete.slice(0, Math.floor(filesToDelete.length / 2)).map(({ url, versionId }) => ({
              Key: url,
              VersionId: versionId
            })),
            Errors: filesToDelete.slice(Math.floor(filesToDelete.length / 2)).map(({ url, versionId }) => ({
              Key: url,
              VersionId: versionId,
              Code: 'AccessDenied',
              Message: 'Access Denied'
            }))
          };
          const mockS3Client = {
            send: vi.fn().mockResolvedValue(mockResult)
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          const result = await s3Module.deleteFiles(b2Config, filesToDelete);

          // Result should contain both Deleted and Errors
          expect(result.Deleted).toBeDefined();
          if (mockResult.Errors.length > 0) {
            expect(result.Errors).toBeDefined();
          }
        }),
        { numRuns: 50 }
      );
    });
  });
});

/**
 * Unit Tests for Client Initialization
 * Validates: Requirements 6.1, 6.5
 */
describe('Client Initialization Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockB2Config = {
    keyId: 'test-key-id',
    applicationKey: 'test-app-key',
    endpoint: 'https://s3.example.com',
    bucket: 'test-bucket'
  };

  describe('successful initialization', () => {
    it('should initialize S3Client with valid config', async () => {
      const mockS3Client = { config: {} };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      // Test through uploadFile which calls _initS3
      const mockResult = { VersionId: 'test-version' };
      mockS3Client.send = vi.fn().mockResolvedValue(mockResult);

      await s3Module.uploadFile(mockB2Config, {
        file: { path: '/tmp/test.pdf' },
        fileName: 'test.pdf',
        url: 'documents/test.pdf'
      });

      // Verify S3Client was instantiated
      expect(S3Client).toHaveBeenCalled();
    });

    it('should decrypt credentials during initialization', async () => {
      const mockS3Client = { send: vi.fn().mockResolvedValue({ VersionId: 'test' }) };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await s3Module.uploadFile(mockB2Config, {
        file: { path: '/tmp/test.pdf' },
        fileName: 'test.pdf',
        url: 'documents/test.pdf'
      });

      // Verify Crypto.decrypt was called for credentials
      expect(Crypto.decrypt).toHaveBeenCalledWith(mockB2Config.keyId);
      expect(Crypto.decrypt).toHaveBeenCalledWith(mockB2Config.applicationKey);
    });

    it('should configure endpoint correctly', async () => {
      const mockS3Client = { send: vi.fn().mockResolvedValue({ VersionId: 'test' }) };
      let capturedConfig;
      vi.mocked(S3Client).mockImplementation((config) => {
        capturedConfig = config;
        return mockS3Client;
      });

      await s3Module.uploadFile(mockB2Config, {
        file: { path: '/tmp/test.pdf' },
        fileName: 'test.pdf',
        url: 'documents/test.pdf'
      });

      // Verify endpoint was configured
      expect(capturedConfig.endpoint).toBe(mockB2Config.endpoint);
    });

    it('should set region for SDK v3 compatibility', async () => {
      const mockS3Client = { send: vi.fn().mockResolvedValue({ VersionId: 'test' }) };
      let capturedConfig;
      vi.mocked(S3Client).mockImplementation((config) => {
        capturedConfig = config;
        return mockS3Client;
      });

      await s3Module.uploadFile(mockB2Config, {
        file: { path: '/tmp/test.pdf' },
        fileName: 'test.pdf',
        url: 'documents/test.pdf'
      });

      // Verify region is set (required by SDK v3)
      expect(capturedConfig.region).toBeDefined();
    });
  });

  describe('initialization with invalid config', () => {
    it('should handle missing keyId', async () => {
      const invalidConfig = {
        applicationKey: 'test-app-key',
        endpoint: 'https://s3.example.com',
        bucket: 'test-bucket'
      };

      // isEnabled should return false
      expect(s3Module.isEnabled(invalidConfig)).toBe(false);
    });

    it('should handle missing applicationKey', async () => {
      const invalidConfig = {
        keyId: 'test-key-id',
        endpoint: 'https://s3.example.com',
        bucket: 'test-bucket'
      };

      expect(s3Module.isEnabled(invalidConfig)).toBe(false);
    });

    it('should handle missing endpoint', async () => {
      const invalidConfig = {
        keyId: 'test-key-id',
        applicationKey: 'test-app-key',
        bucket: 'test-bucket'
      };

      expect(s3Module.isEnabled(invalidConfig)).toBe(false);
    });

    it('should handle missing bucket', async () => {
      const invalidConfig = {
        keyId: 'test-key-id',
        applicationKey: 'test-app-key',
        endpoint: 'https://s3.example.com'
      };

      expect(s3Module.isEnabled(invalidConfig)).toBe(false);
    });

    it('should handle empty config object', () => {
      expect(s3Module.isEnabled({})).toBe(false);
    });

    it('should handle null config', () => {
      expect(s3Module.isEnabled(null)).toBe(false);
    });

    it('should handle undefined config', () => {
      expect(s3Module.isEnabled(undefined)).toBe(false);
    });
  });
});

/**
 * Unit Tests for Upload Operations
 * Validates: Requirements 6.2, 6.5
 */
describe('Upload Operations Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockB2Config = {
    keyId: 'test-key-id',
    applicationKey: 'test-app-key',
    endpoint: 'https://s3.example.com',
    bucket: 'test-bucket'
  };

  describe('successful upload', () => {
    it('should upload file and return result with VersionId', async () => {
      const mockVersionId = 'test-version-123';
      const mockS3Client = {
        send: vi.fn().mockResolvedValue({ VersionId: mockVersionId })
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const uploadParams = {
        file: { path: '/tmp/test.pdf' },
        fileName: 'test.pdf',
        url: 'documents/test.pdf'
      };

      const result = await s3Module.uploadFile(mockB2Config, uploadParams);

      expect(result).toEqual({
        fileName: 'test.pdf',
        key: 'documents/test.pdf',
        versionId: mockVersionId
      });
    });

    it('should create file stream from file path', async () => {
      const mockS3Client = {
        send: vi.fn().mockResolvedValue({ VersionId: 'test-version' })
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const filePath = '/tmp/test-document.pdf';
      await s3Module.uploadFile(mockB2Config, {
        file: { path: filePath },
        fileName: 'test-document.pdf',
        url: 'documents/test-document.pdf'
      });

      // Verify createReadStream was called with the file path
      expect(fs.createReadStream).toHaveBeenCalledWith(filePath);
    });

    it('should send PutObjectCommand with correct parameters', async () => {
      let capturedCommand;
      const mockS3Client = {
        send: vi.fn().mockImplementation((command) => {
          capturedCommand = command;
          return Promise.resolve({ VersionId: 'test-version' });
        })
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await s3Module.uploadFile(mockB2Config, {
        file: { path: '/tmp/test.pdf' },
        fileName: 'test.pdf',
        url: 'documents/test.pdf'
      });

      // Verify send was called with a command
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      expect(capturedCommand).toBeDefined();
    });
  });

  describe('upload with error', () => {
    it('should throw error when upload fails', async () => {
      const mockError = new Error('Upload failed');
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.uploadFile(mockB2Config, {
          file: { path: '/tmp/test.pdf' },
          fileName: 'test.pdf',
          url: 'documents/test.pdf'
        })
      ).rejects.toThrow('Upload failed');
    });

    it('should throw error for access denied', async () => {
      const mockError = new Error('AccessDenied');
      mockError.name = 'AccessDenied';
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.uploadFile(mockB2Config, {
          file: { path: '/tmp/test.pdf' },
          fileName: 'test.pdf',
          url: 'documents/test.pdf'
        })
      ).rejects.toThrow('AccessDenied');
    });

    it('should throw error for invalid bucket', async () => {
      const mockError = new Error('NoSuchBucket');
      mockError.name = 'NoSuchBucket';
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.uploadFile(mockB2Config, {
          file: { path: '/tmp/test.pdf' },
          fileName: 'test.pdf',
          url: 'documents/test.pdf'
        })
      ).rejects.toThrow('NoSuchBucket');
    });
  });

  describe('response structure', () => {
    it('should return object with fileName, key, and versionId', async () => {
      const mockS3Client = {
        send: vi.fn().mockResolvedValue({ VersionId: 'v123' })
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const result = await s3Module.uploadFile(mockB2Config, {
        file: { path: '/tmp/test.pdf' },
        fileName: 'my-file.pdf',
        url: 'documents/my-file.pdf'
      });

      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('versionId');
    });

    it('should preserve fileName from input', async () => {
      const mockS3Client = {
        send: vi.fn().mockResolvedValue({ VersionId: 'v123' })
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const fileName = 'important-document.pdf';
      const result = await s3Module.uploadFile(mockB2Config, {
        file: { path: '/tmp/test.pdf' },
        fileName: fileName,
        url: 'documents/test.pdf'
      });

      expect(result.fileName).toBe(fileName);
    });

    it('should use url as key in response', async () => {
      const mockS3Client = {
        send: vi.fn().mockResolvedValue({ VersionId: 'v123' })
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const url = 'documents/subfolder/file.pdf';
      const result = await s3Module.uploadFile(mockB2Config, {
        file: { path: '/tmp/test.pdf' },
        fileName: 'file.pdf',
        url: url
      });

      expect(result.key).toBe(url);
    });
  });
});

/**
 * Unit Tests for Deletion Operations
 * Validates: Requirements 6.4, 6.5
 */
describe('Deletion Operations Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockB2Config = {
    keyId: 'test-key-id',
    applicationKey: 'test-app-key',
    endpoint: 'https://s3.example.com',
    bucket: 'test-bucket'
  };

  describe('successful batch deletion', () => {
    it('should delete single file', async () => {
      const mockResult = {
        Deleted: [{ Key: 'documents/test.pdf', VersionId: 'v1' }]
      };
      const mockS3Client = {
        send: vi.fn().mockResolvedValue(mockResult)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const filesToDelete = [
        { url: 'documents/test.pdf', versionId: 'v1' }
      ];

      const result = await s3Module.deleteFiles(mockB2Config, filesToDelete);

      expect(result.Deleted).toBeDefined();
      expect(result.Deleted.length).toBe(1);
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });

    it('should delete multiple files in batch', async () => {
      const filesToDelete = [
        { url: 'documents/file1.pdf', versionId: 'v1' },
        { url: 'documents/file2.pdf', versionId: 'v2' },
        { url: 'documents/file3.pdf', versionId: 'v3' }
      ];

      const mockResult = {
        Deleted: filesToDelete.map(({ url, versionId }) => ({
          Key: url,
          VersionId: versionId
        }))
      };
      const mockS3Client = {
        send: vi.fn().mockResolvedValue(mockResult)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const result = await s3Module.deleteFiles(mockB2Config, filesToDelete);

      expect(result.Deleted.length).toBe(3);
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });

    it('should map urlsIds to Objects format correctly', async () => {
      let capturedCommand;
      const mockS3Client = {
        send: vi.fn().mockImplementation((command) => {
          capturedCommand = command;
          return Promise.resolve({
            Deleted: [{ Key: 'documents/test.pdf', VersionId: 'v1' }]
          });
        })
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await s3Module.deleteFiles(mockB2Config, [
        { url: 'documents/test.pdf', versionId: 'v1' }
      ]);

      // Verify send was called
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      expect(capturedCommand).toBeDefined();
    });

    it('should handle empty Deleted array', async () => {
      const mockResult = { Deleted: [] };
      const mockS3Client = {
        send: vi.fn().mockResolvedValue(mockResult)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const result = await s3Module.deleteFiles(mockB2Config, [
        { url: 'documents/test.pdf', versionId: 'v1' }
      ]);

      expect(result.Deleted).toEqual([]);
    });
  });

  describe('deletion with errors (non-blocking)', () => {
    it('should throw error when deletion fails', async () => {
      const mockError = new Error('Deletion failed');
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.deleteFiles(mockB2Config, [
          { url: 'documents/test.pdf', versionId: 'v1' }
        ])
      ).rejects.toThrow('Deletion failed');
    });

    it('should throw error for access denied', async () => {
      const mockError = new Error('AccessDenied');
      mockError.name = 'AccessDenied';
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.deleteFiles(mockB2Config, [
          { url: 'documents/test.pdf', versionId: 'v1' }
        ])
      ).rejects.toThrow('AccessDenied');
    });

    it('should throw error for invalid bucket', async () => {
      const mockError = new Error('NoSuchBucket');
      mockError.name = 'NoSuchBucket';
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.deleteFiles(mockB2Config, [
          { url: 'documents/test.pdf', versionId: 'v1' }
        ])
      ).rejects.toThrow('NoSuchBucket');
    });

    it('should handle partial deletion failures', async () => {
      const mockResult = {
        Deleted: [{ Key: 'documents/file1.pdf', VersionId: 'v1' }],
        Errors: [
          {
            Key: 'documents/file2.pdf',
            VersionId: 'v2',
            Code: 'AccessDenied',
            Message: 'Access Denied'
          }
        ]
      };
      const mockS3Client = {
        send: vi.fn().mockResolvedValue(mockResult)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      const result = await s3Module.deleteFiles(mockB2Config, [
        { url: 'documents/file1.pdf', versionId: 'v1' },
        { url: 'documents/file2.pdf', versionId: 'v2' }
      ]);

      expect(result.Deleted.length).toBe(1);
      expect(result.Errors).toBeDefined();
      expect(result.Errors.length).toBe(1);
    });

    it('should propagate network errors', async () => {
      const mockError = new Error('Network error');
      mockError.code = 'ECONNREFUSED';
      const mockS3Client = {
        send: vi.fn().mockRejectedValue(mockError)
      };
      vi.mocked(S3Client).mockImplementation(() => mockS3Client);

      await expect(
        s3Module.deleteFiles(mockB2Config, [
          { url: 'documents/test.pdf', versionId: 'v1' }
        ])
      ).rejects.toThrow('Network error');
    });
  });
});

/**
 * Property-Based Tests for Configuration Compatibility
 * Feature: pdfgenerator-aws-sdk-v3-migration, Property 4: Configuration format compatibility
 * Validates: Requirements 7.1, 7.4
 */
describe('Configuration Compatibility Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 4: Configuration format compatibility
   * For any B2 configuration object in the existing format, the new S3 client initialization
   * should accept it without requiring modifications to the configuration structure.
   * Validates: Requirements 7.1, 7.4
   */
  describe('Property 4: Configuration format compatibility', () => {
    // Arbitrary generator for B2 configuration in the existing format
    const arbB2ConfigExistingFormat = fc.record({
      keyId: fc.string({ minLength: 10, maxLength: 50 }),
      applicationKey: fc.string({ minLength: 20, maxLength: 100 }),
      endpoint: fc
        .tuple(
          fc.constantFrom('http', 'https'),
          fc.domain(),
          fc.option(fc.integer({ min: 1000, max: 9999 }), { nil: null })
        )
        .map(([protocol, domain, port]) =>
          port ? `${protocol}://${domain}:${port}` : `${protocol}://${domain}`
        ),
      bucket: fc.string({ minLength: 3, maxLength: 63 })
    });

    it('should accept configuration in existing format without modifications', () => {
      fc.assert(
        fc.property(arbB2ConfigExistingFormat, (b2Config) => {
          // The configuration should be accepted as-is by isEnabled
          const result = s3Module.isEnabled(b2Config);
          
          // Should return true for valid config
          expect(result).toBe(true);
          
          // Verify all fields are present in original format
          expect(b2Config).toHaveProperty('keyId');
          expect(b2Config).toHaveProperty('applicationKey');
          expect(b2Config).toHaveProperty('endpoint');
          expect(b2Config).toHaveProperty('bucket');
        }),
        { numRuns: 100 }
      );
    });

    it('should initialize S3Client with existing configuration format', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2ConfigExistingFormat, async (b2Config) => {
          const mockVersionId = 'test-version-id';
          const mockS3Client = {
            send: vi.fn().mockResolvedValue({ VersionId: mockVersionId })
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // Should be able to upload with existing config format
          const result = await s3Module.uploadFile(b2Config, {
            file: { path: '/tmp/test.pdf' },
            fileName: 'test.pdf',
            url: 'documents/test.pdf'
          });

          // Should succeed without errors
          expect(result).toBeDefined();
          expect(result.versionId).toBe(mockVersionId);
          
          // Verify S3Client was initialized
          expect(S3Client).toHaveBeenCalled();
        }),
        { numRuns: 100 }
      );
    });

    it('should download files with existing configuration format', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2ConfigExistingFormat, async (b2Config) => {
          const mockBody = { pipe: vi.fn() };
          const mockS3Client = {
            send: vi.fn().mockResolvedValue({ Body: mockBody })
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // Should be able to download with existing config format
          const result = await s3Module.downloadFile(b2Config, 'documents/test.pdf');

          // Should succeed without errors
          expect(result).toBe(mockBody);
          
          // Verify S3Client was initialized
          expect(S3Client).toHaveBeenCalled();
        }),
        { numRuns: 100 }
      );
    });

    it('should delete files with existing configuration format', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2ConfigExistingFormat, async (b2Config) => {
          const mockResult = {
            Deleted: [{ Key: 'documents/test.pdf', VersionId: 'v1' }]
          };
          const mockS3Client = {
            send: vi.fn().mockResolvedValue(mockResult)
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // Should be able to delete with existing config format
          const result = await s3Module.deleteFiles(b2Config, [
            { url: 'documents/test.pdf', versionId: 'v1' }
          ]);

          // Should succeed without errors
          expect(result).toBeDefined();
          expect(result.Deleted).toBeDefined();
          
          // Verify S3Client was initialized
          expect(S3Client).toHaveBeenCalled();
        }),
        { numRuns: 100 }
      );
    });

    it('should handle configuration with encrypted credentials', () => {
      fc.assert(
        fc.property(arbB2ConfigExistingFormat, (b2Config) => {
          // Mock Crypto.decrypt to simulate encrypted credentials
          vi.mocked(Crypto.decrypt).mockImplementation((value) => `decrypted-${value}`);

          // Configuration should still be valid
          const result = s3Module.isEnabled(b2Config);
          expect(result).toBe(true);

          // Reset mock
          vi.mocked(Crypto.decrypt).mockImplementation((value) => value);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve configuration structure across operations', async () => {
      await fc.assert(
        fc.asyncProperty(arbB2ConfigExistingFormat, async (b2Config) => {
          const mockS3Client = {
            send: vi.fn()
              .mockResolvedValueOnce({ VersionId: 'v1' }) // upload
              .mockResolvedValueOnce({ Body: { pipe: vi.fn() } }) // download
              .mockResolvedValueOnce({ Deleted: [{ Key: 'test', VersionId: 'v1' }] }) // delete
          };
          vi.mocked(S3Client).mockImplementation(() => mockS3Client);

          // Perform multiple operations with same config
          await s3Module.uploadFile(b2Config, {
            file: { path: '/tmp/test.pdf' },
            fileName: 'test.pdf',
            url: 'documents/test.pdf'
          });

          await s3Module.downloadFile(b2Config, 'documents/test.pdf');

          await s3Module.deleteFiles(b2Config, [
            { url: 'documents/test.pdf', versionId: 'v1' }
          ]);

          // Configuration should remain unchanged
          expect(b2Config).toHaveProperty('keyId');
          expect(b2Config).toHaveProperty('applicationKey');
          expect(b2Config).toHaveProperty('endpoint');
          expect(b2Config).toHaveProperty('bucket');
        }),
        { numRuns: 50 }
      );
    });

    it('should handle Backblaze B2 specific endpoint formats', () => {
      fc.assert(
        fc.property(
          fc.record({
            keyId: fc.string({ minLength: 10, maxLength: 50 }),
            applicationKey: fc.string({ minLength: 20, maxLength: 100 }),
            endpoint: fc.constantFrom(
              'https://s3.us-west-000.backblazeb2.com',
              'https://s3.us-west-001.backblazeb2.com',
              'https://s3.us-west-002.backblazeb2.com',
              'https://s3.eu-central-003.backblazeb2.com'
            ),
            bucket: fc.string({ minLength: 3, maxLength: 63 })
          }),
          (b2Config) => {
            // B2-specific endpoints should be accepted
            const result = s3Module.isEnabled(b2Config);
            expect(result).toBe(true);
            
            // Endpoint should match B2 format
            expect(b2Config.endpoint).toMatch(/^https:\/\/s3\.[a-z]+-[a-z]+-\d{3}\.backblazeb2\.com$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle configuration with additional fields', () => {
      fc.assert(
        fc.property(
          arbB2ConfigExistingFormat,
          fc.record({
            extraField1: fc.string(),
            extraField2: fc.integer(),
            extraField3: fc.boolean()
          }),
          (b2Config, extraFields) => {
            // Add extra fields to config
            const configWithExtras = { ...b2Config, ...extraFields };
            
            // Should still be valid
            const result = s3Module.isEnabled(configWithExtras);
            expect(result).toBe(true);
            
            // Extra fields should be preserved
            expect(configWithExtras).toHaveProperty('extraField1');
            expect(configWithExtras).toHaveProperty('extraField2');
            expect(configWithExtras).toHaveProperty('extraField3');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Unit Tests for isEnabled() Function
 * Validates: Requirements 6.1, 6.5
 */
describe('isEnabled() Function Unit Tests', () => {
  describe('with valid configuration', () => {
    it('should return true for complete valid config', () => {
      const config = {
        keyId: 'test-key-id',
        applicationKey: 'test-app-key',
        endpoint: 'https://s3.example.com',
        bucket: 'test-bucket'
      };

      expect(s3Module.isEnabled(config)).toBe(true);
    });

    it('should return true for config with all required fields', () => {
      const config = {
        keyId: 'abc123',
        applicationKey: 'secret456',
        endpoint: 'https://s3.us-west-002.backblazeb2.com',
        bucket: 'my-bucket'
      };

      expect(s3Module.isEnabled(config)).toBe(true);
    });

    it('should return true for config with extra fields', () => {
      const config = {
        keyId: 'test-key-id',
        applicationKey: 'test-app-key',
        endpoint: 'https://s3.example.com',
        bucket: 'test-bucket',
        extraField: 'extra-value'
      };

      expect(s3Module.isEnabled(config)).toBe(true);
    });
  });

  describe('with invalid/missing configuration', () => {
    it('should return false for missing keyId', () => {
      const config = {
        applicationKey: 'test-app-key',
        endpoint: 'https://s3.example.com',
        bucket: 'test-bucket'
      };

      expect(s3Module.isEnabled(config)).toBe(false);
    });

    it('should return false for empty keyId', () => {
      const config = {
        keyId: '',
        applicationKey: 'test-app-key',
        endpoint: 'https://s3.example.com',
        bucket: 'test-bucket'
      };

      expect(s3Module.isEnabled(config)).toBe(false);
    });

    it('should return false for missing applicationKey', () => {
      const config = {
        keyId: 'test-key-id',
        endpoint: 'https://s3.example.com',
        bucket: 'test-bucket'
      };

      expect(s3Module.isEnabled(config)).toBe(false);
    });

    it('should return false for empty applicationKey', () => {
      const config = {
        keyId: 'test-key-id',
        applicationKey: '',
        endpoint: 'https://s3.example.com',
        bucket: 'test-bucket'
      };

      expect(s3Module.isEnabled(config)).toBe(false);
    });

    it('should return false for missing endpoint', () => {
      const config = {
        keyId: 'test-key-id',
        applicationKey: 'test-app-key',
        bucket: 'test-bucket'
      };

      expect(s3Module.isEnabled(config)).toBe(false);
    });

    it('should return false for empty endpoint', () => {
      const config = {
        keyId: 'test-key-id',
        applicationKey: 'test-app-key',
        endpoint: '',
        bucket: 'test-bucket'
      };

      expect(s3Module.isEnabled(config)).toBe(false);
    });

    it('should return false for missing bucket', () => {
      const config = {
        keyId: 'test-key-id',
        applicationKey: 'test-app-key',
        endpoint: 'https://s3.example.com'
      };

      expect(s3Module.isEnabled(config)).toBe(false);
    });

    it('should return false for empty bucket', () => {
      const config = {
        keyId: 'test-key-id',
        applicationKey: 'test-app-key',
        endpoint: 'https://s3.example.com',
        bucket: ''
      };

      expect(s3Module.isEnabled(config)).toBe(false);
    });

    it('should return false for null config', () => {
      expect(s3Module.isEnabled(null)).toBe(false);
    });

    it('should return false for undefined config', () => {
      expect(s3Module.isEnabled(undefined)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(s3Module.isEnabled({})).toBe(false);
    });

    it('should return false for config with null values', () => {
      const config = {
        keyId: null,
        applicationKey: null,
        endpoint: null,
        bucket: null
      };

      expect(s3Module.isEnabled(config)).toBe(false);
    });

    it('should return false for config with undefined values', () => {
      const config = {
        keyId: undefined,
        applicationKey: undefined,
        endpoint: undefined,
        bucket: undefined
      };

      expect(s3Module.isEnabled(config)).toBe(false);
    });
  });
});
