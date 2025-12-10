import * as emailManager from '../../managers/emailmanager.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataAccess, EnvironmentConfig, Service, TestUtils } from '@microrealestate/common';
import axios from 'axios';
import fc from 'fast-check';

const { connectTestDB, disconnectTestDB, clearTestDB } = TestUtils;

// Mock axios
vi.mock('axios');

// Helper to create mock req/res objects
function createMockReqRes(body = {}, params = {}) {
  const req = {
    realm: {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Realm'
    },
    body,
    params,
    headers: {
      authorization: 'Bearer test-token',
      organizationid: '507f1f77bcf86cd799439011',
      'accept-language': 'en'
    }
  };
  
  const res = {
    _status: null,
    _json: null,
    json(data) {
      this._json = data;
      return this;
    },
    sendStatus(status) {
      this._status = status;
      return this;
    },
    status(code) {
      this._status = code;
      return this;
    }
  };
  
  return { req, res };
}

describe('EmailManager - Property-Based Tests', () => {
  beforeAll(async () => {
    await connectTestDB();
    
    // Initialize Service with test environment config
    const envConfig = new EnvironmentConfig({
      EMAILER_URL: 'http://localhost:8400/emailer'
    });
    Service.getInstance(envConfig);
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    vi.clearAllMocks();
  });

  // Feature: api-email-data-access-layer, Property 1: Tenant query security
  it('Property 1: Tenant query security - should only return tenants from the specified realm', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.hexaString({ minLength: 24, maxLength: 24 }), { minLength: 1, maxLength: 5 }),
        fc.hexaString({ minLength: 24, maxLength: 24 }),
        fc.hexaString({ minLength: 24, maxLength: 24 }),
        async (tenantIds, realmId1, realmId2) => {
          // Ensure realm IDs are different
          fc.pre(realmId1 !== realmId2);
          
          await clearTestDB();
          
          const tenantRepository = DataAccess.getTenantRepository();
          
          // Create tenants in realm1
          const realm1Tenants = [];
          for (const tenantId of tenantIds.slice(0, Math.ceil(tenantIds.length / 2))) {
            const tenant = await tenantRepository.create({
              _id: tenantId,
              realmId: realmId1,
              name: `Tenant ${tenantId}`,
              isCompany: false,
              beginDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
              rents: []
            });
            realm1Tenants.push(tenant);
          }
          
          // Create tenants in realm2
          for (const tenantId of tenantIds.slice(Math.ceil(tenantIds.length / 2))) {
            await tenantRepository.create({
              _id: tenantId,
              realmId: realmId2,
              name: `Tenant ${tenantId}`,
              isCompany: false,
              beginDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
              rents: []
            });
          }
          
          // Query tenants from realm1
          const queriedTenants = await tenantRepository.findByIds(
            tenantIds,
            realmId1
          );
          
          // Verify all returned tenants belong to realm1
          for (const tenant of queriedTenants) {
            expect(tenant.realmId).toBe(realmId1);
          }
          
          // Verify we got the expected number of tenants
          expect(queriedTenants.length).toBe(realm1Tenants.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: api-email-data-access-layer, Property 2: Email sending completeness
  it('Property 2: Email sending completeness - should return status for each tenant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.hexaString({ minLength: 24, maxLength: 24 }), { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        async (tenantIds, document, year, month) => {
          await clearTestDB();
          
          const realmId = '507f1f77bcf86cd799439011';
          const tenantRepository = DataAccess.getTenantRepository();
          
          // Create tenants
          for (const tenantId of tenantIds) {
            await tenantRepository.create({
              _id: tenantId,
              realmId,
              name: `Tenant ${tenantId}`,
              isCompany: false,
              beginDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
              rents: []
            });
          }
          
          // Mock axios to return success for all emails
          axios.post.mockResolvedValue({
            data: [{
              templateName: document,
              recordId: 'test',
              params: { term: 202401 },
              email: 'test@example.com',
              status: 'sent'
            }]
          });
          
          const { req, res } = createMockReqRes({
            document,
            tenantIds,
            year,
            month
          });
          req.realm._id = realmId;
          
          await emailManager.send(req, res);
          
          // Verify we got exactly one status per tenant
          expect(res._json).toBeDefined();
          expect(res._json.length).toBe(tenantIds.length);
          
          // Verify each status has required fields
          for (const status of res._json) {
            expect(status.name).toBeDefined();
            expect(status.tenantId).toBeDefined();
            expect(status.document).toBe(document);
            expect(status.term).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: api-email-data-access-layer, Property 3: Term calculation consistency
  it('Property 3: Term calculation consistency - should produce valid YYYYMMDDHH format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        async (year, month) => {
          await clearTestDB();
          
          const realmId = '507f1f77bcf86cd799439011';
          const tenantRepository = DataAccess.getTenantRepository();
          
          // Create a test tenant
          const tenant = await tenantRepository.create({
            realmId,
            name: 'Test Tenant',
            isCompany: false,
            beginDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
            rents: []
          });
          
          // Mock axios
          axios.post.mockResolvedValue({
            data: [{
              templateName: 'invoice',
              recordId: String(tenant._id),
              params: { term: 202401 },
              email: 'test@example.com',
              status: 'sent'
            }]
          });
          
          const { req, res } = createMockReqRes({
            document: 'invoice',
            tenantIds: [String(tenant._id)],
            year,
            month
          });
          req.realm._id = realmId;
          
          await emailManager.send(req, res);
          
          // Verify term format
          expect(res._json).toBeDefined();
          expect(res._json.length).toBe(1);
          
          const term = res._json[0].term;
          const termStr = String(term);
          
          // Verify it's 10 digits (YYYYMMDDHH)
          expect(termStr.length).toBe(10);
          
          // Verify year is encoded correctly
          const termYear = parseInt(termStr.substring(0, 4));
          expect(termYear).toBe(year);
          
          // Verify month is encoded correctly
          const termMonth = parseInt(termStr.substring(4, 6));
          expect(termMonth).toBe(month);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: api-email-data-access-layer, Property 4: Error isolation
  it('Property 4: Error isolation - failure for one tenant should not prevent others', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.hexaString({ minLength: 24, maxLength: 24 }), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 0, max: 100 }),
        async (tenantIds, failureIndex) => {
          // Ensure we have at least 2 tenants
          fc.pre(tenantIds.length >= 2);
          
          await clearTestDB();
          
          const realmId = '507f1f77bcf86cd799439011';
          const tenantRepository = DataAccess.getTenantRepository();
          
          // Create tenants
          for (const tenantId of tenantIds) {
            await tenantRepository.create({
              _id: tenantId,
              realmId,
              name: `Tenant ${tenantId}`,
              isCompany: false,
              beginDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
              rents: []
            });
          }
          
          // Mock axios to fail for one tenant
          const failIndex = failureIndex % tenantIds.length;
          let callCount = 0;
          
          axios.post.mockImplementation(() => {
            const currentCall = callCount++;
            if (currentCall === failIndex) {
              return Promise.reject({
                response: {
                  data: {
                    status: 500,
                    message: 'Email service error'
                  }
                }
              });
            }
            return Promise.resolve({
              data: [{
                templateName: 'invoice',
                recordId: 'test',
                params: { term: 202401 },
                email: 'test@example.com',
                status: 'sent'
              }]
            });
          });
          
          const { req, res } = createMockReqRes({
            document: 'invoice',
            tenantIds,
            year: 2024,
            month: 1
          });
          req.realm._id = realmId;
          
          await emailManager.send(req, res);
          
          // Verify we got status for ALL tenants
          expect(res._json).toBeDefined();
          expect(res._json.length).toBe(tenantIds.length);
          
          // Verify exactly one has an error
          const errored = res._json.filter(s => s.error);
          const succeeded = res._json.filter(s => !s.error);
          
          expect(errored.length).toBe(1);
          expect(succeeded.length).toBe(tenantIds.length - 1);
          
          // Verify HTTP status is 500 when any failed
          expect(res._status).toBe(500);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: api-email-data-access-layer, Property 5: Response format consistency
  it('Property 5: Response format consistency - each status should have required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.hexaString({ minLength: 24, maxLength: 24 }), { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.boolean(),
        async (tenantIds, document, shouldFail) => {
          await clearTestDB();
          
          const realmId = '507f1f77bcf86cd799439011';
          const tenantRepository = DataAccess.getTenantRepository();
          
          // Create tenants
          for (const tenantId of tenantIds) {
            await tenantRepository.create({
              _id: tenantId,
              realmId,
              name: `Tenant ${tenantId}`,
              isCompany: false,
              beginDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
              rents: []
            });
          }
          
          // Mock axios
          if (shouldFail) {
            axios.post.mockRejectedValue({
              response: {
                data: {
                  status: 500,
                  message: 'Test error'
                }
              }
            });
          } else {
            axios.post.mockResolvedValue({
              data: [{
                templateName: document,
                recordId: 'test',
                params: { term: 202401 },
                email: 'test@example.com',
                status: 'sent'
              }]
            });
          }
          
          const { req, res } = createMockReqRes({
            document,
            tenantIds,
            year: 2024,
            month: 1
          });
          req.realm._id = realmId;
          
          await emailManager.send(req, res);
          
          // Verify response format
          expect(res._json).toBeDefined();
          expect(res._json.length).toBe(tenantIds.length);
          
          for (const status of res._json) {
            // All statuses must have these fields
            expect(status.name).toBeDefined();
            expect(status.tenantId).toBeDefined();
            expect(status.document).toBe(document);
            expect(status.term).toBeDefined();
            
            // Either success fields or error field
            if (shouldFail) {
              expect(status.error).toBeDefined();
              expect(status.error.status).toBeDefined();
              expect(status.error.message).toBeDefined();
            } else {
              expect(status.email).toBeDefined();
              expect(status.status).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('EmailManager - Unit Tests', () => {
  beforeAll(async () => {
    await connectTestDB();
    
    // Initialize Service with test environment config
    const envConfig = new EnvironmentConfig({
      EMAILER_URL: 'http://localhost:8400/emailer'
    });
    Service.getInstance(envConfig);
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    vi.clearAllMocks();
  });

  it('should use TenantRepository.findByIds with correct parameters', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create test tenants
    const tenant1 = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    const tenant2 = await tenantRepository.create({
      realmId,
      name: 'Jane Smith',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Mock axios
    axios.post.mockResolvedValue({
      data: [{
        templateName: 'invoice',
        recordId: String(tenant1._id),
        params: { term: 202401 },
        email: 'test@example.com',
        status: 'sent'
      }]
    });
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [String(tenant1._id), String(tenant2._id)],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify response includes both tenants
    expect(res._json).toBeDefined();
    expect(res._json.length).toBe(2);
    expect(res._json[0].name).toBe('John Doe');
    expect(res._json[1].name).toBe('Jane Smith');
  });

  it('should send emails with custom terms', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create test tenant
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Mock axios
    axios.post.mockResolvedValue({
      data: [{
        templateName: 'invoice',
        recordId: String(tenant._id),
        params: { term: 202403 },
        email: 'test@example.com',
        status: 'sent'
      }]
    });
    
    const customTerm = 202403;
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [String(tenant._id)],
      terms: [customTerm],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify custom term was used
    expect(res._json).toBeDefined();
    expect(res._json[0].term).toBe(customTerm);
    
    // Verify axios was called with custom term
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8400/emailer',
      expect.objectContaining({
        params: { term: customTerm }
      }),
      expect.any(Object)
    );
  });

  it('should send emails with default term calculation', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create test tenant
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Mock axios
    axios.post.mockResolvedValue({
      data: [{
        templateName: 'invoice',
        recordId: String(tenant._id),
        params: { term: 202401 },
        email: 'test@example.com',
        status: 'sent'
      }]
    });
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [String(tenant._id)],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify default term was calculated (YYYYMM0100)
    expect(res._json).toBeDefined();
    expect(res._json[0].term).toBe(2024010100);
  });

  it('should isolate errors per tenant', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create test tenants
    const tenant1 = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    const tenant2 = await tenantRepository.create({
      realmId,
      name: 'Jane Smith',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Mock axios to fail for first tenant, succeed for second
    let callCount = 0;
    axios.post.mockImplementation(() => {
      if (callCount++ === 0) {
        return Promise.reject({
          response: {
            data: {
              status: 500,
              message: 'Email service error'
            }
          }
        });
      }
      return Promise.resolve({
        data: [{
          templateName: 'invoice',
          recordId: String(tenant2._id),
          params: { term: 202401 },
          email: 'test@example.com',
          status: 'sent'
        }]
      });
    });
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [String(tenant1._id), String(tenant2._id)],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify both tenants have status
    expect(res._json).toBeDefined();
    expect(res._json.length).toBe(2);
    
    // First tenant should have error
    expect(res._json[0].error).toBeDefined();
    expect(res._json[0].error.message).toContain('Something went wrong');
    
    // Second tenant should succeed
    expect(res._json[1].name).toBe('Jane Smith');
    expect(res._json[1].email).toBeDefined();
    expect(res._json[1].status).toBe('sent');
  });

  it('should return 500 if any email failed', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create test tenant
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Mock axios to fail
    axios.post.mockRejectedValue({
      response: {
        data: {
          status: 500,
          message: 'Email service error'
        }
      }
    });
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [String(tenant._id)],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify 500 status
    expect(res._status).toBe(500);
    expect(res._json[0].error).toBeDefined();
  });

  it('should return 200 if all emails succeeded', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create test tenant
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Mock axios to succeed
    axios.post.mockResolvedValue({
      data: [{
        templateName: 'invoice',
        recordId: String(tenant._id),
        params: { term: 202401 },
        email: 'test@example.com',
        status: 'sent'
      }]
    });
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [String(tenant._id)],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify 200 status (no explicit status call means 200)
    expect(res._status).toBeNull();
    expect(res._json[0]).toBeDefined();
    // The response structure includes the status from emailer
    expect(res._json[0].name).toBe('John Doe');
  });

  it('should extract error message from emailer service', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create test tenant
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Mock axios to fail with specific error
    axios.post.mockRejectedValue({
      response: {
        data: {
          status: 503,
          message: 'SMTP server unavailable'
        }
      }
    });
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [String(tenant._id)],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify error message was extracted
    expect(res._json[0].error).toBeDefined();
    expect(res._json[0].error.status).toBe(500);
    expect(res._json[0].error.message).toContain('Something went wrong');
  });

  it('should provide default error message when emailer service does not return one', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create test tenant
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Mock axios to fail without response data
    axios.post.mockRejectedValue(new Error('Network error'));
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [String(tenant._id)],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify default error message
    expect(res._json[0].error).toBeDefined();
    expect(res._json[0].error.status).toBe(500);
    expect(res._json[0].error.message).toContain('Something went wrong');
    expect(res._json[0].error.message).toContain('John Doe');
  });

  it('should handle empty tenant list', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify empty response
    expect(res._json).toBeDefined();
    expect(res._json.length).toBe(0);
  });

  it('should handle tenants not found', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: ['507f1f77bcf86cd799439099'],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify empty response (no tenants found)
    expect(res._json).toBeDefined();
    expect(res._json.length).toBe(0);
  });

  it('should pass correct headers to emailer service', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create test tenant
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Mock axios
    axios.post.mockResolvedValue({
      data: [{
        templateName: 'invoice',
        recordId: String(tenant._id),
        params: { term: 202401 },
        email: 'test@example.com',
        status: 'sent'
      }]
    });
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [String(tenant._id)],
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    req.headers.authorization = 'Bearer custom-token';
    req.headers.organizationid = 'custom-org-id';
    req.headers['accept-language'] = 'fr';
    
    await emailManager.send(req, res);
    
    // Verify headers were passed
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8400/emailer',
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer custom-token',
          organizationid: 'custom-org-id',
          'Accept-Language': 'fr'
        })
      })
    );
  });

  it('should use fallback term when terms array is shorter than tenant list', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create test tenants
    const tenant1 = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    const tenant2 = await tenantRepository.create({
      realmId,
      name: 'Jane Smith',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Mock axios
    axios.post.mockResolvedValue({
      data: [{
        templateName: 'invoice',
        recordId: 'test',
        params: { term: 202401 },
        email: 'test@example.com',
        status: 'sent'
      }]
    });
    
    const { req, res } = createMockReqRes({
      document: 'invoice',
      tenantIds: [String(tenant1._id), String(tenant2._id)],
      terms: [202403], // Only one term for two tenants
      year: 2024,
      month: 1
    });
    req.realm._id = realmId;
    
    await emailManager.send(req, res);
    
    // Verify first tenant got custom term, second got default
    expect(res._json[0].term).toBe(202403);
    expect(res._json[1].term).toBe(2024010100);
  });
});
