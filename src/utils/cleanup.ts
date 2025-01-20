import { promises as fs } from 'fs'
import path from 'path'
import logger from './logger'

export interface CleanupConfig {
  directory: string
  maxFiles: number
  retentionDays?: number
}

/**
 * 清理指定目录中的文件
 * 当文件数量超过 maxFiles 时，删除最旧的文件
 */
export const cleanupDirectory = async (config: CleanupConfig): Promise<void> => {
  const { directory, maxFiles, retentionDays } = config

  try {
    // 确保目录存在
    await fs.mkdir(directory, { recursive: true })

    // 读取目录中的所有文件
    const files = await fs.readdir(directory)
    
    // 如果文件数量未超过限制，直接返回
    if (files.length <= maxFiles) {
      return
    }

    // 获取所有文件的详细信息
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(directory, file)
        const stats = await fs.stat(filePath)
        return {
          name: file,
          path: filePath,
          createTime: stats.birthtime
        }
      })
    )

    // 按创建时间排序（最旧的在前）
    fileStats.sort((a, b) => a.createTime.getTime() - b.createTime.getTime())

    // 如果指定了保留天数，先删除超过保留天数的文件
    if (retentionDays) {
      const now = new Date()
      const retentionMs = retentionDays * 24 * 60 * 60 * 1000
      const expiredFiles = fileStats.filter(
        (file) => now.getTime() - file.createTime.getTime() > retentionMs
      )

      for (const file of expiredFiles) {
        await fs.unlink(file.path)
        logger.info(`已删除过期文件: ${file.name}`)
      }

      // 重新检查文件数量
      const remainingFiles = fileStats.filter(
        (file) => !expiredFiles.includes(file)
      )
      if (remainingFiles.length <= maxFiles) {
        return
      }
    }

    // 计算需要删除的文件数量
    const filesToDelete = fileStats.slice(0, fileStats.length - maxFiles)

    // 删除多余的文件
    for (const file of filesToDelete) {
      await fs.unlink(file.path)
      logger.info(`已删除多余文件: ${file.name}`)
    }

    logger.info(`清理完成，当前文件数量: ${maxFiles}`)
  } catch (error) {
    logger.error('清理目录失败:', error)
    throw error
  }
} 