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

    return {
      ToUserName: result.xml.ToUserName,
      CreateTime: parseInt(result.xml.CreateTime),
      MsgType: result.xml.MsgType,
      Event: result.xml.Event,
      Token: result.xml.Token,
      OpenKfId: result.xml.OpenKfId,
      ...(result.xml.text && { text: result.xml.text }),
      ...(result.xml.image && { image: result.xml.image }),
      ...(result.xml.voice && { voice: result.xml.voice }),
    }
  } catch (error) {
    logger.error('解析回调消息失败:', error)
    throw new Error('解析回调消息失败')
  }
}
