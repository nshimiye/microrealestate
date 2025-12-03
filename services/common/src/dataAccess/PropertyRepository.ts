import { CollectionTypes } from '@microrealestate/types';
import PropertyModel from '../collections/property.js';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Repository for Property entity operations
 * 
 * Provides an abstraction layer over Mongoose Property model,
 * returning plain JavaScript objects instead of Mongoose documents.
 * All operations are realm-scoped to ensure multi-tenancy security.
 */
export default class PropertyRepository {
  /**
   * Create a new property
   * 
   * Creates a property and returns a plain JavaScript object.
   * The realmId must be included in the property data.
   * 
   * @param propertyData - Property creation data (must include realmId)
   * @returns Created property object
   * @throws Error if propertyData is invalid or missing realmId
   * 
   * @example
   * ```typescript
   * const property = await propertyRepository.create({
   *   realmId: '507f1f77bcf86cd799439011',
   *   name: 'Apartment 101',
   *   type: 'apartment',
   *   surface: 75,
   *   price: 1200
   * });
   * console.log(property._id);
   * ```
   */
  async create(propertyData: DeepPartial<CollectionTypes.Property>): Promise<CollectionTypes.Property> {
    if (!propertyData || typeof propertyData !== 'object') {
      throw new Error('Property data must be an object');
    }
    if (!propertyData.realmId) {
      throw new Error('Property data must include realmId');
    }

    const doc = await PropertyModel.create(propertyData);
    return doc.toObject();
  }

  /**
   * Update an existing property
   * 
   * Updates a property by ID with realm-scoped filtering.
   * Returns the updated property or null if not found.
   * 
   * @param propertyId - Property ID to update
   * @param realmId - Realm ID for security filtering
   * @param updateData - Data to update
   * @returns Updated property object or null if not found
   * @throws Error if propertyId, realmId, or updateData is invalid
   * 
   * @example
   * ```typescript
   * const updated = await propertyRepository.update(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012',
   *   { name: 'Updated Apartment Name', price: 1300 }
   * );
   * if (updated) {
   *   console.log(updated.name);
   * }
   * ```
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

    const property = await PropertyModel.findOneAndUpdate(
      { _id: propertyId, realmId: realmId },
      updateData,
      { new: true, lean: true }
    );

    return property as CollectionTypes.Property | null;
  }

  /**
   * Delete properties by IDs
   * 
   * Deletes multiple properties with realm-scoped filtering.
   * Only properties belonging to the specified realm will be deleted.
   * 
   * @param propertyIds - Array of property IDs to delete
   * @param realmId - Realm ID for security filtering
   * @returns Number of properties deleted
   * @throws Error if propertyIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const count = await propertyRepository.delete(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * console.log(`Deleted ${count} properties`);
   * ```
   */
  async delete(propertyIds: string[], realmId: string): Promise<number> {
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      throw new Error('Property IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const result = await PropertyModel.deleteMany({
      _id: { $in: propertyIds },
      realmId: realmId
    });

    return result.deletedCount || 0;
  }

  /**
   * Find a property by ID
   * 
   * Retrieves a single property with realm-scoped filtering.
   * Returns null if the property is not found or belongs to a different realm.
   * 
   * @param propertyId - Property ID
   * @param realmId - Realm ID for security filtering
   * @returns Property object or null if not found
   * @throws Error if propertyId or realmId is invalid
   * 
   * @example
   * ```typescript
   * const property = await propertyRepository.findById(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012'
   * );
   * if (property) {
   *   console.log(property.name);
   * }
   * ```
   */
  async findById(propertyId: string, realmId: string): Promise<CollectionTypes.Property | null> {
    if (!propertyId || typeof propertyId !== 'string') {
      throw new Error('Property ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const property = await PropertyModel.findOne({
      _id: propertyId,
      realmId: realmId
    }).lean();

    return property as CollectionTypes.Property | null;
  }

  /**
   * Find all properties in a realm
   * 
   * Retrieves all properties belonging to the specified realm,
   * sorted by name in ascending order.
   * 
   * @param realmId - Realm ID
   * @returns Array of property objects sorted by name ascending
   * @throws Error if realmId is invalid
   * 
   * @example
   * ```typescript
   * const properties = await propertyRepository.findAll('507f1f77bcf86cd799439011');
   * console.log(`Found ${properties.length} properties`);
   * properties.forEach(p => console.log(p.name));
   * ```
   */
  async findAll(realmId: string): Promise<CollectionTypes.Property[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const properties = await PropertyModel.find({ realmId })
      .sort({ name: 1 })
      .lean();

    return properties as CollectionTypes.Property[];
  }

  /**
   * Count properties in a realm
   * 
   * Returns the total number of properties belonging to the specified realm.
   * Uses efficient countDocuments() method for performance.
   * 
   * @param realmId - Realm ID
   * @returns Number of properties in the realm
   * @throws Error if realmId is invalid
   * 
   * @example
   * ```typescript
   * const count = await propertyRepository.countByRealmId('507f1f77bcf86cd799439011');
   * console.log(`Total properties: ${count}`);
   * ```
   */
  async countByRealmId(realmId: string): Promise<number> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const count = await PropertyModel.countDocuments({ realmId });
    return count;
  }
}
