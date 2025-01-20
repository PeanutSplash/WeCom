import ffmpeg from 'fluent-ffmpeg'

import { promises as fs } from 'fs'
import path from 'path'
import logger from './logger'
import { cleanupDirectory } from './cleanup'

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

    // 清理 media 目录
    await cleanupDirectory({
      directory: outputDir,
      maxFiles: 100, // 最多保留100个文件
      retentionDays: 7, // 文件最多保留7天
    })

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

/**
 * 将 MP3 音频转换为 AMR 格式
 */
export const convertMp3ToAmr = async (inputBuffer: Buffer, mediaDir: string = 'media'): Promise<AudioConversionResult> => {
  try {
    await ensureMediaDirectory(mediaDir)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const tempMp3Path = path.join(mediaDir, `temp_${timestamp}.mp3`)
    const outputAmrPath = path.join(mediaDir, `${timestamp}.amr`)

    logger.info('开始转换音频:', {
      inputSize: inputBuffer.length,
      tempMp3Path,
      outputAmrPath,
    })

    // 写入临时 MP3 文件
    await fs.writeFile(tempMp3Path, inputBuffer)

    // 执行转换
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempMp3Path)
        .toFormat('amr')
        .audioChannels(1) // 单声道
        .audioFrequency(8000) // AMR-NB 标准采样率
        .audioBitrate('12.2k') // AMR-NB 标准比特率
        .addOutputOption('-ac', '1') // 强制单声道
        .on('start', command => {
          logger.info('开始执行 FFmpeg 命令:', command)
        })
        .on('progress', progress => {
          logger.debug('转换进度:', progress)
        })
        .on('error', err => {
          logger.error('FFmpeg 转换失败:', err)
          reject(err)
        })
        .on('end', () => {
          logger.info('FFmpeg 转换完成')
          resolve()
        })
        .save(outputAmrPath)
    })

    // 验证输出文件
    const stats = await fs.stat(outputAmrPath)
    logger.info('AMR 文件生成成功:', {
      path: outputAmrPath,
      size: stats.size,
    })

    // 删除临时 MP3 文件
    await fs.unlink(tempMp3Path)
    logger.info('清理临时 MP3 文件完成')

    // 清理 media 目录
    await cleanupDirectory({
      directory: mediaDir,
      maxFiles: 2000, // 最多保留2000个文件
      retentionDays: 7, // 文件最多保留7天
    })

    return {
      success: true,
      filePath: outputAmrPath,
    }
  } catch (error) {
    logger.error('MP3 转 AMR 失败:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'MP3 转 AMR 失败',
    }
  }
}
