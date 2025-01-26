import { promises as fs } from 'fs'
import path from 'path'

interface CursorData {
  cursor: string
  lastUpdateTime: number
}

interface CursorStore {
  [key: string]: CursorData
}

export class CursorManager {
  private cursorStore: CursorStore = {}
  private readonly storePath: string
  private readonly storeDir: string = 'data'
  private readonly storeFileName: string = 'cursor-store.json'

  constructor() {
    this.storeDir = path.join(process.cwd(), this.storeDir)
    this.storePath = path.join(this.storeDir, this.storeFileName)
    this.initStore().catch(error => {
      logger.error('初始化 cursor store 失败:', error)
    })
  }

  private async initStore(): Promise<void> {
    try {
      // 确保目录存在
      await fs.mkdir(this.storeDir, { recursive: true })

      try {
        const data = await fs.readFile(this.storePath, 'utf-8')
        this.cursorStore = JSON.parse(data)

        // 清理旧格式的数据
        await this.cleanupOldFormat()
      } catch (error) {
        // 如果文件不存在或解析失败，使用空对象
        this.cursorStore = {}
        await this.saveStore()
      }
    } catch (error) {
      logger.error('初始化 cursor store 失败:', error)
      throw error
    }
  }

  private async cleanupOldFormat(): Promise<void> {
    let hasChanges = false

    // 遍历所有记录，只清理不符合新格式的数据
    for (const key of Object.keys(this.cursorStore)) {
      // 检查是否是旧格式（不包含 ":" 的键）
      if (!key.includes(':')) {
        delete this.cursorStore[key]
        hasChanges = true
      }
    }

    // 如果有变更，保存到文件
    if (hasChanges) {
      await this.saveStore()
      logger.info('已清理旧格式的 cursor 数据')
    }
  }

  private async saveStore(): Promise<void> {
    try {
      await fs.writeFile(this.storePath, JSON.stringify(this.cursorStore, null, 2))
    } catch (error) {
      logger.error('保存 cursor store 失败:', error)
      throw error
    }
  }

  public async getCursor(userId: string): Promise<string> {
    const data = this.cursorStore[userId]
    return data?.cursor || ''
  }

  public async updateCursor(userId: string, cursor: string): Promise<void> {
    this.cursorStore[userId] = {
      cursor,
      lastUpdateTime: Date.now(),
    }
    await this.saveStore()
  }

  public async clearCursor(userId: string): Promise<void> {
    delete this.cursorStore[userId]
    await this.saveStore()
  }
}
