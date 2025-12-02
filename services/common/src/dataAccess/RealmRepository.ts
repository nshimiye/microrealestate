import { CollectionTypes } from '@microrealestate/types';
import RealmModel from '../collections/realm.js';
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
/**
 * Repository for Realm entity operations
 * 
 * Provides an abstraction layer over Mongoose Realm model,
 * returning plain JavaScript objects instead of Mongoose documents.
 */
export default class RealmRepository {
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
  async findById(id: string): Promise<CollectionTypes.Realm | null> {
    if (!id || typeof id !== 'string') {
      throw new Error('ID must be a non-empty string');
    }

    const realm = await RealmModel.findById(id).lean();
    return realm;
  }

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
  async updateMemberRegistration(
    email: string,
    name: string
  ): Promise<number> {
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('Name must be a non-empty string');
    }

    const result = await RealmModel.updateMany(
      {
        members: {
          $elemMatch: { email: email }
        }
      },
      {
        $set: {
          'members.$.registered': true,
          'members.$.name': name
        }
      }
    );

    return result.modifiedCount || 0;
  }

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
  async findOne(filter: { _id: string }): Promise<CollectionTypes.Realm | null> {
    if (!filter?._id || typeof filter._id !== 'string') {
      throw new Error('Filter must contain a valid _id string');
    }

    const realm = await RealmModel.findOne(filter).lean();
    return realm;
  }

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
  async create(realmData: DeepPartial<CollectionTypes.Realm>): Promise<CollectionTypes.Realm> {
    if (!realmData || typeof realmData !== 'object') {
      throw new Error('Realm data must be an object');
    }

    const doc = await RealmModel.create(realmData);
    return doc.toObject();
  }

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
  async update(
    realmId: string,
    updateData: DeepPartial<CollectionTypes.Realm>
  ): Promise<CollectionTypes.Realm> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }

    // Find the existing document
    const realm = await RealmModel.findById(realmId);

    if (!realm) {
      throw new Error('Realm not found');
    }

    // Update using .set() (Mongoose method)
    realm.set(updateData);

    // Save (triggers pre-save hook)
    await realm.save();

    // Return plain object
    return realm.toObject();
  }
}
