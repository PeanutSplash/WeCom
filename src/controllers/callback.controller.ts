import { Request, Response } from 'express'
import { CallbackService } from '../services/callback'
import { OpenAIService } from '../utils/openai'
import { verifySignature, parseCallbackMessage } from '../utils/wecom'
import { env } from '../utils/env'

export class CallbackController {
  private callbackService: CallbackService

  constructor(wecomService: any, openAIService: OpenAIService) {
    this.callbackService = new CallbackService(wecomService, env.WECOM_ENCODING_AES_KEY, openAIService)
  }

  private validateCallbackParams(params: any) {
    const { msg_signature, timestamp, nonce } = params
    if (!msg_signature || !timestamp || !nonce) {
      throw new Error('缺少必要的验证参数')
    }

    return { msg_signature, timestamp, nonce }
  }

  public async handleGetCallback(req: Request, res: Response) {
    try {
      const { echostr } = req.query
      if (!echostr) {
        throw new Error('缺少必要的验证参数')
      }

      const { msg_signature, timestamp, nonce } = this.validateCallbackParams(req.query)

      const isSignatureValid = verifySignature({
        token: env.WECOM_TOKEN,
        timestamp: timestamp as string,
        nonce: nonce as string,
        msgSignature: msg_signature as string,
        echostr: echostr as string,
      })

      if (!isSignatureValid) {
        throw new Error('GET 请求签名验证失败')
      }

      const decryptedEchoStr = this.callbackService.decryptMessage(echostr as string)
      logger.info('GET 请求返回结果:', { decryptedEchoStr })
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(decryptedEchoStr)
    } catch (error) {
      const message = error instanceof Error ? error.message : '处理验证请求失败'
      logger.error('处理 GET 验证请求失败:', error)
      res.status(400).send(message)
    }
  }

  public async handlePostCallback(req: Request, res: Response) {
    try {
      const { msg_signature, timestamp, nonce } = this.validateCallbackParams(req.query)
      const xmlBody = req.body.toString()

      const encryptMatch = xmlBody.match(/<Encrypt><!\[CDATA\[(.*?)\]\]><\/Encrypt>/)
      const encrypt = encryptMatch?.[1]
      if (!encrypt) {
        throw new Error('无法解析加密消息')
      }

      const isSignatureValid = verifySignature({
        token: env.WECOM_TOKEN,
        timestamp: timestamp as string,
        nonce: nonce as string,
        msgSignature: msg_signature as string,
        echostr: encrypt,
      })

      if (!isSignatureValid) {
        throw new Error('POST 请求签名验证失败')
      }

      res.status(200).send('success')

      // 异步处理消息
      const decryptedMessage = this.callbackService.decryptMessage(encrypt)
      const parsedMessage = await parseCallbackMessage(decryptedMessage)

      if (parsedMessage.MsgType === 'event' && parsedMessage.Event === 'kf_msg_or_event') {
        await this.callbackService.handleCallback(parsedMessage)
      }
    } catch (error) {
      logger.error('处理 POST 回调消息失败:', error)
    }
  }
}
