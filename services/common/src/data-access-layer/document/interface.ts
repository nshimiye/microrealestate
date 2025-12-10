import { CollectionTypes } from '@microrealestate/types';

/**
 * Repository for Document entity operations
 *
 * Provides an abstraction layer over database Document operations,
 * returning plain JavaScript objects.
 * All operations are realm-scoped to ensure multi-tenancy security.
 */
export interface IDocumentRepository {
  /**
   * Find all documents in a realm
   *
   * @param realmId - Realm ID for security filtering
   * @returns Array of document objects
   * @throws Error if realmId is invalid
   */
  findAll(realmId: string): Promise<CollectionTypes.Document[]>;

  /**
   * Find a single document by ID and realm
   *
   * @param documentId - Document ID
   * @param realmId - Realm ID for security filtering
   * @returns Document object or null if not found
   * @throws Error if documentId or realmId is invalid
   */
  findById(
    documentId: string,
    realmId: string
  ): Promise<CollectionTypes.Document | null>;

  /**
   * Create a new document
   *
   * @param documentData - Document creation data (must include realmId)
   * @returns Created document object
   * @throws Error if documentData is invalid or missing realmId
   */
  create(
    documentData: Partial<CollectionTypes.Document>
  ): Promise<CollectionTypes.Document>;

  /**
   * Update an existing document
   *
   * @param documentId - Document ID to update
   * @param realmId - Realm ID for security filtering
   * @param updateData - Data to update
   * @returns Updated document object or null if not found
   * @throws Error if documentId, realmId, or updateData is invalid
   */
  update(
    documentId: string,
    realmId: string,
    updateData: Partial<CollectionTypes.Document>
  ): Promise<CollectionTypes.Document | null>;

  /**
   * Delete multiple documents
   *
   * @param documentIds - Array of document IDs to delete
   * @param realmId - Realm ID for security filtering
   * @returns Number of documents deleted
   * @throws Error if documentIds or realmId is invalid
   */
  deleteMany(documentIds: string[], realmId: string): Promise<number>;

  /**
   * Find multiple documents by their IDs
   *
   * @param documentIds - Array of document IDs to find
   * @param realmId - Realm ID for security filtering
   * @returns Array of document objects
   * @throws Error if documentIds or realmId is invalid
   */
  findByIds(
    documentIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Document[]>;

  /**
   * Find documents by tenant IDs
   *
   * @param tenantIds - Array of tenant IDs
   * @param realmId - Realm ID for security filtering
   * @param projection - Optional fields to include/exclude
   * @returns Array of document objects
   * @throws Error if tenantIds or realmId is invalid
   */
  findByTenantIds(
    tenantIds: string[],
    realmId: string,
    projection?: Record<string, number>
  ): Promise<CollectionTypes.Document[]>;
}
