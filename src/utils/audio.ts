import ffmpeg from 'fluent-ffmpeg'

import { promises as fs } from 'fs'
import path from 'path'

export type AudioConversionResult = {
  success: boolean
  filePath?: string
  error?: string
}

export type AudioFileInfo = {
  contentType: string
  contentLength: number
  fileName: string
}

export type VoiceMessageResult = {
  success: boolean
  mp3FilePath?: string
  fileInfo?: AudioFileInfo
  error?: string
}

/**
 * 将 AMR 音频转换为 MP3 格式
 */
export const convertAmrToMp3 = async (inputBuffer: Buffer, mediaId: string, outputDir: string = 'media'): Promise<AudioConversionResult> => {
  try {
    // 确保输出目录存在
    await fs.mkdir(outputDir, { recursive: true })

    // 生成东八区(UTC+8)的时间戳
    const date = new Date()
    const utc8Time = new Date(date.getTime() + 8 * 60 * 60 * 1000)
    const timestamp = utc8Time.toISOString().replace(/[:.]/g, '-')

    const tempAmrPath = path.join(outputDir, `temp_${timestamp}_${mediaId}.amr`)
    const outputPath = path.join(outputDir, `${timestamp}_${mediaId}.mp3`)

    // 写入临时 AMR 文件
    await fs.writeFile(tempAmrPath, inputBuffer)

    // 执行转换
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempAmrPath)
        .toFormat('mp3')
        .audioBitrate('128k')
        .audioChannels(2)
        .audioFrequency(44100)
        .on('error', err => {
          logger.error('音频转换失败:', err)
          reject(err)
        })
        .on('end', () => {
          resolve()
        })
        .save(outputPath)
    })

    // 删除临时 AMR 文件
    await fs.unlink(tempAmrPath)

    return {
      success: true,
      filePath: outputPath,
    }
  } catch (error) {
    logger.error('音频转换失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '音频转换失败',
    }
  }
}

/**
 * 检查并创建媒体目录
 */
export const ensureMediaDirectory = async (dir: string = 'media'): Promise<void> => {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (error) {
    logger.error('创建媒体目录失败:', error)
    throw error
  }
}
