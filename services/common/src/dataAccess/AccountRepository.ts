import AccountModel from '../collections/account.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * Repository for Account entity operations
 * 
 * Provides an abstraction layer over Mongoose Account model,
 * returning plain JavaScript objects instead of Mongoose documents.
 */
export default class AccountRepository {
  /**
   * Find an account by email address
   * 
   * Email is normalized to lowercase before querying.
   * 
   * @param email - Email address to search for
   * @returns Account object or null if not found
   * @throws Error if email is invalid
   * 
   * @example
   * ```typescript
   * const account = await accountRepository.findByEmail('user@example.com');
   * if (account) {
   *   console.log(account.firstname);
   * }
   * ```
   */
  async findByEmail(email: string): Promise<CollectionTypes.Account | null> {
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }

    const account = await AccountModel.findOne({
      email: email.toLowerCase()
    }).lean();

    return account;
  }

  /**
   * Find an account by ID
   * 
   * @param id - Account ID
   * @returns Account object or null if not found
   * @throws Error if ID is invalid
   * 
   * @example
   * ```typescript
   * const account = await accountRepository.findById('507f1f77bcf86cd799439011');
   * ```
   */
  async findById(id: string): Promise<CollectionTypes.Account | null> {
    if (!id || typeof id !== 'string') {
      throw new Error('ID must be a non-empty string');
    }

    const account = await AccountModel.findById(id).lean();
    return account;
  }

  /**
   * Create a new account
   * 
   * Password will be automatically hashed by Mongoose pre-save middleware.
   * Email will be normalized to lowercase.
   * If a realm exists with a member matching the email, the member will be marked as registered.
   * 
   * @param accountData - Account creation data
   * @returns Created account object (with hashed password)
   * @throws Error if account data is invalid or creation fails
   * 
   * @example
   * ```typescript
   * const account = await accountRepository.create({
   *   firstname: 'John',
   *   lastname: 'Doe',
   *   email: 'john@example.com',
   *   password: 'plaintext123'
   * });
   * // account.password will be hashed
   * ```
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

    const doc = await AccountModel.create(accountData);
    return doc.toObject();
  }

  /**
   * Update an account's password
   * 
   * The new password will be automatically hashed by Mongoose pre-save middleware.
   * 
   * @param email - Email address of the account to update
   * @param newPassword - New password (will be hashed)
   * @returns Updated account object or null if account not found
   * @throws Error if email or password is invalid
   * 
   * @example
   * ```typescript
   * const updated = await accountRepository.updatePassword(
   *   'user@example.com',
   *   'newPassword123'
   * );
   * ```
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

    // Find the account first
    const account = await AccountModel.findOne({
      email: email.toLowerCase()
    });

    if (!account) {
      return null;
    }

    // Update password and save (triggers pre-save hook for hashing)
    account.password = newPassword;
    await account.save();

    return account.toObject();
  }

  /**
   * Find all accounts
   * 
   * Returns all accounts with email, firstname, and lastname fields.
   * Used by realm manager to build username map for member population.
   * 
   * @returns Array of account objects
   * 
   * @example
   * ```typescript
   * const accounts = await accountRepository.findAll();
   * accounts.forEach(account => {
   *   console.log(`${account.firstname} ${account.lastname} - ${account.email}`);
   * });
   * ```
   */
  async findAll(): Promise<CollectionTypes.Account[]> {
    const accounts = await AccountModel.find().lean();
    return accounts;
  }
}
