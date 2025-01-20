import { WeComCallbackVoiceMessage, WeComCallbackResult } from '../../../types/wecom'

import { OpenAIService } from '../../../utils/openai'
import { WeComService } from '../../wecom'
import { MessageHandler } from './text-handler'

export class VoiceMessageHandler implements MessageHandler<WeComCallbackVoiceMessage> {
  constructor(private readonly wecomService: WeComService, private readonly openAIService: OpenAIService) {}

  async handle(message: WeComCallbackVoiceMessage): Promise<WeComCallbackResult> {
    const mediaId = message.voice.media_id
    logger.info(`处理语音消息, media_id: ${mediaId}`)

    try {
      // 下载并转换语音文件
      const voiceResult = await this.wecomService.handleVoiceMessage(message)

      if (voiceResult.success && voiceResult.mp3FilePath) {
        logger.info('语音文件处理成功：', {
          mp3File: voiceResult.mp3FilePath,
          fileName: voiceResult.fileInfo?.fileName,
          fileType: voiceResult.fileInfo?.contentType,
          fileSize: voiceResult.fileInfo?.contentLength,
        })

        // 使用 Whisper 将语音转换为文字
        const transcription = await this.openAIService.transcribeAudio(voiceResult.mp3FilePath)
        logger.info('语音转文字成功:', transcription)

        return {
          success: true,
          data: {
            type: 'voice',
            mediaId,
            transcription,
          },
        }
      } else {
        throw new Error(voiceResult.error || '语音处理失败')
      }
    } catch (error) {
      logger.error('处理语音消息失败:', error)
      return {
        success: false,
        message: `处理语音消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }
}
