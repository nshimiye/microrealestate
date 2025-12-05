import * as bcrypt from 'bcrypt';
import logger from '../../../utils/logger.js';
import { CollectionTypes } from '@microrealestate/types';
import { BaseRealmCRUDRepository } from '../../dynamo/base-realm-crud.js';

/**
 * Base repository for Account entity in DynamoDB
 */
export abstract class AccountBaseRepository extends BaseRealmCRUDRepository<CollectionTypes.Account> {
  /**
   * Build partition key for Account entity.
   * Format: ACCOUNT#<accountId>
   *
   * @param accountId The account ID
   * @returns The partition key
   */
  protected buildPK(accountId: string): string {
    return `ACCOUNT#${accountId}`;
  }

  /**
   * Build sort key for Account entity.
   * Format: ACCOUNT#<accountId>
   *
   * @param accountId The account ID
   * @returns The sort key
   */
  protected buildSK(accountId: string): string {
    return `ACCOUNT#${accountId}`;
  }

  /**
   * Transform Account entity to DynamoDB item.
   * Includes Email attribute for GSI lookups.
   * Password should already be hashed before calling this method.
   *
   * @param entity The Account entity
   * @returns The DynamoDB item
   */
  protected toItem(entity: CollectionTypes.Account): Record<string, any> {
    const email = entity.email.toLowerCase();

    return {
      PK: this.buildPK(entity._id),
      SK: this.buildSK(entity._id),
      Email: email,
      EntityType: 'Account',
      FirstName: entity.firstname,
      LastName: entity.lastname,
      Password: entity.password,
      CreatedDate: entity.createdDate
        ? entity.createdDate.toISOString()
        : new Date().toISOString()
    };
  }

  /**
   * Transform DynamoDB item to Account entity.
   *
   * @param item The DynamoDB item
   * @returns The Account entity
   */
  protected fromItem(item: Record<string, any>): CollectionTypes.Account {
    // Extract account ID from PK (format: ACCOUNT#<accountId>)
    const accountId = item.PK.replace('ACCOUNT#', '');
    
    return {
      _id: accountId,
      firstname: item.FirstName,
      lastname: item.LastName,
      email: item.Email,
      password: item.Password,
      createdDate: item.CreatedDate ? new Date(item.CreatedDate) : undefined
    };
  }


}
