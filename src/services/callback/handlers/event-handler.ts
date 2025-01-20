import { WeComCallbackEventMessage, WeComCallbackResult, MessageType } from '../../../types/wecom'

import { WeComService } from '../../wecom'
import { OpenAIService } from '../../../utils/openai'
import { XunfeiTTSService } from '../../../utils/xunfei'
import logger from '../../../utils/logger'
import { convertMp3ToAmr } from '../../../utils/audio'
import { promises as fs } from 'fs'
import path from 'path'

export class EventMessageHandler {
  private readonly xunfeiService: XunfeiTTSService

  constructor(private readonly wecomService: WeComService, private readonly openAIService: OpenAIService) {
    const xunfeiAppId = process.env.XUNFEI_APP_ID || ''
    const xunfeiApiKey = process.env.XUNFEI_API_KEY || ''
    const xunfeiApiSecret = process.env.XUNFEI_API_SECRET || ''
    const xunfeiVoiceName = process.env.XUNFEI_VOICE_NAME || 'xiaoyan'

    this.xunfeiService = new XunfeiTTSService(xunfeiAppId, xunfeiApiKey, xunfeiApiSecret, xunfeiVoiceName)
  }

  async handle(message: WeComCallbackEventMessage): Promise<WeComCallbackResult> {
    const eventType = message.Event
    logger.info(`处理事件消息, 事件类型: ${eventType}`)

    if (eventType === 'kf_msg_or_event') {
      return await this.handleKfMessageSync(message)
    }

    return {
      success: true,
      data: {
        type: 'event',
        eventType,
        event: message.event,
      },
    }
  }

  private async handleKfMessageSync(message: WeComCallbackEventMessage): Promise<WeComCallbackResult> {
    if (!message.Token) {
      return {
        success: false,
        message: '缺少必要的 Token 参数',
      }
    }

    try {
      const syncResult: any = await this.syncLatestMessage(message.Token)
      logger.info('获取最新消息成功:', syncResult)

      if (syncResult.msg_list?.length > 0) {
        const lastMessage = syncResult.msg_list[0]

        // 提取发送语音消息的通用函数
        const sendVoiceWithFallback = async (text: string, userId: string, kfId: string) => {
          try {
            // 将文本转换为语音 (MP3格式)
            const audioBuffer = await this.xunfeiService.textToSpeech(text)

            // 将 MP3 转换为 AMR
            const amrResult = await convertMp3ToAmr(audioBuffer)

            if (!amrResult.success || !amrResult.filePath) {
              throw new Error(amrResult.error || '转换 AMR 失败')
            }

            // 读取 AMR 文件并上传
            const amrBuffer = await fs.readFile(amrResult.filePath)
            const mediaId = await this.wecomService.uploadMedia('voice', amrBuffer, path.basename(amrResult.filePath))

            // 发送语音消息
            await this.wecomService.sendVoiceMessage({
              touser: userId,
              open_kfid: kfId,
              msgtype: 'voice',
              voice: {
                media_id: mediaId,
              },
            })

            // 删除临时 AMR 文件
            await fs.unlink(amrResult.filePath)
            logger.info('AI 语音回复已发送')
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误'
            logger.error('语音合成或发送失败，回退到文本消息:', errorMessage)

            // 如果语音处理失败，回退到发送文本消息
            await this.wecomService.sendTextMessage({
              touser: userId,
              open_kfid: kfId,
              msgtype: MessageType.TEXT,
              text: {
                content: text,
              },
            })
          }
        }

        if (lastMessage.msgtype === 'text') {
          const aiResponse = await this.openAIService.generateResponse(lastMessage.text.content)
          await sendVoiceWithFallback(aiResponse, lastMessage.external_userid, lastMessage.open_kfid)
        } else if (lastMessage.msgtype === 'voice') {
          // 处理语音消息
          const voiceResult = await this.wecomService.handleVoiceMessage({
            voice: { media_id: lastMessage.voice.media_id },
          })

          if (voiceResult.success && voiceResult.mp3FilePath) {
            // 使用 Whisper 转换语音为文字
            const transcription = await this.openAIService.transcribeAudio(voiceResult.mp3FilePath)
            logger.info('语音转文字成功:', transcription)

            // 生成 AI 回复
            const aiResponse = await this.openAIService.generateResponse(transcription)

            // 发送语音回复（带文字回退）
            await sendVoiceWithFallback(aiResponse, lastMessage.external_userid, lastMessage.open_kfid)
          }
        }
      }

      return {
        success: true,
        data: {
          type: 'event',
          eventType: message.Event,
          event: message.event,
          syncMessages: syncResult,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      logger.error('处理同步消息失败:', error)
      return {
        success: false,
        message: `处理同步消息失败: ${errorMessage}`,
      }
    }
  }

  private async syncLatestMessage(token: string) {
    let lastMessage = null
    let cursor = ''
    let hasMore = true

    do {
      const syncResult = await this.wecomService.syncMessage(cursor, token, 1000)

      if (syncResult.msg_list?.length) {
        lastMessage = syncResult.msg_list[syncResult.msg_list.length - 1]
      }

      cursor = syncResult.next_cursor || ''
      hasMore = Boolean(syncResult.has_more)

      // 避免频繁请求
      await new Promise(resolve => setTimeout(resolve, 200))
    } while (hasMore)

    return {
      errcode: 0,
      msg_list: lastMessage ? [lastMessage] : [],
      has_more: 0,
      next_cursor: '',
    }
  }
}
