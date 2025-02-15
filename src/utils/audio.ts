import ffmpeg from 'fluent-ffmpeg'

import { promises as fs } from 'fs'
import path from 'path'
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
  rawData?: Buffer
  error?: string
}

/**
 * 将 AMR 音频转换为 MP3 格式
 */
export const convertAmrToMp3 = async (inputBuffer: Buffer, mediaId: string, outputDir: string = 'media'): Promise<AudioConversionResult> => {
  try {
    await fs.mkdir(outputDir, { recursive: true })

    const date = new Date()
    const timestamp = date.toISOString().replace(/[:.]/g, '-')

    const tempAmrPath = path.join(outputDir, `temp_${timestamp}_${mediaId}.amr`)
    const outputPath = path.join(outputDir, `${timestamp}_${mediaId}.mp3`)

    await fs.writeFile(tempAmrPath, inputBuffer)

    // 使用明确的编码器参数
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempAmrPath)
        .toFormat('mp3')
        .outputOptions([
          '-c:a libmp3lame', // 使用 libmp3lame 编码器
          '-ar 16000', // 采样率
          '-ac 1', // 声道数
          '-b:a 16k', // 比特率
          '-filter:a volume=2.0', // 将音量增加到原来的2倍
        ])
        .on('error', err => {
          logger.error('音频转换失败:', err)
          reject(err)
        })
        .on('end', () => resolve())
        .save(outputPath)
    })

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

/**
 * 将 MP3 音频转换为 AMR 格式
 */
export const convertMp3ToAmr = async (inputBuffer: Buffer, mediaDir: string = 'media'): Promise<AudioConversionResult> => {
  try {
    await ensureMediaDirectory(mediaDir)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const tempMp3Path = path.join(mediaDir, `temp_${timestamp}.mp3`)
    const outputAmrPath = path.join(mediaDir, `${timestamp}.amr`)

    logger.debug('开始转换音频:', {
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
          logger.debug('开始执行 FFmpeg 命令:', command)
        })
        .on('progress', progress => {
          logger.debug('转换进度:', progress)
        })
        .on('error', err => {
          logger.error('FFmpeg 转换失败:', err)
          reject(err)
        })
        .on('end', () => {
          logger.debug('FFmpeg 转换完成')
          resolve()
        })
        .save(outputAmrPath)
    })

    // 验证输出文件
    const stats = await fs.stat(outputAmrPath)
    logger.debug('AMR 文件生成成功:', {
      path: outputAmrPath,
      size: stats.size,
    })

    // 删除临时 MP3 文件
    await fs.unlink(tempMp3Path)
    logger.debug('清理临时 MP3 文件完成')

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

/**
 * 将 AMR 音频转换为 PCM 格式
 * @param inputBuffer AMR 音频的 Buffer 数据
 * @param mediaId 媒体ID
 * @param outputDir 输出目录
 * @param sampleRate 采样率 (默认 16000Hz)
 * @returns PCM 转换结果
 */
export const convertAmrToPcm = async (
  inputBuffer: Buffer,
  mediaId: string,
  outputDir: string = 'media',
  sampleRate: 8000 | 16000 = 16000,
): Promise<AudioConversionResult> => {
  try {
    await ensureMediaDirectory(outputDir)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const tempAmrPath = path.join(outputDir, `temp_${timestamp}_${mediaId}.amr`)
    const outputPath = path.join(outputDir, `${timestamp}_${mediaId}.pcm`)

    await fs.writeFile(tempAmrPath, inputBuffer)

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempAmrPath)
        .toFormat('s16le') // 16bit PCM
        .outputOptions([
          '-ar ' + sampleRate, // 采样率
          '-ac 1', // 单声道
          '-f s16le', // 强制 16bit PCM 格式
        ])
        .on('error', err => {
          logger.error('AMR 转 PCM 失败:', err)
          reject(err)
        })
        .on('end', () => {
          logger.info('AMR 转 PCM 完成')
          resolve()
        })
        .save(outputPath)
    })

    await fs.unlink(tempAmrPath)

    return {
      success: true,
      filePath: outputPath,
    }
  } catch (error) {
    logger.error('AMR 转 PCM 失败:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AMR 转 PCM 失败',
    }
  }
}
