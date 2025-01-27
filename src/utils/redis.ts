import { createClient, RedisClientType } from 'redis'
import { env } from './env'

type RedisConfig = {
  url: string
  password?: string
  socket?: {
    reconnectStrategy: (retries: number) => number | false
  }
}

export class RedisService {
  private client: RedisClientType
  private static readonly DEFAULT_EXPIRE_TIME = 3 * 24 * 60 * 60 // 3天
  private static readonly MAX_RETRY_ATTEMPTS = 5
  private static readonly RETRY_DELAY = 5000 // 5秒
  private static readonly CONNECTION_TIMEOUT = 5000 // 5秒

  private readonly globalPrefix: string
  private retryCount = 0
  private isReconnecting = false
  private isFatalError = false
  private isConnected = false
  private isInitialized = false

  constructor(customPrefix?: string) {
    const redisConfig: RedisConfig = {
      url: env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries: number) => {
          if (this.isFatalError) return false
          return Math.min(retries * 1000, RedisService.RETRY_DELAY)
        },
      },
    }

    if (env.REDIS_PASSWORD) {
      redisConfig.password = env.REDIS_PASSWORD
    }

    this.client = createClient(redisConfig)
    this.globalPrefix = customPrefix || env.REDIS_PREFIX
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.client
      .on('error', this.handleError.bind(this))
      .on('connect', () => {
        this.isConnected = true
      })
      .on('ready', () => {
        this.isConnected = true
        this.isFatalError = false
        this.retryCount = 0
        this.isInitialized = true
        logger.info('Redis 连接就绪')
      })
      .on('end', () => {
        this.isConnected = false
        this.isInitialized = false
        logger.warn('Redis 连接已断开')
      })
  }

  private handleError(err: Error): void {
    this.isConnected = false
    logger.error('Redis 连接错误:', err)

    if (err.message.includes('ECONNREFUSED') && this.retryCount >= RedisService.MAX_RETRY_ATTEMPTS) {
      this.isFatalError = true
      logger.error('Redis 服务不可用')
      return
    }

    void this.handleReconnect()
  }

  private async handleReconnect(): Promise<void> {
    try {
      if (this.isReconnecting || this.isFatalError) {
        logger.warn('Redis 重连已停止：', this.isFatalError ? '发生致命错误' : '重连正在进行中')
        return
      }

      if (this.retryCount >= RedisService.MAX_RETRY_ATTEMPTS) {
        this.isFatalError = true
        logger.error(`Redis 重连失败次数超过最大限制 (${RedisService.MAX_RETRY_ATTEMPTS})，停止重连`)
        return
      }

      this.isReconnecting = true
      this.retryCount++

      logger.info(`Redis 开始第 ${this.retryCount} 次重连尝试`)

      if (this.client.isOpen) {
        await this.client.disconnect()
      }

      await new Promise(resolve => setTimeout(resolve, RedisService.RETRY_DELAY))

      await this.connect()

      // 等待连接真正就绪
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Redis 连接超时'))
        }, RedisService.CONNECTION_TIMEOUT)

        const checkConnection = () => {
          if (this.isConnected) {
            clearTimeout(timeout)
            resolve()
          } else if (!this.isFatalError) {
            setTimeout(checkConnection, 100)
          } else {
            clearTimeout(timeout)
            reject(new Error('Redis 连接失败'))
          }
        }

        checkConnection()
      })

      logger.info('Redis 重连成功并就绪')
    } catch (error) {
      logger.error(`Redis 第 ${this.retryCount} 次重连失败:`, error)
      if (this.retryCount >= RedisService.MAX_RETRY_ATTEMPTS) {
        this.isFatalError = true
      }
    } finally {
      this.isReconnecting = false
    }
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      try {
        await this.client.connect()
        // 注意：这里不立即设置 isInitialized，等待 ready 事件
      } catch (error) {
        logger.error('Redis 连接失败:', error)
        throw error
      }
    }
  }

  private async ensureConnection(): Promise<void> {
    if (this.isFatalError) {
      throw new Error('Redis 服务不可用，请检查服务器状态和配置')
    }
    if (!this.isInitialized || !this.isConnected) {
      await this.connect()
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.disconnect()
      this.isInitialized = false
    }
  }

  async set(key: string, value: any, expireTime?: number): Promise<void> {
    try {
      await this.ensureConnection()
      const serializedValue = JSON.stringify(value)
      if (expireTime) {
        await this.client.setEx(key, expireTime, serializedValue)
      } else {
        await this.client.setEx(key, RedisService.DEFAULT_EXPIRE_TIME, serializedValue)
      }
    } catch (error) {
      logger.error('Redis 设置值失败:', error)
      throw error
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnection()
      const value = await this.client.get(key)
      return value ? (JSON.parse(value) as T) : null
    } catch (error) {
      logger.error('Redis 获取值失败:', error)
      throw error
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.ensureConnection()
      await this.client.del(key)
    } catch (error) {
      logger.error('Redis 删除值失败:', error)
      throw error
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.ensureConnection()
      return (await this.client.exists(key)) === 1
    } catch (error) {
      logger.error('Redis 检查键是否存在失败:', error)
      throw error
    }
  }

  /**
   * 生成带全局前缀的 Redis key
   * @param parts - key 的各个部分
   * @returns 完整的 Redis key
   */
  generateKey(...parts: string[]): string {
    return [this.globalPrefix, ...parts].join(':')
  }

  /**
   * 获取指定前缀的所有 keys
   * @param prefix - 要搜索的前缀
   * @returns 匹配的 keys 数组
   */
  async getKeysByPrefix(prefix: string): Promise<string[]> {
    try {
      await this.ensureConnection()
      const pattern = this.generateKey(prefix, '*')
      return await this.client.keys(pattern)
    } catch (error) {
      logger.error('获取指定前缀的 keys 失败:', error)
      throw error
    }
  }

  /**
   * 删除指定前缀的所有 keys
   * @param prefix - 要删除的前缀
   * @returns 删除的 key 数量
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    try {
      await this.ensureConnection()
      const keys = await this.getKeysByPrefix(prefix)
      if (keys.length > 0) {
        await this.client.del(keys)
      }
      return keys.length
    } catch (error) {
      logger.error('删除指定前缀的 keys 失败:', error)
      throw error
    }
  }

  /**
   * 获取 Redis 信息
   * @returns Redis 服务器信息
   */
  async getInfo(): Promise<any> {
    try {
      await this.ensureConnection()
      return await this.client.info()
    } catch (error) {
      logger.error('获取 Redis 信息失败:', error)
      throw error
    }
  }

  /**
   * 批量设置多个键值对
   */
  async mset(items: Record<string, any>, expireTime?: number): Promise<void> {
    await this.ensureConnection()
    const multi = this.client.multi()

    for (const [key, value] of Object.entries(items)) {
      const serializedValue = JSON.stringify(value)
      multi.setEx(key, expireTime || RedisService.DEFAULT_EXPIRE_TIME, serializedValue)
    }

    await multi.exec()
  }

  /**
   * 批量获取多个键的值
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    await this.ensureConnection()
    const values = await this.client.mGet(keys)

    return values.map(value => (value ? (JSON.parse(value) as T) : null))
  }

  /**
   * 获取键的剩余过期时间（秒）
   */
  async getTTL(key: string): Promise<number> {
    await this.ensureConnection()
    return this.client.ttl(key)
  }

  /**
   * 更新键的过期时间
   */
  async updateExpiry(key: string, expireTime: number): Promise<boolean> {
    await this.ensureConnection()
    return await this.client.expire(key, expireTime)
  }

  /**
   * 移除键的过期时间
   */
  async persistKey(key: string): Promise<boolean> {
    await this.ensureConnection()
    return await this.client.persist(key)
  }
}
