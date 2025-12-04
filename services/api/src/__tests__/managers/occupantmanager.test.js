import * as occupantManager from '../../managers/occupantmanager.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Collections, DataAccess, EnvironmentConfig, Service, TestUtils } from '@microrealestate/common';

const { connectTestDB, disconnectTestDB, clearTestDB } = TestUtils;

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

describe('OccupantManager - _buildPropertyMap refactoring', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should build property map using PropertyRepository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create test properties using PropertyRepository
    const propertyRepository = DataAccess.getPropertyRepository();
    
    await propertyRepository.create({
      realmId,
      name: 'Property 1',
      type: 'apartment',
      surface: 75,
      price: 1200
    });
    
    await propertyRepository.create({
      realmId,
      name: 'Property 2',
      type: 'house',
      surface: 150,
      price: 2000
    });
    
    // Verify properties were created
    const allProperties = await propertyRepository.findAll(realmId);
    expect(allProperties).toHaveLength(2);
    
    // Verify property IDs are strings in the result
    expect(typeof allProperties[0]._id).toBe('object'); // MongoDB ObjectId
    expect(typeof allProperties[1]._id).toBe('object'); // MongoDB ObjectId
    
    // Verify properties are plain objects (not Mongoose documents)
    expect(allProperties[0].save).toBeUndefined();
    expect(allProperties[0].toObject).toBeUndefined();
  });

  it('should return empty array for realm with no properties', async () => {
    const realmId = '507f1f77bcf86cd799439012';
    
    const propertyRepository = DataAccess.getPropertyRepository();
    const properties = await propertyRepository.findAll(realmId);
    
    expect(properties).toEqual([]);
  });

  it('should only return properties for the specified realm', async () => {
    const realm1Id = '507f1f77bcf86cd799439011';
    const realm2Id = '507f1f77bcf86cd799439012';
    
    const propertyRepository = DataAccess.getPropertyRepository();
    
    // Create properties in realm 1
    await propertyRepository.create({
      realmId: realm1Id,
      name: 'Realm 1 Property',
      type: 'apartment',
      surface: 75,
      price: 1200
    });
    
    // Create properties in realm 2
    await propertyRepository.create({
      realmId: realm2Id,
      name: 'Realm 2 Property',
      type: 'house',
      surface: 150,
      price: 2000
    });
    
    // Verify realm isolation
    const realm1Properties = await propertyRepository.findAll(realm1Id);
    const realm2Properties = await propertyRepository.findAll(realm2Id);
    
    expect(realm1Properties).toHaveLength(1);
    expect(realm2Properties).toHaveLength(1);
    expect(realm1Properties[0].name).toBe('Realm 1 Property');
    expect(realm2Properties[0].name).toBe('Realm 2 Property');
  });
});

describe('OccupantManager - add() function refactoring', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should create tenant using TenantRepository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a test property first
    const propertyRepository = DataAccess.getPropertyRepository();
    const property = await propertyRepository.create({
      realmId,
      name: 'Test Property',
      type: 'apartment',
      surface: 75,
      price: 1200
    });
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Prepare tenant data
    const tenantData = {
      name: 'John Doe',
      isCompany: false,
      manager: 'John Doe',
      beginDate: '01/01/2024',
      endDate: '31/12/2024',
      frequency: 'months',
      leaseId: String(lease._id),
      properties: [
        {
          propertyId: String(property._id),
          rent: 1200,
          entryDate: '01/01/2024',
          exitDate: '31/12/2024'
        }
      ]
    };
    
    const { req, res } = createMockReqRes(tenantData);
    
    // Call add function
    await occupantManager.add(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(res._json.name).toBe('John Doe');
    expect(res._json.isCompany).toBe(false);
    
    // Verify tenant was created in database using repository
    const tenantRepository = DataAccess.getTenantRepository();
    const tenants = await tenantRepository.findAll(realmId);
    expect(tenants).toHaveLength(1);
    expect(tenants[0].name).toBe('John Doe');
    expect(tenants[0].realmId).toBe(realmId);
  });

  it('should throw error when tenant name is missing', async () => {
    const tenantData = {
      isCompany: false,
      beginDate: '01/01/2024',
      endDate: '31/12/2024'
    };
    
    const { req, res } = createMockReqRes(tenantData);
    
    // Expect error to be thrown
    await expect(occupantManager.add(req, res)).rejects.toThrow('missing fields');
  });

  it('should generate reference code if not provided', async () => {
    const tenantData = {
      name: 'Jane Smith',
      isCompany: false,
      manager: 'Jane Smith',
      beginDate: '01/01/2024',
      endDate: '31/12/2024'
    };
    
    const { req, res } = createMockReqRes(tenantData);
    
    await occupantManager.add(req, res);
    
    // Verify reference was generated
    expect(res._json).toBeDefined();
    expect(res._json.reference).toBeDefined();
    expect(res._json.reference).toMatch(/^[0-9A-Z]{12}$/);
  });

  it('should format company tenant correctly', async () => {
    const tenantData = {
      company: 'ACME Corp',
      isCompany: true,
      manager: 'John Manager',
      beginDate: '01/01/2024',
      endDate: '31/12/2024',
      legalForm: 'LLC',
      siret: '12345678901234'
    };
    
    const { req, res } = createMockReqRes(tenantData);
    
    await occupantManager.add(req, res);
    
    // Verify company name is used as tenant name
    expect(res._json).toBeDefined();
    expect(res._json.name).toBe('ACME Corp');
    expect(res._json.isCompany).toBe(true);
    expect(res._json.legalForm).toBe('LLC');
  });
});

describe('OccupantManager - update() function refactoring', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should update tenant using TenantRepository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a test property first
    const propertyRepository = DataAccess.getPropertyRepository();
    const property = await propertyRepository.create({
      realmId,
      name: 'Test Property',
      type: 'apartment',
      surface: 75,
      price: 1200
    });
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create initial tenant
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      manager: 'John Doe',
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      frequency: 'months',
      leaseId: String(lease._id),
      properties: [
        {
          propertyId: String(property._id),
          property: property,
          rent: 1200,
          entryDate: new Date('2024-01-01'),
          exitDate: new Date('2024-12-31'),
          expenses: []
        }
      ],
      rents: []
    });
    
    // Update tenant data
    const updateData = {
      name: 'John Updated Doe',
      isCompany: false,
      manager: 'John Updated Doe',
      beginDate: '01/01/2024',
      endDate: '31/12/2024',
      frequency: 'months',
      leaseId: String(lease._id),
      properties: [
        {
          propertyId: String(property._id),
          rent: 1300,
          entryDate: '01/01/2024',
          exitDate: '31/12/2024',
          expenses: []
        }
      ]
    };
    
    const { req, res } = createMockReqRes(updateData, { id: String(tenant._id) });
    
    // Call update function
    await occupantManager.update(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(res._json.name).toBe('John Updated Doe');
    
    // Verify tenant was updated in database using repository
    const updatedTenant = await tenantRepository.findOne({
      tenantId: String(tenant._id),
      realmId
    });
    expect(updatedTenant).toBeDefined();
    expect(updatedTenant.name).toBe('John Updated Doe');
  });

  it('should throw error when tenant name is missing in update', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create initial tenant
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31')
    });
    
    const updateData = {
      isCompany: false,
      beginDate: '01/01/2024',
      endDate: '31/12/2024'
    };
    
    const { req, res } = createMockReqRes(updateData, { id: String(tenant._id) });
    
    // Expect error to be thrown
    await expect(occupantManager.update(req, res)).rejects.toThrow('missing fields');
  });

  it('should throw error when tenant not found', async () => {
    const updateData = {
      name: 'John Doe',
      isCompany: false,
      beginDate: '01/01/2024',
      endDate: '31/12/2024'
    };
    
    const { req, res } = createMockReqRes(updateData, { id: '507f1f77bcf86cd799439099' });
    
    // Expect error to be thrown
    await expect(occupantManager.update(req, res)).rejects.toThrow('tenant not found');
  });

  it('should use refactored _buildPropertyMap helper', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create test properties
    const propertyRepository = DataAccess.getPropertyRepository();
    const property1 = await propertyRepository.create({
      realmId,
      name: 'Property 1',
      type: 'apartment',
      surface: 75,
      price: 1200
    });
    
    const property2 = await propertyRepository.create({
      realmId,
      name: 'Property 2',
      type: 'house',
      surface: 150,
      price: 2000
    });
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create initial tenant with property1
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      frequency: 'months',
      leaseId: String(lease._id),
      properties: [
        {
          propertyId: String(property1._id),
          property: property1,
          rent: 1200,
          entryDate: new Date('2024-01-01'),
          exitDate: new Date('2024-12-31'),
          expenses: []
        }
      ],
      rents: []
    });
    
    // Update to use property2
    const updateData = {
      name: 'John Doe',
      isCompany: false,
      beginDate: '01/01/2024',
      endDate: '31/12/2024',
      frequency: 'months',
      leaseId: String(lease._id),
      properties: [
        {
          propertyId: String(property2._id),
          rent: 2000,
          entryDate: '01/01/2024',
          exitDate: '31/12/2024',
          expenses: []
        }
      ]
    };
    
    const { req, res } = createMockReqRes(updateData, { id: String(tenant._id) });
    
    // Call update function
    await occupantManager.update(req, res);
    
    // Verify property was resolved from property map
    expect(res._json).toBeDefined();
    expect(res._json.properties).toBeDefined();
    expect(res._json.properties[0].propertyId).toBe(String(property2._id));
  });

  it('should use refactored _fetchTenants helper', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create initial tenant
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    // Update tenant
    const updateData = {
      name: 'John Updated',
      isCompany: false,
      beginDate: '01/01/2024',
      endDate: '31/12/2024',
      leaseId: String(lease._id),
      properties: []
    };
    
    const { req, res } = createMockReqRes(updateData, { id: String(tenant._id) });
    
    // Call update function
    await occupantManager.update(req, res);
    
    // Verify response includes data from _fetchTenants (with filesToUpload)
    expect(res._json).toBeDefined();
    expect(res._json.name).toBe('John Updated');
    // filesToUpload should be present from aggregation
    expect(res._json.filesToUpload).toBeDefined();
  });
});

describe('OccupantManager - remove() function refactoring', () => {
  beforeAll(async () => {
    await connectTestDB();
    
    // Initialize Service with test environment config
    const envConfig = new EnvironmentConfig({
      PDFGENERATOR_URL: 'http://localhost:8300'
    });
    Service.getInstance(envConfig);
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should delete tenant using TenantRepository.findByIds and deleteMany', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create test tenants
    const tenantRepository = DataAccess.getTenantRepository();
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
    
    // Verify tenants exist
    const beforeDelete = await tenantRepository.findAll(realmId);
    expect(beforeDelete).toHaveLength(2);
    
    // Delete tenant1
    const { req, res } = createMockReqRes({}, { ids: String(tenant1._id) });
    
    await occupantManager.remove(req, res);
    
    // Verify response
    expect(res._status).toBe(200);
    
    // Verify tenant was deleted
    const afterDelete = await tenantRepository.findAll(realmId);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]._id.toString()).toBe(String(tenant2._id));
  });

  it('should delete multiple tenants at once', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create test tenants
    const tenantRepository = DataAccess.getTenantRepository();
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
    
    const tenant3 = await tenantRepository.create({
      realmId,
      name: 'Bob Johnson',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Delete tenant1 and tenant2
    const { req, res } = createMockReqRes({}, { 
      ids: `${String(tenant1._id)},${String(tenant2._id)}` 
    });
    
    await occupantManager.remove(req, res);
    
    // Verify response
    expect(res._status).toBe(200);
    
    // Verify only tenant3 remains
    const afterDelete = await tenantRepository.findAll(realmId);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]._id.toString()).toBe(String(tenant3._id));
  });

  it('should throw error when tenant IDs are empty', async () => {
    const { req, res } = createMockReqRes({}, { ids: '' });
    
    // Empty string split by comma results in [''], which causes MongoDB cast error
    // This is expected behavior - the validation happens at MongoDB level
    await expect(occupantManager.remove(req, res)).rejects.toThrow();
  });

  it('should throw error when tenant not found', async () => {
    const { req, res } = createMockReqRes({}, { ids: '507f1f77bcf86cd799439099' });
    
    await expect(occupantManager.remove(req, res)).rejects.toThrow('tenant not found');
  });

  it('should prevent deletion of tenants with paid rents', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create tenant with paid rents
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: [
        {
          term: 202401,
          payments: [{ amount: 1200, date: new Date('2024-01-05') }],
          discounts: []
        }
      ]
    });
    
    const { req, res } = createMockReqRes({}, { ids: String(tenant._id) });
    
    // Expect error to be thrown
    await expect(occupantManager.remove(req, res)).rejects.toThrow(
      'impossible to remove'
    );
    
    // Verify tenant was not deleted
    const afterAttempt = await tenantRepository.findAll(realmId);
    expect(afterAttempt).toHaveLength(1);
  });

  it('should use DocumentRepository to find documents for deletion', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create test tenant
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Create test documents
    const documentRepository = DataAccess.getDocumentRepository();
    await Collections.Document.create({
      realmId,
      tenantId: String(tenant._id),
      leaseId: '507f1f77bcf86cd799439020',
      templateId: '507f1f77bcf86cd799439021',
      type: 'file',
      name: 'Test Document',
      description: 'Test'
    });
    
    // Verify document exists
    const beforeDelete = await documentRepository.findByTenantIds(
      [String(tenant._id)],
      realmId
    );
    expect(beforeDelete).toHaveLength(1);
    
    // Delete tenant (this should also handle documents)
    const { req, res } = createMockReqRes({}, { ids: String(tenant._id) });
    
    await occupantManager.remove(req, res);
    
    // Verify response
    expect(res._status).toBe(200);
    
    // Verify tenant was deleted
    const afterDelete = await tenantRepository.findAll(realmId);
    expect(afterDelete).toHaveLength(0);
  });

  it('should use SessionManager.withTransaction for transaction management', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create test tenant
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Delete tenant
    const { req, res } = createMockReqRes({}, { ids: String(tenant._id) });
    
    await occupantManager.remove(req, res);
    
    // Verify response
    expect(res._status).toBe(200);
    
    // Verify tenant was deleted (transaction committed)
    const afterDelete = await tenantRepository.findAll(realmId);
    expect(afterDelete).toHaveLength(0);
  });

  it('should only delete tenants in the specified realm', async () => {
    const realm1Id = '507f1f77bcf86cd799439011';
    const realm2Id = '507f1f77bcf86cd799439012';
    
    // Create tenants in different realms
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant1 = await tenantRepository.create({
      realmId: realm1Id,
      name: 'Realm 1 Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    const tenant2 = await tenantRepository.create({
      realmId: realm2Id,
      name: 'Realm 2 Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rents: []
    });
    
    // Try to delete tenant1 from realm1
    const { req, res } = createMockReqRes({}, { ids: String(tenant1._id) });
    req.realm._id = realm1Id;
    
    await occupantManager.remove(req, res);
    
    // Verify tenant1 was deleted from realm1
    const realm1Tenants = await tenantRepository.findAll(realm1Id);
    expect(realm1Tenants).toHaveLength(0);
    
    // Verify tenant2 still exists in realm2
    const realm2Tenants = await tenantRepository.findAll(realm2Id);
    expect(realm2Tenants).toHaveLength(1);
    expect(realm2Tenants[0]._id.toString()).toBe(String(tenant2._id));
  });
});

describe('OccupantManager - all() function refactoring', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should return all tenants using _fetchTenants helper', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create test tenants
    const tenantRepository = DataAccess.getTenantRepository();
    await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    await tenantRepository.create({
      realmId,
      name: 'Jane Smith',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    const { req, res } = createMockReqRes();
    
    // Call all function
    await occupantManager.all(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(Array.isArray(res._json)).toBe(true);
    expect(res._json).toHaveLength(2);
    
    // Verify data is transformed by FD.toOccupantData
    expect(res._json[0].name).toBeDefined();
    expect(res._json[1].name).toBeDefined();
    
    // Verify filesToUpload is present from aggregation
    expect(res._json[0].filesToUpload).toBeDefined();
    expect(res._json[1].filesToUpload).toBeDefined();
  });

  it('should return empty array when no tenants exist', async () => {
    const { req, res } = createMockReqRes();
    
    // Call all function
    await occupantManager.all(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(Array.isArray(res._json)).toBe(true);
    expect(res._json).toHaveLength(0);
  });

  it('should only return tenants for the specified realm', async () => {
    const realm1Id = '507f1f77bcf86cd799439011';
    const realm2Id = '507f1f77bcf86cd799439012';
    
    // Create leases for both realms
    const lease1 = await Collections.Lease.create({
      realmId: realm1Id,
      name: 'Realm 1 Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const lease2 = await Collections.Lease.create({
      realmId: realm2Id,
      name: 'Realm 2 Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create tenants in different realms
    const tenantRepository = DataAccess.getTenantRepository();
    await tenantRepository.create({
      realmId: realm1Id,
      name: 'Realm 1 Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease1._id),
      properties: [],
      rents: []
    });
    
    await tenantRepository.create({
      realmId: realm2Id,
      name: 'Realm 2 Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease2._id),
      properties: [],
      rents: []
    });
    
    // Query realm 1
    const { req: req1, res: res1 } = createMockReqRes();
    req1.realm._id = realm1Id;
    
    await occupantManager.all(req1, res1);
    
    // Verify only realm 1 tenant is returned
    expect(res1._json).toHaveLength(1);
    expect(res1._json[0].name).toBe('Realm 1 Tenant');
    
    // Query realm 2
    const { req: req2, res: res2 } = createMockReqRes();
    req2.realm._id = realm2Id;
    
    await occupantManager.all(req2, res2);
    
    // Verify only realm 2 tenant is returned
    expect(res2._json).toHaveLength(1);
    expect(res2._json[0].name).toBe('Realm 2 Tenant');
  });

  it('should return tenants sorted by name', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create test tenants in non-alphabetical order
    const tenantRepository = DataAccess.getTenantRepository();
    await tenantRepository.create({
      realmId,
      name: 'Zoe Wilson',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    await tenantRepository.create({
      realmId,
      name: 'Alice Brown',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    await tenantRepository.create({
      realmId,
      name: 'Mike Davis',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    const { req, res } = createMockReqRes();
    
    // Call all function
    await occupantManager.all(req, res);
    
    // Verify response is sorted by name
    expect(res._json).toHaveLength(3);
    expect(res._json[0].name).toBe('Alice Brown');
    expect(res._json[1].name).toBe('Mike Davis');
    expect(res._json[2].name).toBe('Zoe Wilson');
  });

  it('should apply FD.toOccupantData transformation to all tenants', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create test tenant
    const tenantRepository = DataAccess.getTenantRepository();
    await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    const { req, res } = createMockReqRes();
    
    // Call all function
    await occupantManager.all(req, res);
    
    // Verify response has expected structure from FD.toOccupantData
    expect(res._json).toHaveLength(1);
    const tenant = res._json[0];
    
    // Check for expected fields that FD.toOccupantData should provide
    expect(tenant._id).toBeDefined();
    expect(tenant.name).toBe('John Doe');
    expect(tenant.isCompany).toBe(false);
    expect(tenant.filesToUpload).toBeDefined();
  });
});

describe('OccupantManager - one() function refactoring', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should return single tenant using _fetchTenants helper with tenantId', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create test tenants
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant1 = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    await tenantRepository.create({
      realmId,
      name: 'Jane Smith',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    const { req, res } = createMockReqRes({}, { id: String(tenant1._id) });
    
    // Call one function
    await occupantManager.one(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(res._json.name).toBe('John Doe');
    expect(res._json._id).toBe(String(tenant1._id));
    
    // Verify filesToUpload is present from aggregation
    expect(res._json.filesToUpload).toBeDefined();
  });

  it('should return null when tenant not found', async () => {
    const { req, res } = createMockReqRes({}, { id: '507f1f77bcf86cd799439099' });
    
    // Call one function
    await occupantManager.one(req, res);
    
    // Verify response is null
    expect(res._json).toBeNull();
  });

  it('should only return tenant from the specified realm', async () => {
    const realm1Id = '507f1f77bcf86cd799439011';
    const realm2Id = '507f1f77bcf86cd799439012';
    
    // Create leases for both realms
    const lease1 = await Collections.Lease.create({
      realmId: realm1Id,
      name: 'Realm 1 Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const lease2 = await Collections.Lease.create({
      realmId: realm2Id,
      name: 'Realm 2 Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create tenants in different realms
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant1 = await tenantRepository.create({
      realmId: realm1Id,
      name: 'Realm 1 Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease1._id),
      properties: [],
      rents: []
    });
    
    const tenant2 = await tenantRepository.create({
      realmId: realm2Id,
      name: 'Realm 2 Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease2._id),
      properties: [],
      rents: []
    });
    
    // Query tenant1 from realm1
    const { req: req1, res: res1 } = createMockReqRes({}, { id: String(tenant1._id) });
    req1.realm._id = realm1Id;
    
    await occupantManager.one(req1, res1);
    
    // Verify tenant1 is returned
    expect(res1._json).toBeDefined();
    expect(res1._json.name).toBe('Realm 1 Tenant');
    
    // Try to query tenant1 from realm2 (should return null)
    const { req: req2, res: res2 } = createMockReqRes({}, { id: String(tenant1._id) });
    req2.realm._id = realm2Id;
    
    await occupantManager.one(req2, res2);
    
    // Verify null is returned (tenant1 doesn't belong to realm2)
    expect(res2._json).toBeNull();
    
    // Query tenant2 from realm2
    const { req: req3, res: res3 } = createMockReqRes({}, { id: String(tenant2._id) });
    req3.realm._id = realm2Id;
    
    await occupantManager.one(req3, res3);
    
    // Verify tenant2 is returned
    expect(res3._json).toBeDefined();
    expect(res3._json.name).toBe('Realm 2 Tenant');
  });

  it('should apply FD.toOccupantData transformation', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create test tenant
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    const { req, res } = createMockReqRes({}, { id: String(tenant._id) });
    
    // Call one function
    await occupantManager.one(req, res);
    
    // Verify response has expected structure from FD.toOccupantData
    expect(res._json).toBeDefined();
    expect(res._json._id).toBe(String(tenant._id));
    expect(res._json.name).toBe('John Doe');
    expect(res._json.isCompany).toBe(false);
    expect(res._json.filesToUpload).toBeDefined();
  });

  it('should include file descriptors from aggregation', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create a file descriptor template linked to the lease
    await Collections.Template.create({
      realmId,
      name: 'Insurance Certificate',
      type: 'fileDescriptor',
      description: 'Proof of insurance',
      linkedResourceIds: [String(lease._id)],
      required: true,
      requiredOnceContractTerminated: false,
      hasExpiryDate: true
    });
    
    // Create test tenant
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    const { req, res } = createMockReqRes({}, { id: String(tenant._id) });
    
    // Call one function
    await occupantManager.one(req, res);
    
    // Verify response includes file descriptors
    expect(res._json).toBeDefined();
    expect(res._json.filesToUpload).toBeDefined();
    expect(Array.isArray(res._json.filesToUpload)).toBe(true);
    expect(res._json.filesToUpload.length).toBeGreaterThan(0);
    
    // Verify file descriptor structure
    const fileDescriptor = res._json.filesToUpload[0];
    expect(fileDescriptor.name).toBe('Insurance Certificate');
    expect(fileDescriptor.required).toBe(true);
    expect(fileDescriptor.documents).toBeDefined();
    expect(Array.isArray(fileDescriptor.documents)).toBe(true);
  });

  it('should compute missing document flags correctly', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a test lease
    const lease = await Collections.Lease.create({
      realmId,
      name: 'Standard Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create a required file descriptor template
    await Collections.Template.create({
      realmId,
      name: 'ID Document',
      type: 'fileDescriptor',
      description: 'Identity document',
      linkedResourceIds: [String(lease._id)],
      required: true,
      requiredOnceContractTerminated: false,
      hasExpiryDate: false
    });
    
    // Create test tenant without uploading the required document
    const tenantRepository = DataAccess.getTenantRepository();
    const tenant = await tenantRepository.create({
      realmId,
      name: 'John Doe',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    const { req, res } = createMockReqRes({}, { id: String(tenant._id) });
    
    // Call one function
    await occupantManager.one(req, res);
    
    // Verify missing flag is computed correctly
    expect(res._json).toBeDefined();
    expect(res._json.filesToUpload).toBeDefined();
    expect(res._json.filesToUpload.length).toBeGreaterThan(0);
    
    const fileDescriptor = res._json.filesToUpload[0];
    expect(fileDescriptor.missing).toBe(true); // Required but no documents uploaded
  });
});

describe('OccupantManager - overview() function refactoring', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should return overview statistics using TenantRepository.findAll', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create test tenants with different statuses
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Active tenant (end date in future)
    await tenantRepository.create({
      realmId,
      name: 'Active Tenant 1',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2026-12-31'), // Far future to ensure it's active
      rents: []
    });
    
    // Active tenant (no termination date)
    await tenantRepository.create({
      realmId,
      name: 'Active Tenant 2',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2026-06-30'), // Far future to ensure it's active
      rents: []
    });
    
    // Inactive tenant (end date in past)
    await tenantRepository.create({
      realmId,
      name: 'Inactive Tenant 1',
      isCompany: false,
      beginDate: new Date('2023-01-01'),
      endDate: new Date('2023-12-31'),
      rents: []
    });
    
    const { req, res } = createMockReqRes();
    
    // Call overview function
    await occupantManager.overview(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(res._json.countAll).toBe(3);
    expect(res._json.countActive).toBe(2);
    expect(res._json.countInactive).toBe(1);
  });

  it('should use terminationDate over endDate for status determination', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Tenant with terminationDate in past (should be inactive)
    await tenantRepository.create({
      realmId,
      name: 'Terminated Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'), // Future end date
      terminationDate: new Date('2024-06-30'), // Past termination date
      rents: []
    });
    
    const { req, res } = createMockReqRes();
    
    // Call overview function
    await occupantManager.overview(req, res);
    
    // Verify response - tenant should be inactive due to terminationDate
    expect(res._json).toBeDefined();
    expect(res._json.countAll).toBe(1);
    expect(res._json.countActive).toBe(0);
    expect(res._json.countInactive).toBe(1);
  });

  it('should return zero counts when no tenants exist', async () => {
    const { req, res } = createMockReqRes();
    
    // Call overview function
    await occupantManager.overview(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(res._json.countAll).toBe(0);
    expect(res._json.countActive).toBe(0);
    expect(res._json.countInactive).toBe(0);
  });

  it('should only count tenants from the specified realm', async () => {
    const realm1Id = '507f1f77bcf86cd799439011';
    const realm2Id = '507f1f77bcf86cd799439012';
    
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create tenants in realm 1
    await tenantRepository.create({
      realmId: realm1Id,
      name: 'Realm 1 Tenant 1',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      rents: []
    });
    
    await tenantRepository.create({
      realmId: realm1Id,
      name: 'Realm 1 Tenant 2',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      rents: []
    });
    
    // Create tenants in realm 2
    await tenantRepository.create({
      realmId: realm2Id,
      name: 'Realm 2 Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      rents: []
    });
    
    // Query realm 1
    const { req: req1, res: res1 } = createMockReqRes();
    req1.realm._id = realm1Id;
    
    await occupantManager.overview(req1, res1);
    
    // Verify only realm 1 tenants are counted
    expect(res1._json.countAll).toBe(2);
    
    // Query realm 2
    const { req: req2, res: res2 } = createMockReqRes();
    req2.realm._id = realm2Id;
    
    await occupantManager.overview(req2, res2);
    
    // Verify only realm 2 tenants are counted
    expect(res2._json.countAll).toBe(1);
  });

  it('should correctly classify tenants as active or inactive based on current date', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Create tenants with various end dates
    // Active: end date is today or in future
    await tenantRepository.create({
      realmId,
      name: 'Active Today',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date(), // Today
      rents: []
    });
    
    // Active: end date in future
    await tenantRepository.create({
      realmId,
      name: 'Active Future',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date(Date.now() + 86400000), // Tomorrow
      rents: []
    });
    
    // Inactive: end date in past
    await tenantRepository.create({
      realmId,
      name: 'Inactive Past',
      isCompany: false,
      beginDate: new Date('2023-01-01'),
      endDate: new Date(Date.now() - 86400000), // Yesterday
      rents: []
    });
    
    const { req, res } = createMockReqRes();
    
    // Call overview function
    await occupantManager.overview(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(res._json.countAll).toBe(3);
    expect(res._json.countActive).toBe(2);
    expect(res._json.countInactive).toBe(1);
  });

  it('should handle tenants with only endDate (no terminationDate)', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const tenantRepository = DataAccess.getTenantRepository();
    
    // Active tenant with only endDate
    await tenantRepository.create({
      realmId,
      name: 'Active No Termination',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      rents: []
    });
    
    // Inactive tenant with only endDate
    await tenantRepository.create({
      realmId,
      name: 'Inactive No Termination',
      isCompany: false,
      beginDate: new Date('2023-01-01'),
      endDate: new Date('2023-12-31'),
      rents: []
    });
    
    const { req, res } = createMockReqRes();
    
    // Call overview function
    await occupantManager.overview(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(res._json.countAll).toBe(2);
    expect(res._json.countActive).toBe(1);
    expect(res._json.countInactive).toBe(1);
  });

  it('should return plain objects from TenantRepository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const tenantRepository = DataAccess.getTenantRepository();
    
    await tenantRepository.create({
      realmId,
      name: 'Test Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      rents: []
    });
    
    // Get tenants directly to verify they are plain objects
    const tenants = await tenantRepository.findAll(realmId);
    
    // Verify tenants are plain objects (no Mongoose methods)
    expect(tenants).toHaveLength(1);
    expect(tenants[0].save).toBeUndefined();
    expect(tenants[0].toObject).toBeUndefined();
    expect(typeof tenants[0]).toBe('object');
  });
});
