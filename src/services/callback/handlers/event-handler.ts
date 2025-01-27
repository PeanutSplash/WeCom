import { WeComCallbackEventMessage, WeComCallbackResult, MessageType, SendMessage } from '../../../types/wecom'
import { WeComService } from '../../wecom'
import { OpenAIService } from '../../../utils/openai'
import { IflytekTTSService } from '../../../utils/iflytek'
import { IflytekASRService } from '../../../utils/iflytek-asr'
import { convertMp3ToAmr, convertAmrToPcm, convertAmrToMp3 } from '../../../utils/audio'
import { promises as fs } from 'fs'
import path from 'path'
import { env } from '../../../utils/env'
import { KnowledgeService } from '../../knowledge'
import { KnowledgeItem } from '../../../types/knowledge'
import { CursorManager } from './cursor-manager'

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

interface SendLinkMessageParams extends SendMessageParams {
  msgtype: MessageType.LINK
  link: {
    title: string
    desc?: string
    url: string
    thumb_media_id: string
  }
}

export class EventMessageHandler {
  private readonly iflytekTTSService: IflytekTTSService
  private readonly iflytekASRService: IflytekASRService
  private readonly knowledgeService: KnowledgeService
  private readonly cursorManager: CursorManager

  constructor(private readonly wecomService: WeComService, private readonly openAIService: OpenAIService) {
    this.iflytekTTSService = new IflytekTTSService()
    this.iflytekASRService = new IflytekASRService()
    this.knowledgeService = new KnowledgeService()
    this.cursorManager = new CursorManager()
    this.initServices().catch(error => {
      logger.error('初始化服务失败:', error)
    })
  }

  private async initServices(): Promise<void> {
    await this.knowledgeService.init()
  }

  /**
   * 处理企业微信回调事件消息
   * @param message - 企业微信回调事件消息
   * @returns 处理结果，包含成功状态和相关数据
   */
  async handle(message: WeComCallbackEventMessage): Promise<WeComCallbackResult> {
    const eventType = message.Event
    logger.debug(`处理事件消息, 事件类型: ${eventType}`)

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
      const syncResult = await this.syncLatestMessage(message.Token, message)
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
  private async processMessage(message: SyncMessage): Promise<void> {
    if (message.msgtype === 'text' && message.text) {
      // 首先检查知识库是否有匹配的回答
      const knowledgeMatch = this.knowledgeService.findMatch(message.text.content)

      if (knowledgeMatch) {
        logger.info('找到知识库匹配:', { pattern: knowledgeMatch.pattern, response: knowledgeMatch.response })

        // 如果配置了链接消息，优先发送链接消息
        if (knowledgeMatch.link) {
          try {
            // 检查是否需要上传图片
            const isThumbValid = await this.knowledgeService.checkLinkThumbMediaValid(knowledgeMatch)
            if (!knowledgeMatch.link.thumbMediaId || !isThumbValid) {
              logger.info('开始上传链接缩略图:', knowledgeMatch.link.imagePath)
              try {
                const imageBuffer = await fs.readFile(knowledgeMatch.link.imagePath)
                const mediaId = await this.wecomService.uploadMedia('image', imageBuffer, path.basename(knowledgeMatch.link.imagePath))
                await this.knowledgeService.updateLinkThumbMediaId(knowledgeMatch.pattern.toString(), mediaId)
                knowledgeMatch.link.thumbMediaId = mediaId
              } catch (error) {
                logger.error('上传链接缩略图失败:', error)
                throw error
              }
            }

            await this.sendMessage<SendLinkMessageParams>({
              touser: message.external_userid,
              open_kfid: message.open_kfid,
              msgtype: MessageType.LINK,
              link: {
                title: knowledgeMatch.link.title,
                desc: knowledgeMatch.link.desc,
                url: knowledgeMatch.link.url,
                thumb_media_id: knowledgeMatch.link.thumbMediaId!
              }
            })
            return
          } catch (error) {
            logger.warn('发送链接消息失败，尝试发送语音消息:', error)
          }
        }

        // 检查是否有有效的语音媒体ID
        if (knowledgeMatch.voiceMediaId) {
          logger.info('使用缓存的语音媒体ID:', knowledgeMatch.voiceMediaId)
          try {
            await this.sendMessage<SendVoiceMessageParams>({
              touser: message.external_userid,
              open_kfid: message.open_kfid,
              msgtype: MessageType.VOICE,
              voice: { media_id: knowledgeMatch.voiceMediaId },
            })
          } catch (error) {
            logger.warn('使用缓存的语音媒体ID失败，尝试重新生成:', error)
            // 清除失效的语音媒体ID
            knowledgeMatch.voiceMediaId = undefined
            knowledgeMatch.voiceMediaExpireTime = undefined
            // 重新生成语音
            await this.generateAndSendVoice(knowledgeMatch, message)
          }
        } else {
          // 如果没有缓存的语音，生成新的语音并缓存
          await this.generateAndSendVoice(knowledgeMatch, message)
        }
      } else {
        const response = await this.openAIService.generateResponse(message.text.content)
        await this.sendVoiceWithFallback(response, message.external_userid, message.open_kfid)
      }
    } else if (message.msgtype === 'voice' && message.voice) {
      await this.handleVoiceMessage(message)
    }
  }

  /**
   * 生成并发送语音消息
   * @param knowledgeItem - 知识库条目
   * @param message - 原始消息
   */
  private async generateAndSendVoice(knowledgeItem: KnowledgeItem, message: SyncMessage): Promise<void> {
    try {
      const audioBuffer = await this.iflytekTTSService.textToSpeech(knowledgeItem.response)
      const amrResult = await convertMp3ToAmr(audioBuffer)

      if (!amrResult.success || !amrResult.filePath) {
        throw new Error(amrResult.error || '转换 AMR 失败')
      }

      const amrBuffer = await fs.readFile(amrResult.filePath)
      const mediaId = await this.wecomService.uploadMedia('voice', amrBuffer, path.basename(amrResult.filePath))

      // 缓存语音媒体ID
      await this.knowledgeService.updateVoiceMediaId(knowledgeItem.pattern.toString(), mediaId)

      await this.sendMessage<SendVoiceMessageParams>({
        touser: message.external_userid,
        open_kfid: message.open_kfid,
        msgtype: MessageType.VOICE,
        voice: { media_id: mediaId },
      })

      await fs.unlink(amrResult.filePath)
      logger.debug('AI 语音回复已发送并缓存')
    } catch (error) {
      logger.error('语音合成或发送失败，回退到文本消息:', error)
      await this.sendMessage<SendTextMessageParams>({
        touser: message.external_userid,
        open_kfid: message.open_kfid,
        msgtype: MessageType.TEXT,
        text: { content: knowledgeItem.response },
      })
    }
  }

  /**
   * 处理语音消息
   * @param message - 包含语音信息的消息对象
   */
  private async handleVoiceMessage(message: SyncMessage): Promise<void> {
    if (!message.voice) return

    const voiceResult = await this.wecomService.handleVoiceMessage({
      voice: { media_id: message.voice.media_id },
    })

    if (!voiceResult.success || !voiceResult.rawData) {
      throw new Error('语音处理失败')
    }

    let transcription: string
    let service = env.SPEECH_RECOGNITION_SERVICE

    try {
      if (service === 'iflytek') {
        // 讯飞服务使用PCM格式
        const pcmResult = await convertAmrToPcm(voiceResult.rawData, message.voice.media_id)

        if (!pcmResult.success || !pcmResult.filePath) {
          throw new Error('AMR转PCM失败')
        }

        const audioBuffer = await fs.readFile(pcmResult.filePath)
        transcription = await this.iflytekASRService.recognizeSpeech(audioBuffer)

        // 清理PCM文件
        await fs.unlink(pcmResult.filePath)
      } else {
        // OpenAI服务使用MP3格式
        if (!voiceResult.mp3FilePath) {
          throw new Error('MP3文件路径不存在')
        }
        transcription = await this.openAIService.transcribeAudio(voiceResult.mp3FilePath)
      }
    } catch (error) {
      logger.error(`${service} 语音识别失败:`, error)

      // 切换到备选服务
      if (service === 'iflytek') {
        logger.info('尝试使用 OpenAI 作为备选服务')
        try {
          // 重新从AMR转换为MP3
          const mp3Result = await convertAmrToMp3(voiceResult.rawData, message.voice.media_id)

          if (!mp3Result.success || !mp3Result.filePath) {
            throw new Error('AMR转MP3失败')
          }

          transcription = await this.openAIService.transcribeAudio(mp3Result.filePath)
          service = 'openai'

          // 清理MP3文件
          await fs.unlink(mp3Result.filePath)
        } catch (fallbackError) {
          logger.error('OpenAI 备选服务也失败:', fallbackError)
          throw new Error('所有语音识别服务都失败了')
        }
      } else {
        logger.info('尝试使用讯飞作为备选服务')
        try {
          // 重新从AMR转换为PCM
          const pcmResult = await convertAmrToPcm(voiceResult.rawData, message.voice.media_id)

          if (!pcmResult.success || !pcmResult.filePath) {
            throw new Error('AMR转PCM失败')
          }

          const audioBuffer = await fs.readFile(pcmResult.filePath)
          transcription = await this.iflytekASRService.recognizeSpeech(audioBuffer)
          service = 'iflytek'

          // 清理PCM文件
          await fs.unlink(pcmResult.filePath)
        } catch (fallbackError) {
          logger.error('讯飞备选服务也失败:', fallbackError)
          throw new Error('所有语音识别服务都失败了')
        }
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
      logger.debug('AI 语音回复已发送')
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
    } else if (message.msgtype === MessageType.LINK) {
      await this.wecomService.sendLinkMessage(message as SendLinkMessageParams)
    }
  }

  /**
   * 生成用户的唯一标识
   * @param openKfId - 客服ID
   * @param corpId - 企业ID
   * @returns 用户唯一标识
   */
  private generateUserId(openKfId: string, corpId: string): string {
    return `${openKfId}:${corpId}`
  }

  /**
   * 同步最新消息
   * @param token - 同步消息所需的token
   * @param message - 回调事件消息
   * @returns 同步结果，包含最新的消息列表
   */
  private async syncLatestMessage(token: string, message: WeComCallbackEventMessage): Promise<SyncMessageResult> {
    const SYNC_INTERVAL = 200
    const MAX_PAGE_SIZE = 1000
    let lastMessage = null
    let hasMore = true
    let cursor = ''

    // 从回调消息中获取用户标识
    if (!message.OpenKfId || !message.ToUserName) {
      throw new Error('缺少必要的消息参数')
    }
    const userId = this.generateUserId(message.OpenKfId, message.ToUserName)
    cursor = await this.cursorManager.getCursor(userId)

    // 同步消息
    const syncResult = await this.wecomService.syncMessage(cursor, token, MAX_PAGE_SIZE)

    if (syncResult.msg_list?.length) {
      lastMessage = syncResult.msg_list[syncResult.msg_list.length - 1] as unknown as SyncMessage
    }

    cursor = syncResult.next_cursor || ''
    hasMore = Boolean(syncResult.has_more)

    // 更新 cursor
    if (cursor) {
      await this.cursorManager.updateCursor(userId, cursor)
    }

    // 如果还有更多消息，继续同步
    while (hasMore) {
      await new Promise(resolve => setTimeout(resolve, SYNC_INTERVAL))

      const nextResult = await this.wecomService.syncMessage(cursor, token, MAX_PAGE_SIZE)

      if (nextResult.msg_list?.length) {
        lastMessage = nextResult.msg_list[nextResult.msg_list.length - 1] as unknown as SyncMessage
      }

      cursor = nextResult.next_cursor || ''
      hasMore = Boolean(nextResult.has_more)

      // 更新 cursor
      if (cursor) {
        await this.cursorManager.updateCursor(userId, cursor)
      }
    }

    return {
      errcode: 0,
      msg_list: lastMessage ? [lastMessage] : [],
      has_more: false,
      next_cursor: cursor,
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
