import * as DashboardManager from '../../managers/dashboardmanager.js';
import * as fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataAccess } from '@microrealestate/common';
import moment from 'moment';

describe('DashboardManager - all function', () => {
  let mockTenantRepository;
  let mockPropertyRepository;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Mock TenantRepository
    mockTenantRepository = {
      findAll: vi.fn()
    };

    // Mock PropertyRepository
    mockPropertyRepository = {
      countByRealmId: vi.fn()
    };

    // Mock DataAccess to return our mocked repositories
    vi.spyOn(DataAccess, 'getTenantRepository').mockReturnValue(mockTenantRepository);
    vi.spyOn(DataAccess, 'getPropertyRepository').mockReturnValue(mockPropertyRepository);

    // Mock request object
    mockReq = {
      headers: {
        organizationid: 'test-realm-id'
      }
    };

    // Mock response object
    mockRes = {
      json: vi.fn()
    };
  });

  describe('Active tenant filtering', () => {
    it('should filter tenants with terminationDate >= current date', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(30, 'days').toDate();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Active Tenant 1',
          terminationDate: futureDate,
          endDate: moment(now).add(365, 'days').toDate(),
          properties: [{ propertyId: 'prop1' }],
          rents: []
        },
        {
          _id: 'tenant2',
          name: 'Active Tenant 2',
          terminationDate: now.toDate(), // Same day should be included
          endDate: moment(now).add(365, 'days').toDate(),
          properties: [{ propertyId: 'prop2' }],
          rents: []
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Both tenants should be counted as active
      expect(response.overview.tenantCount).toBe(2);
    });

    it('should filter tenants with endDate >= current date when no terminationDate', async () => {
      // Arrange
      const now = moment();
      const futureEndDate = moment(now).add(180, 'days').toDate();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Active Tenant',
          terminationDate: null,
          endDate: futureEndDate,
          properties: [{ propertyId: 'prop1' }],
          rents: []
        },
        {
          _id: 'tenant2',
          name: 'Active Tenant 2',
          terminationDate: undefined,
          endDate: now.toDate(), // Same day should be included
          properties: [{ propertyId: 'prop2' }],
          rents: []
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Both tenants should be counted as active
      expect(response.overview.tenantCount).toBe(2);
    });

    it('should exclude tenants with past dates', async () => {
      // Arrange
      const now = moment();
      const pastDate = moment(now).subtract(30, 'days').toDate();
      const futureDate = moment(now).add(30, 'days').toDate();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Inactive Tenant',
          terminationDate: pastDate,
          endDate: moment(now).add(365, 'days').toDate(),
          properties: [{ propertyId: 'prop1' }],
          rents: []
        },
        {
          _id: 'tenant2',
          name: 'Active Tenant',
          terminationDate: futureDate,
          endDate: moment(now).add(365, 'days').toDate(),
          properties: [{ propertyId: 'prop2' }],
          rents: []
        },
        {
          _id: 'tenant3',
          name: 'Inactive Tenant 2',
          terminationDate: null,
          endDate: pastDate,
          properties: [{ propertyId: 'prop3' }],
          rents: []
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Only tenant2 should be counted as active
      expect(response.overview.tenantCount).toBe(1);
    });
  });

  describe('Occupancy rate calculation', () => {
    it('should calculate occupancy rate with multiple active tenants', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [
            { propertyId: 'prop1' },
            { propertyId: 'prop2' }
          ],
          rents: []
        },
        {
          _id: 'tenant2',
          name: 'Tenant 2',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [
            { propertyId: 'prop2' }, // Same property as tenant1
            { propertyId: 'prop3' }
          ],
          rents: []
        },
        {
          _id: 'tenant3',
          name: 'Tenant 3',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [
            { propertyId: 'prop4' }
          ],
          rents: []
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(10);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // 4 unique properties rented (prop1, prop2, prop3, prop4) out of 10 total
      expect(response.overview.occupancyRate).toBe(0.4);
    });

    it('should return undefined occupancy rate when no properties exist', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: []
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(0);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Occupancy rate should be undefined when propertyCount is 0
      expect(response.overview.occupancyRate).toBeUndefined();
    });

    it('should return 0 occupancy rate when no active tenants', async () => {
      // Arrange
      const now = moment();
      const pastDate = moment(now).subtract(30, 'days').toDate();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Inactive Tenant',
          terminationDate: pastDate,
          endDate: pastDate,
          properties: [{ propertyId: 'prop1' }],
          rents: []
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // No active tenants means 0 properties rented
      expect(response.overview.occupancyRate).toBe(0);
    });

    it('should count unique properties using Set', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [
            { propertyId: 'prop1' },
            { propertyId: 'prop1' }, // Duplicate
            { propertyId: 'prop2' }
          ],
          rents: []
        },
        {
          _id: 'tenant2',
          name: 'Tenant 2',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [
            { propertyId: 'prop1' }, // Same as tenant1
            { propertyId: 'prop2' }  // Same as tenant1
          ],
          rents: []
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Only 2 unique properties (prop1, prop2) out of 5 total
      expect(response.overview.occupancyRate).toBe(0.4);
    });
  });

  describe('Year revenue calculation', () => {
    it('should sum payments within current year', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentYear = now.year();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: [
                { date: `15/01/${currentYear}`, amount: 500 },
                { date: `20/01/${currentYear}`, amount: 500 }
              ]
            },
            {
              term: parseInt(moment(`${currentYear}0201`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: [
                { date: `15/02/${currentYear}`, amount: 1000 }
              ]
            }
          ]
        },
        {
          _id: 'tenant2',
          name: 'Tenant 2',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop2' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0301`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1500, grandTotal: 1500 },
              payments: [
                { date: `10/03/${currentYear}`, amount: 1500 }
              ]
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Total: 500 + 500 + 1000 + 1500 = 3500
      expect(response.overview.totalYearRevenues).toBe(3500);
    });

    it('should exclude payments outside year boundaries', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentYear = now.year();
      const lastYear = currentYear - 1;
      const nextYear = currentYear + 1;
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: [
                { date: `15/12/${lastYear}`, amount: 500 },      // Last year - excluded
                { date: `15/01/${currentYear}`, amount: 1000 },  // Current year - included
                { date: `15/01/${nextYear}`, amount: 500 }       // Next year - excluded
              ]
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Only the current year payment should be counted
      expect(response.overview.totalYearRevenues).toBe(1000);
    });

    it('should skip payments with no date', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentYear = now.year();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: [
                { date: null, amount: 500 },                     // No date - excluded
                { date: undefined, amount: 300 },                // No date - excluded
                { date: `15/01/${currentYear}`, amount: 1000 }   // Valid - included
              ]
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Only the payment with a valid date should be counted
      expect(response.overview.totalYearRevenues).toBe(1000);
    });

    it('should skip payments with zero amount', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentYear = now.year();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: [
                { date: `10/01/${currentYear}`, amount: 0 },     // Zero amount - excluded
                { date: `15/01/${currentYear}`, amount: 1000 }   // Valid - included
              ]
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Only the non-zero payment should be counted
      expect(response.overview.totalYearRevenues).toBe(1000);
    });
  });

  describe('Top unpaid calculation', () => {
    it('should find current month rent for active tenants', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentMonthTerm = parseInt(now.format('YYYYMMDDHH'));
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: currentMonthTerm,
              total: { payment: 500, grandTotal: 1000 },
              payments: []
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Should find the current month rent
      expect(response.topUnpaid).toHaveLength(1);
      expect(response.topUnpaid[0].tenant._id).toBe('tenant1');
    });

    it('should calculate balance as payment minus grandTotal', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentMonthTerm = parseInt(now.format('YYYYMMDDHH'));
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: currentMonthTerm,
              total: { payment: 300, grandTotal: 1000 },
              payments: []
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Balance should be 300 - 1000 = -700
      expect(response.topUnpaid[0].balance).toBe(-700);
    });

    it('should sort tenants by balance ascending', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentMonthTerm = parseInt(now.format('YYYYMMDDHH'));
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: currentMonthTerm,
              total: { payment: 500, grandTotal: 1000 },  // Balance: -500
              payments: []
            }
          ]
        },
        {
          _id: 'tenant2',
          name: 'Tenant 2',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop2' }],
          rents: [
            {
              term: currentMonthTerm,
              total: { payment: 100, grandTotal: 1000 },  // Balance: -900 (most unpaid)
              payments: []
            }
          ]
        },
        {
          _id: 'tenant3',
          name: 'Tenant 3',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop3' }],
          rents: [
            {
              term: currentMonthTerm,
              total: { payment: 800, grandTotal: 1000 },  // Balance: -200
              payments: []
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Should be sorted by balance ascending (most negative first)
      expect(response.topUnpaid).toHaveLength(3);
      expect(response.topUnpaid[0].tenant._id).toBe('tenant2'); // -900
      expect(response.topUnpaid[1].tenant._id).toBe('tenant1'); // -500
      expect(response.topUnpaid[2].tenant._id).toBe('tenant3'); // -200
    });

    it('should filter to negative balances only', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentMonthTerm = parseInt(now.format('YYYYMMDDHH'));
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1 - Unpaid',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: currentMonthTerm,
              total: { payment: 500, grandTotal: 1000 },  // Balance: -500 (negative)
              payments: []
            }
          ]
        },
        {
          _id: 'tenant2',
          name: 'Tenant 2 - Paid',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop2' }],
          rents: [
            {
              term: currentMonthTerm,
              total: { payment: 1000, grandTotal: 1000 },  // Balance: 0 (not negative)
              payments: []
            }
          ]
        },
        {
          _id: 'tenant3',
          name: 'Tenant 3 - Overpaid',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop3' }],
          rents: [
            {
              term: currentMonthTerm,
              total: { payment: 1200, grandTotal: 1000 },  // Balance: 200 (positive)
              payments: []
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Only tenant1 with negative balance should be included
      expect(response.topUnpaid).toHaveLength(1);
      expect(response.topUnpaid[0].tenant._id).toBe('tenant1');
    });

    it('should limit to top 5 results', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentMonthTerm = parseInt(now.format('YYYYMMDDHH'));
      
      // Create 7 tenants with negative balances
      const tenants = Array.from({ length: 7 }, (_, i) => ({
        _id: `tenant${i + 1}`,
        name: `Tenant ${i + 1}`,
        terminationDate: futureDate,
        endDate: futureDate,
        properties: [{ propertyId: `prop${i + 1}` }],
        rents: [
          {
            term: currentMonthTerm,
            total: { payment: 100 * (i + 1), grandTotal: 1000 },  // Different balances
            payments: []
          }
        ]
      }));

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(10);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Should only return top 5 most unpaid
      expect(response.topUnpaid).toHaveLength(5);
    });
  });

  describe('Monthly revenues calculation', () => {
    it('should create entries for all 12 months', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [] // No rents, but should still have 12 months
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Should have 12 months
      expect(response.revenues).toHaveLength(12);
    });

    it('should sum paid and notPaid per month', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentYear = now.year();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 800, grandTotal: 1000 },  // notPaid: -200
              payments: []
            }
          ]
        },
        {
          _id: 'tenant2',
          name: 'Tenant 2',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop2' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1200, grandTotal: 1000 },  // notPaid: 0 (positive balance)
              payments: []
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Find January revenue
      const januaryKey = moment(`1/${currentYear}`, 'MM/YYYY').format('MMYYYY');
      const januaryRevenue = response.revenues.find(r => r.month === januaryKey);
      
      // paid should be sum of both: 800 + 1200 = 2000
      expect(januaryRevenue.paid).toBe(2000);
      // notPaid should only include negative: -200
      expect(januaryRevenue.notPaid).toBe(-200);
    });

    it('should filter rents by current year', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentYear = now.year();
      const lastYear = currentYear - 1;
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: parseInt(moment(`${lastYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: []
            },
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1500, grandTotal: 1000 },
              payments: []
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Find January revenue for current year
      const januaryKey = moment(`1/${currentYear}`, 'MM/YYYY').format('MMYYYY');
      const januaryRevenue = response.revenues.find(r => r.month === januaryKey);
      
      // Should only include current year rent
      expect(januaryRevenue.paid).toBe(1500);
    });

    it('should round amounts to 2 decimal places', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentYear = now.year();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000.456, grandTotal: 1000 },
              payments: []
            }
          ]
        },
        {
          _id: 'tenant2',
          name: 'Tenant 2',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop2' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 333.333, grandTotal: 1000 },  // notPaid: -666.667
              payments: []
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Find January revenue
      const januaryKey = moment(`1/${currentYear}`, 'MM/YYYY').format('MMYYYY');
      const januaryRevenue = response.revenues.find(r => r.month === januaryKey);
      
      // Should be rounded to 2 decimal places
      expect(januaryRevenue.paid).toBe(1333.79); // 1000.456 + 333.333 = 1333.789 -> 1333.79
      expect(januaryRevenue.notPaid).toBe(-666.67); // -666.667 -> -666.67
    });

    it('should sort results by month chronologically', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentYear = now.year();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0601`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: []
            },
            {
              term: parseInt(moment(`${currentYear}0301`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: []
            },
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: []
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Should be sorted chronologically (January, February, March, ...)
      const months = response.revenues.map(r => r.month);
      const januaryKey = moment(`1/${currentYear}`, 'MM/YYYY').format('MMYYYY');
      const februaryKey = moment(`2/${currentYear}`, 'MM/YYYY').format('MMYYYY');
      const marchKey = moment(`3/${currentYear}`, 'MM/YYYY').format('MMYYYY');
      
      expect(months[0]).toBe(januaryKey);
      expect(months[1]).toBe(februaryKey);
      expect(months[2]).toBe(marchKey);
    });
  });

  describe('Response structure', () => {
    it('should return overview object structure with data', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentYear = now.year();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: [
                { date: `15/01/${currentYear}`, amount: 1000 }
              ]
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Verify overview structure
      expect(response.overview).toBeDefined();
      expect(response.overview).toHaveProperty('tenantCount');
      expect(response.overview).toHaveProperty('propertyCount');
      expect(response.overview).toHaveProperty('occupancyRate');
      expect(response.overview).toHaveProperty('totalYearRevenues');
      
      // Verify values
      expect(response.overview.tenantCount).toBe(1);
      expect(response.overview.propertyCount).toBe(5);
      expect(response.overview.occupancyRate).toBe(0.2); // 1 property rented / 5 total
      expect(response.overview.totalYearRevenues).toBe(1000);
    });

    it('should return null overview when no tenants or properties', async () => {
      // Arrange
      mockTenantRepository.findAll.mockResolvedValue([]);
      mockPropertyRepository.countByRealmId.mockResolvedValue(0);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Overview should be null when no data
      expect(response.overview).toBeNull();
    });

    it('should return topUnpaid array structure', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentMonthTerm = parseInt(now.format('YYYYMMDDHH'));
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: currentMonthTerm,
              total: { payment: 500, grandTotal: 1000 },
              payments: []
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Verify topUnpaid structure
      expect(Array.isArray(response.topUnpaid)).toBe(true);
      expect(response.topUnpaid).toHaveLength(1);
      
      const unpaidEntry = response.topUnpaid[0];
      expect(unpaidEntry).toHaveProperty('tenant');
      expect(unpaidEntry).toHaveProperty('balance');
      expect(unpaidEntry).toHaveProperty('rent');
      
      // Verify tenant is a plain object
      expect(unpaidEntry.tenant._id).toBe('tenant1');
      expect(unpaidEntry.balance).toBe(-500);
      expect(unpaidEntry.rent.term).toBe(currentMonthTerm);
    });

    it('should return empty array for topUnpaid when no tenants or properties', async () => {
      // Arrange
      mockTenantRepository.findAll.mockResolvedValue([]);
      mockPropertyRepository.countByRealmId.mockResolvedValue(0);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // topUnpaid should be empty array when no data
      expect(Array.isArray(response.topUnpaid)).toBe(true);
      expect(response.topUnpaid).toHaveLength(0);
    });

    it('should return revenues array structure', async () => {
      // Arrange
      const now = moment();
      const futureDate = moment(now).add(180, 'days').toDate();
      const currentYear = now.year();
      
      const tenants = [
        {
          _id: 'tenant1',
          name: 'Tenant 1',
          terminationDate: futureDate,
          endDate: futureDate,
          properties: [{ propertyId: 'prop1' }],
          rents: [
            {
              term: parseInt(moment(`${currentYear}0101`, 'YYYYMMDD').format('YYYYMMDDHH')),
              total: { payment: 1000, grandTotal: 1000 },
              payments: []
            }
          ]
        }
      ];

      mockTenantRepository.findAll.mockResolvedValue(tenants);
      mockPropertyRepository.countByRealmId.mockResolvedValue(5);

      // Act
      await DashboardManager.all(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledOnce();
      const response = mockRes.json.mock.calls[0][0];
      
      // Verify revenues structure
      expect(Array.isArray(response.revenues)).toBe(true);
      expect(response.revenues).toHaveLength(12); // All 12 months
      
      // Verify each revenue entry has correct structure
      response.revenues.forEach(revenue => {
        expect(revenue).toHaveProperty('month');
        expect(revenue).toHaveProperty('paid');
        expect(revenue).toHaveProperty('notPaid');
        expect(typeof revenue.month).toBe('string');
        expect(typeof revenue.paid).toBe('number');
        expect(typeof revenue.notPaid).toBe('number');
      });
    });
  });
});

describe('Property-Based Tests for Dashboard Calculations', () => {
  let localMockTenantRepository;
  let localMockPropertyRepository;
  let localMockReq;
  let localMockRes;

  beforeEach(() => {
    // Set up local mocks for property-based tests
    localMockTenantRepository = {
      findAll: vi.fn()
    };

    localMockPropertyRepository = {
      countByRealmId: vi.fn()
    };

    vi.spyOn(DataAccess, 'getTenantRepository').mockReturnValue(localMockTenantRepository);
    vi.spyOn(DataAccess, 'getPropertyRepository').mockReturnValue(localMockPropertyRepository);

    localMockReq = {
      headers: {
        organizationid: 'test-realm-id'
      }
    };

    localMockRes = {
      json: vi.fn()
    };
  });

  describe('Property 3: Active tenant filtering preserves logic', () => {
    it('should correctly filter active tenants for any set of tenants and dates', async () => {
      // Feature: api-dashboard-data-access-layer, Property 3: Active tenant filtering preserves logic
      // Validates: Requirements 6.1, 6.2
      
      await fc.assert(
        fc.asyncProperty(
          // Generate an array of tenants with random dates relative to "now"
          fc.array(
            fc.record({
              _id: fc.string({ minLength: 1, maxLength: 24 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              terminationDate: fc.option(fc.date({ min: new Date('2019-01-01'), max: new Date('2031-12-31') }), { nil: null }),
              endDate: fc.date({ min: new Date('2019-01-01'), max: new Date('2031-12-31') }),
              properties: fc.array(
                fc.record({
                  propertyId: fc.string({ minLength: 1, maxLength: 24 })
                }),
                { minLength: 0, maxLength: 5 }
              ),
              rents: fc.constant([])
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (tenants) => {
            // Arrange
            // Use the actual current moment that the code will use
            const now = moment();
            localMockReq.headers.organizationid = 'test-realm';
            
            localMockTenantRepository.findAll.mockResolvedValue(tenants);
            localMockPropertyRepository.countByRealmId.mockResolvedValue(10);

            // Act
            await DashboardManager.all(localMockReq, localMockRes);

            // Assert
            const response = localMockRes.json.mock.calls[localMockRes.json.mock.calls.length - 1][0];
            
            // Manually compute expected active tenant count using the same logic as the code
            const expectedActiveTenants = tenants.filter(tenant => {
              const terminationMoment = tenant.terminationDate
                ? moment(tenant.terminationDate)
                : moment(tenant.endDate);
              // Use startOf('day') to match the code's comparison logic
              return terminationMoment.startOf('day').isSameOrAfter(now.startOf('day'));
            });

            // Property: The tenant count should match the number of tenants with terminationDate/endDate >= current date
            expect(response.overview?.tenantCount || 0).toBe(expectedActiveTenants.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Occupancy rate calculation preserves logic', () => {
    it('should calculate occupancy rate correctly for any set of active tenants and properties', async () => {
      // Feature: api-dashboard-data-access-layer, Property 4: Occupancy rate calculation preserves logic
      // Validates: Requirements 7.1, 7.2
      
      await fc.assert(
        fc.asyncProperty(
          // Generate property count (including 0 as edge case)
          fc.nat({ max: 100 }),
          async (propertyCount) => {
            // Generate active tenants with properties constrained by propertyCount
            // This ensures we can't have more rented properties than total properties
            const tenants = propertyCount > 0 ? await fc.sample(
              fc.array(
                fc.record({
                  _id: fc.string({ minLength: 1, maxLength: 24 }),
                  name: fc.string({ minLength: 1, maxLength: 50 }),
                  terminationDate: fc.constant(moment().add(180, 'days').toDate()),
                  endDate: fc.constant(moment().add(180, 'days').toDate()),
                  properties: fc.array(
                    fc.record({
                      // Generate property IDs from 0 to propertyCount-1 to ensure valid range
                      propertyId: fc.integer({ min: 0, max: propertyCount - 1 }).map(n => `prop${n}`)
                    }),
                    { minLength: 0, maxLength: Math.min(5, propertyCount) }
                  ),
                  rents: fc.constant([])
                }),
                { minLength: 0, maxLength: 20 }
              ),
              1
            ) : [[]]; // Empty tenants when propertyCount is 0

            // Arrange
            localMockReq.headers.organizationid = 'test-realm';
            
            localMockTenantRepository.findAll.mockResolvedValue(tenants[0]);
            localMockPropertyRepository.countByRealmId.mockResolvedValue(propertyCount);

            // Act
            await DashboardManager.all(localMockReq, localMockRes);

            // Assert
            const response = localMockRes.json.mock.calls[localMockRes.json.mock.calls.length - 1][0];
            
            // Property: Occupancy rate should be between 0 and 1 (or undefined if no properties)
            if (propertyCount === 0) {
              // When there are no properties, occupancy rate should be undefined
              expect(response.overview?.occupancyRate).toBeUndefined();
            } else {
              // Manually compute expected occupancy rate
              const uniqueProperties = new Set();
              tenants[0].forEach(tenant => {
                (tenant.properties || []).forEach(({ propertyId }) => {
                  uniqueProperties.add(propertyId);
                });
              });
              const expectedOccupancyRate = uniqueProperties.size / propertyCount;

              expect(response.overview?.occupancyRate).toBe(expectedOccupancyRate);
              expect(response.overview?.occupancyRate).toBeGreaterThanOrEqual(0);
              expect(response.overview?.occupancyRate).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Year revenue calculation preserves logic', () => {
    it('should sum year revenues correctly for any set of tenants and payments', async () => {
      // Feature: api-dashboard-data-access-layer, Property 5: Year revenue calculation preserves logic
      // Validates: Requirements 8.1, 8.2
      
      await fc.assert(
        fc.asyncProperty(
          // Generate tenants with rents and payments for the current year
          fc.array(
            fc.record({
              _id: fc.string({ minLength: 1, maxLength: 24 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              terminationDate: fc.constant(moment().add(180, 'days').toDate()),
              endDate: fc.constant(moment().add(180, 'days').toDate()),
              properties: fc.array(
                fc.record({
                  propertyId: fc.string({ minLength: 1, maxLength: 24 })
                }),
                { minLength: 0, maxLength: 3 }
              ),
              rents: fc.array(
                fc.record({
                  term: fc.integer({ min: 2019010100, max: 2031123100 }),
                  total: fc.record({
                    payment: fc.float({ min: 0, max: 10000, noNaN: true }),
                    grandTotal: fc.float({ min: 0, max: 10000, noNaN: true })
                  }),
                  payments: fc.array(
                    fc.record({
                      date: fc.option(
                        fc.date({ min: new Date('2019-01-01'), max: new Date('2031-12-31') })
                          .map(d => moment(d).format('DD/MM/YYYY')),
                        { nil: null }
                      ),
                      amount: fc.float({ min: 0, max: 5000, noNaN: true })
                    }),
                    { minLength: 0, maxLength: 5 }
                  )
                }),
                { minLength: 0, maxLength: 5 }
              )
            }),
            { minLength: 0, maxLength: 10 }
          ),
          async (tenants) => {
            // Arrange
            // Use the current year that the code will use
            const beginOfTheYear = moment().startOf('year');
            const endOfTheYear = moment().endOf('year');
            
            localMockReq.headers.organizationid = 'test-realm';
            localMockTenantRepository.findAll.mockResolvedValue(tenants);
            localMockPropertyRepository.countByRealmId.mockResolvedValue(10);

            // Act
            await DashboardManager.all(localMockReq, localMockRes);

            // Assert
            const response = localMockRes.json.mock.calls[localMockRes.json.mock.calls.length - 1][0];
            
            // Manually compute expected year revenues for the current year
            let expectedRevenues = 0;
            tenants.forEach(tenant => {
              tenant.rents.forEach(rent => {
                rent.payments.forEach(payment => {
                  if (!payment.date || payment.amount === 0) {
                    return;
                  }
                  const paymentMoment = moment(payment.date, 'DD/MM/YYYY');
                  if (paymentMoment.isBetween(beginOfTheYear, endOfTheYear, 'day', '[]')) {
                    expectedRevenues += payment.amount;
                  }
                });
              });
            });

            // Property: Total year revenues should be non-negative and match expected sum
            expect(response.overview?.totalYearRevenues || 0).toBeGreaterThanOrEqual(0);
            expect(response.overview?.totalYearRevenues || 0).toBeCloseTo(expectedRevenues, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Top unpaid calculation preserves logic', () => {
    it('should correctly sort and filter top unpaid tenants', async () => {
      // Feature: api-dashboard-data-access-layer, Property 6: Top unpaid calculation preserves logic
      // Validates: Requirements 9.1, 9.2
      
      await fc.assert(
        fc.asyncProperty(
          // Generate active tenants with current month rents
          fc.array(
            fc.record({
              _id: fc.string({ minLength: 1, maxLength: 24 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              terminationDate: fc.constant(moment().add(180, 'days').toDate()),
              endDate: fc.constant(moment().add(180, 'days').toDate()),
              properties: fc.array(
                fc.record({
                  propertyId: fc.string({ minLength: 1, maxLength: 24 })
                }),
                { minLength: 1, maxLength: 3 }
              ),
              rents: fc.array(
                fc.record({
                  term: fc.constant(parseInt(moment().format('YYYYMMDDHH'))),
                  total: fc.record({
                    payment: fc.float({ min: 0, max: 2000, noNaN: true }),
                    grandTotal: fc.float({ min: 0, max: 2000, noNaN: true })
                  }),
                  payments: fc.constant([])
                }),
                { minLength: 1, maxLength: 1 }
              )
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (tenants) => {
            // Arrange
            localMockReq.headers.organizationid = 'test-realm';
            
            localMockTenantRepository.findAll.mockResolvedValue(tenants);
            localMockPropertyRepository.countByRealmId.mockResolvedValue(10);

            // Act
            await DashboardManager.all(localMockReq, localMockRes);

            // Assert
            const response = localMockRes.json.mock.calls[localMockRes.json.mock.calls.length - 1][0];
            
            // Manually compute expected top unpaid
            const unpaidTenants = tenants
              .map(tenant => {
                const currentRent = tenant.rents[0];
                const balance = currentRent.total.payment - currentRent.total.grandTotal;
                return { tenant, balance, rent: currentRent };
              })
              .filter(t => t.balance < 0)
              .sort((t1, t2) => t1.balance - t2.balance)
              .slice(0, 5);

            // Property: Results should be sorted by balance ascending and limited to 5
            expect(response.topUnpaid.length).toBeLessThanOrEqual(5);
            expect(response.topUnpaid.length).toBe(Math.min(unpaidTenants.length, 5));
            
            // All balances should be negative
            response.topUnpaid.forEach(entry => {
              expect(entry.balance).toBeLessThan(0);
            });
            
            // Should be sorted by balance ascending
            for (let i = 1; i < response.topUnpaid.length; i++) {
              expect(response.topUnpaid[i].balance).toBeGreaterThanOrEqual(response.topUnpaid[i - 1].balance);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Monthly revenues calculation preserves logic', () => {
    it('should correctly aggregate monthly revenues for any set of tenants', async () => {
      // Feature: api-dashboard-data-access-layer, Property 7: Monthly revenues calculation preserves logic
      // Validates: Requirements 10.1, 10.2
      
      await fc.assert(
        fc.asyncProperty(
          // Generate tenants with rents for the current year
          fc.array(
            fc.record({
              _id: fc.string({ minLength: 1, maxLength: 24 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              terminationDate: fc.constant(moment().add(180, 'days').toDate()),
              endDate: fc.constant(moment().add(180, 'days').toDate()),
              properties: fc.array(
                fc.record({
                  propertyId: fc.string({ minLength: 1, maxLength: 24 })
                }),
                { minLength: 0, maxLength: 3 }
              ),
              rents: fc.array(
                fc.record({
                  term: fc.integer({ min: 2019010100, max: 2031123100 }),
                  total: fc.record({
                    payment: fc.float({ min: 0, max: 5000, noNaN: true }),
                    grandTotal: fc.float({ min: 0, max: 5000, noNaN: true })
                  }),
                  payments: fc.constant([])
                }),
                { minLength: 0, maxLength: 12 }
              )
            }),
            { minLength: 0, maxLength: 10 }
          ),
          async (tenants) => {
            // Arrange
            localMockReq.headers.organizationid = 'test-realm';
            localMockTenantRepository.findAll.mockResolvedValue(tenants);
            localMockPropertyRepository.countByRealmId.mockResolvedValue(10);

            // Act
            await DashboardManager.all(localMockReq, localMockRes);

            // Assert
            const response = localMockRes.json.mock.calls[localMockRes.json.mock.calls.length - 1][0];
            
            // Property: Should have exactly 12 months
            expect(response.revenues).toHaveLength(12);
            
            // All months should have valid structure
            response.revenues.forEach(revenue => {
              expect(revenue).toHaveProperty('month');
              expect(revenue).toHaveProperty('paid');
              expect(revenue).toHaveProperty('notPaid');
              expect(typeof revenue.paid).toBe('number');
              expect(typeof revenue.notPaid).toBe('number');
              expect(revenue.paid).toBeGreaterThanOrEqual(0);
              expect(revenue.notPaid).toBeLessThanOrEqual(0);
            });
            
            // Should be sorted chronologically
            for (let i = 1; i < response.revenues.length; i++) {
              const prev = moment(response.revenues[i - 1].month, 'MMYYYY');
              const curr = moment(response.revenues[i].month, 'MMYYYY');
              expect(curr.isAfter(prev)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
