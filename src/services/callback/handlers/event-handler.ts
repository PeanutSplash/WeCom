import { WeComCallbackEventMessage, WeComCallbackResult, MessageType, SendMessage } from '../../../types/wecom'
import { WeComService } from '../../wecom'
import { OpenAIService } from '../../../utils/openai'
import { IflytekTTSService } from '../../../utils/iflytek'
import { IflytekASRService } from '../../../utils/iflytek-asr'
import { convertMp3ToAmr } from '../../../utils/audio'
import { promises as fs } from 'fs'
import path from 'path'
import { env } from '../../../utils/env'

interface SyncMessage {
  msgtype: string
  text?: { content: string }
  voice?: { media_id: string }
  external_userid: string
  open_kfid: string
}

interface SyncMessageResult {
  errcode: number
  msg_list: SyncMessage[]
  has_more: boolean
  next_cursor: string
}

interface SendMessageParams extends SendMessage {
  touser: string
  open_kfid: string
}

interface SendTextMessageParams extends SendMessageParams {
  msgtype: MessageType.TEXT
  text: { content: string }
}

interface SendVoiceMessageParams extends SendMessageParams {
  msgtype: MessageType.VOICE
  voice: { media_id: string }
}

export class EventMessageHandler {
  private readonly iflytekTTSService: IflytekTTSService
  private readonly iflytekASRService: IflytekASRService

  constructor(private readonly wecomService: WeComService, private readonly openAIService: OpenAIService) {
    this.iflytekTTSService = new IflytekTTSService()
    this.iflytekASRService = new IflytekASRService()
  }

  /**
   * 处理企业微信回调事件消息
   * @param message - 企业微信回调事件消息
   * @returns 处理结果，包含成功状态和相关数据
   */
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

  /**
   * 处理客服消息同步事件
   * @param message - 企业微信回调事件消息
   * @returns 处理结果，包含成功状态和同步消息数据
   */
  private async handleKfMessageSync(message: WeComCallbackEventMessage): Promise<WeComCallbackResult> {
    if (!message.Token) {
      return {
        success: false,
        message: '缺少必要的 Token 参数',
      }
    }

    try {
      const syncResult = await this.syncLatestMessage(message.Token)
      logger.info('获取最新消息成功:', syncResult)

      if (!syncResult.msg_list?.length) {
        return this.createSuccessResult(message, syncResult)
      }

      const lastMessage = syncResult.msg_list[0]
      await this.processMessage(lastMessage)

      return this.createSuccessResult(message, syncResult)
    } catch (error) {
      return this.handleError('处理同步消息失败', error)
    }
  }

  /**
   * 处理单条消息
   * @param message - 同步消息对象
   */
  private async processMessage(message: SyncMessageResult['msg_list'][0]): Promise<void> {
    if (message.msgtype === 'text' && message.text) {
      const aiResponse = await this.openAIService.generateResponse(message.text.content)
      await this.sendVoiceWithFallback(aiResponse, message.external_userid, message.open_kfid)
    } else if (message.msgtype === 'voice' && message.voice) {
      await this.handleVoiceMessage(message)
    }
  }

  /**
   * 处理语音消息
   * @param message - 包含语音信息的消息对象
   */
  private async handleVoiceMessage(message: SyncMessageResult['msg_list'][0]): Promise<void> {
    if (!message.voice) return

    const voiceResult = await this.wecomService.handleVoiceMessage({
      voice: { media_id: message.voice.media_id },
    })

    if (!voiceResult.success || !voiceResult.mp3FilePath) {
      throw new Error('语音处理失败')
    }

    let transcription: string
    let service = env.SPEECH_RECOGNITION_SERVICE

    try {
      if (service === 'iflytek') {
        const audioBuffer = await fs.readFile(voiceResult.mp3FilePath)
        transcription = await this.iflytekASRService.recognizeSpeech(audioBuffer)
      } else {
        transcription = await this.openAIService.transcribeAudio(voiceResult.mp3FilePath)
      }
    } catch (error) {
      logger.error(`${service} 语音识别失败:`, error)
      if (service === 'iflytek') {
        logger.info('尝试使用 OpenAI 作为备选服务')
        try {
          transcription = await this.openAIService.transcribeAudio(voiceResult.mp3FilePath)
          service = 'openai'
        } catch (fallbackError) {
          logger.error('OpenAI 备选服务也失败:', fallbackError)
          throw new Error('所有语音识别服务都失败了')
        }
      } else {
        throw error
      }
    }

    logger.info('语音转文字成功:', { service, transcription })

    const aiResponse = await this.openAIService.generateResponse(transcription)
    await this.sendVoiceWithFallback(aiResponse, message.external_userid, message.open_kfid)
  }

  /**
   * 发送语音消息，如果失败则回退到文本消息
   * @param text - 要转换为语音的文本内容
   * @param userId - 接收消息的用户ID
   * @param kfId - 客服ID
   */
  private async sendVoiceWithFallback(text: string, userId: string, kfId: string): Promise<void> {
    try {
      const audioBuffer = await this.iflytekTTSService.textToSpeech(text)
      const amrResult = await convertMp3ToAmr(audioBuffer)

      if (!amrResult.success || !amrResult.filePath) {
        throw new Error(amrResult.error || '转换 AMR 失败')
      }

      const amrBuffer = await fs.readFile(amrResult.filePath)
      const mediaId = await this.wecomService.uploadMedia('voice', amrBuffer, path.basename(amrResult.filePath))

      await this.sendMessage<SendVoiceMessageParams>({
        touser: userId,
        open_kfid: kfId,
        msgtype: MessageType.VOICE,
        voice: { media_id: mediaId },
      })

      await fs.unlink(amrResult.filePath)
      logger.info('AI 语音回复已发送')
    } catch (error) {
      logger.error('语音合成或发送失败，回退到文本消息:', error)
      await this.sendMessage<SendTextMessageParams>({
        touser: userId,
        open_kfid: kfId,
        msgtype: MessageType.TEXT,
        text: { content: text },
      })
    }
  }

  /**
   * 发送消息到企业微信
   * @param message - 要发送的消息对象
   */
  private async sendMessage<T extends SendMessageParams>(message: T): Promise<void> {
    if (message.msgtype === MessageType.TEXT) {
      await this.wecomService.sendTextMessage(message as SendTextMessageParams)
    } else if (message.msgtype === MessageType.VOICE) {
      await this.wecomService.sendVoiceMessage(message as SendVoiceMessageParams)
    }
  }

  /**
   * 同步最新消息
   * @param token - 同步消息所需的token
   * @returns 同步结果，包含最新的消息列表
   */
  private async syncLatestMessage(token: string): Promise<SyncMessageResult> {
    const SYNC_INTERVAL = 200
    const MAX_PAGE_SIZE = 1000

    let lastMessage = null
    let cursor = ''
    let hasMore = true

    do {
      const syncResult = await this.wecomService.syncMessage(cursor, token, MAX_PAGE_SIZE)

      if (syncResult.msg_list?.length) {
        lastMessage = syncResult.msg_list[syncResult.msg_list.length - 1] as unknown as SyncMessage
      }

      cursor = syncResult.next_cursor || ''
      hasMore = Boolean(syncResult.has_more)

      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, SYNC_INTERVAL))
      }
    } while (hasMore)

    return {
      errcode: 0,
      msg_list: lastMessage ? [lastMessage] : [],
      has_more: false,
      next_cursor: '',
    }
  }

  /**
   * 创建成功响应结果
   * @param message - 原始回调事件消息
   * @param syncResult - 同步消息结果
   * @returns 格式化的成功响应对象
   */
  private createSuccessResult(message: WeComCallbackEventMessage, syncResult: SyncMessageResult): WeComCallbackResult {
    return {
      success: true,
      data: {
        type: 'event',
        eventType: message.Event,
        event: message.event,
        syncMessages: syncResult,
      },
    }
  }

  /**
   * 处理错误并返回统一的错误响应格式
   * @param message - 错误描述信息
   * @param error - 错误对象
   * @returns 格式化的错误响应对象
   */
  private handleError(message: string, error: unknown): WeComCallbackResult {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    logger.error(`${message}:`, error)
    return {
      success: false,
      message: `${message}: ${errorMessage}`,
    }
  }
}
