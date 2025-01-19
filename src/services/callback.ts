import {
  WeComCallbackMessageType,
  WeComCallbackResult,
  WeComCallbackTextMessage,
  WeComCallbackImageMessage,
  WeComCallbackVoiceMessage,
  MessageType,
  SendMessage,
} from '../types/wecom'
import { setupLogger } from '../utils/logger'
import { WeComService } from './wecom'
import crypto from 'crypto'

const logger = setupLogger()

// 提取常用常量
const MESSAGE_TEMPLATES = {
  text: '收到文本消息：',
  image: '收到图片消息',
  voice: '收到语音消息',
} as const

type MessageHandler<T extends WeComCallbackMessageType = WeComCallbackMessageType> = (message: T) => Promise<WeComCallbackResult>

export class CallbackService {
  private readonly messageHandlers: Record<string, MessageHandler> = {
    text: this.handleTextMessage as MessageHandler,
    image: this.handleImageMessage as MessageHandler,
    voice: this.handleVoiceMessage as MessageHandler,
  }

  constructor(private readonly wecomService: WeComService) {}

  async handleCallback(message: WeComCallbackMessageType): Promise<WeComCallbackResult> {
    try {
      const { MsgType: msgType } = message
      logger.info(`收到${msgType}类型消息`)

      const handler = this.messageHandlers[msgType]
      if (!handler) {
        logger.warn(`不支持的消息类型: ${msgType}`)
        return {
          success: false,
          message: `不支持的消息类型: ${msgType}`,
        }
      }

      return await handler(message)
    } catch (error) {
      logger.error(`处理消息失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return {
        success: false,
        message: `处理消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }

  private async createAndSendReply(message: WeComCallbackMessageType, content: string): Promise<void> {
    const replyMessage: SendMessage = {
      touser: message.ToUserName,
      open_kfid: message.OpenKfId || '',
      msgtype: MessageType.TEXT,
      text: { content },
    }
    await this.wecomService.sendMessage(replyMessage)
  }

  private async handleTextMessage(message: WeComCallbackTextMessage): Promise<WeComCallbackResult> {
    const content = message.text.content
    logger.info(`处理文本消息: ${content.substring(0, 50)}...`)

    await this.createAndSendReply(message, `${MESSAGE_TEMPLATES.text}${content}`)

    return {
      success: true,
      data: { type: 'text', content },
    }
  }

  private async handleImageMessage(message: WeComCallbackImageMessage): Promise<WeComCallbackResult> {
    const mediaId = message.image.media_id
    logger.info(`处理图片消息: ${mediaId}`)

    await this.createAndSendReply(message, MESSAGE_TEMPLATES.image)

    return {
      success: true,
      data: { type: 'image', mediaId },
    }
  }

  private async handleVoiceMessage(message: WeComCallbackVoiceMessage): Promise<WeComCallbackResult> {
    const mediaId = message.voice.media_id
    logger.info(`处理语音消息: ${mediaId}`)

    await this.createAndSendReply(message, MESSAGE_TEMPLATES.voice)

    return {
      success: true,
      data: { type: 'voice', mediaId },
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
