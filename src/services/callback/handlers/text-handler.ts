import { WeComCallbackTextMessage, WeComCallbackResult } from '../../../types/wecom'

export interface MessageHandler<T> {
  handle(message: T): Promise<WeComCallbackResult>
}

export class TextMessageHandler implements MessageHandler<WeComCallbackTextMessage> {
  async handle(message: WeComCallbackTextMessage): Promise<WeComCallbackResult> {
    const content = message.text.content
    logger.info(`处理文本消息: ${content.substring(0, 50)}...`)

    return {
      success: true,
      data: { type: 'text', content },
    }
  }
}
