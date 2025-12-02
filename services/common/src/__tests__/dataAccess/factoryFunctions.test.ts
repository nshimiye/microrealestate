import { describe, it, expect } from 'vitest';
import {
  getAccountRepository,
  getTenantRepository,
  getRealmRepository,
} from '../../dataAccess/index.js';
import AccountRepository from '../../dataAccess/AccountRepository.js';
import TenantRepository from '../../dataAccess/TenantRepository.js';
import RealmRepository from '../../dataAccess/RealmRepository.js';

describe('Repository Factory Functions', () => {
  describe('getAccountRepository', () => {
    it('should return an AccountRepository instance', () => {
      const repository = getAccountRepository();
      expect(repository).toBeInstanceOf(AccountRepository);
    });

    it('should return the same instance on multiple calls (singleton)', () => {
      const repository1 = getAccountRepository();
      const repository2 = getAccountRepository();
      expect(repository1).toBe(repository2);
    });

    it('should return a properly initialized instance with all methods', () => {
      const repository = getAccountRepository();
      expect(repository.findByEmail).toBeDefined();
      expect(repository.findById).toBeDefined();
      expect(repository.create).toBeDefined();
      expect(repository.updatePassword).toBeDefined();
      expect(typeof repository.findByEmail).toBe('function');
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.create).toBe('function');
      expect(typeof repository.updatePassword).toBe('function');
    });
  });

  describe('getTenantRepository', () => {
    it('should return a TenantRepository instance', () => {
      const repository = getTenantRepository();
      expect(repository).toBeInstanceOf(TenantRepository);
    });

    it('should return the same instance on multiple calls (singleton)', () => {
      const repository1 = getTenantRepository();
      const repository2 = getTenantRepository();
      expect(repository1).toBe(repository2);
    });

    it('should return a properly initialized instance with all methods', () => {
      const repository = getTenantRepository();
      expect(repository.findByContactEmail).toBeDefined();
      expect(repository.findById).toBeDefined();
      expect(typeof repository.findByContactEmail).toBe('function');
      expect(typeof repository.findById).toBe('function');
    });
  });

  describe('getRealmRepository', () => {
    it('should return a RealmRepository instance', () => {
      const repository = getRealmRepository();
      expect(repository).toBeInstanceOf(RealmRepository);
    });

    it('should return the same instance on multiple calls (singleton)', () => {
      const repository1 = getRealmRepository();
      const repository2 = getRealmRepository();
      expect(repository1).toBe(repository2);
    });

    it('should return a properly initialized instance with all methods', () => {
      const repository = getRealmRepository();
      expect(repository.findById).toBeDefined();
      expect(repository.updateMemberRegistration).toBeDefined();
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.updateMemberRegistration).toBe('function');
    });
  });

  describe('Factory function independence', () => {
    it('should return different instances for different repository types', () => {
      const accountRepo = getAccountRepository();
      const tenantRepo = getTenantRepository();
      const realmRepo = getRealmRepository();

      expect(accountRepo).not.toBe(tenantRepo);
      expect(accountRepo).not.toBe(realmRepo);
      expect(tenantRepo).not.toBe(realmRepo);
    });
  });
});
