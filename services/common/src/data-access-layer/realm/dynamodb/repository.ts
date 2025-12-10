import { CollectionTypes } from '@microrealestate/types';
import { RealmBaseRepository } from './base-repository.js';
import { IRealmRepository } from '../interface.js';
import logger from '../../../utils/logger.js';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
/**
 * Repository for Realm entity operations
 *
 * Provides an abstraction layer over Mongoose Realm model,
 * returning plain JavaScript objects instead of Mongoose documents.
 */
export default class RealmRepository
  extends RealmBaseRepository
  implements IRealmRepository
{
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
  async updateMemberRegistration(email: string, name: string): Promise<number> {
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('Name must be a non-empty string');
    }

    try {
      // Find all realms with a member matching the email
      const realms = await this.findManyByEmail(email);

      let updateCount = 0;

      // Update each realm's member
      for (const realm of realms) {
        // Find and update the member with matching email
        const updatedMembers = realm.members?.map((member) => {
          if (member.email === email) {
            return {
              ...member,
              registered: true,
              name: name
            };
          }
          return member;
        });

        // Update the realm with modified members
        await this.update(realm._id, { members: updatedMembers });
        updateCount++;
      }

      logger.debug('Updated member registration', {
        email,
        name,
        updateCount
      });

      return updateCount;
    } catch (error) {
      logger.error('Failed to update member registration', {
        email,
        name,
        error
      });
      throw error;
    }
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
  async findOne(filter: {
    _id: string;
  }): Promise<CollectionTypes.Realm | null> {
    return super.findById(filter._id);
  }

  /**
   * Find all realms where a member has the specified email
   *
   * Scans all realm items and filters for those with a member matching the email.
   *
   * @param email - Member email address
   * @returns Array of realms containing the member
   * @throws Error if scan fails
   *
   * @example
   * ```typescript
   * const realms = await realmRepository.findManyByEmail('user@example.com');
   * console.log(`Found ${realms.length} realms`);
   * ```
   */
  async findManyByEmail(email: string): Promise<CollectionTypes.Realm[]> {
    try {
      // Scan all items with EntityType = 'Realm' and filter by member email
      const items = await this.client.scanAll({
        filterExpression: 'EntityType = :entityType',
        expressionAttributeValues: {
          ':entityType': 'Realm'
        }
      });

      // Filter in-memory for members with matching email
      const matchingRealms = items
        .map((item) => this.fromItem(item))
        .filter((realm) =>
          realm.members?.some((member) => member.email === email)
        );

      return matchingRealms;
    } catch (error) {
      logger.error('Failed to find realms by email', { email, error });
      throw error;
    }
  }

  /**
   * Find a realm by application clientId
   *
   * Scans all realm items and returns the first one with an application matching the clientId.
   *
   * @param clientId - Application client ID
   * @returns Realm object or null if not found
   * @throws Error if scan fails
   *
   * @example
   * ```typescript
   * const realm = await realmRepository.findByClientId('app-client-123');
   * if (realm) {
   *   console.log(realm.name);
   * }
   * ```
   */
  async findByClientId(clientId: string): Promise<CollectionTypes.Realm | null> {
    try {
      // Scan all items with EntityType = 'Realm'
      const items = await this.client.scanAll({
        filterExpression: 'EntityType = :entityType',
        expressionAttributeValues: {
          ':entityType': 'Realm'
        }
      });

      // Find the first realm with matching application clientId
      for (const item of items) {
        const realm = this.fromItem(item);
        if (realm.applications?.some((app) => app.clientId === clientId)) {
          return realm;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to find realm by clientId', { clientId, error });
      throw error;
    }
  }
}
