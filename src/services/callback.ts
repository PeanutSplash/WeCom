import {
  WeComCallbackMessageType,
  WeComCallbackResult,
  WeComCallbackTextMessage,
  WeComCallbackImageMessage,
  WeComCallbackVoiceMessage,
  WeComCallbackEventMessage,
} from '../types/wecom'
import { setupLogger } from '../utils/logger'
import { WeComService } from './wecom'
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

  constructor(private readonly wecomService: WeComService) {
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
        
        // 如果是语音消息，下载并转换语音文件
        if (lastMessage.msgtype === 'voice' && lastMessage.voice?.media_id) {
          logger.info('检测到语音消息，准备下载并转换')
          const voiceResult = await this.wecomService.handleVoiceMessage(lastMessage)
          
          if (voiceResult.success) {
            logger.info('语音文件处理成功：', {
              mp3File: voiceResult.mp3FilePath,
              fileName: voiceResult.fileInfo?.fileName,
              fileType: voiceResult.fileInfo?.contentType,
              fileSize: voiceResult.fileInfo?.contentLength
            })
          } else {
            logger.error(`语音文件处理失败: ${voiceResult.error}`)
          }
        }

        // 发送语音回复
        try {
          // 上传语音文件获取 media_id
          const voiceMediaId = await this.wecomService.uploadMedia('voice', './assets/hello.amr')

          // 使用获取到的 media_id 发送语音消息
          await this.wecomService.sendVoiceMessage({
            touser: lastMessage.external_userid,
            open_kfid: lastMessage.open_kfid,
            msgtype: 'voice',
            voice: {
              media_id: voiceMediaId,
            },
          })
          logger.info('语音消息发送成功')
        } catch (error) {
          logger.error('发送语音消息失败:', error)
          throw error
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
