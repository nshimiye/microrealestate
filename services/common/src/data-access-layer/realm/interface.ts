import { CollectionTypes } from '@microrealestate/types';
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
/**
 * Repository for Realm entity operations
 *
 * Provides an abstraction layer over Mongoose Realm model,
 * returning plain JavaScript objects instead of Mongoose documents.
 */
export interface IRealmRepository {
  /**
   * Find a realm by ID
   *
   * Returns the realm with its applications array populated.
   *
   * @param id - Realm ID (organization ID)
   * @returns Realm object with applications or null if not found
   * @throws Error if ID is invalid
   *
   * @example
   * ```typescript
   * const realm = await realmRepository.findById('507f1f77bcf86cd799439011');
   * if (realm) {
   *   console.log(realm.name);
   *   console.log(realm.applications.length);
   * }
   * ```
   */
  findById(id: string): Promise<CollectionTypes.Realm | null>;
  /**
   * Update realm members when an account is registered
   *
   * Finds all realms that have a member with the specified email
   * and updates that member's registered status to true and sets their name.
   *
   * @param email - Member email address
   * @param name - Member full name
   * @returns Number of realms updated
   * @throws Error if email or name is invalid
   *
   * @example
   * ```typescript
   * const count = await realmRepository.updateMemberRegistration(
   *   'user@example.com',
   *   'John Doe'
   * );
   * console.log(`Updated ${count} realms`);
   * ```
   */
  updateMemberRegistration(email: string, name: string): Promise<number>;
  /**
   * Find a single realm by filter
   *
   * Returns a plain JavaScript object without Mongoose methods.
   *
   * @param filter - Query filter with _id field
   * @returns Realm object or null if not found
   * @throws Error if filter is invalid
   *
   * @example
   * ```typescript
   * const realm = await realmRepository.findOne({ _id: '507f1f77bcf86cd799439011' });
   * if (realm) {
   *   console.log(realm.name);
   * }
   * ```
   */
  findOne(filter: { _id: string }): Promise<CollectionTypes.Realm | null>;
  /**
   * Create a new realm
   *
   * Creates a realm and triggers Mongoose pre-save hooks (e.g., hashing application secrets).
   * Returns a plain JavaScript object without Mongoose methods.
   *
   * @param realmData - Realm creation data
   * @returns Created realm object
   * @throws Error if realmData is invalid
   *
   * @example
   * ```typescript
   * const realm = await realmRepository.create({
   *   name: 'My Organization',
   *   members: [{ name: 'John Doe', email: 'john@example.com', role: 'administrator', registered: true }],
   *   locale: 'en',
   *   currency: 'USD'
   * });
   * console.log(realm._id);
   * ```
   */
  create(
    realmData: DeepPartial<CollectionTypes.Realm>
  ): Promise<CollectionTypes.Realm>;
  /**
   * Update an existing realm
   *
   * This method retrieves the realm document, updates it using .set(),
   * then saves it. This ensures Mongoose pre-save hooks are triggered
   * (e.g., hashing application secrets).
   *
   * Returns a plain JavaScript object without Mongoose methods.
   *
   * @param realmId - Realm ID to update
   * @param updateData - Data to update
   * @returns Updated realm object
   * @throws Error if realm is not found or if realmId/updateData is invalid
   *
   * @example
   * ```typescript
   * const updated = await realmRepository.update('507f1f77bcf86cd799439011', {
   *   name: 'Updated Organization Name',
   *   locale: 'fr'
   * });
   * console.log(updated.name);
   * ```
   */
  update(
    realmId: string,
    updateData: DeepPartial<CollectionTypes.Realm>
  ): Promise<CollectionTypes.Realm | null>;


  /**
   * Given a member email, find all realm objects that has a member with this email
   */
  findManyByEmail(email:string): Promise<CollectionTypes.Realm[]>;

  /**
   * Given an application clientId, find the first matching realm that this application on it
   * @param req 
   * @param user 
   * @param clientId 
   */
  findByClientId(clientId:string): Promise<CollectionTypes.Realm | null>;
}
