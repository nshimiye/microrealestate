import { CollectionTypes } from '@microrealestate/types';

/**
 * Repository for Account entity operations
 *
 * Provides an abstraction layer over database Account operations,
 * returning plain JavaScript objects.
 */
export interface IAccountRepository {
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
  findByEmail(email: string): Promise<CollectionTypes.Account | null>;

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
  findById(id: string): Promise<CollectionTypes.Account | null>;

  /**
   * Create a new account
   *
   * Password will be automatically hashed by pre-save middleware.
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
  create(accountData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
  }): Promise<CollectionTypes.Account>;

  /**
   * Update an account's password
   *
   * The new password will be automatically hashed by pre-save middleware.
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
  updatePassword(
    email: string,
    newPassword: string
  ): Promise<CollectionTypes.Account | null>;

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
  findAll(): Promise<CollectionTypes.Account[]>;
}
