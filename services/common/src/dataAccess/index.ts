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
import DocumentRepository from './DocumentRepository.js';
import LeaseRepository from './LeaseRepository.js';
import PropertyRepository from './PropertyRepository.js';
import RealmRepository from './RealmRepository.js';
import SessionManager from './SessionManager.js';
import TemplateRepository from './TemplateRepository.js';
import TenantRepository from './TenantRepository.js';

// Singleton instances
let accountRepositoryInstance: AccountRepository | null = null;
let tenantRepositoryInstance: TenantRepository | null = null;
let realmRepositoryInstance: RealmRepository | null = null;
let propertyRepositoryInstance: PropertyRepository | null = null;
let documentRepositoryInstance: DocumentRepository | null = null;
let leaseRepositoryInstance: LeaseRepository | null = null;
let templateRepositoryInstance: TemplateRepository | null = null;
let sessionManagerInstance: SessionManager | null = null;

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

/**
 * Get the singleton PropertyRepository instance
 * @returns PropertyRepository instance
 */
export function getPropertyRepository(): PropertyRepository {
  if (!propertyRepositoryInstance) {
    propertyRepositoryInstance = new PropertyRepository();
  }
  return propertyRepositoryInstance;
}

/**
 * Get the singleton DocumentRepository instance
 * @returns DocumentRepository instance
 */
export function getDocumentRepository(): DocumentRepository {
  if (!documentRepositoryInstance) {
    documentRepositoryInstance = new DocumentRepository();
  }
  return documentRepositoryInstance;
}

/**
 * Get the singleton LeaseRepository instance
 * @returns LeaseRepository instance
 */
export function getLeaseRepository(): LeaseRepository {
  if (!leaseRepositoryInstance) {
    leaseRepositoryInstance = new LeaseRepository();
  }
  return leaseRepositoryInstance;
}

/**
 * Get the singleton TemplateRepository instance
 * @returns TemplateRepository instance
 */
export function getTemplateRepository(): TemplateRepository {
  if (!templateRepositoryInstance) {
    templateRepositoryInstance = new TemplateRepository();
  }
  return templateRepositoryInstance;
}

/**
 * Get the singleton SessionManager instance
 * @returns SessionManager instance
 */
export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
