import { KnowledgeBase, KnowledgeItem } from '../types/knowledge'
import path from 'path'
import { promises as fs } from 'fs'

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
  private knowledgeBase: KnowledgeBase = { items: [] }
  private readonly knowledgeFilePath: string
  // 企业微信媒体文件有效期为3天
  private readonly MEDIA_EXPIRE_TIME = 3 * 24 * 60 * 60 * 1000

  constructor() {
    this.knowledgeFilePath = path.join(process.cwd(), 'knowledge', 'knowledge.json')
  }

  /**
   * 初始化知识库
   */
  async init(): Promise<void> {
    try {
      logger.debug(`知识库路径: ${this.knowledgeFilePath}`)
      const dataDir = path.dirname(this.knowledgeFilePath)
      await fs.mkdir(dataDir, { recursive: true })

      try {
        const content = await fs.readFile(this.knowledgeFilePath, 'utf-8')
        this.knowledgeBase = JSON.parse(content)
        logger.info(`知识库加载成功，包含 ${this.knowledgeBase.items.length} 条记录`)
      } catch (error) {
        logger.warn(`知识库文件不存在，将创建默认知识库: ${error instanceof Error ? error.message : '未知错误'}`)
        await this.save()
      }
    } catch (error) {
      logger.error('初始化知识库失败:', error)
      throw error
    }
  }

  /**
   * 保存知识库到文件
   */
  private async save(): Promise<void> {
    const content = JSON.stringify(this.knowledgeBase, null, 2)
    await fs.writeFile(this.knowledgeFilePath, content, 'utf-8')
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
    const index = this.knowledgeBase.items.findIndex(item => item.pattern.toString() === pattern)
    if (index !== -1) {
      this.knowledgeBase.items[index].voiceMediaId = mediaId
      this.knowledgeBase.items[index].voiceMediaExpireTime = Date.now() + this.MEDIA_EXPIRE_TIME
      await this.save()
    }
  }

  /**
   * 检查语音媒体ID是否有效
   */
  private isVoiceMediaValid(item: KnowledgeItem): boolean {
    return !!(item.voiceMediaId && item.voiceMediaExpireTime && item.voiceMediaExpireTime > Date.now())
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
      if (item.isRegex) {
        const regex = new RegExp(item.pattern)
        if (regex.test(input)) {
          // 如果语音媒体ID已过期，清除它
          if (item.voiceMediaId && !this.isVoiceMediaValid(item)) {
            item.voiceMediaId = undefined
            item.voiceMediaExpireTime = undefined
            this.save().catch(error => {
              logger.error('清除过期语音媒体ID失败:', error)
            })
          }
          return item
        }
      } else {
        if (input.includes(item.pattern.toString())) {
          // 如果语音媒体ID已过期，清除它
          if (item.voiceMediaId && !this.isVoiceMediaValid(item)) {
            item.voiceMediaId = undefined
            item.voiceMediaExpireTime = undefined
            this.save().catch(error => {
              logger.error('清除过期语音媒体ID失败:', error)
            })
          }
          return item
        }
      }
    }
    return null
  }

  /**
   * 获取所有知识条目
   */
  getAll(): KnowledgeItem[] {
    return this.knowledgeBase.items
  }
}
