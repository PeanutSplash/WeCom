import { WeComCallbackEventMessage, WeComCallbackResult, MessageType } from '../../../types/wecom'

import { WeComService } from '../../wecom'
import { OpenAIService } from '../../../utils/openai'

export class EventMessageHandler {
  constructor(private readonly wecomService: WeComService, private readonly openAIService: OpenAIService) {}

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

        if (lastMessage.msgtype === 'text') {
          const aiResponse = await this.openAIService.generateResponse(lastMessage.text.content)

          await this.wecomService.sendTextMessage({
            touser: lastMessage.external_userid,
            open_kfid: lastMessage.open_kfid,
            msgtype: MessageType.TEXT,
            text: {
              content: aiResponse,
            },
          })

          logger.info('AI 文本回复已发送')
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

            // 发送回复消息
            await this.wecomService.sendTextMessage({
              touser: lastMessage.external_userid,
              open_kfid: lastMessage.open_kfid,
              msgtype: MessageType.TEXT,
              text: {
                content: aiResponse,
              },
            })

            logger.info('AI 语音回复已发送')
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
