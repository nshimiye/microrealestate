import * as bcrypt from 'bcrypt';
import { AccountBaseRepository } from './base-repository.js';
import { IAccountRepository } from '../interface.js';
import { CollectionTypes } from '@microrealestate/types';
import logger from '../../../utils/logger.js';
import ServiceError from '../../../utils/serviceerror.js';
import { randomUUID } from 'crypto';

/**
 * DynamoDB implementation of Account repository
 */
export default class DynamoRepository extends AccountBaseRepository implements IAccountRepository {
  /**
   * Find an account by email using GSI query on Email attribute.
   * 
   * @param email The account email
   * @returns The account if found, null otherwise
   * @throws Error if email is invalid
   */
  async findByEmail(email: string): Promise<CollectionTypes.Account | null> {
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }

    try {
      const normalizedEmail = email.toLowerCase();

      // Query using EmailIndex GSI
      const result = await this.client.queryGSI('EmailIndex', {
        keyConditionExpression: '#email = :email',
        expressionAttributeNames: {
          '#email': 'Email'
        },
        expressionAttributeValues: {
          ':email': normalizedEmail
        },
        limit: 1
      });

      if (result.items.length === 0) {
        logger.debug('Account not found by email', { email: normalizedEmail });
        return null;
      }

      return this.fromItem(result.items[0]);
    } catch (error) {
      logger.error('Failed to find account by email', { email, error });
      throw error;
    }
  }

  /**
   * Create a new account with email normalization and password hashing.
   * 
   * @param accountData Account creation data
   * @returns Created account object (with hashed password)
   * @throws Error if account data is invalid or creation fails
   */
  async create(accountData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
  }): Promise<CollectionTypes.Account> {
    if (!accountData || typeof accountData !== 'object') {
      throw new Error('Account data must be an object');
    }

    const { firstname, lastname, email, password } = accountData;

    if (!firstname || typeof firstname !== 'string') {
      throw new Error('Firstname must be a non-empty string');
    }
    if (!lastname || typeof lastname !== 'string') {
      throw new Error('Lastname must be a non-empty string');
    }
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    try {
      // Hash password before storing (bcrypt with 10 rounds)
      const hashedPassword = bcrypt.hashSync(password, 10);

      // Generate account ID
      const accountId = randomUUID();

      // Create entity with hashed password and normalized email
      const account: CollectionTypes.Account = {
        _id: accountId,
        firstname,
        lastname,
        email: email.toLowerCase(),
        password: hashedPassword,
        createdDate: new Date()
      };

      const item = this.toItem(account);

      // Validate item size before attempting to write
      this.validateItemSize(item);

      await this.client.putItem(item);

      logger.debug('Account created successfully', {
        accountId,
        email: account.email
      });

      return account;
    } catch (error) {
      logger.error('Failed to create account', { error });
      throw error;
    }
  }

  /**
   * Update an account's password with password hashing.
   * 
   * @param email Email address of the account to update
   * @param newPassword New password (will be hashed)
   * @returns Updated account object or null if account not found
   * @throws Error if email or password is invalid
   */
  async updatePassword(
    email: string,
    newPassword: string
  ): Promise<CollectionTypes.Account | null> {
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }
    if (!newPassword || typeof newPassword !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    try {
      // First find the account by email to get the account ID
      const account = await this.findByEmail(email);

      if (!account) {
        logger.debug('Account not found for password update', { email });
        return null;
      }

      // Hash the new password
      const hashedPassword = bcrypt.hashSync(newPassword, 10);

      // Update the account
      const key = {
        PK: this.buildPK(account._id),
        SK: this.buildSK(account._id)
      };

      await this.client.updateItem(
        key,
        { Password: hashedPassword },
        'attribute_exists(PK)', // Ensure item still exists
        undefined,
        undefined
      );

      logger.debug('Password updated successfully', {
        accountId: account._id,
        email
      });

      // Return updated account
      return {
        ...account,
        password: hashedPassword
      };
    } catch (error) {
      logger.error('Failed to update password', { email, error });
      throw error;
    }
  }

  /**
   * Find all accounts.
   * Since accounts use unique partition keys (ACCOUNT#<accountId>), 
   * we need to scan the table with a filter for EntityType=Account.
   * 
   * Note: This is an expensive operation and should be used sparingly.
   * In production, consider using a GSI with a constant partition key for all accounts.
   * 
   * @returns Array of account objects
   */
  async findAll(): Promise<CollectionTypes.Account[]> {
    try {
      // Use the scan method from the client
      // We'll call it directly since it's not exposed in the public API yet
      const allItems = await (this.client as any).scanAll({
        filterExpression: '#entityType = :entityType',
        expressionAttributeNames: {
          '#entityType': 'EntityType'
        },
        expressionAttributeValues: {
          ':entityType': 'Account'
        }
      });

      logger.debug('Found all accounts', { count: allItems.length });

      return allItems.map((item: Record<string, any>) => this.fromItem(item));
    } catch (error) {
      logger.error('Failed to find all accounts', { error });
      throw error;
    }
  }
}
