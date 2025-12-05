import { CollectionTypes } from '@microrealestate/types';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Repository for Property entity operations
 *
 * Provides an abstraction layer over database Property operations,
 * returning plain JavaScript objects.
 * All operations are realm-scoped to ensure multi-tenancy security.
 */
export interface IPropertyRepository {
  /**
   * Create a new property
   *
   * @param propertyData - Property creation data (must include realmId)
   * @returns Created property object
   * @throws Error if propertyData is invalid or missing realmId
   */
  create(propertyData: DeepPartial<CollectionTypes.Property>): Promise<CollectionTypes.Property>;

  /**
   * Update an existing property
   *
   * @param propertyId - Property ID to update
   * @param realmId - Realm ID for security filtering
   * @param updateData - Data to update
   * @returns Updated property object or null if not found
   * @throws Error if propertyId, realmId, or updateData is invalid
   */
  update(
    propertyId: string,
    realmId: string,
    updateData: DeepPartial<CollectionTypes.Property>
  ): Promise<CollectionTypes.Property | null>;

  /**
   * Delete properties by IDs
   *
   * @param propertyIds - Array of property IDs to delete
   * @param realmId - Realm ID for security filtering
   * @returns Number of properties deleted
   * @throws Error if propertyIds or realmId is invalid
   */
  delete(propertyIds: string[], realmId: string): Promise<number>;

  /**
   * Find a property by ID
   *
   * @param propertyId - Property ID
   * @param realmId - Realm ID for security filtering
   * @returns Property object or null if not found
   * @throws Error if propertyId or realmId is invalid
   */
  findById(propertyId: string, realmId: string): Promise<CollectionTypes.Property | null>;

  /**
   * Find all properties in a realm
   *
   * @param realmId - Realm ID
   * @returns Array of property objects sorted by name ascending
   * @throws Error if realmId is invalid
   */
  findAll(realmId: string): Promise<CollectionTypes.Property[]>;

  /**
   * Count properties in a realm
   *
   * @param realmId - Realm ID
   * @returns Number of properties in the realm
   * @throws Error if realmId is invalid
   */
  countByRealmId(realmId: string): Promise<number>;
}
