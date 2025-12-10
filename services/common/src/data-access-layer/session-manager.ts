import mongoose from 'mongoose';
import axios from 'axios';
import { getLeaseRepository } from './lease/index.js';
import { getTemplateRepository } from './template/index.js';
import { getDocumentRepository } from './document/index.js';
import { getTenantRepository } from './tenant/index.js';
import logger from "../utils/logger.js";

/**
 * Session Manager for MongoDB transactions
 * 
 * Provides utilities for managing MongoDB sessions and transactions.
 * Abstracts the complexity of session lifecycle management and ensures
 * proper cleanup in all scenarios.
 * 
 * @example
 * ```typescript
 * const sessionManager = new SessionManager();
 * 
 * // Manual session management
 * const session = await sessionManager.startSession();
 * try {
 *   // Use session...
 * } finally {
 *   session.endSession();
 * }
 * 
 * // Automatic transaction management (recommended)
 * await sessionManager.withTransaction(async (session) => {
 *   await tenantRepository.deleteMany(ids, realmId);
 *   await documentRepository.deleteByTenantIds(ids, realmId);
 * });
 * ```
 */
export class SessionManager {
  /**
   * Start a new MongoDB session
   * 
   * Creates a new client session for transaction support.
   * The caller is responsible for ending the session.
   * 
   * @returns MongoDB ClientSession
   * @throws Error if session creation fails
   * 
   * @example
   * ```typescript
   * const session = await sessionManager.startSession();
   * try {
   *   session.startTransaction();
   *   // Perform operations...
   *   await session.commitTransaction();
   * } catch (error) {
   *   await session.abortTransaction();
   *   throw error;
   * } finally {
   *   session.endSession();
   * }
   * ```
   */
  async startSession(): Promise<mongoose.ClientSession> {
    return await mongoose.startSession();
  }

  /**
   * Execute a function within a transaction
   * 
   * Automatically handles session creation, transaction lifecycle,
   * and cleanup. If the function throws an error, the transaction
   * is aborted. Otherwise, it is committed.
   * 
   * The session is always ended in the finally block, ensuring
   * proper cleanup even if errors occur.
   * 
   * @param fn - Async function to execute within transaction
   * @returns Result of the function
   * @throws Error if transaction fails or function throws
   * 
   * @example
   * ```typescript
   * const result = await sessionManager.withTransaction(async (session) => {
   *   await tenantRepository.deleteMany(ids, realmId);
   *   await documentRepository.deleteByTenantIds(ids, realmId);
   *   return { deleted: ids.length };
   * });
   * console.log(`Deleted ${result.deleted} tenants`);
   * ```
   */
  async withTransaction<T>(
    fn: (session: mongoose.ClientSession) => Promise<T>
  ): Promise<T> {
    const session = await this.startSession();
    session.startTransaction();

    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export class SessionTasks {
    constructor(private sessionManager: SessionManager) {}

    async deleteManyLeases(leaseIds: string[], templateIdsToRemove:string[], realm: {_id:string}) {
         const leaseRepository = getLeaseRepository();
          const templateRepository = getTemplateRepository();

            await this.sessionManager.withTransaction(async (session) => {
            // let session = undefined;
              await Promise.all([
                leaseRepository.deleteMany(leaseIds, realm._id, session),
                templateIdsToRemove.length > 0 
                  ? templateRepository.deleteMany(templateIdsToRemove, realm._id, session)
                  : Promise.resolve(0),
                templateRepository.updateMany(
                  {
                    realmId: realm._id,
                    linkedResourceIds: { $in: leaseIds }
                  },
                  {
                    // remove leaseIds from linkedResourceIds
                    $pull: { linkedResourceIds: { $in: leaseIds } }
                  },
                  session
                )
              ]);
            });
    }

    async deleteManyTenants(occupantIds:string[], options: {realm: {_id:string}, PDFGENERATOR_URL: string, pdfHeaders: Record<string, string>}) {
        const { realm, PDFGENERATOR_URL, pdfHeaders } = options;

            await this.sessionManager.withTransaction(async (_session) => {
              // Use repository to find documents
              const documentRepository = getDocumentRepository();  
              const tenantRepository = getTenantRepository();
              
              const documents = await documentRepository.findByTenantIds(
                occupantIds,
                realm._id,
                { _id: 1 }
              );
        
              // Keep PDF generator service call via axios
              const documentsEndPoint = `${PDFGENERATOR_URL}/documents/${documents
                .map(({ _id }) => _id)
                .join(',')}`;
              try {
                await axios.delete(documentsEndPoint, {
                  headers: pdfHeaders
                });
              } catch (e) {
                const error = e as {response?:any,message:string}
                const errorMessage = error.response?.data?.message || error.message;
                logger.error('DELETE documents failed');
                logger.error(errorMessage);
              }
        
              // Use repository to delete tenants
              await tenantRepository.deleteMany(occupantIds, realm._id);
            });
    }
}


let sessionManagerInstance: SessionManager | null = null;
let sessionTasksInstance: SessionTasks | null = null;

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

export function getSessionTasks(): SessionTasks {
  if (!sessionTasksInstance) {
    sessionTasksInstance = new SessionTasks( getSessionManager() );
  }
  return sessionTasksInstance;
}
