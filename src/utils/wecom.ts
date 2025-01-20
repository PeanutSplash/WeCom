import crypto from 'crypto'
import xml2js from 'xml2js'
import { WeComCallbackMessageType } from '../types/wecom'

/**
 * 验证企业微信回调消息签名
 */
export const verifySignature = (params: { token: string; timestamp: string; nonce: string; msgSignature: string; echostr?: string }): boolean => {
  const { token, timestamp, nonce, msgSignature, echostr } = params
  const sortedParams = [token, timestamp, nonce]
  if (echostr) {
    sortedParams.push(echostr)
  }
  sortedParams.sort()

  const signature = crypto.createHash('sha1').update(sortedParams.join('')).digest('hex')

  return signature === msgSignature
}

/**
 * 解析企业微信回调消息XML
 */
export const parseCallbackMessage = async (xmlData: string): Promise<WeComCallbackMessageType> => {
  try {
    const parser = new xml2js.Parser({ explicitArray: false, trim: true })
    const result = await parser.parseStringPromise(xmlData)
    const xml = result.xml

    // 基础消息属性
    const baseMessage = {
      ToUserName: xml.ToUserName,
      FromUserName: xml.FromUserName,
      CreateTime: parseInt(xml.CreateTime),
      MsgType: xml.MsgType as 'text' | 'image' | 'voice' | 'event',
      MsgId: xml.MsgId,
      Event: xml.Event,
      Token: xml.Token,
      OpenKfId: xml.OpenKfId,
    }

    // 只有当不是 event 类型消息或者事件类型不是 kf_msg_or_event 时才输出日志
    // if (!(baseMessage.MsgType === 'event' && baseMessage.Event !== 'kf_msg_or_event')) {
    //   logger.info(`解析回调消息成功: ${JSON.stringify(baseMessage)}`)
    // }

    // 根据消息类型添加特定字段
    switch (baseMessage.MsgType) {
      case 'text':
        return {
          ...baseMessage,
          MsgType: 'text' as const,
          text: {
            content: xml.Content,
            menu_id: xml.MenuId,
          },
        }
      case 'image':
        return {
          ...baseMessage,
          MsgType: 'image' as const,
          image: {
            media_id: xml.MediaId,
          },
        }
      case 'voice':
        return {
          ...baseMessage,
          MsgType: 'voice' as const,
          voice: {
            media_id: xml.MediaId,
          },
        }
      case 'event':
        return {
          ...baseMessage,
          MsgType: 'event' as const,
          event: {
            event_type: xml.Event,
            open_kfid: xml.OpenKfId,
            external_userid: xml.ExternalUserId,
            scene: xml.Scene,
            scene_param: xml.SceneParam,
            welcome_code: xml.WelcomeCode,
            fail_msgid: xml.FailMsgId,
            fail_type: xml.FailType ? parseInt(xml.FailType) : undefined,
            recall_msgid: xml.RecallMsgId,
            wechat_channels: xml.WechatChannels
              ? {
                  nickname: xml.WechatChannels.Nickname,
                  shop_nickname: xml.WechatChannels.ShopNickname,
                  scene: xml.WechatChannels.Scene ? parseInt(xml.WechatChannels.Scene) : undefined,
                }
              : undefined,
          },
        }
      default:
        throw new Error(`不支持的消息类型: ${xml.MsgType}`)
    }
  } catch (error) {
    throw new Error('解析回调消息失败')
  }
}
