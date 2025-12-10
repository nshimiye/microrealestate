import { CollectionTypes } from '@microrealestate/types';

export interface IDataBaseSession {
  // Database-specific session type
}

/**
 * Repository for Template entity operations
 *
 * Provides an abstraction layer over database Template operations,
 * returning plain JavaScript objects.
 * All operations are realm-scoped to ensure multi-tenancy security.
 */
export interface ITemplateRepository {
  /**
   * Find all templates in a realm
   *
   * @param realmId - Realm ID for security filtering
   * @returns Array of template objects
   * @throws Error if realmId is invalid
   */
  findAll(realmId: string): Promise<CollectionTypes.Template[]>;

  /**
   * Find a single template by ID and realm
   *
   * @param templateId - Template ID
   * @param realmId - Realm ID for security filtering
   * @returns Template object or null if not found
   * @throws Error if templateId or realmId is invalid
   */
  findById(
    templateId: string,
    realmId: string
  ): Promise<CollectionTypes.Template | null>;

  /**
   * Create a new template
   *
   * @param templateData - Template creation data (must include realmId)
   * @returns Created template object
   * @throws Error if templateData is invalid or missing realmId
   */
  create(
    templateData: Partial<CollectionTypes.Template>
  ): Promise<CollectionTypes.Template>;

  /**
   * Replace an existing template
   *
   * @param templateId - Template ID to replace
   * @param realmId - Realm ID for security filtering
   * @param templateData - New template data
   * @returns Replaced template object or null if not found
   * @throws Error if templateId, realmId, or templateData is invalid
   */
  replace(
    templateId: string,
    realmId: string,
    templateData: Partial<CollectionTypes.Template>
  ): Promise<CollectionTypes.Template | null>;

  /**
   * Find templates linked to specific resources (leases)
   *
   * @param resourceIds - Array of resource IDs (lease IDs)
   * @param realmId - Realm ID
   * @returns Array of template objects
   * @throws Error if resourceIds or realmId is invalid
   */
  findByLinkedResources(
    resourceIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Template[]>;

  /**
   * Delete multiple templates
   *
   * @param templateIds - Array of template IDs to delete
   * @param realmId - Realm ID
   * @param session - Optional database session for transactions
   * @returns Number of templates deleted
   * @throws Error if templateIds or realmId is invalid
   */
  deleteMany(
    templateIds: string[],
    realmId: string,
    session?: IDataBaseSession
  ): Promise<number>;

  /**
   * Update multiple templates
   *
   * @param filter - Query filter
   * @param update - Update operations
   * @param session - Optional database session for transactions
   * @returns Number of templates modified
   * @throws Error if filter or update is invalid
   */
  updateMany(
    filter: Record<string, any>,
    update: Record<string, any>,
    session?: IDataBaseSession
  ): Promise<number>;
}
