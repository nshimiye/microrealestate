/**
 * Tests for DataAccess module exports
 * 
 * Verifies that repository getter functions are properly exported
 * and return singleton instances.
 */

import { describe, expect, it } from 'vitest';
import {
  getAccountRepository,
  getDocumentRepository,
  getLeaseRepository,
  getPropertyRepository,
  getRealmRepository,
  getSessionManager,
  getTemplateRepository,
  getTenantRepository,
} from '../../dataAccess/index.js';

describe('DataAccess Module Exports', () => {
  describe('Repository Getters', () => {
    it('should export getLeaseRepository function', () => {
      expect(getLeaseRepository).toBeDefined();
      expect(typeof getLeaseRepository).toBe('function');
    });

    it('should export getTemplateRepository function', () => {
      expect(getTemplateRepository).toBeDefined();
      expect(typeof getTemplateRepository).toBe('function');
    });

    it('should export getAccountRepository function', () => {
      expect(getAccountRepository).toBeDefined();
      expect(typeof getAccountRepository).toBe('function');
    });

    it('should export getTenantRepository function', () => {
      expect(getTenantRepository).toBeDefined();
      expect(typeof getTenantRepository).toBe('function');
    });

    it('should export getRealmRepository function', () => {
      expect(getRealmRepository).toBeDefined();
      expect(typeof getRealmRepository).toBe('function');
    });

    it('should export getPropertyRepository function', () => {
      expect(getPropertyRepository).toBeDefined();
      expect(typeof getPropertyRepository).toBe('function');
    });

    it('should export getDocumentRepository function', () => {
      expect(getDocumentRepository).toBeDefined();
      expect(typeof getDocumentRepository).toBe('function');
    });

    it('should export getSessionManager function', () => {
      expect(getSessionManager).toBeDefined();
      expect(typeof getSessionManager).toBe('function');
    });
  });

  describe('Singleton Behavior', () => {
    it('should return the same LeaseRepository instance on multiple calls', () => {
      const instance1 = getLeaseRepository();
      const instance2 = getLeaseRepository();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });

    it('should return the same TemplateRepository instance on multiple calls', () => {
      const instance1 = getTemplateRepository();
      const instance2 = getTemplateRepository();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });

    it('should return the same AccountRepository instance on multiple calls', () => {
      const instance1 = getAccountRepository();
      const instance2 = getAccountRepository();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });

    it('should return the same TenantRepository instance on multiple calls', () => {
      const instance1 = getTenantRepository();
      const instance2 = getTenantRepository();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });

    it('should return the same RealmRepository instance on multiple calls', () => {
      const instance1 = getRealmRepository();
      const instance2 = getRealmRepository();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });

    it('should return the same PropertyRepository instance on multiple calls', () => {
      const instance1 = getPropertyRepository();
      const instance2 = getPropertyRepository();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });

    it('should return the same DocumentRepository instance on multiple calls', () => {
      const instance1 = getDocumentRepository();
      const instance2 = getDocumentRepository();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });

    it('should return the same SessionManager instance on multiple calls', () => {
      const instance1 = getSessionManager();
      const instance2 = getSessionManager();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });
  });

  describe('Repository Instances', () => {
    it('should return a LeaseRepository instance with expected methods', () => {
      const repository = getLeaseRepository();
      
      expect(repository).toBeDefined();
      expect(typeof repository.create).toBe('function');
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.findAll).toBe('function');
      expect(typeof repository.update).toBe('function');
      expect(typeof repository.deleteMany).toBe('function');
      expect(typeof repository.findLeaseIdsUsedByTenants).toBe('function');
      expect(typeof repository.findByIds).toBe('function');
    });

    it('should return a TemplateRepository instance with expected methods', () => {
      const repository = getTemplateRepository();
      
      expect(repository).toBeDefined();
      expect(typeof repository.findByLinkedResources).toBe('function');
      expect(typeof repository.deleteMany).toBe('function');
      expect(typeof repository.updateMany).toBe('function');
    });
  });
});
