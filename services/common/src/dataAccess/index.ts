/**
 * Data Access Layer
 * 
 * This module provides repository pattern implementations for database operations.
 * Repositories abstract Mongoose-specific logic and return plain JavaScript objects.
 * 
 * Usage:
 * ```typescript
 * import { DataAccess } from '@microrealestate/common';
 * 
 * const accountRepository = DataAccess.getAccountRepository();
 * const account = await accountRepository.findByEmail('user@example.com');
 * ```
 */

import AccountRepository from './AccountRepository.js';
import TenantRepository from './TenantRepository.js';
import RealmRepository from './RealmRepository.js';

// Singleton instances
let accountRepositoryInstance: AccountRepository | null = null;
let tenantRepositoryInstance: TenantRepository | null = null;
let realmRepositoryInstance: RealmRepository | null = null;

/**
 * Get the singleton AccountRepository instance
 * @returns AccountRepository instance
 */
export function getAccountRepository(): AccountRepository {
  if (!accountRepositoryInstance) {
    accountRepositoryInstance = new AccountRepository();
  }
  return accountRepositoryInstance;
}

/**
 * Get the singleton TenantRepository instance
 * @returns TenantRepository instance
 */
export function getTenantRepository(): TenantRepository {
  if (!tenantRepositoryInstance) {
    tenantRepositoryInstance = new TenantRepository();
  }
  return tenantRepositoryInstance;
}

/**
 * Get the singleton RealmRepository instance
 * @returns RealmRepository instance
 */
export function getRealmRepository(): RealmRepository {
  if (!realmRepositoryInstance) {
    realmRepositoryInstance = new RealmRepository();
  }
  return realmRepositoryInstance;
}
