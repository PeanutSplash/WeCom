import {
  WeComCallbackMessageType,
  WeComCallbackResult,
  WeComCallbackTextMessage,
  WeComCallbackImageMessage,
  WeComCallbackVoiceMessage,
  WeComCallbackEventMessage,
  MessageType,
} from '../types/wecom'
import { setupLogger } from '../utils/logger'
import { WeComService } from './wecom'
import { OpenAIService } from './openai'
import crypto from 'crypto'

const logger = setupLogger()

interface MessageHandlers {
  text: (message: WeComCallbackTextMessage) => Promise<WeComCallbackResult>
  image: (message: WeComCallbackImageMessage) => Promise<WeComCallbackResult>
  voice: (message: WeComCallbackVoiceMessage) => Promise<WeComCallbackResult>
  event: (message: WeComCallbackEventMessage) => Promise<WeComCallbackResult>
}

export class CallbackService {
  private readonly messageHandlers: MessageHandlers
  private readonly openAIService: OpenAIService

  constructor(private readonly wecomService: WeComService) {
    this.openAIService = new OpenAIService()
    this.messageHandlers = {
      text: this.handleTextMessage.bind(this),
      image: this.handleImageMessage.bind(this),
      voice: this.handleVoiceMessage.bind(this),
      event: this.handleEventMessage.bind(this),
    }
  }

  async handleCallback(message: WeComCallbackMessageType): Promise<WeComCallbackResult> {
    try {
      const { MsgType: msgType } = message

      const handler = this.messageHandlers[msgType as keyof MessageHandlers]
      if (!handler) {
        return {
          success: false,
          message: `不支持的消息类型: ${msgType}`,
        }
      }

      return await handler(message as any)
    } catch (error) {
      logger.error(`处理消息失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return {
        success: false,
        message: `处理消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }

  private async handleTextMessage(message: WeComCallbackTextMessage): Promise<WeComCallbackResult> {
    const content = message.text.content
    logger.info(`处理文本消息: ${content.substring(0, 50)}...`)
    return {
      success: true,
      data: { type: 'text', content },
    }
  }

  private async handleImageMessage(message: WeComCallbackImageMessage): Promise<WeComCallbackResult> {
    const mediaId = message.image.media_id
    logger.info(`处理图片消息, media_id: ${mediaId}`)
    return {
      success: true,
      data: { type: 'image', mediaId },
    }
  }

  private async handleVoiceMessage(message: WeComCallbackVoiceMessage): Promise<WeComCallbackResult> {
    const mediaId = message.voice.media_id
    logger.info(`处理语音消息, media_id: ${mediaId}`)
    return {
      success: true,
      data: { type: 'voice', mediaId },
    }
  }

  private async handleEventMessage(message: WeComCallbackEventMessage): Promise<WeComCallbackResult> {
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

      // 处理同步到的消息
      if (syncResult.msg_list?.length > 0) {
        const lastMessage = syncResult.msg_list[0]

        // 处理不同类型的消息
        if (lastMessage.msgtype === 'text') {
          // 使用 OpenAI 生成回复
          const aiResponse = await this.openAIService.generateResponse(lastMessage.text.content)

          // 发送回复消息
          await this.wecomService.sendTextMessage({
            touser: lastMessage.external_userid,
            open_kfid: lastMessage.open_kfid,
            msgtype: MessageType.TEXT,
            text: {
              content: aiResponse,
            },
          })

          logger.info('AI 回复已发送')
        }
        // 如果是语音消息，下载并转换语音文件
        else if (lastMessage.msgtype === 'voice' && lastMessage.voice?.media_id) {
          logger.info('检测到语音消息，准备下载并转换')
          const voiceResult = await this.wecomService.handleVoiceMessage(lastMessage)

          if (voiceResult.success && voiceResult.mp3FilePath) {
            logger.info('语音文件处理成功：', {
              mp3File: voiceResult.mp3FilePath,
              fileName: voiceResult.fileInfo?.fileName,
              fileType: voiceResult.fileInfo?.contentType,
              fileSize: voiceResult.fileInfo?.contentLength,
            })

            try {
              // 使用 Whisper 将语音转换为文字
              const transcription = await this.openAIService.transcribeAudio(voiceResult.mp3FilePath)
              logger.info('语音转文字成功:', transcription)

              // 使用 ChatGPT 生成回复
              const aiResponse = await this.openAIService.generateResponse(transcription)

              // 发送文字回复，只发送 AI 的回复
              await this.wecomService.sendTextMessage({
                touser: lastMessage.external_userid,
                open_kfid: lastMessage.open_kfid,
                msgtype: MessageType.TEXT,
                text: {
                  content: aiResponse,
                },
              })

              logger.info('AI 回复已发送')
            } catch (error) {
              logger.error('处理语音转文字或生成回复失败:', error)
              // 发送错误提示
              await this.wecomService.sendTextMessage({
                touser: lastMessage.external_userid,
                open_kfid: lastMessage.open_kfid,
                msgtype: MessageType.TEXT,
                text: {
                  content: '抱歉，我在处理您的语音消息时遇到了问题，请您尝试重新发送或使用文字描述。',
                },
              })
            }
          } else {
            logger.error(`语音文件处理失败: ${voiceResult.error}`)
            // 发送错误提示
            await this.wecomService.sendTextMessage({
              touser: lastMessage.external_userid,
              open_kfid: lastMessage.open_kfid,
              msgtype: MessageType.TEXT,
              text: {
                content: '抱歉，我在处理您的语音消息时遇到了问题，请您尝试重新发送或使用文字描述。',
              },
            })
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

  public decryptMessage(message: string): string {
    try {
      const aesKey = Buffer.from(process.env.WECOM_ENCODING_AES_KEY + '=', 'base64')
      const iv = aesKey.slice(0, 16)
      const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv)
      decipher.setAutoPadding(false)

      const decrypted = Buffer.concat([Buffer.from(decipher.update(message, 'base64')), Buffer.from(decipher.final())])

      return this.parseDecryptedMessage(decrypted)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      logger.error('解密消息失败:', errorMessage)
      throw new Error(`消息解密失败: ${errorMessage}`)
    }
  }

  private parseDecryptedMessage(decrypted: Buffer): string {
    const padLen = decrypted[decrypted.length - 1]
    if (padLen < 1 || padLen > 32) {
      throw new Error('无效的填充长度')
    }

    const unpaddedData = decrypted.slice(0, decrypted.length - padLen)
    const msgLen = unpaddedData.readUInt32BE(16)
    return unpaddedData.slice(20, 20 + msgLen).toString('utf8')
  }
}
