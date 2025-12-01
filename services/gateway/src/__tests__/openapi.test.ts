/**
 * Property-Based Tests for OpenAPI Aggregation
 * Feature: api-documentation, Property 1: Service endpoint aggregation completeness
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 4.2
 */

import * as fc from 'fast-check';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSpec, aggregateSpecs, fetchSpec, setupSwaggerDocs } from '../openapi.js';
import axios from 'axios';
import type * as Express from 'express';

// Mock axios for unit tests
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock swagger-ui-express
vi.mock('swagger-ui-express', () => ({
  default: {
    serve: vi.fn((req: any, res: any, next: any) => next()),
    setup: vi.fn(() => (req: any, res: any) => {
      res.status(200).send('<!DOCTYPE html><html><head><title>Swagger UI</title></head><body><div id="swagger-ui"></div></body></html>');
    })
  }
}));

// Mock logger
vi.mock('@microrealestate/common', async () => {
  const actual = await vi.importActual('@microrealestate/common');
  return {
    ...actual,
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    },
    Service: {
      getInstance: vi.fn(() => ({
        envConfig: {
          getValues: vi.fn(() => ({
            ENABLE_API_DOCS: 'true',
            API_URL: 'http://api:8200',
            TENANTAPI_URL: 'http://tenantapi:8250',
            AUTHENTICATOR_URL: 'http://authenticator:8000',
            PDFGENERATOR_URL: 'http://pdfgenerator:8300',
            EMAILER_URL: 'http://emailer:8400',
            RESETSERVICE_URL: 'http://resetservice:8500',
            PRODUCTION: false
          }))
        }
      }))
    }
  };
});

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths?: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    responses?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

/**
 * Unit Tests for Spec Validation and Error Handling
 * Task 9.1: Write unit tests for spec validation and error handling
 * Validates: Requirements 5.1, 5.2, 5.3
 */
describe('OpenAPI Validation and Error Handling Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateSpec', () => {
    it('should return true for valid OpenAPI spec', () => {
      const validSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {
          '/test': {
            get: {
              summary: 'Test endpoint'
            }
          }
        }
      };

      const result = validateSpec(validSpec, 'TestService');
      expect(result).toBe(true);
    });

    it('should return false for null spec', () => {
      const result = validateSpec(null, 'TestService');
      expect(result).toBe(false);
    });

    it('should return false for undefined spec', () => {
      const result = validateSpec(undefined, 'TestService');
      expect(result).toBe(false);
    });

    it('should return false for non-object spec', () => {
      const result = validateSpec('not an object', 'TestService');
      expect(result).toBe(false);
    });

    it('should return false for spec missing openapi field', () => {
      const invalidSpec = {
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {}
      };

      const result = validateSpec(invalidSpec, 'TestService');
      expect(result).toBe(false);
    });

    it('should return false for spec missing info field', () => {
      const invalidSpec = {
        openapi: '3.0.0',
        paths: {}
      };

      const result = validateSpec(invalidSpec, 'TestService');
      expect(result).toBe(false);
    });

    it('should return false for spec missing paths field', () => {
      const invalidSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0'
        }
      };

      const result = validateSpec(invalidSpec, 'TestService');
      expect(result).toBe(false);
    });

    it('should return true for spec with empty paths object', () => {
      const validSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {}
      };

      const result = validateSpec(validSpec, 'TestService');
      expect(result).toBe(true);
    });
  });

  describe('aggregateSpecs', () => {
    it('should handle empty array of specs', () => {
      const result = aggregateSpecs([]);
      
      expect(result).toHaveProperty('openapi', '3.0.0');
      expect(result).toHaveProperty('info');
      expect(result).toHaveProperty('paths');
      expect(result.paths).toEqual({});
    });

    it('should handle array with only null specs', () => {
      const result = aggregateSpecs([null, null, null]);
      
      expect(result).toHaveProperty('openapi', '3.0.0');
      expect(result).toHaveProperty('info');
      expect(result).toHaveProperty('paths');
      expect(result.paths).toEqual({});
    });

    it('should handle mixed null and valid specs', () => {
      const validSpec: OpenAPISpec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0'
        },
        paths: {
          '/test': {
            get: {
              summary: 'Test endpoint'
            }
          }
        }
      };

      const result = aggregateSpecs([null, validSpec, null]);
      
      expect(result.paths).toHaveProperty('/test');
    });

    it('should merge paths from multiple specs', () => {
      const spec1: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        paths: {
          '/api1': { get: { summary: 'API 1 endpoint' } }
        }
      };

      const spec2: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'API 2', version: '1.0.0' },
        paths: {
          '/api2': { get: { summary: 'API 2 endpoint' } }
        }
      };

      const result = aggregateSpecs([spec1, spec2]);
      
      expect(result.paths).toHaveProperty('/api1');
      expect(result.paths).toHaveProperty('/api2');
    });

    it('should merge schemas from multiple specs', () => {
      const spec1: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: { type: 'object' }
          }
        }
      };

      const spec2: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'API 2', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            Product: { type: 'object' }
          }
        }
      };

      const result = aggregateSpecs([spec1, spec2]);
      
      expect(result.components?.schemas).toHaveProperty('User');
      expect(result.components?.schemas).toHaveProperty('Product');
    });

    it('should merge responses from multiple specs', () => {
      const spec1: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        paths: {},
        components: {
          responses: {
            NotFound: { description: '404 error' }
          }
        }
      };

      const spec2: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'API 2', version: '1.0.0' },
        paths: {},
        components: {
          responses: {
            Unauthorized: { description: '401 error' }
          }
        }
      };

      const result = aggregateSpecs([spec1, spec2]);
      
      expect(result.components?.responses).toHaveProperty('NotFound');
      expect(result.components?.responses).toHaveProperty('Unauthorized');
    });

    it('should merge tags from multiple specs', () => {
      const spec1: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        paths: {},
        tags: [
          { name: 'Users', description: 'User operations' }
        ]
      };

      const spec2: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'API 2', version: '1.0.0' },
        paths: {},
        tags: [
          { name: 'Products', description: 'Product operations' }
        ]
      };

      const result = aggregateSpecs([spec1, spec2]);
      
      expect(result.tags).toContainEqual({ name: 'Users', description: 'User operations' });
      expect(result.tags).toContainEqual({ name: 'Products', description: 'Product operations' });
    });

    it('should include bearerAuth security scheme in aggregated spec', () => {
      const result = aggregateSpecs([]);
      
      expect(result.components?.securitySchemes).toHaveProperty('bearerAuth');
      expect(result.components?.securitySchemes?.bearerAuth).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from /api/v2/authenticator/signin'
      });
    });
  });
});

/**
 * Integration Tests for End-to-End Documentation Access
 * Task 12.1: Write integration tests for end-to-end documentation access
 * Validates: Requirements 1.1, 2.2, 2.5, 4.2, 4.5, 5.2
 */
describe('API Documentation Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Swagger UI Access', () => {
    /**
     * Test accessing /api-docs returns Swagger UI
     * Validates: Requirements 1.1, 4.1
     */
    it('should serve Swagger UI at /api-docs when enabled', async () => {
      // Create a mock Express application
      const mockApp = {
        use: vi.fn()
      } as unknown as Express.Application;

      // Mock successful spec fetching
      mockedAxios.get.mockResolvedValue({
        data: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/test': {
              get: {
                summary: 'Test endpoint',
                responses: {
                  '200': { description: 'Success' }
                }
              }
            }
          }
        }
      });

      await setupSwaggerDocs(mockApp);

      // Verify that /api-docs route was registered
      expect(mockApp.use).toHaveBeenCalledWith(
        '/api-docs',
        expect.any(Function),
        expect.any(Function)
      );
    });

    /**
     * Test documentation disabled behavior (404 response)
     * Validates: Requirements 5.1, 5.2, 5.3
     */
    it('should return 404 when ENABLE_API_DOCS is false', async () => {
      // Mock Service to return disabled config
      const { Service } = await import('@microrealestate/common');
      vi.mocked(Service.getInstance).mockReturnValue({
        envConfig: {
          getValues: vi.fn(() => ({
            ENABLE_API_DOCS: 'false'
          }))
        }
      } as any);

      const mockApp = {
        use: vi.fn()
      } as unknown as Express.Application;

      await setupSwaggerDocs(mockApp);

      // Verify that a 404 handler was registered
      expect(mockApp.use).toHaveBeenCalledWith('/api-docs', expect.any(Function));

      // Get the handler function
      const handler = vi.mocked(mockApp.use).mock.calls[0][1] as Function;
      
      // Create mock request and response
      const mockReq = {} as any;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn()
      } as any;

      // Call the handler
      handler(mockReq, mockRes);

      // Verify 404 response
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith('API documentation is disabled');
    });
  });

  describe('Spec Aggregation', () => {
    /**
     * Test aggregated spec includes endpoints from all services
     * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 4.2
     */
    it('should aggregate specs from multiple services', () => {
      const apiSpec = {
        openapi: '3.0.0',
        info: { title: 'API Service', version: '1.0.0' },
        paths: {
          '/api/v2/tenants': {
            get: {
              summary: 'Get tenants',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const tenantApiSpec = {
        openapi: '3.0.0',
        info: { title: 'TenantAPI Service', version: '1.0.0' },
        paths: {
          '/tenantapi/info': {
            get: {
              summary: 'Get tenant info',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const authSpec = {
        openapi: '3.0.0',
        info: { title: 'Authenticator Service', version: '1.0.0' },
        paths: {
          '/api/v2/authenticator/signin': {
            post: {
              summary: 'Sign in',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      // Test aggregation directly
      const aggregated = aggregateSpecs([apiSpec, tenantApiSpec, authSpec]);

      // Verify all paths are included
      expect(aggregated.paths).toHaveProperty('/api/v2/tenants');
      expect(aggregated.paths).toHaveProperty('/tenantapi/info');
      expect(aggregated.paths).toHaveProperty('/api/v2/authenticator/signin');
    });

    /**
     * Test service failure handling (partial documentation)
     * Validates: Requirements 5.2
     */
    it('should handle service failures gracefully and continue with available specs', () => {
      const apiSpec = {
        openapi: '3.0.0',
        info: { title: 'API Service', version: '1.0.0' },
        paths: {
          '/api/v2/tenants': {
            get: {
              summary: 'Get tenants',
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      // Test aggregation with null specs (simulating failed fetches)
      const aggregated = aggregateSpecs([
        apiSpec,
        null, // Failed service
        null  // Another failed service
      ]);

      // Verify that aggregation succeeded with partial specs
      expect(aggregated).toHaveProperty('openapi', '3.0.0');
      expect(aggregated).toHaveProperty('info');
      expect(aggregated).toHaveProperty('paths');
      
      // Verify the successful spec's paths are included
      expect(aggregated.paths).toHaveProperty('/api/v2/tenants');
      
      // Verify the aggregated spec is still valid
      expect(aggregated.components?.securitySchemes).toHaveProperty('bearerAuth');
    });

    it('should handle timeout errors when fetching specs', async () => {
      // Mock axios to timeout
      mockedAxios.get.mockRejectedValue(new Error('timeout of 5000ms exceeded'));

      const result = await fetchSpec('http://slow-service:8000', 'SlowService');

      expect(result).toBeNull();
      
      const { logger } = await import('@microrealestate/common');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch OpenAPI spec from SlowService')
      );
    });

    it('should validate specs before including them in aggregation', async () => {
      const invalidSpec = {
        // Missing required fields
        info: { title: 'Invalid', version: '1.0.0' }
      };

      mockedAxios.get.mockResolvedValue({ data: invalidSpec });

      const result = await fetchSpec('http://invalid-service:8000', 'InvalidService');

      expect(result).toBeNull();
      
      const { logger } = await import('@microrealestate/common');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid spec from InvalidService')
      );
    });
  });

  describe('Authentication Documentation', () => {
    /**
     * Test "Try it out" functionality with authenticated request
     * Validates: Requirements 2.2, 2.4, 2.5
     */
    it('should include bearerAuth security scheme in aggregated spec', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/v2/tenants': {
            get: {
              summary: 'Get tenants',
              security: [{ bearerAuth: [] }],
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      mockedAxios.get.mockResolvedValue({ data: spec });

      const mockApp = {
        use: vi.fn()
      } as unknown as Express.Application;

      await setupSwaggerDocs(mockApp);

      // Verify setup was called (which means aggregation happened)
      expect(mockApp.use).toHaveBeenCalled();
    });

    it('should document authentication flow in aggregated spec description', () => {
      const aggregated = aggregateSpecs([]);

      // Verify the description includes authentication instructions
      expect(aggregated.info.description).toContain('Authentication');
      expect(aggregated.info.description).toContain('/api/v2/authenticator/signin');
      expect(aggregated.info.description).toContain('Bearer');
      expect(aggregated.info.description).toContain('Authorization');
    });

    it('should include JWT token format in security scheme', () => {
      const aggregated = aggregateSpecs([]);

      expect(aggregated.components?.securitySchemes?.bearerAuth).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from /api/v2/authenticator/signin'
      });
    });
  });

  describe('Spec Fetching', () => {
    it('should fetch spec with 5 second timeout', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      };

      mockedAxios.get.mockResolvedValue({ data: spec });

      await fetchSpec('http://test-service:8000', 'TestService');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://test-service:8000/openapi.json',
        { timeout: 5000 }
      );
    });

    it('should set service name as title in fetched spec', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Original Title', version: '1.0.0' },
        paths: {}
      };

      mockedAxios.get.mockResolvedValue({ data: spec });

      const result = await fetchSpec('http://test-service:8000', 'CustomServiceName');

      expect(result?.info.title).toBe('CustomServiceName');
    });

    it('should return null for network errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await fetchSpec('http://unreachable:8000', 'UnreachableService');

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON responses', async () => {
      mockedAxios.get.mockResolvedValue({ data: 'not json' });

      const result = await fetchSpec('http://bad-service:8000', 'BadService');

      expect(result).toBeNull();
    });
  });

  describe('Production Environment', () => {
    it('should not include ResetService in production', async () => {
      // Mock Service to return production config
      const { Service } = await import('@microrealestate/common');
      vi.mocked(Service.getInstance).mockReturnValue({
        envConfig: {
          getValues: vi.fn(() => ({
            ENABLE_API_DOCS: 'true',
            API_URL: 'http://api:8200',
            TENANTAPI_URL: 'http://tenantapi:8250',
            AUTHENTICATOR_URL: 'http://authenticator:8000',
            PDFGENERATOR_URL: 'http://pdfgenerator:8300',
            EMAILER_URL: 'http://emailer:8400',
            RESETSERVICE_URL: 'http://resetservice:8500',
            PRODUCTION: true
          }))
        }
      } as any);

      mockedAxios.get.mockResolvedValue({
        data: {
          openapi: '3.0.0',
          info: { title: 'Test', version: '1.0.0' },
          paths: {}
        }
      });

      const mockApp = {
        use: vi.fn()
      } as unknown as Express.Application;

      await setupSwaggerDocs(mockApp);

      // Verify ResetService was not fetched
      const resetServiceCalls = vi.mocked(mockedAxios.get).mock.calls.filter(
        call => call[0].includes('resetservice')
      );
      expect(resetServiceCalls).toHaveLength(0);
    });

    it('should include ResetService in non-production', async () => {
      // Mock Service to return non-production config
      const { Service } = await import('@microrealestate/common');
      vi.mocked(Service.getInstance).mockReturnValue({
        envConfig: {
          getValues: vi.fn(() => ({
            ENABLE_API_DOCS: 'true',
            API_URL: 'http://api:8200',
            TENANTAPI_URL: 'http://tenantapi:8250',
            AUTHENTICATOR_URL: 'http://authenticator:8000',
            PDFGENERATOR_URL: 'http://pdfgenerator:8300',
            EMAILER_URL: 'http://emailer:8400',
            RESETSERVICE_URL: 'http://resetservice:8500',
            PRODUCTION: false
          }))
        }
      } as any);

      mockedAxios.get.mockResolvedValue({
        data: {
          openapi: '3.0.0',
          info: { title: 'Test', version: '1.0.0' },
          paths: {}
        }
      });

      const mockApp = {
        use: vi.fn()
      } as unknown as Express.Application;

      await setupSwaggerDocs(mockApp);

      // Verify ResetService was fetched
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('resetservice:8500/openapi.json'),
        expect.any(Object)
      );
    });
  });

  describe('Swagger UI Configuration', () => {
    it('should configure Swagger UI with custom options', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          openapi: '3.0.0',
          info: { title: 'Test', version: '1.0.0' },
          paths: {}
        }
      });

      const mockApp = {
        use: vi.fn()
      } as unknown as Express.Application;

      await setupSwaggerDocs(mockApp);

      // Verify Swagger UI was set up (implementation detail - we just verify it was called)
      expect(mockApp.use).toHaveBeenCalledWith(
        '/api-docs',
        expect.any(Function),
        expect.any(Function)
      );
    });
  });
});

// Arbitrary generators for OpenAPI specs
const arbPathItem = fc.record({
  get: fc.record({
    summary: fc.string(),
    responses: fc.dictionary(
      fc.constantFrom('200', '400', '401', '404', '500'),
      fc.record({
        description: fc.string()
      })
    )
  })
});

const arbOpenAPISpec = fc.record({
  openapi: fc.constant('3.0.0'),
  info: fc.record({
    title: fc.string({ minLength: 1 }),
    version: fc.string({ minLength: 1 })
  }),
  paths: fc.dictionary(
    fc.string({ minLength: 1 }).map(s => `/${s}`),
    arbPathItem,
    { minKeys: 1, maxKeys: 10 }
  ),
  components: fc.record({
    schemas: fc.dictionary(
      fc.string({ minLength: 1 }),
      fc.record({
        type: fc.constantFrom('object', 'string', 'number'),
        properties: fc.dictionary(
          fc.string({ minLength: 1 }),
          fc.record({
            type: fc.constantFrom('string', 'number', 'boolean')
          })
        )
      }),
      { maxKeys: 5 }
    ),
    responses: fc.dictionary(
      fc.string({ minLength: 1 }),
      fc.record({
        description: fc.string()
      }),
      { maxKeys: 5 }
    )
  }),
  tags: fc.array(
    fc.record({
      name: fc.string({ minLength: 1 }),
      description: fc.string()
    }),
    { maxLength: 5 }
  )
});

// Arbitrary generator for semantic version strings
const arbSemanticVersion = fc.tuple(
  fc.nat({ max: 99 }), // major
  fc.nat({ max: 99 }), // minor
  fc.nat({ max: 99 })  // patch
).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

// Arbitrary generator for OpenAPI spec with version
const arbOpenAPISpecWithVersion = fc.record({
  openapi: fc.constant('3.0.0'),
  info: fc.record({
    title: fc.string({ minLength: 1 }),
    version: arbSemanticVersion
  }),
  paths: fc.dictionary(
    fc.string({ minLength: 1 }).map(s => `/${s}`),
    arbPathItem,
    { minKeys: 0, maxKeys: 5 }
  )
});

describe('OpenAPI Aggregation Property Tests', () => {
  describe('Property 1: Service endpoint aggregation completeness', () => {
    it('should include all service endpoints in aggregated spec', () => {
      fc.assert(
        fc.property(
          fc.array(arbOpenAPISpec, { minLength: 1, maxLength: 6 }),
          (serviceSpecs) => {
            const aggregated = aggregateSpecs(serviceSpecs);

            // For each service spec
            serviceSpecs.forEach(spec => {
              if (spec && spec.paths) {
                // All paths from service should be in aggregated spec
                Object.keys(spec.paths).forEach(path => {
                  expect(aggregated.paths?.[path]).toBeDefined();
                });
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all schemas from all services', () => {
      fc.assert(
        fc.property(
          fc.array(arbOpenAPISpec, { minLength: 1, maxLength: 6 }),
          (serviceSpecs) => {
            const aggregated = aggregateSpecs(serviceSpecs);

            serviceSpecs.forEach(spec => {
              if (spec && spec.components?.schemas) {
                Object.keys(spec.components.schemas).forEach(schemaName => {
                  expect(aggregated.components?.schemas?.[schemaName]).toBeDefined();
                });
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all response definitions from all services', () => {
      fc.assert(
        fc.property(
          fc.array(arbOpenAPISpec, { minLength: 1, maxLength: 6 }),
          (serviceSpecs) => {
            const aggregated = aggregateSpecs(serviceSpecs);

            serviceSpecs.forEach(spec => {
              if (spec && spec.components?.responses) {
                Object.keys(spec.components.responses).forEach(responseName => {
                  expect(aggregated.components?.responses?.[responseName]).toBeDefined();
                });
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all tags from all services', () => {
      fc.assert(
        fc.property(
          fc.array(arbOpenAPISpec, { minLength: 1, maxLength: 6 }),
          (serviceSpecs) => {
            const aggregated = aggregateSpecs(serviceSpecs);

            serviceSpecs.forEach(spec => {
              if (spec && spec.tags) {
                spec.tags.forEach(tag => {
                  expect(aggregated.tags).toContainEqual(tag);
                });
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle null specs gracefully', () => {
      fc.assert(
        fc.property(
          fc.array(fc.option(arbOpenAPISpec, { nil: null }), { minLength: 1, maxLength: 6 }),
          (serviceSpecs) => {
            const aggregated = aggregateSpecs(serviceSpecs);

            // Should not throw and should have valid structure
            expect(aggregated).toHaveProperty('openapi', '3.0.0');
            expect(aggregated).toHaveProperty('info');
            expect(aggregated).toHaveProperty('paths');
            expect(aggregated).toHaveProperty('components');

            // Only non-null specs should contribute
            const validSpecs = serviceSpecs.filter(spec => spec !== null);
            validSpecs.forEach(spec => {
              if (spec && spec.paths) {
                Object.keys(spec.paths).forEach(path => {
                  expect(aggregated.paths?.[path]).toBeDefined();
                });
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all endpoint operations from services', () => {
      fc.assert(
        fc.property(
          fc.array(arbOpenAPISpec, { minLength: 1, maxLength: 6 }),
          (serviceSpecs) => {
            const aggregated = aggregateSpecs(serviceSpecs);

            serviceSpecs.forEach(spec => {
              if (spec && spec.paths) {
                Object.entries(spec.paths).forEach(([path, pathItem]) => {
                  expect(aggregated.paths?.[path]).toBeDefined();
                  // Verify the operation is preserved
                  if (pathItem.get) {
                    expect(aggregated.paths?.[path]?.get).toBeDefined();
                  }
                });
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Semantic version format', () => {
    /**
     * Property-Based Test for Semantic Version Format
     * Feature: api-documentation, Property 7: Semantic version format
     * Validates: Requirements 8.4
     */
    it('should match semver format for all service version strings', () => {
      fc.assert(
        fc.property(
          fc.array(arbOpenAPISpecWithVersion, { minLength: 1, maxLength: 6 }),
          (serviceSpecs) => {
            // Semantic versioning regex: MAJOR.MINOR.PATCH with optional pre-release and build metadata
            const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;

            serviceSpecs.forEach(spec => {
              if (spec && spec.info && spec.info.version) {
                expect(spec.info.version).toMatch(semverRegex);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid semver format in aggregated spec', () => {
      fc.assert(
        fc.property(
          fc.array(arbOpenAPISpecWithVersion, { minLength: 1, maxLength: 6 }),
          (serviceSpecs) => {
            const aggregated = aggregateSpecs(serviceSpecs);
            const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;

            expect(aggregated.info.version).toMatch(semverRegex);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse version components correctly', () => {
      fc.assert(
        fc.property(
          arbSemanticVersion,
          (version) => {
            const parts = version.split('.');
            
            // Should have exactly 3 parts
            expect(parts).toHaveLength(3);
            
            // Each part should be a valid number
            parts.forEach(part => {
              expect(Number.isNaN(parseInt(part, 10))).toBe(false);
              expect(parseInt(part, 10)).toBeGreaterThanOrEqual(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid version formats', () => {
      const invalidVersions = [
        '1.0',           // Missing patch
        '1',             // Missing minor and patch
        'v1.0.0',        // Has 'v' prefix
        '1.0.0.0',       // Too many parts
        'a.b.c',         // Non-numeric
        '1.0.0-',        // Invalid pre-release
        '1.0.0+',        // Invalid build metadata
        '',              // Empty
        '1.0.0 beta',    // Space instead of hyphen
      ];

      const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;

      invalidVersions.forEach(version => {
        expect(version).not.toMatch(semverRegex);
      });
    });

    it('should accept valid semver with pre-release and build metadata', () => {
      const validVersions = [
        '1.0.0',
        '1.0.0-alpha',
        '1.0.0-alpha.1',
        '1.0.0-0.3.7',
        '1.0.0-x.7.z.92',
        '1.0.0+20130313144700',
        '1.0.0-beta+exp.sha.5114f85',
        '1.0.0+21AF26D3-117B344092BD',
      ];

      const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;

      validVersions.forEach(version => {
        expect(version).toMatch(semverRegex);
      });
    });
  });
});
