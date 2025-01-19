import {
  WeComCallbackMessageType,
  WeComCallbackResult,
  WeComCallbackTextMessage,
  WeComCallbackImageMessage,
  WeComCallbackVoiceMessage,
  WeComCallbackEventMessage,
  MessageType,
  SendMessage,
} from '../types/wecom'
import { setupLogger } from '../utils/logger'
import { WeComService } from './wecom'
import crypto from 'crypto'
import path from 'path'

const logger = setupLogger()

// 修改 MessageHandler 类型定义
interface MessageHandlers {
  text: (message: WeComCallbackTextMessage) => Promise<WeComCallbackResult>
  image: (message: WeComCallbackImageMessage) => Promise<WeComCallbackResult>
  voice: (message: WeComCallbackVoiceMessage) => Promise<WeComCallbackResult>
  event: (message: WeComCallbackEventMessage) => Promise<WeComCallbackResult>
}

export class CallbackService {
  private readonly messageHandlers: MessageHandlers

  private openKfId: string | null = null

  constructor(private readonly wecomService: WeComService) {
    this.messageHandlers = {
      text: this.handleTextMessage.bind(this),
      image: this.handleImageMessage.bind(this),
      voice: this.handleVoiceMessage.bind(this),
      event: this.handleEventMessage.bind(this),
    }
  }

  private async getOpenKfId(): Promise<string> {
    if (this.openKfId) {
      return this.openKfId
    }

    try {
      const response = await this.wecomService.getAccountList()
      const accounts = response.account_list
      if (!accounts || accounts.length === 0) {
        throw new Error('没有可用的客服账号')
      }

      this.openKfId = accounts[0].open_kfid
      logger.info(`获取到客服账号: ${this.openKfId}`)
      return this.openKfId
    } catch (error) {
      logger.error('获取客服账号失败:', error)
      throw error
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

      // 直接处理消息并返回结果,不执行后续回复逻辑
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

    return {
      success: true,
      data: {
        type: 'event',
        eventType,
        event: message.event,
      },
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
