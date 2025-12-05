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
   * Format: ACCOUNT#<email>
   *
   * @param email The account email (used as identifier)
   * @returns The partition key
   */
  protected buildPK(email: string): string {
    return `ACCOUNT#${email.toLowerCase()}`;
  }

  /**
   * Build sort key for Account entity.
   * Format: ACCOUNT#<email>
   *
   * @param email The account email (used as identifier)
   * @returns The sort key
   */
  protected buildSK(email: string): string {
    return `ACCOUNT#${email.toLowerCase()}`;
  }

  /**
   * Transform Account entity to DynamoDB item.
   * Includes GSI1 keys for email lookups.
   *
   * @param entity The Account entity
   * @returns The DynamoDB item
   */
  protected toItem(entity: CollectionTypes.Account): Record<string, any> {
    const email = entity.email.toLowerCase();

    return {
      PK: this.buildPK(email),
      SK: this.buildSK(email),
      GSI1PK: `EMAIL#${email}`,
      GSI1SK: `ACCOUNT#${email}`,
      EntityType: 'Account',
      AccountId: entity._id,
      FirstName: entity.firstname,
      LastName: entity.lastname,
      Email: email,
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
    return {
      _id: item.AccountId,
      firstname: item.FirstName,
      lastname: item.LastName,
      email: item.Email,
      password: item.Password,
      createdDate: item.CreatedDate ? new Date(item.CreatedDate) : undefined
    };
  }

  /**
   * Create a new account with password hashing.
   * Overrides base create to add password hashing logic.
   *
   * @param entity The account to create
   * @returns The created account
   * @throws ServiceError if creation fails
   */
  async create(
    entity: CollectionTypes.Account
  ): Promise<CollectionTypes.Account> {
    try {
      // Hash password before storing (bcrypt with 10 rounds)
      const hashedPassword = bcrypt.hashSync(entity.password, 10);

      // Create entity with hashed password
      const accountWithHashedPassword = {
        ...entity,
        password: hashedPassword,
        email: entity.email.toLowerCase(),
        createdDate: entity.createdDate || new Date()
      };

      const item = this.toItem(accountWithHashedPassword);

      // Validate item size before attempting to write
      this.validateItemSize(item);

      await this.client.putItem(item);

      logger.debug('Account created successfully', {
        email: accountWithHashedPassword.email
      });

      return accountWithHashedPassword;
    } catch (error) {
      logger.error('Failed to create account', { error });
      throw error;
    }
  }

  /**
   * Find an account by email using GSI1.
   * This is the primary lookup method for accounts.
   *
   * @param email The account email
   * @returns The account if found, null otherwise
   * @throws ServiceError if query fails
   */
  async findByEmail(email: string): Promise<CollectionTypes.Account | null> {
    try {
      const normalizedEmail = email.toLowerCase();

      const result = await this.client.queryGSI('GSI1', {
        keyConditionExpression: '#gsi1pk = :gsi1pk',
        expressionAttributeNames: {
          '#gsi1pk': 'GSI1PK'
        },
        expressionAttributeValues: {
          ':gsi1pk': `EMAIL#${normalizedEmail}`
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
      // throw error;
    }
    return null;
  }

  /**
   * Find account by ID (email).
   * Overrides base method since Account uses email as ID.
   *
   * @param email The account email
   * @returns The account if found, null otherwise
   */
  async findById(email: string): Promise<CollectionTypes.Account | null> {
    return super.findById(email);
  }

  /**
   * Update an account.
   * Overrides base method to handle email as ID.
   *
   * @param email The account email
   * @param updates Partial account updates
   * @returns The updated account
   */
  async update(
    email: string,
    updates: Partial<CollectionTypes.Account>
  ): Promise<CollectionTypes.Account | null> {
    // If password is being updated, hash it
    if (updates.password) {
      updates.password = bcrypt.hashSync(updates.password, 10);
    }

    // Normalize email if it's being updated
    if (updates.email) {
      updates.email = updates.email.toLowerCase();
    }

    return super.update(email, updates);
  }

  /**
   * Delete an account.
   * Overrides base method to handle email as ID.
   *
   * @param email The account email
   */
  async delete(email: string): Promise<void> {
    return super.delete(email);
  }
}
