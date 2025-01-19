import crypto from 'crypto'
import xml2js from 'xml2js'
import { WeComCallbackMessageType } from '../types/wecom'
import { setupLogger } from './logger'

const logger = setupLogger()

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
      MsgType: xml.MsgType as 'text' | 'image' | 'voice',
      MsgId: xml.MsgId,
      Event: xml.Event,
      Token: xml.Token,
      OpenKfId: xml.OpenKfId,
    }

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
      default:
        logger.warn(`不支持的消息类型: ${xml.MsgType}`)
        throw new Error(`不支持的消息类型: ${xml.MsgType}`)
    }
  } catch (error) {
    logger.error('解析回调消息失败:', error)
    throw new Error('解析回调消息失败')
  }
}
