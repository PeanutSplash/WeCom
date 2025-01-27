import { createClient } from 'redis'
import { env } from './env'

export class RedisService {
  private client
  private readonly DEFAULT_EXPIRE_TIME = 3 * 24 * 60 * 60 // 3天，单位秒
  private readonly globalPrefix: string
  private isInitialized = false

  constructor(customPrefix?: string) {
    const redisConfig: any = {
      url: env.REDIS_URL || 'redis://localhost:6379',
    }

    // 如果配置了密码,添加密码
    if (env.REDIS_PASSWORD) {
      redisConfig.password = env.REDIS_PASSWORD
    }

    this.client = createClient(redisConfig)
    this.globalPrefix = customPrefix || env.REDIS_PREFIX

    this.client.on('error', err => {
      logger.error('Redis 连接错误:', err)
      this.handleReconnect()
    })

    this.client.on('connect', () => {
      logger.info('Redis 连接成功')
    })
  }

  private async handleReconnect(): Promise<void> {
    try {
      if (this.client.isOpen) {
        await this.client.disconnect()
      }
      await this.connect()
    } catch (error) {
      logger.error('Redis 重连失败:', error)
    }
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect()
      this.isInitialized = true
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isInitialized) {
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
        await this.client.setEx(key, this.DEFAULT_EXPIRE_TIME, serializedValue)
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
}
