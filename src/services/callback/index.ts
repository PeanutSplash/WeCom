import { WeComCallbackMessageType, WeComCallbackResult } from '../../types/wecom'

import { WeComService } from '../wecom'
import { OpenAIService } from '../../utils/openai'
import { TextMessageHandler } from './handlers/text-handler'
import { ImageMessageHandler } from './handlers/image-handler'
import { VoiceMessageHandler } from './handlers/voice-handler'
import { EventMessageHandler } from './handlers/event-handler'
import { decryptMessage } from '../../utils/crypto'

interface MessageHandlers {
  text: TextMessageHandler
  image: ImageMessageHandler
  voice: VoiceMessageHandler
  event: EventMessageHandler
}

export class CallbackService {
  private readonly messageHandlers: MessageHandlers
  private readonly encodingAESKey: string

  constructor(private readonly wecomService: WeComService, encodingAESKey: string, openAIService: OpenAIService) {
    this.encodingAESKey = encodingAESKey

    this.messageHandlers = {
      text: new TextMessageHandler(),
      image: new ImageMessageHandler(),
      voice: new VoiceMessageHandler(wecomService, openAIService),
      event: new EventMessageHandler(wecomService, openAIService),
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

      return await handler.handle(message as any)
    } catch (error) {
      logger.error(`处理消息失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return {
        success: false,
        message: `处理消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }

  public decryptMessage(message: string): string {
    return decryptMessage(message, this.encodingAESKey)
  }
}
