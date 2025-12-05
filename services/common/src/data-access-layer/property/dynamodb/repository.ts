import { IPropertyRepository } from '../interface.js';
import { CollectionTypes } from '@microrealestate/types';
import { PropertyBaseRepository } from './base-repository.js';
import logger from '../../../utils/logger.js';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * DynamoDB implementation of Property repository
 */
export default class PropertyRepository
  extends PropertyBaseRepository
  implements IPropertyRepository
{
  /**
   * Create a new property
   * Validates realmId and stores the property
   *
   * @param propertyData - Property creation data (must include realmId)
   * @returns Created property object
   * @throws Error if propertyData is invalid or missing realmId
   */
  async create(
    propertyData: DeepPartial<CollectionTypes.Property>
  ): Promise<CollectionTypes.Property> {
    if (!propertyData || typeof propertyData !== 'object') {
      throw new Error('Property data must be an object');
    }
    if (!propertyData.realmId) {
      throw new Error('Property data must include realmId');
    }
    if (!propertyData._id) {
      throw new Error('Property data must include _id');
    }

    return super.create(propertyData as CollectionTypes.Property);
  }

  /**
   * Update an existing property
   * Uses base class method with realmId validation
   *
   * @param propertyId - Property ID to update
   * @param realmId - Realm ID for security filtering
   * @param updateData - Data to update
   * @returns Updated property object or null if not found
   * @throws Error if propertyId, realmId, or updateData is invalid
   */
  async update(
    propertyId: string,
    realmId: string,
    updateData: DeepPartial<CollectionTypes.Property>
  ): Promise<CollectionTypes.Property | null> {
    if (!propertyId || typeof propertyId !== 'string') {
      throw new Error('Property ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }

    return super.update(propertyId, realmId, updateData as Partial<CollectionTypes.Property>);
  }

  /**
   * Delete a single property
   * Uses base class method with realmId validation
   *
   * @param propertyId - Property ID to delete
   * @param realmId - Realm ID for security filtering
   * @throws Error if propertyId or realmId is invalid
   */
  async delete(propertyId: string, realmId: string): Promise<void> {
    if (!propertyId || typeof propertyId !== 'string') {
      throw new Error('Property ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    return super.delete(propertyId, realmId);
  }

  /**
   * Delete multiple properties by IDs
   * Uses batch delete operations for efficiency
   *
   * @param propertyIds - Array of property IDs to delete
   * @param realmId - Realm ID for security filtering
   * @returns Number of properties deleted
   * @throws Error if propertyIds or realmId is invalid
   */
  async deleteMany(propertyIds: string[], realmId: string): Promise<number> {
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      throw new Error('Property IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Build delete requests for batch operation
      const deleteRequests = propertyIds.map((propertyId) => ({
        deleteRequest: {
          PK: this.buildPK(propertyId, realmId),
          SK: this.buildSK(propertyId)
        }
      }));

      // Execute batch delete
      const result = await this.client.batchWrite(deleteRequests);

      // Calculate number of successfully deleted items
      const deletedCount = propertyIds.length - result.unprocessedItems.length;

      if (result.unprocessedItems.length > 0) {
        logger.warn('Some properties could not be deleted', {
          realmId,
          unprocessedCount: result.unprocessedItems.length,
          totalRequested: propertyIds.length
        });
      }

      logger.debug('Properties deleted', {
        realmId,
        deletedCount,
        requestedCount: propertyIds.length
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete properties', { realmId, error });
      throw error;
    }
  }

  /**
   * Find a property by ID
   * Uses base class method with realmId validation
   *
   * @param propertyId - Property ID
   * @param realmId - Realm ID for security filtering
   * @returns Property object or null if not found
   * @throws Error if propertyId or realmId is invalid
   */
  async findById(
    propertyId: string,
    realmId: string
  ): Promise<CollectionTypes.Property | null> {
    if (!propertyId || typeof propertyId !== 'string') {
      throw new Error('Property ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    return super.findById(propertyId, realmId);
  }

  /**
   * Find all properties in a realm
   * Uses base class findByRealm method with sorting by name
   *
   * @param realmId - Realm ID
   * @returns Array of property objects sorted by name ascending
   * @throws Error if realmId is invalid
   */
  async findAll(realmId: string): Promise<CollectionTypes.Property[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Get all properties in the realm
      const properties = await this.findByRealm(realmId);

      // Sort by name ascending (case-insensitive)
      properties.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      logger.debug('Found properties in realm', {
        realmId,
        count: properties.length
      });

      return properties;
    } catch (error) {
      logger.error('Failed to find properties', { realmId, error });
      throw error;
    }
  }

  /**
   * Count properties in a realm
   * Queries all properties and returns the count
   *
   * @param realmId - Realm ID
   * @returns Number of properties in the realm
   * @throws Error if realmId is invalid
   */
  async countByRealmId(realmId: string): Promise<number> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Get all properties in the realm
      const properties = await this.findByRealm(realmId);
      const count = properties.length;

      logger.debug('Counted properties in realm', {
        realmId,
        count
      });

      return count;
    } catch (error) {
      logger.error('Failed to count properties', { realmId, error });
      throw error;
    }
  }
}
