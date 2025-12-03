import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Collections, DataAccess, TestUtils } from '@microrealestate/common';
import * as leaseManager from '../../managers/leasemanager.js';

const { connectTestDB, disconnectTestDB, clearTestDB, supportsTransactions } = TestUtils;

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

describe('LeaseManager - add() function with repositories', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should create lease using LeaseRepository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const leaseData = {
      name: '12 Month Lease',
      description: 'Standard 12 month lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true,
      stepperMode: false
    };
    
    const { req, res } = createMockReqRes(leaseData);
    
    // Call add function
    await leaseManager.add(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(res._json.name).toBe('12 Month Lease');
    expect(res._json.numberOfTerms).toBe(12);
    expect(res._json.active).toBe(true);
    expect(res._json.usedByTenants).toBe(false);
    
    // Verify lease was created in database using repository
    const leaseRepository = DataAccess.getLeaseRepository();
    const leases = await leaseRepository.findAll(realmId);
    expect(leases).toHaveLength(1);
    expect(leases[0].name).toBe('12 Month Lease');
  });

  it('should throw error when lease name is missing', async () => {
    const leaseData = {
      numberOfTerms: 12,
      timeRange: 'months'
    };
    
    const { req, res } = createMockReqRes(leaseData);
    
    await expect(leaseManager.add(req, res)).rejects.toThrow('missing fields');
  });

  it('should calculate active status correctly', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Test with all required fields for active
    const activeLeaseData = {
      name: 'Active Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    };
    
    const { req: req1, res: res1 } = createMockReqRes(activeLeaseData);
    await leaseManager.add(req1, res1);
    
    expect(res1._json.active).toBe(true);
    
    // Test with missing numberOfTerms (should be inactive)
    const inactiveLeaseData = {
      name: 'Inactive Lease',
      numberOfTerms: 0,
      timeRange: 'months',
      active: true
    };
    
    const { req: req2, res: res2 } = createMockReqRes(inactiveLeaseData);
    await leaseManager.add(req2, res2);
    
    expect(res2._json.active).toBe(false);
  });

  it('should enrich lease with usedByTenants field', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a lease
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create a tenant using this lease
    const tenantRepository = DataAccess.getTenantRepository();
    await tenantRepository.create({
      realmId,
      name: 'Test Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    // Create a new lease (not used by any tenant)
    const newLeaseData = {
      name: 'New Lease',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    };
    
    const { req, res } = createMockReqRes(newLeaseData);
    await leaseManager.add(req, res);
    
    // New lease should not be used by tenants
    expect(res._json.usedByTenants).toBe(false);
  });

  it('should return plain objects from repository', async () => {
    const leaseData = {
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    };
    
    const { req, res } = createMockReqRes(leaseData);
    await leaseManager.add(req, res);
    
    // Verify response is a plain object (no Mongoose methods)
    expect(res._json.save).toBeUndefined();
    expect(res._json.toObject).toBeUndefined();
  });
});

describe('LeaseManager - update() function with repositories', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should update lease using LeaseRepository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create initial lease
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Original Lease',
      description: 'Original description',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Update lease data
    const updateData = {
      _id: String(lease._id),
      name: 'Updated Lease',
      description: 'Updated description',
      numberOfTerms: 6,
      timeRange: 'months',
      active: false
    };
    
    const { req, res } = createMockReqRes(updateData);
    
    // Call update function
    await leaseManager.update(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(res._json.name).toBe('Updated Lease');
    expect(res._json.description).toBe('Updated description');
    expect(res._json.numberOfTerms).toBe(6);
    expect(res._json.active).toBe(false);
    
    // Verify lease was updated in database
    const updatedLease = await leaseRepository.findById(String(lease._id), realmId);
    expect(updatedLease.name).toBe('Updated Lease');
  });

  it('should throw error when lease name is missing', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const updateData = {
      _id: String(lease._id),
      numberOfTerms: 6,
      timeRange: 'months'
    };
    
    const { req, res } = createMockReqRes(updateData);
    
    await expect(leaseManager.update(req, res)).rejects.toThrow('missing fields');
  });

  it('should throw error when lease not found', async () => {
    const updateData = {
      _id: '507f1f77bcf86cd799439099',
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months'
    };
    
    const { req, res } = createMockReqRes(updateData);
    
    await expect(leaseManager.update(req, res)).rejects.toThrow('lease not found');
  });

  it('should recalculate active status when not provided', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Update without providing active field
    const updateData = {
      _id: String(lease._id),
      name: 'Updated Lease',
      numberOfTerms: 0, // This should make it inactive
      timeRange: 'months'
    };
    
    const { req, res } = createMockReqRes(updateData);
    await leaseManager.update(req, res);
    
    // Active should be recalculated to false
    expect(res._json.active).toBe(false);
  });

  it('should restrict updates for leases used by tenants', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a lease
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Used Lease',
      description: 'Original description',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true,
      stepperMode: false
    });
    
    // Create a tenant using this lease
    const tenantRepository = DataAccess.getTenantRepository();
    await tenantRepository.create({
      realmId,
      name: 'Test Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    // Try to update all fields
    const updateData = {
      _id: String(lease._id),
      name: 'Updated Name',
      description: 'Updated description',
      numberOfTerms: 6, // Should not be updated
      timeRange: 'weeks', // Should not be updated
      active: false,
      stepperMode: true
    };
    
    const { req, res } = createMockReqRes(updateData);
    await leaseManager.update(req, res);
    
    // Only name, description, active, and stepperMode should be updated
    expect(res._json.name).toBe('Updated Name');
    expect(res._json.description).toBe('Updated description');
    expect(res._json.active).toBe(false);
    expect(res._json.stepperMode).toBe(true);
    
    // numberOfTerms and timeRange should remain unchanged
    expect(res._json.numberOfTerms).toBe(12);
    expect(res._json.timeRange).toBe('months');
  });

  it('should allow full updates for leases not used by tenants', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a lease not used by any tenant
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Unused Lease',
      description: 'Original description',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Update all fields
    const updateData = {
      _id: String(lease._id),
      name: 'Updated Name',
      description: 'Updated description',
      numberOfTerms: 6,
      timeRange: 'weeks',
      active: false
    };
    
    const { req, res } = createMockReqRes(updateData);
    await leaseManager.update(req, res);
    
    // All fields should be updated
    expect(res._json.name).toBe('Updated Name');
    expect(res._json.description).toBe('Updated description');
    expect(res._json.numberOfTerms).toBe(6);
    expect(res._json.timeRange).toBe('weeks');
    expect(res._json.active).toBe(false);
  });

  it('should enrich lease with usedByTenants field', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a lease
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create a tenant using this lease
    const tenantRepository = DataAccess.getTenantRepository();
    await tenantRepository.create({
      realmId,
      name: 'Test Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    // Update the lease
    const updateData = {
      _id: String(lease._id),
      name: 'Updated Lease',
      numberOfTerms: 12,
      timeRange: 'months'
    };
    
    const { req, res } = createMockReqRes(updateData);
    await leaseManager.update(req, res);
    
    // Should be marked as used by tenants
    expect(res._json.usedByTenants).toBe(true);
  });
});

describe('LeaseManager - remove() function with repositories and transactions', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it.skipIf(!supportsTransactions())('should delete lease using LeaseRepository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create test leases
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease1 = await leaseRepository.create({
      realmId,
      name: 'Lease 1',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const lease2 = await leaseRepository.create({
      realmId,
      name: 'Lease 2',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    });
    
    // Verify leases exist
    const beforeDelete = await leaseRepository.findAll(realmId);
    expect(beforeDelete).toHaveLength(2);
    
    // Delete lease1
    const { req, res } = createMockReqRes({}, { ids: String(lease1._id) });
    
    await leaseManager.remove(req, res);
    
    // Verify response
    expect(res._status).toBe(200);
    
    // Verify lease was deleted
    const afterDelete = await leaseRepository.findAll(realmId);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]._id.toString()).toBe(String(lease2._id));
  });

  it.skipIf(!supportsTransactions())('should delete multiple leases at once', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease1 = await leaseRepository.create({
      realmId,
      name: 'Lease 1',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const lease2 = await leaseRepository.create({
      realmId,
      name: 'Lease 2',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    });
    
    const lease3 = await leaseRepository.create({
      realmId,
      name: 'Lease 3',
      numberOfTerms: 3,
      timeRange: 'months',
      active: true
    });
    
    // Delete lease1 and lease2
    const { req, res } = createMockReqRes({}, { 
      ids: `${String(lease1._id)},${String(lease2._id)}` 
    });
    
    await leaseManager.remove(req, res);
    
    // Verify only lease3 remains
    const afterDelete = await leaseRepository.findAll(realmId);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]._id.toString()).toBe(String(lease3._id));
  });

  it('should throw error when lease IDs are empty', async () => {
    const { req, res } = createMockReqRes({}, { ids: '' });
    
    // Empty string split by comma results in [''], which causes validation error
    await expect(leaseManager.remove(req, res)).rejects.toThrow();
  });

  it('should throw error when lease not found', async () => {
    const { req, res } = createMockReqRes({}, { ids: '507f1f77bcf86cd799439099' });
    
    await expect(leaseManager.remove(req, res)).rejects.toThrow('lease not found');
  });

  it('should prevent deletion of leases used by tenants', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a lease
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Used Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create a tenant using this lease
    const tenantRepository = DataAccess.getTenantRepository();
    await tenantRepository.create({
      realmId,
      name: 'Test Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    const { req, res } = createMockReqRes({}, { ids: String(lease._id) });
    
    // Expect error to be thrown
    await expect(leaseManager.remove(req, res)).rejects.toThrow('missing fields');
    
    // Verify lease was not deleted
    const afterAttempt = await leaseRepository.findAll(realmId);
    expect(afterAttempt).toHaveLength(1);
  });

  it.skipIf(!supportsTransactions())('should delete orphaned templates (linked only to deleted leases)', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a lease
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create a template linked only to this lease
    await Collections.Template.create({
      realmId,
      name: 'Orphaned Template',
      type: 'text',
      description: 'Will be deleted',
      linkedResourceIds: [String(lease._id)],
      required: false,
      requiredOnceContractTerminated: false,
      hasExpiryDate: false
    });
    
    // Verify template exists
    const templateRepository = DataAccess.getTemplateRepository();
    const beforeDelete = await templateRepository.findByLinkedResources([String(lease._id)], realmId);
    expect(beforeDelete).toHaveLength(1);
    
    // Delete lease
    const { req, res } = createMockReqRes({}, { ids: String(lease._id) });
    await leaseManager.remove(req, res);
    
    // Verify template was deleted
    const afterDelete = await templateRepository.findByLinkedResources([String(lease._id)], realmId);
    expect(afterDelete).toHaveLength(0);
  });

  it.skipIf(!supportsTransactions())('should preserve templates linked to other leases', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create two leases
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease1 = await leaseRepository.create({
      realmId,
      name: 'Lease 1',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const lease2 = await leaseRepository.create({
      realmId,
      name: 'Lease 2',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    });
    
    // Create a template linked to both leases
    const template = await Collections.Template.create({
      realmId,
      name: 'Shared Template',
      type: 'text',
      description: 'Linked to multiple leases',
      linkedResourceIds: [String(lease1._id), String(lease2._id)],
      required: false,
      requiredOnceContractTerminated: false,
      hasExpiryDate: false
    });
    
    // Delete lease1
    const { req, res } = createMockReqRes({}, { ids: String(lease1._id) });
    await leaseManager.remove(req, res);
    
    // Verify template still exists
    const templateRepository = DataAccess.getTemplateRepository();
    const templates = await templateRepository.findByLinkedResources([String(lease2._id)], realmId);
    expect(templates).toHaveLength(1);
    expect(templates[0]._id.toString()).toBe(String(template._id));
    
    // Verify lease1 ID was removed from linkedResourceIds
    expect(templates[0].linkedResourceIds).toHaveLength(1);
    expect(templates[0].linkedResourceIds[0]).toBe(String(lease2._id));
  });

  it.skipIf(!supportsTransactions())('should use transaction for atomic deletion', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a lease
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create a template
    await Collections.Template.create({
      realmId,
      name: 'Test Template',
      type: 'text',
      description: 'Test',
      linkedResourceIds: [String(lease._id)],
      required: false,
      requiredOnceContractTerminated: false,
      hasExpiryDate: false
    });
    
    // Delete lease (should use transaction)
    const { req, res } = createMockReqRes({}, { ids: String(lease._id) });
    await leaseManager.remove(req, res);
    
    // Verify both lease and template were deleted atomically
    const leases = await leaseRepository.findAll(realmId);
    expect(leases).toHaveLength(0);
    
    const templateRepository = DataAccess.getTemplateRepository();
    const templates = await templateRepository.findByLinkedResources([String(lease._id)], realmId);
    expect(templates).toHaveLength(0);
  });

  it.skipIf(!supportsTransactions())('should only delete leases in the specified realm', async () => {
    const realm1Id = '507f1f77bcf86cd799439011';
    const realm2Id = '507f1f77bcf86cd799439012';
    
    // Create leases in different realms
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease1 = await leaseRepository.create({
      realmId: realm1Id,
      name: 'Realm 1 Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const lease2 = await leaseRepository.create({
      realmId: realm2Id,
      name: 'Realm 2 Lease',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    });
    
    // Try to delete lease1 from realm1
    const { req, res } = createMockReqRes({}, { ids: String(lease1._id) });
    req.realm._id = realm1Id;
    
    await leaseManager.remove(req, res);
    
    // Verify lease1 was deleted from realm1
    const realm1Leases = await leaseRepository.findAll(realm1Id);
    expect(realm1Leases).toHaveLength(0);
    
    // Verify lease2 still exists in realm2
    const realm2Leases = await leaseRepository.findAll(realm2Id);
    expect(realm2Leases).toHaveLength(1);
    expect(realm2Leases[0]._id.toString()).toBe(String(lease2._id));
  });
});

describe('LeaseManager - all() function with repositories', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should return all leases using LeaseRepository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create test leases
    const leaseRepository = DataAccess.getLeaseRepository();
    await leaseRepository.create({
      realmId,
      name: 'Lease 1',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    await leaseRepository.create({
      realmId,
      name: 'Lease 2',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    });
    
    const { req, res } = createMockReqRes();
    
    // Call all function
    await leaseManager.all(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(Array.isArray(res._json)).toBe(true);
    expect(res._json).toHaveLength(2);
    expect(res._json[0].name).toBeDefined();
    expect(res._json[1].name).toBeDefined();
  });

  it('should return empty array when no leases exist', async () => {
    const { req, res } = createMockReqRes();
    
    // Call all function
    await leaseManager.all(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(Array.isArray(res._json)).toBe(true);
    expect(res._json).toHaveLength(0);
  });

  it('should only return leases for the specified realm', async () => {
    const realm1Id = '507f1f77bcf86cd799439011';
    const realm2Id = '507f1f77bcf86cd799439012';
    
    // Create leases in different realms
    const leaseRepository = DataAccess.getLeaseRepository();
    await leaseRepository.create({
      realmId: realm1Id,
      name: 'Realm 1 Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    await leaseRepository.create({
      realmId: realm2Id,
      name: 'Realm 2 Lease',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    });
    
    // Query realm 1
    const { req: req1, res: res1 } = createMockReqRes();
    req1.realm._id = realm1Id;
    
    await leaseManager.all(req1, res1);
    
    // Verify only realm 1 lease is returned
    expect(res1._json).toHaveLength(1);
    expect(res1._json[0].name).toBe('Realm 1 Lease');
    
    // Query realm 2
    const { req: req2, res: res2 } = createMockReqRes();
    req2.realm._id = realm2Id;
    
    await leaseManager.all(req2, res2);
    
    // Verify only realm 2 lease is returned
    expect(res2._json).toHaveLength(1);
    expect(res2._json[0].name).toBe('Realm 2 Lease');
  });

  it('should return leases sorted by name', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create leases in non-alphabetical order
    const leaseRepository = DataAccess.getLeaseRepository();
    await leaseRepository.create({
      realmId,
      name: 'Zulu Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    await leaseRepository.create({
      realmId,
      name: 'Alpha Lease',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    });
    
    await leaseRepository.create({
      realmId,
      name: 'Mike Lease',
      numberOfTerms: 3,
      timeRange: 'months',
      active: true
    });
    
    const { req, res } = createMockReqRes();
    
    // Call all function
    await leaseManager.all(req, res);
    
    // Verify response is sorted by name
    expect(res._json).toHaveLength(3);
    expect(res._json[0].name).toBe('Alpha Lease');
    expect(res._json[1].name).toBe('Mike Lease');
    expect(res._json[2].name).toBe('Zulu Lease');
  });

  it('should enrich leases with usedByTenants field', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create leases
    const leaseRepository = DataAccess.getLeaseRepository();
    const usedLease = await leaseRepository.create({
      realmId,
      name: 'Used Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const unusedLease = await leaseRepository.create({
      realmId,
      name: 'Unused Lease',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    });
    
    // Create a tenant using the first lease
    const tenantRepository = DataAccess.getTenantRepository();
    await tenantRepository.create({
      realmId,
      name: 'Test Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(usedLease._id),
      properties: [],
      rents: []
    });
    
    const { req, res } = createMockReqRes();
    
    // Call all function
    await leaseManager.all(req, res);
    
    // Verify usedByTenants field is set correctly
    expect(res._json).toHaveLength(2);
    
    const usedLeaseResult = res._json.find(l => l.name === 'Used Lease');
    const unusedLeaseResult = res._json.find(l => l.name === 'Unused Lease');
    
    expect(usedLeaseResult.usedByTenants).toBe(true);
    expect(unusedLeaseResult.usedByTenants).toBe(false);
  });

  it('should return plain objects from repository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const leaseRepository = DataAccess.getLeaseRepository();
    await leaseRepository.create({
      realmId,
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const { req, res } = createMockReqRes();
    await leaseManager.all(req, res);
    
    // Verify response contains plain objects (no Mongoose methods)
    expect(res._json).toHaveLength(1);
    expect(res._json[0].save).toBeUndefined();
    expect(res._json[0].toObject).toBeUndefined();
  });
});

describe('LeaseManager - one() function with repositories', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should return single lease using LeaseRepository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create test leases
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease1 = await leaseRepository.create({
      realmId,
      name: 'Lease 1',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    await leaseRepository.create({
      realmId,
      name: 'Lease 2',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    });
    
    const { req, res } = createMockReqRes({}, { id: String(lease1._id) });
    
    // Call one function
    await leaseManager.one(req, res);
    
    // Verify response
    expect(res._json).toBeDefined();
    expect(res._json.name).toBe('Lease 1');
    expect(res._json._id.toString()).toBe(String(lease1._id));
  });

  it('should throw error when lease not found', async () => {
    const { req, res } = createMockReqRes({}, { id: '507f1f77bcf86cd799439099' });
    
    // Call one function
    await expect(leaseManager.one(req, res)).rejects.toThrow('lease not found');
  });

  it('should only return lease from the specified realm', async () => {
    const realm1Id = '507f1f77bcf86cd799439011';
    const realm2Id = '507f1f77bcf86cd799439012';
    
    // Create leases in different realms
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease1 = await leaseRepository.create({
      realmId: realm1Id,
      name: 'Realm 1 Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const lease2 = await leaseRepository.create({
      realmId: realm2Id,
      name: 'Realm 2 Lease',
      numberOfTerms: 6,
      timeRange: 'months',
      active: true
    });
    
    // Query lease1 from realm1
    const { req: req1, res: res1 } = createMockReqRes({}, { id: String(lease1._id) });
    req1.realm._id = realm1Id;
    
    await leaseManager.one(req1, res1);
    
    // Verify lease1 is returned
    expect(res1._json).toBeDefined();
    expect(res1._json.name).toBe('Realm 1 Lease');
    
    // Try to query lease1 from realm2 (should throw error)
    const { req: req2, res: res2 } = createMockReqRes({}, { id: String(lease1._id) });
    req2.realm._id = realm2Id;
    
    await expect(leaseManager.one(req2, res2)).rejects.toThrow('lease not found');
    
    // Query lease2 from realm2
    const { req: req3, res: res3 } = createMockReqRes({}, { id: String(lease2._id) });
    req3.realm._id = realm2Id;
    
    await leaseManager.one(req3, res3);
    
    // Verify lease2 is returned
    expect(res3._json).toBeDefined();
    expect(res3._json.name).toBe('Realm 2 Lease');
  });

  it('should enrich lease with usedByTenants field', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    // Create a lease
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    // Create a tenant using this lease
    const tenantRepository = DataAccess.getTenantRepository();
    await tenantRepository.create({
      realmId,
      name: 'Test Tenant',
      isCompany: false,
      beginDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      leaseId: String(lease._id),
      properties: [],
      rents: []
    });
    
    const { req, res } = createMockReqRes({}, { id: String(lease._id) });
    
    // Call one function
    await leaseManager.one(req, res);
    
    // Verify usedByTenants field is set
    expect(res._json).toBeDefined();
    expect(res._json.usedByTenants).toBe(true);
  });

  it('should return plain object from repository', async () => {
    const realmId = '507f1f77bcf86cd799439011';
    
    const leaseRepository = DataAccess.getLeaseRepository();
    const lease = await leaseRepository.create({
      realmId,
      name: 'Test Lease',
      numberOfTerms: 12,
      timeRange: 'months',
      active: true
    });
    
    const { req, res } = createMockReqRes({}, { id: String(lease._id) });
    await leaseManager.one(req, res);
    
    // Verify response is a plain object (no Mongoose methods)
    expect(res._json.save).toBeUndefined();
    expect(res._json.toObject).toBeUndefined();
  });
});
