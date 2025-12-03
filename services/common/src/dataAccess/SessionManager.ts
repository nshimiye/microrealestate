import mongoose from 'mongoose';

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
export default class SessionManager {
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
