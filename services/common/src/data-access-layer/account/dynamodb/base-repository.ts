import { BaseRepository } from '../../dynamo/base.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * Base repository for Account entity in DynamoDB
 */
export abstract class AccountBaseRepository extends BaseRepository<CollectionTypes.Account> {
  protected buildPK(id: string): string {
    return `ACCOUNT#${id}`;
  }

  protected buildSK(id: string): string {
    return `ACCOUNT#${id}`;
  }

  protected toItem(account: CollectionTypes.Account): Record<string, any> {
    return {
      PK: this.buildPK(account._id),
      SK: this.buildSK(account._id),
      _id: account._id,
      email: account.email,
      firstname: account.firstname,
      lastname: account.lastname,
      password: account.password,
      // Add other account fields as needed
    };
  }

  protected fromItem(item: Record<string, any>): CollectionTypes.Account {
    return {
      _id: item._id,
      email: item.email,
      firstname: item.firstname,
      lastname: item.lastname,
      password: item.password,
      // Add other account fields as needed
    } as CollectionTypes.Account;
  }
}
