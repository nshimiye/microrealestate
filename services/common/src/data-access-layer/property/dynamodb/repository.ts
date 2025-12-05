// import { PropertyBaseRepository } from './base-repository.js';
import { IPropertyRepository } from '../interface.js';
import { CollectionTypes } from '@microrealestate/types';
import { PropertyBaseRepository } from './base-repository.js';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * DynamoDB implementation of Property repository
 */
// export default class PropertyRepository extends PropertyBaseRepository implements IPropertyRepository {
export default class PropertyRepository
  extends PropertyBaseRepository
  implements IPropertyRepository
{
  // update(
  //   propertyId: string,
  //   realmId: string,
  //   updateData: {
  //     _id?: string | undefined;
  //     realmId?: string | undefined;
  //     type?: string | undefined;
  //     name?: string | undefined;
  //     description?: string | undefined;
  //     surface?: number | undefined;
  //     phone?: string | undefined;
  //     digicode?: string | undefined;
  //     address?:
  //       | {
  //           street1?: string | undefined;
  //           street2?: string | undefined;
  //           zipCode?: string | undefined;
  //           city?: string | undefined;
  //           state?: string | undefined;
  //           country?: string | undefined;
  //         }
  //       | undefined;
  //     price?: number | undefined;
  //     building?: string | undefined;
  //     level?: string | undefined;
  //     location?: string | undefined;
  //   }
  // ): Promise<CollectionTypes.Property | null> {
  //   return super.update(propertyId, realmId, updateData);
  // }
  deleteMany(propertyIds: string[], realmId: string): Promise<number> {
    throw new Error('Method not implemented.');
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
