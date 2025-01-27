import { KnowledgeBase, KnowledgeItem } from '../types/knowledge'
import { knowledgeData } from '../knowledge/knowledge'
import { RedisService } from '../utils/redis'

/**
 * 知识库服务类
 * 用于管理和操作知识条目
 *
 * 知识库数据结构 (knowledge.json):
 * {
 *   "items": [
 *     {
 *       // 匹配模式：字符串或正则表达式
 *       "pattern": "你好|hello",
 *       // 回复内容，支持 \n 换行
 *       "response": "你好！很高兴见到你",
 *       // 条目描述，用于管理和维护
 *       "description": "基础问候语",
 *       // 是否启用正则匹配，默认 false
 *       "isRegex": true
 *     }
 *   ]
 * }
 */
export class KnowledgeService {
  private knowledgeBase: KnowledgeBase
  private readonly redis: RedisService
  private readonly MEDIA_EXPIRE_TIME = 3 * 24 * 60 * 60 // 3天，单位秒

  constructor() {
    this.knowledgeBase = { ...knowledgeData }
    this.redis = new RedisService()
  }

  /**
   * 初始化知识库
   */
  async init(): Promise<void> {
    try {
      await this.loadCachedMedia()
      logger.info(`知识库加载成功，包含 ${this.knowledgeBase.items.length} 条记录`)
    } catch (error) {
      logger.error('初始化知识库失败:', error)
      throw error
    }
  }

  private async loadCachedMedia(): Promise<void> {
    for (const item of this.knowledgeBase.items) {
      const pattern = item.pattern.toString()

      // 加载语音媒体缓存
      const voiceKey = this.getVoiceMediaKey(pattern)
      const voiceCache = await this.redis.get<{
        mediaId: string
        expireTime: number
      }>(voiceKey)

      if (voiceCache && voiceCache.expireTime > Date.now()) {
        item.voiceMediaId = voiceCache.mediaId
        item.voiceMediaExpireTime = voiceCache.expireTime
      }

      // 加载链接缩略图缓存
      if (item.link) {
        const thumbKey = this.getThumbMediaKey(pattern)
        const thumbCache = await this.redis.get<{
          mediaId: string
          expireTime: number
        }>(thumbKey)

        if (thumbCache && thumbCache.expireTime > Date.now()) {
          item.link.thumbMediaId = thumbCache.mediaId
          item.link.thumbMediaExpireTime = thumbCache.expireTime
        }
      }
    }
  }

  private getVoiceMediaKey(pattern: string): string {
    return this.redis.generateKey('media', 'voice', pattern)
  }

  private getThumbMediaKey(pattern: string): string {
    return this.redis.generateKey('media', 'thumb', pattern)
  }

  /**
   * 添加知识条目
   */
  async addItem(item: KnowledgeItem): Promise<void> {
    this.knowledgeBase.items.push(item)
    await this.save()
  }

  /**
   * 删除知识条目
   */
  async removeItem(pattern: string): Promise<void> {
    this.knowledgeBase.items = this.knowledgeBase.items.filter(item => item.pattern.toString() !== pattern)
    await this.save()
  }

  /**
   * 更新知识条目
   */
  async updateItem(oldPattern: string, newItem: KnowledgeItem): Promise<void> {
    const index = this.knowledgeBase.items.findIndex(item => item.pattern.toString() === oldPattern)
    if (index !== -1) {
      this.knowledgeBase.items[index] = newItem
      await this.save()
    }
  }

  /**
   * 更新知识条目的语音媒体ID
   */
  async updateVoiceMediaId(pattern: string, mediaId: string): Promise<void> {
    const expireTime = Date.now() + this.MEDIA_EXPIRE_TIME * 1000
    const key = this.getVoiceMediaKey(pattern)

    await this.redis.set(
      key,
      {
        mediaId,
        expireTime,
      },
      this.MEDIA_EXPIRE_TIME,
    )

    const index = this.knowledgeBase.items.findIndex(item => item.pattern.toString() === pattern)
    if (index !== -1) {
      this.knowledgeBase.items[index].voiceMediaId = mediaId
      this.knowledgeBase.items[index].voiceMediaExpireTime = expireTime
    }
  }

  /**
   * 检查语音媒体ID是否有效
   */
  private isVoiceMediaValid(item: KnowledgeItem): boolean {
    return !!(item.voiceMediaId && item.voiceMediaExpireTime && item.voiceMediaExpireTime > Date.now())
  }

  /**
   * 检查链接缩略图媒体ID是否有效
   */
  private isLinkThumbMediaValid(item: KnowledgeItem): boolean {
    return !!(item.link?.thumbMediaId && item.link?.thumbMediaExpireTime && item.link.thumbMediaExpireTime > Date.now())
  }

  /**
   * 检查链接缩略图媒体ID是否有效（公共方法）
   */
  async checkLinkThumbMediaValid(item: KnowledgeItem): Promise<boolean> {
    if (!item.link?.thumbMediaId) return false

    const key = this.getThumbMediaKey(item.pattern.toString())
    const cache = await this.redis.get<{
      mediaId: string
      expireTime: number
    }>(key)

    return !!(cache && cache.expireTime > Date.now())
  }

  /**
   * 查找匹配的知识条目
   * @param input 输入文本
   * @returns 匹配到的知识条目或 null
   *
   * 匹配规则：
   * 1. 按数组顺序从上到下匹配，返回第一个匹配项
   * 2. isRegex = true 时使用正则匹配
   * 3. isRegex = false 时使用 includes 文本匹配
   */
  findMatch(input: string): KnowledgeItem | null {
    for (const item of this.knowledgeBase.items) {
      if (this.isMatch(item, input)) {
        return item
      }
    }
    return null
  }

  private isMatch(item: KnowledgeItem, input: string): boolean {
    if (item.isRegex) {
      const regex = new RegExp(item.pattern)
      return regex.test(input)
    }
    return input.includes(item.pattern.toString())
  }

  /**
   * 获取所有知识条目
   */
  getAll(): KnowledgeItem[] {
    return this.knowledgeBase.items
  }

  /**
   * 更新知识条目的链接缩略图媒体ID
   */
  async updateLinkThumbMediaId(pattern: string, mediaId: string): Promise<void> {
    const expireTime = Date.now() + this.MEDIA_EXPIRE_TIME * 1000
    const key = this.getThumbMediaKey(pattern)

    await this.redis.set(
      key,
      {
        mediaId,
        expireTime,
      },
      this.MEDIA_EXPIRE_TIME,
    )

    const index = this.knowledgeBase.items.findIndex(item => item.pattern.toString() === pattern)
    if (index !== -1 && this.knowledgeBase.items[index].link) {
      this.knowledgeBase.items[index].link!.thumbMediaId = mediaId
      this.knowledgeBase.items[index].link!.thumbMediaExpireTime = expireTime
    }
  }

  private async save(): Promise<void> {
    // Implementation of save method
  }
}
