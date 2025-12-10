/* eslint-disable @typescript-eslint/no-explicit-any */

import * as bcrypt from 'bcrypt';
import * as fc from 'fast-check';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clearTestDB, connectTestDB, disconnectTestDB } from './testSetup.js';

import { getAccountRepository, IAccountRepository } from '../../data-access-layer/index.js';

// import AccountRepository from '../../dataAccess/AccountRepository.js';
import RealmModel from '../../collections/realm.js';

// Generator for valid account data (non-whitespace strings)
const accountDataArbitrary = fc.record({
  firstname: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  lastname: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  email: fc.emailAddress(),
  password: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length > 0)
});

describe('AccountRepository', () => {
  let accountRepository: IAccountRepository;

  beforeAll(async () => {
    await connectTestDB();
    accountRepository = getAccountRepository();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property 1: Account Key Structure Consistency', () => {
    it('should store accounts with PK=ACCOUNT#<accountId> and SK=ACCOUNT#<accountId>', async () => {
      // Feature: dynamodb-data-access-layer-completion, Property 1: Account Key Structure Consistency
      // Validates: Requirements 1.2

      // Skip this test if not using DynamoDB
      if (String(process.env['USE_DYNAMODB']) !== 'true') {
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          accountDataArbitrary,
          async (accountData) => {
            // Create account
            const created = await accountRepository.create(accountData);

            // Access the DynamoDB client to verify key structure
            const repo = accountRepository as any;
            const client = repo.client || repo.getClient();
            
            // Get the item directly from DynamoDB
            const key = {
              PK: `ACCOUNT#${created._id}`,
              SK: `ACCOUNT#${created._id}`
            };
            
            const item = await client.getItem(key);

            // Verify the item exists and has correct key structure
            expect(item).toBeDefined();
            expect(item.PK).toBe(`ACCOUNT#${created._id}`);
            expect(item.SK).toBe(`ACCOUNT#${created._id}`);
            expect(item.EntityType).toBe('Account');
          }
        ),
        { numRuns: 20, timeout: 60000 }
      );
    }, 65000);
  });

  describe('Property 2: Account Email Query Round-Trip', () => {
    it('should return the same account with all fields intact when querying by email', async () => {
      // Feature: dynamodb-data-access-layer-completion, Property 2: Account Email Query Round-Trip
      // Validates: Requirements 1.1, 1.3

      await fc.assert(
        fc.asyncProperty(
          accountDataArbitrary,
          async (accountData) => {
            // Create account
            const created = await accountRepository.create(accountData);

            // Query by email
            const found = await accountRepository.findByEmail(accountData.email);

            // Verify account was found and all fields match
            expect(found).toBeDefined();
            expect(found!._id.toString()).toBe(created._id.toString());
            expect(found!.firstname).toBe(created.firstname);
            expect(found!.lastname).toBe(created.lastname);
            expect(found!.email).toBe(created.email);
            expect(found!.password).toBe(created.password);
            
            // Verify email is normalized to lowercase
            expect(found!.email).toBe(accountData.email.toLowerCase());
          }
        ),
        { numRuns: 50, timeout: 60000 }
      );
    }, 65000);
  });

  describe('Property 3: Account Password Hashing', () => {
    it('should hash passwords before storage and not equal plaintext', async () => {
      // Feature: dynamodb-data-access-layer-completion, Property 3: Account Password Hashing
      // Validates: Requirements 1.6

      await fc.assert(
        fc.asyncProperty(
          accountDataArbitrary,
          async (accountData) => {
            const plainPassword = accountData.password;
            // Account for Mongoose trimming the password
            const trimmedPassword = plainPassword.trim();

            // Create account
            const created = await accountRepository.create(accountData);

            // Password should be hashed (not equal to plain text)
            expect(created.password).toBeDefined();
            expect(created.password).not.toBe(plainPassword);
            expect(created.password).not.toBe(trimmedPassword);

            // Password should be a valid bcrypt hash
            expect(created.password).toMatch(/^\$2[aby]\$\d{2}\$/);

            // Should be able to verify the password (using trimmed version)
            const isValid = bcrypt.compareSync(trimmedPassword, created.password);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 20, timeout: 60000 }
      );
    }, 65000);
  });

  describe('Property 4: Account Data Round-Trip', () => {
    it('should preserve all fields through toItem/fromItem transformation', async () => {
      // Feature: dynamodb-data-access-layer-completion, Property 4: Account Data Round-Trip
      // Validates: Requirements 1.7

      // Skip this test if not using DynamoDB
      if (String(process.env['USE_DYNAMODB']) !== 'true') {
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          accountDataArbitrary,
          async (accountData) => {
            // Create account
            const created = await accountRepository.create(accountData);

            // Retrieve account by ID
            const retrieved = await accountRepository.findById(created._id!);

            // Verify all fields are preserved
            expect(retrieved).toBeDefined();
            expect(retrieved!._id).toBe(created._id);
            expect(retrieved!.firstname).toBe(created.firstname);
            expect(retrieved!.lastname).toBe(created.lastname);
            expect(retrieved!.email).toBe(created.email);
            expect(retrieved!.password).toBe(created.password);
            
            // Verify createdDate is preserved (if present)
            if (created.createdDate) {
              expect(retrieved!.createdDate).toBeDefined();
              expect(retrieved!.createdDate!.getTime()).toBe(created.createdDate.getTime());
            }
          }
        ),
        { numRuns: 50, timeout: 60000 }
      );
    }, 65000);
  });

  describe('Property 1: Plain object returns', () => {
    it('should return plain objects without Mongoose methods', async () => {
      // Feature: authenticator-data-access-layer, Property 1: Plain object returns
      // Validates: Requirements 1.2, 2.5, 5.2

      await fc.assert(
        fc.asyncProperty(
          accountDataArbitrary,
          async (accountData) => {
            // Create account
            const created = await accountRepository.create(accountData);

            // Verify created account is a plain object
            expect(created).toBeDefined();
            expect(typeof created).toBe('object');
            // Check that it doesn't have Mongoose methods
            expect((created as any).save).toBeUndefined(); // No Mongoose save method
            expect((created as any).$isNew).toBeUndefined(); // No Mongoose $isNew property
            expect((created as any).toObject).toBeUndefined(); // No Mongoose toObject method

            // Find by email
            const foundByEmail = await accountRepository.findByEmail(
              accountData.email
            );
            expect(foundByEmail).toBeDefined();
            expect((foundByEmail as any).save).toBeUndefined();
            expect((foundByEmail as any).$isNew).toBeUndefined();
            expect((foundByEmail as any).toObject).toBeUndefined();

            // Find by ID
            const foundById = await accountRepository.findById(
              created._id!.toString()
            );
            expect(foundById).toBeDefined();
            expect((foundById as any).save).toBeUndefined();
            expect((foundById as any).$isNew).toBeUndefined();
            expect((foundById as any).toObject).toBeUndefined();
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 7: Email normalization consistency', () => {
    it('should return same results for mixed-case and lowercase emails', async () => {
      // Feature: authenticator-data-access-layer, Property 7: Email normalization consistency
      // Validates: Requirements 5.1

      await fc.assert(
        fc.asyncProperty(
          accountDataArbitrary,
          async (accountData) => {
            // Create account with original email
            await accountRepository.create(accountData);

            // Generate mixed-case version of email
            const mixedCaseEmail = accountData.email
              .split('')
              .map((char, i) =>
                i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()
              )
              .join('');

            // Query with both versions
            const resultOriginal = await accountRepository.findByEmail(
              accountData.email
            );
            const resultMixedCase = await accountRepository.findByEmail(
              mixedCaseEmail
            );
            const resultLowerCase = await accountRepository.findByEmail(
              accountData.email.toLowerCase()
            );

            // All should return the same account
            expect(resultOriginal).toBeDefined();
            expect(resultMixedCase).toBeDefined();
            expect(resultLowerCase).toBeDefined();
            expect(resultOriginal!._id).toEqual(resultMixedCase!._id);
            expect(resultOriginal!._id).toEqual(resultLowerCase!._id);
            expect(resultOriginal!.email).toBe(accountData.email.toLowerCase());
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);
  });

  describe('Property 3: Account creation persistence', () => {
    it('should persist accounts so they can be retrieved', async () => {
      // Feature: authenticator-data-access-layer, Property 3: Account creation persistence
      // Validates: Requirements 3.2

      await fc.assert(
        fc.asyncProperty(
          accountDataArbitrary,
          async (accountData) => {
            // Create account
            const created = await accountRepository.create(accountData);

            // Account for Mongoose trimming
            const expectedFirstname = accountData.firstname.trim();
            const expectedLastname = accountData.lastname.trim();

            // Retrieve by email
            const foundByEmail = await accountRepository.findByEmail(
              accountData.email
            );
            expect(foundByEmail).toBeDefined();
            expect(foundByEmail!.firstname).toBe(expectedFirstname);
            expect(foundByEmail!.lastname).toBe(expectedLastname);
            expect(foundByEmail!.email).toBe(accountData.email.toLowerCase());

            // Retrieve by ID
            const foundById = await accountRepository.findById(
              created._id!.toString()
            );
            expect(foundById).toBeDefined();
            expect(foundById!.firstname).toBe(expectedFirstname);
            expect(foundById!.lastname).toBe(expectedLastname);
            expect(foundById!.email).toBe(accountData.email.toLowerCase());
          }
        ),
        { numRuns: 20, timeout: 60000 }
      );
    }, 65000);
  });

  describe('Property 9: Password hashing preservation', () => {
    it('should hash passwords before storing', async () => {
      // Feature: authenticator-data-access-layer, Property 9: Password hashing preservation
      // Validates: Requirements 5.5

      await fc.assert(
        fc.asyncProperty(
          accountDataArbitrary,
          async (accountData) => {
            const plainPassword = accountData.password;
            // Account for Mongoose trimming the password
            const trimmedPassword = plainPassword.trim();

            // Create account
            const created = await accountRepository.create(accountData);

            // Password should be hashed (not equal to plain text)
            expect(created.password).toBeDefined();
            expect(created.password).not.toBe(plainPassword);
            expect(created.password).not.toBe(trimmedPassword);

            // Password should be a valid bcrypt hash
            expect(created.password).toMatch(/^\$2[aby]\$\d{2}\$/);

            // Should be able to verify the password (using trimmed version)
            const isValid = bcrypt.compareSync(trimmedPassword, created.password);
            expect(isValid).toBe(true);

            // Retrieved account should also have hashed password
            const found = await accountRepository.findByEmail(accountData.email);
            expect(found!.password).toBe(created.password);
          }
        ),
        { numRuns: 20, timeout: 60000 }
      );
    }, 65000);
  });

  describe('Property 10: Realm member update preservation', () => {
    it('should update realm members when account is created', async () => {
      // Feature: authenticator-data-access-layer, Property 10: Realm member update preservation
      // Validates: Requirements 5.5

      await fc.assert(
        fc.asyncProperty(
          accountDataArbitrary,
          async (accountData) => {
            // Create a realm with a member matching the email
            const realm = await RealmModel.create({
              name: 'Test Realm',
              members: [
                {
                  name: '',
                  email: accountData.email.toLowerCase(),
                  role: 'administrator',
                  registered: false
                }
              ]
            });

            // Create account
            await accountRepository.create(accountData);

            // Give the post-save hook time to execute
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Account for Mongoose trimming
            const expectedName = `${accountData.firstname.trim()} ${accountData.lastname.trim()}`;

            // Retrieve realm and check member was updated
            const updatedRealm = await RealmModel.findById(realm._id).lean();
            expect(updatedRealm).toBeDefined();
            expect(updatedRealm!.members).toHaveLength(1);
            expect(updatedRealm!.members[0].registered).toBe(true);
            expect(updatedRealm!.members[0].name).toBe(expectedName);
          }
        ),
        { numRuns: 20, timeout: 60000 }
      );
    }, 65000);
  });

  describe('Property 5: Account findAll returns all accounts', () => {
    it('should return all accounts in the database as plain objects', async () => {
      // Feature: api-realm-data-access-layer, Property 5: Account findAll returns all accounts
      // Validates: Requirements 3.1, 3.2

      await fc.assert(
        fc.asyncProperty(
          fc.array(accountDataArbitrary, { minLength: 0, maxLength: 10 }),
          async (accountsData) => {
            // Clear database before each property test iteration
            await clearTestDB();

            // Create all accounts
            const createdAccounts = [];
            for (const accountData of accountsData) {
              const created = await accountRepository.create(accountData);
              createdAccounts.push(created);
            }

            // Call findAll
            const allAccounts = await accountRepository.findAll();

            // Should return the same number of accounts
            expect(allAccounts).toHaveLength(createdAccounts.length);

            // All returned accounts should be plain objects
            for (const account of allAccounts) {
              expect(account).toBeDefined();
              expect(typeof account).toBe('object');
              expect((account as any).save).toBeUndefined();
              expect((account as any).$isNew).toBeUndefined();
              expect((account as any).toObject).toBeUndefined();
            }

            // All created accounts should be in the result
            for (const created of createdAccounts) {
              const found = allAccounts.find(
                (a) => a._id!.toString() === created._id!.toString()
              );
              expect(found).toBeDefined();
              expect(found!.email).toBe(created.email);
              expect(found!.firstname).toBe(created.firstname);
              expect(found!.lastname).toBe(created.lastname);
            }
          }
        ),
        { numRuns: 100, timeout: 60000 }
      );
    }, 65000);
  });

  // ============================================================================
  // Unit Tests
  // ============================================================================

  describe('findByEmail', () => {
    it('should find account by email', async () => {
      const accountData = {
        firstname: 'John',
        lastname: 'Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      await accountRepository.create(accountData);
      const found = await accountRepository.findByEmail('john@example.com');

      expect(found).toBeDefined();
      expect(found!.firstname).toBe('John');
      expect(found!.lastname).toBe('Doe');
      expect(found!.email).toBe('john@example.com');
    });

    it('should return null for non-existent email', async () => {
      const found = await accountRepository.findByEmail('nonexistent@example.com');
      expect(found).toBeNull();
    });

    it('should normalize email to lowercase', async () => {
      const accountData = {
        firstname: 'Jane',
        lastname: 'Smith',
        email: 'Jane@Example.COM',
        password: 'password123'
      };

      await accountRepository.create(accountData);
      const found = await accountRepository.findByEmail('JANE@EXAMPLE.COM');

      expect(found).toBeDefined();
      expect(found!.email).toBe('jane@example.com');
    });

    it('should throw error for invalid email', async () => {
      await expect(accountRepository.findByEmail('')).rejects.toThrow(
        'Email must be a non-empty string'
      );
      await expect(accountRepository.findByEmail(null as any)).rejects.toThrow(
        'Email must be a non-empty string'
      );
    });
  });

  describe('findById', () => {
    it('should find account by ID', async () => {
      const accountData = {
        firstname: 'Bob',
        lastname: 'Johnson',
        email: 'bob@example.com',
        password: 'password123'
      };

      const created = await accountRepository.create(accountData);
      const found = await accountRepository.findById(created._id!.toString());

      expect(found).toBeDefined();
      expect(found!.firstname).toBe('Bob');
      expect(found!.lastname).toBe('Johnson');
    });

    it('should return null for non-existent ID', async () => {
      const found = await accountRepository.findById('507f1f77bcf86cd799439011');
      expect(found).toBeNull();
    });

    it('should throw error for invalid ID', async () => {
      await expect(accountRepository.findById('')).rejects.toThrow(
        'ID must be a non-empty string'
      );
      await expect(accountRepository.findById(null as any)).rejects.toThrow(
        'ID must be a non-empty string'
      );
    });
  });

  describe('create', () => {
    it('should create account with valid data', async () => {
      const accountData = {
        firstname: 'Alice',
        lastname: 'Williams',
        email: 'alice@example.com',
        password: 'password123'
      };

      const created = await accountRepository.create(accountData);

      expect(created).toBeDefined();
      expect(created._id).toBeDefined();
      expect(created.firstname).toBe('Alice');
      expect(created.lastname).toBe('Williams');
      expect(created.email).toBe('alice@example.com');
      expect(created.password).not.toBe('password123'); // Should be hashed
      expect(created.createdDate).toBeDefined();
    });

    it('should throw error for missing firstname', async () => {
      await expect(
        accountRepository.create({
          firstname: '',
          lastname: 'Test',
          email: 'test@example.com',
          password: 'password123'
        })
      ).rejects.toThrow('Firstname must be a non-empty string');
    });

    it('should throw error for missing lastname', async () => {
      await expect(
        accountRepository.create({
          firstname: 'Test',
          lastname: '',
          email: 'test@example.com',
          password: 'password123'
        })
      ).rejects.toThrow('Lastname must be a non-empty string');
    });

    it('should throw error for missing email', async () => {
      await expect(
        accountRepository.create({
          firstname: 'Test',
          lastname: 'User',
          email: '',
          password: 'password123'
        })
      ).rejects.toThrow('Email must be a non-empty string');
    });

    it('should throw error for missing password', async () => {
      await expect(
        accountRepository.create({
          firstname: 'Test',
          lastname: 'User',
          email: 'test@example.com',
          password: ''
        })
      ).rejects.toThrow('Password must be a non-empty string');
    });
  });

  describe('updatePassword', () => {
    it('should update password for existing account', async () => {
      const accountData = {
        firstname: 'Charlie',
        lastname: 'Brown',
        email: 'charlie@example.com',
        password: 'oldpassword'
      };

      await accountRepository.create(accountData);
      const updated = await accountRepository.updatePassword(
        'charlie@example.com',
        'newpassword'
      );

      expect(updated).toBeDefined();
      expect(updated!.password).not.toBe('oldpassword');
      expect(updated!.password).not.toBe('newpassword');

      // Verify new password is hashed correctly
      const isValid = bcrypt.compareSync('newpassword', updated!.password);
      expect(isValid).toBe(true);
    });

    it('should return null for non-existent account', async () => {
      const updated = await accountRepository.updatePassword(
        'nonexistent@example.com',
        'newpassword'
      );
      expect(updated).toBeNull();
    });

    it('should throw error for invalid email', async () => {
      await expect(
        accountRepository.updatePassword('', 'newpassword')
      ).rejects.toThrow('Email must be a non-empty string');
    });

    it('should throw error for invalid password', async () => {
      await expect(
        accountRepository.updatePassword('test@example.com', '')
      ).rejects.toThrow('Password must be a non-empty string');
    });
  });

  describe('findAll', () => {
    it('should return all accounts', async () => {
      // Create multiple accounts
      const account1 = {
        firstname: 'Alice',
        lastname: 'Smith',
        email: 'alice@example.com',
        password: 'password123'
      };
      const account2 = {
        firstname: 'Bob',
        lastname: 'Jones',
        email: 'bob@example.com',
        password: 'password456'
      };
      const account3 = {
        firstname: 'Carol',
        lastname: 'White',
        email: 'carol@example.com',
        password: 'password789'
      };

      await accountRepository.create(account1);
      await accountRepository.create(account2);
      await accountRepository.create(account3);

      const allAccounts = await accountRepository.findAll();

      expect(allAccounts).toHaveLength(3);
      expect(allAccounts.some((a) => a.email === 'alice@example.com')).toBe(true);
      expect(allAccounts.some((a) => a.email === 'bob@example.com')).toBe(true);
      expect(allAccounts.some((a) => a.email === 'carol@example.com')).toBe(true);
    });

    it('should return empty array for empty database', async () => {
      const allAccounts = await accountRepository.findAll();
      expect(allAccounts).toEqual([]);
    });

    it('should return plain objects', async () => {
      const accountData = {
        firstname: 'David',
        lastname: 'Brown',
        email: 'david@example.com',
        password: 'password123'
      };

      await accountRepository.create(accountData);
      const allAccounts = await accountRepository.findAll();

      expect(allAccounts).toHaveLength(1);
      const account = allAccounts[0];
      
      // Verify it's a plain object without Mongoose methods
      expect((account as any).save).toBeUndefined();
      expect((account as any).$isNew).toBeUndefined();
      expect((account as any).toObject).toBeUndefined();
    });
  });
});
