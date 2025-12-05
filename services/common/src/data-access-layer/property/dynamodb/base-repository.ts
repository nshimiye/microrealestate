import { BaseOthersCRUDRepository } from '../../dynamo/base-others-crud.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * Base repository for Property entity in DynamoDB
 */
export abstract class PropertyBaseRepository extends BaseOthersCRUDRepository<CollectionTypes.Property> {
  /**
   * Build partition key for Property entity.
   * Format: REALM#<realmId>
   *
   * @param propertyId The property identifier (not used for PK)
   * @param realmId The realm identifier
   * @returns The partition key
   */
  protected buildPK(propertyId: string, realmId: string): string {
    if (!realmId) {
      throw new Error('realmId is required for Property entities');
    }
    return `REALM#${realmId}`;
  }

  /**
   * Build sort key for Property entity.
   * Format: PROPERTY#<propertyId>
   *
   * @param propertyId The property identifier
   * @returns The sort key
   */
  protected buildSK(propertyId: string): string {
    return `PROPERTY#${propertyId}`;
  }

  /**
   * Transform Property entity to DynamoDB item.
   * Preserves all fields including address object.
   *
   * @param entity The Property entity
   * @returns The DynamoDB item
   */
  protected toItem(entity: CollectionTypes.Property): Record<string, any> {
    const propertyId = entity._id;
    const realmId = entity.realmId;
    if (typeof realmId !== 'string') {
      throw new Error('missing org');
    }

    if (typeof propertyId !== 'string') {
      throw new Error('missing property id');
    }
    return {
      PK: this.buildPK(propertyId, realmId),
      SK: this.buildSK(propertyId),
      EntityType: 'Property',
      RealmId: realmId,
      PropertyId: propertyId,
      Type: entity.type,
      Name: entity.name,
      Description: entity.description,
      Surface: entity.surface,
      Phone: entity.phone,
      Digicode: entity.digicode,
      // Preserve address object structure
      Address: entity.address || {},
      Price: entity.price,
      // Legacy fields (to be removed)
      Building: entity.building,
      Level: entity.level,
      Location: entity.location
    };
  }

  /**
   * Transform DynamoDB item to Property entity.
   * Restores all fields from DynamoDB format.
   *
   * @param item The DynamoDB item
   * @returns The Property entity
   */
  protected fromItem(item: Record<string, any>): CollectionTypes.Property {
    return {
      _id: item.PropertyId,
      realmId: item.RealmId,
      type: item.Type,
      name: item.Name,
      description: item.Description,
      surface: item.Surface,
      phone: item.Phone,
      digicode: item.Digicode,
      address: item.Address || {},
      price: item.Price,
      // Legacy fields (to be removed)
      building: item.Building,
      level: item.Level,
      location: item.Location
    };
  }

  /**
   * Find all properties for a given realm.
   * Uses the base repository's findByRealm method with PROPERTY# prefix.
   *
   * @param realmId The realm identifier
   * @returns Array of properties in the realm
   * @throws ServiceError if query fails
   */
  async findByRealm(realmId: string): Promise<CollectionTypes.Property[]> {
    return super.findByRealm(realmId, 'PROPERTY#');
  }

  /**
   * Create a new property.
   * Overrides base method for clarity and validation.
   *
   * @param entity The property to create
   * @returns The created property
   * @throws ServiceError if creation fails or realmId is missing
   */
  async create(
    entity: CollectionTypes.Property
  ): Promise<CollectionTypes.Property> {
    if (typeof entity.realmId !== 'string') {
      throw new Error('realmId is required to create a Property');
    }

    if (typeof entity._id !== 'string') {
      throw new Error('realmId is required to create a Property');
    }

    return super.create(entity);
  }

  /**
   * Find property by ID.
   * Requires realmId for partition key construction.
   *
   * @param propertyId The property identifier
   * @param realmId The realm identifier
   * @returns The property if found, null otherwise
   * @throws Error if realmId is not provided
   */
  async findById(
    propertyId: string,
    realmId?: string
  ): Promise<CollectionTypes.Property | null> {
    if (!realmId) {
      throw new Error('realmId is required to find a Property by ID');
    }
    return super.findById(propertyId, realmId);
  }

  /**
   * Update a property.
   * Requires realmId for partition key construction.
   *
   * @param propertyId The property identifier
   * @param updates Partial property updates
   * @param realmId The realm identifier
   * @returns The updated property
   * @throws Error if realmId is not provided
   */
  async update(
    propertyId: string,
    realmId: string,
    updates: Partial<CollectionTypes.Property>
  ): Promise<CollectionTypes.Property | null> {
    if (!realmId) {
      throw new Error('realmId is required to update a Property');
    }
    return super.update(propertyId, realmId, updates);
  }

  /**
   * Delete a property.
   * Requires realmId for partition key construction.
   *
   * @param propertyId The property identifier
   * @param realmId The realm identifier
   * @throws Error if realmId is not provided
   */
  async delete(propertyId: string, realmId: string): Promise<void> {
    if (!realmId) {
      throw new Error('realmId is required to delete a Property');
    }
    return super.delete(propertyId, realmId);
  }
}
