import * as RealmManager from '../../managers/realmmanager.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Crypto, DataAccess, EnvironmentConfig, Service, TestUtils } from '@microrealestate/common';

const { connectTestDB, disconnectTestDB, clearTestDB } = TestUtils;

describe('RealmManager - add function', () => {
  let realmRepository;

  beforeAll(async () => {
    await connectTestDB();
    
    // Initialize Service with test config for Crypto
    const envConfig = new EnvironmentConfig({
      CIPHER_KEY: 'test-cipher-key-32-characters!!',
      CIPHER_IV_KEY: 'test-iv-key-16ch'
    });
    Service.getInstance(envConfig);
    
    realmRepository = DataAccess.getRealmRepository();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should create a realm with encrypted secrets using repository', async () => {
    // Arrange
    const realmData = {
      name: 'Test Realm',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en',
      thirdParties: {
        gmail: {
          selected: true,
          email: 'test@gmail.com',
          appPassword: 'plaintext-password',
          fromEmail: 'test@gmail.com',
          replyToEmail: 'test@gmail.com'
        }
      }
    };

    const req = {
      body: realmData,
      realms: []
    };

    const res = {
      json: vi.fn()
    };

    // Act
    await RealmManager.add(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledOnce();
    const responseRealm = res.json.mock.calls[0][0];

    // Verify realm was created
    expect(responseRealm).toBeDefined();
    expect(responseRealm.name).toBe('Test Realm');
    expect(responseRealm.members).toHaveLength(1);
    expect(responseRealm.currency).toBe('USD');
    expect(responseRealm.locale).toBe('en');

    // Verify secrets are escaped in response
    expect(responseRealm.thirdParties.gmail.appPassword).toBe('**********');

    // Verify realm was persisted with encrypted secrets
    const savedRealm = await realmRepository.findOne({ _id: responseRealm._id.toString() });
    expect(savedRealm).toBeDefined();
    expect(savedRealm.thirdParties.gmail.appPassword).not.toBe('plaintext-password');
    expect(savedRealm.thirdParties.gmail.appPassword).not.toBe('**********');
    
    // Verify the secret is actually encrypted (can be decrypted)
    const decrypted = Crypto.decrypt(savedRealm.thirdParties.gmail.appPassword);
    expect(decrypted).toBe('plaintext-password');
  });

  it('should create a realm with application secrets hashed', async () => {
    // Arrange
    const realmData = {
      name: 'Test Realm with Apps',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'EUR',
      locale: 'fr',
      applications: [
        {
          name: 'Test App',
          role: 'administrator',
          clientId: 'test-client-id',
          clientSecret: 'plain-secret-123',
          expiryDate: new Date('2025-12-31')
        }
      ]
    };

    const req = {
      body: realmData,
      realms: []
    };

    const res = {
      json: vi.fn()
    };

    // Act
    await RealmManager.add(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledOnce();
    const responseRealm = res.json.mock.calls[0][0];

    // Verify application secrets are escaped in response
    expect(responseRealm.applications).toHaveLength(1);
    expect(responseRealm.applications[0].clientSecret).toBe('**********');

    // Verify application secrets are hashed in database
    const savedRealm = await realmRepository.findOne({ _id: responseRealm._id.toString() });
    expect(savedRealm.applications).toHaveLength(1);
    expect(savedRealm.applications[0].clientSecret).not.toBe('plain-secret-123');
    expect(savedRealm.applications[0].clientSecret).not.toBe('**********');
    
    // Verify it's a bcrypt hash (starts with $2b$ or $2a$)
    expect(savedRealm.applications[0].clientSecret).toMatch(/^\$2[ab]\$/);
    
    // Verify createdDate was set by pre-save hook
    expect(savedRealm.applications[0].createdDate).toBeDefined();
  });

  it('should validate required fields', async () => {
    // Arrange - missing required field 'name'
    const realmData = {
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en'
    };

    const req = {
      body: realmData,
      realms: []
    };

    const res = {
      json: vi.fn()
    };

    // Act & Assert
    await expect(RealmManager.add(req, res)).rejects.toThrow('missing fields');
  });

  it('should reject duplicate realm names', async () => {
    // Arrange - create an existing realm
    const existingRealm = {
      name: 'Existing Realm',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en'
    };

    await realmRepository.create(existingRealm);

    // Try to create a realm with the same name
    const req = {
      body: {
        name: 'Existing Realm',
        members: [
          {
            name: 'Another Admin',
            email: 'admin2@test.com',
            role: 'administrator',
            registered: true
          }
        ],
        currency: 'EUR',
        locale: 'fr'
      },
      realms: [existingRealm]
    };

    const res = {
      json: vi.fn()
    };

    // Act & Assert
    await expect(RealmManager.add(req, res)).rejects.toThrow('landlord name already taken');
  });

  it('should encrypt multiple third-party secrets', async () => {
    // Arrange
    const realmData = {
      name: 'Multi-Secret Realm',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en',
      thirdParties: {
        smtp: {
          selected: true,
          server: 'smtp.example.com',
          port: 587,
          secure: true,
          authentication: true,
          username: 'user@example.com',
          password: 'smtp-password-123',
          fromEmail: 'noreply@example.com',
          replyToEmail: 'support@example.com'
        },
        mailgun: {
          selected: true,
          apiKey: 'mailgun-api-key-456',
          domain: 'example.com',
          fromEmail: 'noreply@example.com',
          replyToEmail: 'support@example.com'
        },
        b2: {
          keyId: 'b2-key-id-789',
          applicationKey: 'b2-app-key-012',
          endpoint: 's3.us-west-002.backblazeb2.com',
          bucket: 'my-bucket'
        }
      }
    };

    const req = {
      body: realmData,
      realms: []
    };

    const res = {
      json: vi.fn()
    };

    // Act
    await RealmManager.add(req, res);

    // Assert
    const responseRealm = res.json.mock.calls[0][0];

    // Verify all secrets are escaped in response
    expect(responseRealm.thirdParties.smtp.password).toBe('**********');
    expect(responseRealm.thirdParties.mailgun.apiKey).toBe('**********');
    expect(responseRealm.thirdParties.b2.keyId).toBe('**********');
    expect(responseRealm.thirdParties.b2.applicationKey).toBe('**********');

    // Verify all secrets are encrypted in database
    const savedRealm = await realmRepository.findOne({ _id: responseRealm._id.toString() });
    
    // SMTP password
    expect(savedRealm.thirdParties.smtp.password).not.toBe('smtp-password-123');
    const decryptedSmtp = Crypto.decrypt(savedRealm.thirdParties.smtp.password);
    expect(decryptedSmtp).toBe('smtp-password-123');

    // Mailgun API key
    expect(savedRealm.thirdParties.mailgun.apiKey).not.toBe('mailgun-api-key-456');
    const decryptedMailgun = Crypto.decrypt(savedRealm.thirdParties.mailgun.apiKey);
    expect(decryptedMailgun).toBe('mailgun-api-key-456');

    // B2 keyId
    expect(savedRealm.thirdParties.b2.keyId).not.toBe('b2-key-id-789');
    const decryptedB2KeyId = Crypto.decrypt(savedRealm.thirdParties.b2.keyId);
    expect(decryptedB2KeyId).toBe('b2-key-id-789');

    // B2 applicationKey
    expect(savedRealm.thirdParties.b2.applicationKey).not.toBe('b2-app-key-012');
    const decryptedB2AppKey = Crypto.decrypt(savedRealm.thirdParties.b2.applicationKey);
    expect(decryptedB2AppKey).toBe('b2-app-key-012');
  });
});

describe('RealmManager - update function', () => {
  let realmRepository;
  let accountRepository;

  // Helper to create req.realm with string _id for comparison
  const createReqRealm = (realm) => ({
    ...realm,
    _id: realm._id.toString()
  });

  beforeAll(async () => {
    await connectTestDB();
    
    // Initialize Service with test config for Crypto
    const envConfig = new EnvironmentConfig({
      CIPHER_KEY: 'test-cipher-key-32-characters!!',
      CIPHER_IV_KEY: 'test-iv-key-16ch'
    });
    Service.getInstance(envConfig);
    
    realmRepository = DataAccess.getRealmRepository();
    accountRepository = DataAccess.getAccountRepository();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should update a realm correctly using repositories', async () => {
    // Arrange - create initial realm
    const initialRealm = await realmRepository.create({
      name: 'Initial Realm',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en'
    });

    const updateData = {
      _id: initialRealm._id.toString(),
      name: 'Updated Realm',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'EUR',
      locale: 'fr'
    };

    const req = {
      body: updateData,
      realm: createReqRealm(initialRealm),
      realms: [initialRealm],
      user: {
        role: 'administrator'
      }
    };

    const res = {
      json: vi.fn()
    };

    // Act
    await RealmManager.update(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledOnce();
    const responseRealm = res.json.mock.calls[0][0];

    expect(responseRealm.name).toBe('Updated Realm');
    expect(responseRealm.currency).toBe('EUR');
    expect(responseRealm.locale).toBe('fr');

    // Verify persistence
    const savedRealm = await realmRepository.findOne({ _id: initialRealm._id.toString() });
    expect(savedRealm.name).toBe('Updated Realm');
    expect(savedRealm.currency).toBe('EUR');
    expect(savedRealm.locale).toBe('fr');
  });

  it('should preserve existing encrypted secrets when not updated', async () => {
    // Arrange - create realm with encrypted secrets
    const initialRealm = await realmRepository.create({
      name: 'Realm with Secrets',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en',
      thirdParties: {
        gmail: {
          selected: true,
          email: 'test@gmail.com',
          appPassword: Crypto.encrypt('original-password'),
          fromEmail: 'test@gmail.com',
          replyToEmail: 'test@gmail.com'
        }
      }
    });

    const originalEncryptedPassword = initialRealm.thirdParties.gmail.appPassword;

    const updateData = {
      _id: initialRealm._id.toString(),
      name: 'Updated Name',
      members: initialRealm.members,
      currency: 'USD',
      locale: 'en',
      thirdParties: {
        gmail: {
          selected: true,
          email: 'test@gmail.com',
          appPassword: '**********', // Placeholder, should preserve original
          appPasswordUpdated: false,
          fromEmail: 'test@gmail.com',
          replyToEmail: 'test@gmail.com'
        }
      }
    };

    const req = {
      body: updateData,
      realm: createReqRealm(initialRealm),
      realms: [initialRealm],
      user: {
        role: 'administrator'
      }
    };

    const res = {
      json: vi.fn()
    };

    // Act
    await RealmManager.update(req, res);

    // Assert
    const savedRealm = await realmRepository.findOne({ _id: initialRealm._id.toString() });
    
    // Verify the encrypted password was preserved
    expect(savedRealm.thirdParties.gmail.appPassword).toBe(originalEncryptedPassword);
    
    // Verify it can still be decrypted to original value
    const decrypted = Crypto.decrypt(savedRealm.thirdParties.gmail.appPassword);
    expect(decrypted).toBe('original-password');
  });

  it('should encrypt new secrets when updated', async () => {
    // Arrange - create realm with encrypted secrets
    const initialRealm = await realmRepository.create({
      name: 'Realm with Secrets',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en',
      thirdParties: {
        smtp: {
          selected: true,
          server: 'smtp.example.com',
          port: 587,
          secure: true,
          authentication: true,
          username: 'user@example.com',
          password: Crypto.encrypt('old-password'),
          fromEmail: 'noreply@example.com',
          replyToEmail: 'support@example.com'
        }
      }
    });

    const updateData = {
      _id: initialRealm._id.toString(),
      name: 'Realm with Secrets',
      members: initialRealm.members,
      currency: 'USD',
      locale: 'en',
      thirdParties: {
        smtp: {
          selected: true,
          server: 'smtp.example.com',
          port: 587,
          secure: true,
          authentication: true,
          username: 'user@example.com',
          password: 'new-password',
          passwordUpdated: true,
          fromEmail: 'noreply@example.com',
          replyToEmail: 'support@example.com'
        }
      }
    };

    const req = {
      body: updateData,
      realm: createReqRealm(initialRealm),
      realms: [initialRealm],
      user: {
        role: 'administrator'
      }
    };

    const res = {
      json: vi.fn()
    };

    // Act
    await RealmManager.update(req, res);

    // Assert
    const savedRealm = await realmRepository.findOne({ _id: initialRealm._id.toString() });
    
    // Verify the password was encrypted
    expect(savedRealm.thirdParties.smtp.password).not.toBe('new-password');
    expect(savedRealm.thirdParties.smtp.password).not.toBe('**********');
    
    // Verify it can be decrypted to new value
    const decrypted = Crypto.decrypt(savedRealm.thirdParties.smtp.password);
    expect(decrypted).toBe('new-password');
  });

  it('should populate member information from accounts', async () => {
    // Arrange - create accounts
    await accountRepository.create({
      email: 'registered@test.com',
      firstname: 'John',
      lastname: 'Doe',
      password: 'hashed-password'
    });

    await accountRepository.create({
      email: 'another@test.com',
      firstname: 'Jane',
      lastname: 'Smith',
      password: 'hashed-password'
    });

    // Create realm with members
    const initialRealm = await realmRepository.create({
      name: 'Test Realm',
      members: [
        {
          email: 'admin@test.com',
          role: 'administrator'
        },
        {
          email: 'registered@test.com',
          role: 'renter'
        },
        {
          email: 'unregistered@test.com',
          role: 'renter'
        }
      ],
      currency: 'USD',
      locale: 'en'
    });

    const updateData = {
      _id: initialRealm._id.toString(),
      name: 'Test Realm',
      members: [
        {
          email: 'admin@test.com',
          role: 'administrator'
        },
        {
          email: 'registered@test.com',
          role: 'renter'
        },
        {
          email: 'unregistered@test.com',
          role: 'renter'
        }
      ],
      currency: 'USD',
      locale: 'en'
    };

    const req = {
      body: updateData,
      realm: createReqRealm(initialRealm),
      realms: [initialRealm],
      user: {
        role: 'administrator'
      }
    };

    const res = {
      json: vi.fn()
    };

    // Act
    await RealmManager.update(req, res);

    // Assert
    const responseRealm = res.json.mock.calls[0][0];
    
    // Verify registered member has name and registered flag
    const registeredMember = responseRealm.members.find(m => m.email === 'registered@test.com');
    expect(registeredMember.name).toBe('John Doe');
    expect(registeredMember.registered).toBe(true);

    // Verify unregistered member has empty name and registered flag false
    const unregisteredMember = responseRealm.members.find(m => m.email === 'unregistered@test.com');
    expect(unregisteredMember.name).toBe('');
    expect(unregisteredMember.registered).toBe(false);
  });

  it('should protect existing application credentials from updates', async () => {
    // Arrange - create realm with application
    const initialRealm = await realmRepository.create({
      name: 'Realm with App',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en',
      applications: [
        {
          name: 'Existing App',
          role: 'administrator',
          clientId: 'existing-client-id',
          clientSecret: 'original-secret',
          expiryDate: new Date('2025-12-31')
        }
      ]
    });

    // Get the hashed secret from database
    const savedInitialRealm = await realmRepository.findOne({ _id: initialRealm._id.toString() });
    const originalHashedSecret = savedInitialRealm.applications[0].clientSecret;

    const updateData = {
      _id: initialRealm._id.toString(),
      name: 'Realm with App',
      members: initialRealm.members,
      currency: 'USD',
      locale: 'en',
      applications: [
        {
          name: 'Existing App',
          role: 'administrator',
          clientId: 'existing-client-id',
          clientSecret: 'attempted-new-secret', // Should be ignored
          expiryDate: new Date('2025-12-31')
        },
        {
          name: 'New App',
          role: 'renter',
          clientId: 'new-client-id',
          clientSecret: 'new-app-secret',
          expiryDate: new Date('2026-12-31')
        }
      ]
    };

    const req = {
      body: updateData,
      realm: createReqRealm(savedInitialRealm),
      realms: [savedInitialRealm],
      user: {
        role: 'administrator'
      }
    };

    const res = {
      json: vi.fn()
    };

    // Act
    await RealmManager.update(req, res);

    // Assert
    const savedRealm = await realmRepository.findOne({ _id: initialRealm._id.toString() });
    
    // Verify existing app credentials were NOT updated
    const existingApp = savedRealm.applications.find(app => app.clientId === 'existing-client-id');
    expect(existingApp.clientSecret).toBe(originalHashedSecret);
    expect(existingApp.clientSecret).not.toBe('attempted-new-secret');

    // Verify new app was added with hashed secret
    const newApp = savedRealm.applications.find(app => app.clientId === 'new-client-id');
    expect(newApp).toBeDefined();
    expect(newApp.clientSecret).not.toBe('new-app-secret');
    expect(newApp.clientSecret).toMatch(/^\$2[ab]\$/); // bcrypt hash
    expect(newApp.createdDate).toBeDefined();
  });

  it('should validate required fields on update', async () => {
    // Arrange - create initial realm
    const initialRealm = await realmRepository.create({
      name: 'Test Realm',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en'
    });

    // Try to update with missing required field (explicitly set to undefined)
    const updateData = {
      _id: initialRealm._id.toString(),
      name: undefined, // Explicitly remove name field
      members: initialRealm.members,
      currency: 'USD',
      locale: 'en'
    };

    const req = {
      body: updateData,
      realm: createReqRealm(initialRealm),
      realms: [initialRealm],
      user: {
        role: 'administrator'
      }
    };

    const res = {
      json: vi.fn()
    };

    // Act & Assert
    await expect(RealmManager.update(req, res)).rejects.toThrow('missing fields');
  });

  it('should reject duplicate realm names on update', async () => {
    // Arrange - create two realms
    const realm1 = await realmRepository.create({
      name: 'Realm One',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en'
    });

    const realm2 = await realmRepository.create({
      name: 'Realm Two',
      members: [
        {
          name: 'Admin User',
          email: 'admin2@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'EUR',
      locale: 'fr'
    });

    // Try to update realm2 to have the same name as realm1
    const updateData = {
      _id: realm2._id.toString(),
      name: 'Realm One', // Duplicate name
      members: realm2.members,
      currency: 'EUR',
      locale: 'fr'
    };

    const req = {
      body: updateData,
      realm: createReqRealm(realm2),
      realms: [realm1, realm2],
      user: {
        role: 'administrator'
      }
    };

    const res = {
      json: vi.fn()
    };

    // Act & Assert
    await expect(RealmManager.update(req, res)).rejects.toThrow('landlord name already taken');
  });

  it('should allow updating realm name to same name (case insensitive)', async () => {
    // Arrange - create realm
    const initialRealm = await realmRepository.create({
      name: 'Test Realm',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en'
    });

    // Update with same name (different case)
    const updateData = {
      _id: initialRealm._id.toString(),
      name: 'TEST REALM',
      members: initialRealm.members,
      currency: 'EUR',
      locale: 'fr'
    };

    const req = {
      body: updateData,
      realm: createReqRealm(initialRealm),
      realms: [initialRealm],
      user: {
        role: 'administrator'
      }
    };

    const res = {
      json: vi.fn()
    };

    // Act
    await RealmManager.update(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledOnce();
    const responseRealm = res.json.mock.calls[0][0];
    expect(responseRealm.name).toBe('TEST REALM');
    expect(responseRealm.currency).toBe('EUR');
  });
});

describe('RealmManager - one and all functions', () => {
  let realmRepository;

  beforeAll(async () => {
    await connectTestDB();
    
    // Initialize Service with test config for Crypto
    const envConfig = new EnvironmentConfig({
      CIPHER_KEY: 'test-cipher-key-32-characters!!',
      CIPHER_IV_KEY: 'test-iv-key-16ch'
    });
    Service.getInstance(envConfig);
    
    realmRepository = DataAccess.getRealmRepository();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should return a single realm by id using req.realms', async () => {
    // Arrange - create realms
    const realm1 = await realmRepository.create({
      name: 'Realm One',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en',
      applications: [
        {
          name: 'Test App',
          role: 'administrator',
          clientId: 'test-client-id',
          clientSecret: 'secret-123',
          expiryDate: new Date('2025-12-31')
        }
      ]
    });

    const realm2 = await realmRepository.create({
      name: 'Realm Two',
      members: [
        {
          name: 'Admin User',
          email: 'admin2@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'EUR',
      locale: 'fr'
    });

    const req = {
      params: {
        id: realm1._id.toString()
      },
      realms: [realm1, realm2]
    };

    const res = {
      json: vi.fn()
    };

    // Act
    RealmManager.one(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledOnce();
    const responseRealm = res.json.mock.calls[0][0];
    
    expect(responseRealm._id.toString()).toBe(realm1._id.toString());
    expect(responseRealm.name).toBe('Realm One');
    
    // Verify secrets are escaped
    expect(responseRealm.applications[0].clientSecret).toBe('**********');
  });

  it('should throw error when realm id is missing', () => {
    // Arrange
    const req = {
      params: {},
      realms: []
    };

    const res = {
      json: vi.fn()
    };

    // Act & Assert
    expect(() => RealmManager.one(req, res)).toThrow('missing fields');
  });

  it('should throw error when realm is not found', () => {
    // Arrange
    const req = {
      params: {
        id: 'non-existent-id'
      },
      realms: []
    };

    const res = {
      json: vi.fn()
    };

    // Act & Assert
    expect(() => RealmManager.one(req, res)).toThrow('landlord not found');
  });

  it('should return all realms using req.realms', async () => {
    // Arrange - create multiple realms
    const realm1 = await realmRepository.create({
      name: 'Realm One',
      members: [
        {
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'USD',
      locale: 'en',
      thirdParties: {
        gmail: {
          selected: true,
          email: 'test@gmail.com',
          appPassword: Crypto.encrypt('password-123'),
          fromEmail: 'test@gmail.com',
          replyToEmail: 'test@gmail.com'
        }
      }
    });

    const realm2 = await realmRepository.create({
      name: 'Realm Two',
      members: [
        {
          name: 'Admin User',
          email: 'admin2@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'EUR',
      locale: 'fr'
    });

    const realm3 = await realmRepository.create({
      name: 'Realm Three',
      members: [
        {
          name: 'Admin User',
          email: 'admin3@test.com',
          role: 'administrator',
          registered: true
        }
      ],
      currency: 'GBP',
      locale: 'en'
    });

    const req = {
      realms: [realm1, realm2, realm3]
    };

    const res = {
      json: vi.fn()
    };

    // Act
    RealmManager.all(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledOnce();
    const responseRealms = res.json.mock.calls[0][0];
    
    expect(responseRealms).toHaveLength(3);
    expect(responseRealms[0].name).toBe('Realm One');
    expect(responseRealms[1].name).toBe('Realm Two');
    expect(responseRealms[2].name).toBe('Realm Three');
    
    // Verify secrets are escaped in all realms
    expect(responseRealms[0].thirdParties.gmail.appPassword).toBe('**********');
  });

  it('should return empty array when no realms exist', () => {
    // Arrange
    const req = {
      realms: []
    };

    const res = {
      json: vi.fn()
    };

    // Act
    RealmManager.all(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledOnce();
    const responseRealms = res.json.mock.calls[0][0];
    expect(responseRealms).toEqual([]);
  });
});
