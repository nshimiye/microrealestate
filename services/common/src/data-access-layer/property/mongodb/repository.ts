import { CollectionTypes } from '@microrealestate/types';
import PropertyModel from '../../../collections/property.js';
import { IPropertyRepository } from '../interface.js';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * MongoDB implementation of Property repository
 */
export default class MongoRepository implements IPropertyRepository {
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

  async findAll(realmId: string): Promise<CollectionTypes.Property[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const properties = await PropertyModel.find({ realmId })
      .sort({ name: 1 })
      .lean();

    return properties as CollectionTypes.Property[];
  }

  async countByRealmId(realmId: string): Promise<number> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const count = await PropertyModel.countDocuments({ realmId });
    return count;
  }
}
