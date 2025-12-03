import { CollectionTypes } from '@microrealestate/types';
import DocumentModel from '../collections/document.js';

/**
 * Repository for Document entity operations
 * 
 * Provides an abstraction layer over Mongoose Document model,
 * returning plain JavaScript objects instead of Mongoose documents.
 * All operations are realm-scoped to ensure multi-tenancy security.
 */
export default class DocumentRepository {
  /**
   * Find documents by tenant IDs
   * 
   * Retrieves all documents associated with the specified tenant IDs
   * within a realm. Used for document cleanup during tenant deletion.
   * 
   * @param tenantIds - Array of tenant IDs
   * @param realmId - Realm ID for security filtering
   * @param projection - Optional fields to include/exclude (e.g., { _id: 1 })
   * @returns Array of document objects
   * @throws Error if tenantIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * // Get all documents for tenants
   * const documents = await documentRepository.findByTenantIds(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * 
   * // Get only document IDs
   * const documents = await documentRepository.findByTenantIds(
   *   ['507f1f77bcf86cd799439011'],
   *   '507f1f77bcf86cd799439013',
   *   { _id: 1 }
   * );
   * ```
   */
  async findByTenantIds(
    tenantIds: string[],
    realmId: string,
    projection?: Record<string, number>
  ): Promise<CollectionTypes.Document[]> {
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new Error('Tenant IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    let query = DocumentModel.find({
      realmId: realmId,
      tenantId: { $in: tenantIds }
    });

    if (projection) {
      query = query.select(projection);
    }

    const documents = await query.lean();
    return documents as CollectionTypes.Document[];
  }
}
