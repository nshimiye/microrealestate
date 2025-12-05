// import { PropertyBaseRepository } from './base-repository.js';
import { IPropertyRepository } from '../interface.js';
import { CollectionTypes } from '@microrealestate/types';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * DynamoDB implementation of Property repository
 */
// export default class PropertyRepository extends PropertyBaseRepository implements IPropertyRepository {
export default class PropertyRepository implements IPropertyRepository {
  findById(propertyId: string, realmId: string): Promise<CollectionTypes.Property | null> {
    throw new Error('Method not implemented.');
  }
  async create(propertyData: DeepPartial<CollectionTypes.Property>): Promise<CollectionTypes.Property> {
    // TODO: Implement DynamoDB create
    throw new Error('Method not implemented');
  }

  async update(
    propertyId: string,
    realmId: string,
    updateData: DeepPartial<CollectionTypes.Property>
  ): Promise<CollectionTypes.Property | null> {
    // TODO: Implement DynamoDB update
    throw new Error('Method not implemented');
  }

  async delete(propertyIds: string[], realmId: string): Promise<number> {
    // TODO: Implement DynamoDB batch delete
    throw new Error('Method not implemented');
  }

  async findAll(realmId: string): Promise<CollectionTypes.Property[]> {
    // TODO: Implement DynamoDB query by realm
    throw new Error('Method not implemented');
  }

  async countByRealmId(realmId: string): Promise<number> {
    // TODO: Implement DynamoDB count by realm
    throw new Error('Method not implemented');
  }
}
