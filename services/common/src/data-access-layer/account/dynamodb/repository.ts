import { AccountBaseRepository } from './base-repository.js';
import { IAccountRepository } from '../interface.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * DynamoDB implementation of Account repository
 */
export default class DynamoRepository extends AccountBaseRepository implements IAccountRepository {
  async findByEmail(email: string): Promise<CollectionTypes.Account | null> {
    // TODO: Implement DynamoDB query by email (GSI required)
    throw new Error('Method not implemented');
  }

  async create(accountData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
  }): Promise<CollectionTypes.Account> {
    // TODO: Implement DynamoDB create
    throw new Error('Method not implemented');
  }

  async updatePassword(
    email: string,
    newPassword: string
  ): Promise<CollectionTypes.Account | null> {
    // TODO: Implement DynamoDB update password
    throw new Error('Method not implemented');
  }

  async findAll(): Promise<CollectionTypes.Account[]> {
    // TODO: Implement DynamoDB scan for all accounts
    throw new Error('Method not implemented');
  }
}
