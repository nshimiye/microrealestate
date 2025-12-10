import EnvironmentConfig from './environmentconfig.js';
import logger from './logger.js';
import redis from 'redis';
import { RedisClientTypes } from '@microrealestate/types';
import DynamoDBClient from './dynamodbclient.js';
import DynamoDBCacheAdapter from './dynamodbcacheadapter.js';

process.on('SIGINT', async () => {
  try {
    await RedisClient.getInstance()?.disconnect();
  } catch (error) {
    console.error(error);
  }
});

export default class RedisClient {
  private static instance: RedisClient | null = null;
  static getInstance(envConfig?: EnvironmentConfig) {
    if (!RedisClient.instance) {
      if (!envConfig) {
        throw new Error('envConfig is required');
      }
      RedisClient.instance = new RedisClient(envConfig);
    }
    return RedisClient.instance;
  }

  private client: redis.RedisClientType | null = null;
  private dynamoAdapter: DynamoDBCacheAdapter | null = null;
  private useDynamoDB: boolean = false;
  private envConfig: EnvironmentConfig;

  get: RedisClientTypes.GetFunction = () => Promise.resolve(null);
  set: RedisClientTypes.SetFunction = () => Promise.resolve(null);
  del: RedisClientTypes.DelFunction = () => Promise.resolve(-1);
  keys: RedisClientTypes.KeysFunction = () => Promise.resolve([]);
  // monitor: RedisClientTypes.MonitorFunction = () => Promise.resolve();

  private constructor(envConfig: EnvironmentConfig) {
    this.envConfig = envConfig;
    const config = this.envConfig.getValues();
    this.useDynamoDB = config.USE_DYNAMODB === true;
  }

  async connect() {
    if (this.useDynamoDB) {
      await this.connectDynamoDB();
    } else {
      await this.connectRedis();
    }
  }

  private async connectDynamoDB() {
    if(this.dynamoAdapter) {
      throw new Error('You already have a dynamoAdapter');
    }
    console.log('Initializing DynamoDB backend for cache storage...');
    logger.debug('Initializing DynamoDB backend for cache storage...');
    
    // Initialize DynamoDB client
    const dynamoClient = DynamoDBClient.getInstance();
    await dynamoClient.connect();

    // Create adapter
    this.dynamoAdapter = new DynamoDBCacheAdapter(dynamoClient);
    
    // Bind adapter methods to public interface
    this.get = this.dynamoAdapter.get.bind(this.dynamoAdapter);
    this.set = this.dynamoAdapter.set.bind(this.dynamoAdapter);
    this.del = this.dynamoAdapter.del.bind(this.dynamoAdapter);
    this.keys = this.dynamoAdapter.keys.bind(this.dynamoAdapter);
    
    logger.debug('DynamoDB backend initialized successfully');
  }

  private async connectRedis() {
    const config = this.envConfig.getValues();
    const obfuscatedConfig = this.envConfig.getObfuscatedValues();
    logger.debug(`db connecting to ${obfuscatedConfig.REDIS_URL}...`);
    if (!config.REDIS_URL) {
      throw new Error('REDIS_URL is not set');
    }
    this.client = redis.createClient({
      url: config.REDIS_URL,
      password: config.REDIS_PASSWORD
    });
    this.client.on('error', (err) => logger.error(`Redis Error: ${err}`));
    this.client.on('connect', () => logger.debug('Redis connected'));
    this.client.on('reconnecting', () => logger.info('Redis reconnecting'));
    this.client.on('ready', () => {
      logger.debug('Redis ready');
    });
    // this.client.on('monitor', (time, args /*, rawReply*/) => {
    //   if (args && args.length && args[0] === 'auth') {
    //     args[1] = '****';
    //   }
    //   logger.debug(args.join(', '));
    // });

    this.get = this.client.get.bind(this.client);
    this.set = this.client.set.bind(this.client);
    this.del = this.client.del.bind(this.client);
    this.keys = this.client.keys.bind(this.client);
    // this.monitor = this.client.monitor.bind(this.client);

    await this.client.connect();
  }

  async disconnect() {
    if (this.useDynamoDB) {
      if (this.dynamoAdapter) {
        const dynamoClient = DynamoDBClient.getInstance();
        await dynamoClient.disconnect();
        this.dynamoAdapter = null;
      }
    } else {
      if (!this.client) {
        throw new Error('cannot quit, connection not established');
      }
      await this.client.quit();
    }
  }
}
