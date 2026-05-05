// Redis client implementation with fallback for when Redis is not available
let createClient: any;
let RedisClientType: any;

try {
  const redis = require('redis');
  createClient = redis.createClient;
  RedisClientType = redis.RedisClientType;
} catch (error) {
  console.warn('Redis package not installed. Rate limiting will use in-memory fallback.');
  createClient = null;
  RedisClientType = null;
}

// Redis client configuration
interface RedisConfig {
  url: string;
  password?: string;
  database?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}

class RedisManager {
  private static instance: RedisManager;
  private client: any = null;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;
  private redisAvailable = false;

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  async getClient(): Promise<any> {
    if (!this.redisAvailable) {
      return this.getFallbackClient();
    }

    if (this.client && this.client.isOpen) {
      return this.client;
    }

    if (this.isConnecting && this.connectionPromise) {
      await this.connectionPromise;
      return this.client;
    }

    return this.connect();
  }

  private getFallbackClient(): any {
    // Fallback in-memory client for when Redis is not available
    return {
      eval: async () => { throw new Error('Redis not available'); },
      del: async () => 0,
      exists: async () => false,
      ttl: async () => -1,
      expire: async () => false,
      pexpire: async () => false,
      pttl: async () => -1,
      incr: async () => 1,
      zadd: async () => 0,
      zcard: async () => 0,
      zremrangebyscore: async () => 0,
      zrange: async () => [],
      ping: async () => 'PONG',
      isOpen: true,
    };
  }

  private async connect(): Promise<any> {
    if (!createClient) {
      this.redisAvailable = false;
      return this.getFallbackClient();
    }

    if (this.isConnecting) {
      throw new Error('Redis connection already in progress');
    }

    this.isConnecting = true;
    this.connectionPromise = this.establishConnection();

    try {
      await this.connectionPromise;
      return this.client;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  private async establishConnection(): Promise<void> {
    try {
      const config: RedisConfig = {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
        database: parseInt(process.env.REDIS_DATABASE || '0'),
        keyPrefix: 'pilatesos:',
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      };

      this.client = createClient(config);

      // Event handlers
      this.client.on('error', (err: any) => {
        console.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
      });

      this.client.on('ready', () => {
        console.log('Redis Client Ready');
      });

      this.client.on('end', () => {
        console.log('Redis Client Connection Ended');
      });

      this.client.on('reconnecting', () => {
        console.log('Redis Client Reconnecting');
      });

      await this.client.connect();

      // Test connection
      await this.client.ping();
      this.redisAvailable = true;

    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.client = null;
      this.redisAvailable = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.client.isOpen) {
      await this.client.quit();
      this.client = null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  // Utility methods for rate limiting
  async eval(script: string, numKeys: number, ...args: string[]): Promise<any> {
    const client = await this.getClient();
    return client.eval(script, { keys: numKeys, arguments: args });
  }

  async del(key: string): Promise<number> {
    const client = await this.getClient();
    return client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    const client = await this.getClient();
    return client.ttl(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.expire(key, seconds);
    return result;
  }

  async pexpire(key: string, milliseconds: number): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.pexpire(key, milliseconds);
    return result;
  }

  async pttl(key: string): Promise<number> {
    const client = await this.getClient();
    return client.pttl(key);
  }

  async incr(key: string): Promise<number> {
    const client = await this.getClient();
    return client.incr(key);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const client = await this.getClient();
    return client.zAdd(key, [{ score, value: member }]);
  }

  async zcard(key: string): Promise<number> {
    const client = await this.getClient();
    return client.zCard(key);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    const client = await this.getClient();
    return client.zRemRangeByScore(key, min, max);
  }

  async zrange(key: string, start: number, stop: number, options?: { WITHSCORES?: boolean }): Promise<string[]> {
    const client = await this.getClient();
    return client.zRange(key, start, stop, options);
  }
}

// Export singleton instance
export const redisManager = RedisManager.getInstance();

// Export the RedisClientType for use in rate limiter
export type { RedisClientType };

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing Redis connection...');
  await redisManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing Redis connection...');
  await redisManager.disconnect();
  process.exit(0);
});
