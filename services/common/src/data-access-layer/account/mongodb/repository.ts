import AccountModel from '../../../collections/account.js';
import { CollectionTypes } from '@microrealestate/types';
import { IAccountRepository } from '../interface.js';

/**
 * MongoDB implementation of Account repository
 */
export default class MongoRepository implements IAccountRepository {
  async findByEmail(email: string): Promise<CollectionTypes.Account | null> {
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }

    const account = await AccountModel.findOne({
      email: email.toLowerCase()
    }).lean();

    return account;
  }

  async findById(id: string): Promise<CollectionTypes.Account | null> {
    if (!id || typeof id !== 'string') {
      throw new Error('ID must be a non-empty string');
    }

    const account = await AccountModel.findById(id).lean();
    return account;
  }

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

    const account = await AccountModel.findOne({
      email: email.toLowerCase()
    });

    if (!account) {
      return null;
    }

    account.password = newPassword;
    await account.save();

    return account.toObject();
  }

  async findAll(): Promise<CollectionTypes.Account[]> {
    const accounts = await AccountModel.find().lean();
    return accounts;
  }
}
