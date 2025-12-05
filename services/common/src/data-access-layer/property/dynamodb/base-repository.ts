import { BaseRepository } from '../../dynamo/base.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * Base repository for Property entity in DynamoDB
 */
export abstract class PropertyBaseRepository extends BaseRepository<CollectionTypes.Property> {
  protected buildPK(id: string, realmId?: string): string {
    return `REALM#${realmId}`;
  }

  protected buildSK(id: string): string {
    return `PROPERTY#${id}`;
  }

  protected toItem(property: CollectionTypes.Property): Record<string, any> {
    return {
      PK: this.buildPK(property._id, property.realmId),
      SK: this.buildSK(property._id),
      _id: property._id,
      realmId: property.realmId,
      name: property.name,
      type: property.type,
      surface: property.surface,
      price: property.price,
      // Add other property fields as needed
    };
  }

  protected fromItem(item: Record<string, any>): CollectionTypes.Property {
    return {
      _id: item._id,
      realmId: item.realmId,
      name: item.name,
      type: item.type,
      surface: item.surface,
      price: item.price,
      // Add other property fields as needed
    } as CollectionTypes.Property;
  }
}
