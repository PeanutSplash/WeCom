import { WeComCallbackImageMessage, WeComCallbackResult } from '../../../types/wecom'

import { MessageHandler } from './text-handler'

export class ImageMessageHandler implements MessageHandler<WeComCallbackImageMessage> {
  async handle(message: WeComCallbackImageMessage): Promise<WeComCallbackResult> {
    const mediaId = message.image.media_id
    logger.info(`处理图片消息, media_id: ${mediaId}`)

    return {
      success: true,
      data: { type: 'image', mediaId },
    }
  }
}
