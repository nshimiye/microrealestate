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
   * Find all documents in a realm
   * 
   * Retrieves all documents that belong to the specified realm.
   * 
   * @param realmId - Realm ID for security filtering
   * @returns Array of document objects (may be empty if no matches found)
   * @throws Error if realmId is invalid
   * 
   * @example
   * ```typescript
   * const documents = await documentRepository.findAll('507f1f77bcf86cd799439011');
   * console.log(`Found ${documents.length} documents`);
   * ```
   */
  async findAll(realmId: string): Promise<CollectionTypes.Document[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const documents = await DocumentModel.find({ realmId }).lean();
    return documents as CollectionTypes.Document[];
  }

  /**
   * Find a single document by ID and realm
   * 
   * @param documentId - Document ID
   * @param realmId - Realm ID for security filtering
   * @returns Document object or null if not found
   * @throws Error if documentId or realmId is invalid
   * 
   * @example
   * ```typescript
   * const document = await documentRepository.findById(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012'
   * );
   * if (document) {
   *   console.log(document.name);
   * }
   * ```
   */
  async findById(
    documentId: string,
    realmId: string
  ): Promise<CollectionTypes.Document | null> {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Document ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const document = await DocumentModel.findOne({
      _id: documentId,
      realmId: realmId
    }).lean();

    return document as CollectionTypes.Document | null;
  }

  /**
   * Create a new document
   * 
   * Creates a new document in the database and returns it as a plain object.
   * 
   * @param documentData - Document creation data (must include realmId)
   * @returns Created document object
   * @throws Error if documentData is invalid or missing realmId
   * 
   * @example
   * ```typescript
   * const newDocument = await documentRepository.create({
   *   realmId: '507f1f77bcf86cd799439011',
   *   tenantId: '507f1f77bcf86cd799439012',
   *   type: 'text',
   *   name: 'Contract',
   *   description: 'Rental contract'
   * });
   * console.log(`Created document: ${newDocument.name}`);
   * ```
   */
  async create(
    documentData: Partial<CollectionTypes.Document>
  ): Promise<CollectionTypes.Document> {
    if (!documentData || typeof documentData !== 'object') {
      throw new Error('Document data must be an object');
    }
    if (!documentData.realmId) {
      throw new Error('Document data must include realmId');
    }

    const doc = await DocumentModel.create(documentData);
    return doc.toObject();
  }

  /**
   * Update an existing document
   * 
   * Updates a document and returns the updated document.
   * 
   * @param documentId - Document ID to update
   * @param realmId - Realm ID for security filtering
   * @param updateData - Data to update
   * @returns Updated document object or null if not found
   * @throws Error if documentId, realmId, or updateData is invalid
   * 
   * @example
   * ```typescript
   * const updated = await documentRepository.update(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012',
   *   { name: 'Updated Contract' }
   * );
   * if (updated) {
   *   console.log(`Updated document: ${updated.name}`);
   * }
   * ```
   */
  async update(
    documentId: string,
    realmId: string,
    updateData: Partial<CollectionTypes.Document>
  ): Promise<CollectionTypes.Document | null> {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Document ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }

    const document = await DocumentModel.findOneAndUpdate(
      { _id: documentId, realmId: realmId },
      updateData,
      { new: true, lean: true }
    );

    return document as CollectionTypes.Document | null;
  }

  /**
   * Delete multiple documents
   * 
   * Deletes all documents with the specified IDs that belong to the given realm.
   * 
   * @param documentIds - Array of document IDs to delete
   * @param realmId - Realm ID for security filtering
   * @returns Number of documents deleted
   * @throws Error if documentIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const deletedCount = await documentRepository.deleteMany(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * console.log(`Deleted ${deletedCount} document(s)`);
   * ```
   */
  async deleteMany(documentIds: string[], realmId: string): Promise<number> {
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new Error('Document IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const result = await DocumentModel.deleteMany({
      realmId: realmId,
      _id: { $in: documentIds }
    });

    return result.deletedCount || 0;
  }

  /**
   * Find multiple documents by their IDs
   * 
   * Retrieves all documents with the specified IDs that belong to the given realm.
   * Used for batch operations like deletion.
   * 
   * @param documentIds - Array of document IDs to find
   * @param realmId - Realm ID for security filtering
   * @returns Array of document objects (may be empty if no matches found)
   * @throws Error if documentIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const documents = await documentRepository.findByIds(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * console.log(`Found ${documents.length} document(s)`);
   * ```
   */
  async findByIds(
    documentIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Document[]> {
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new Error('Document IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const documents = await DocumentModel.find({
      _id: { $in: documentIds },
      realmId: realmId
    }).lean();

    return documents as CollectionTypes.Document[];
  }

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
