import { Router } from 'express'
import { CallbackService } from '../services/callback'
import { setupLogger } from '../utils/logger'
import { verifySignature, parseCallbackMessage } from '../utils/wecom'

const logger = setupLogger()
const router = Router()

// 优化验证参数的函数
const validateCallbackParams = (params: any) => {
  const { msg_signature, timestamp, nonce } = params
  if (!msg_signature || !timestamp || !nonce) {
    throw new Error('缺少必要的验证参数')
  }

  const token = process.env.WECOM_TOKEN
  const encodingAESKey = process.env.WECOM_ENCODING_AES_KEY

  if (!token || !encodingAESKey) {
    throw new Error('缺少 WECOM_TOKEN 或 WECOM_ENCODING_AES_KEY 配置')
  }

  return { token, encodingAESKey, msg_signature, timestamp, nonce }
}

export const setupCallbackRoutes = (callbackService: CallbackService) => {
  // GET 请求处理器 - 用于验证回调配置
  const handleGetCallback = (req: any, res: any) => {
    try {
      const { echostr } = req.query
      if (!echostr) {
        throw new Error('缺少必要的验证参数')
      }

      const { token, msg_signature, timestamp, nonce } = validateCallbackParams(req.query)

      const isSignatureValid = verifySignature({
        token,
        timestamp: timestamp as string,
        nonce: nonce as string,
        msgSignature: msg_signature as string,
        echostr: echostr as string,
      })

      if (!isSignatureValid) {
        throw new Error('GET 请求签名验证失败')
      }

      const decryptedEchoStr = callbackService.decryptMessage(echostr as string)
      logger.info('GET 请求返回结果:', { decryptedEchoStr })
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(decryptedEchoStr)
    } catch (error) {
      const message = error instanceof Error ? error.message : '处理验证请求失败'
      logger.error('处理 GET 验证请求失败:', error)
      res.status(400).send(message)
    }
  }

  // POST 请求处理器 - 用于接收回调消息
  const handlePostCallback = async (req: any, res: any) => {
    try {
      const { token, msg_signature, timestamp, nonce } = validateCallbackParams(req.query)
      const xmlBody = req.body.toString()

      // 从 XML 中提取加密消息
      const encryptMatch = xmlBody.match(/<Encrypt><!\[CDATA\[(.*?)\]\]><\/Encrypt>/)
      const encrypt = encryptMatch?.[1]
      if (!encrypt) {
        throw new Error('无法解析加密消息')
      }

      const isSignatureValid = verifySignature({
        token,
        timestamp: timestamp as string,
        nonce: nonce as string,
        msgSignature: msg_signature as string,
        echostr: encrypt,
      })

      if (!isSignatureValid) {
        throw new Error('POST 请求签名验证失败')
      }

      const decryptedMessage = callbackService.decryptMessage(encrypt)
      const parsedMessage = await parseCallbackMessage(decryptedMessage)

      // 只有当不是 event 类型消息或者事件类型不是 kf_msg_or_event 时才输出日志
      if (!(parsedMessage.MsgType === 'event' && parsedMessage.Event !== 'kf_msg_or_event')) {
        logger.info(`收到回调信息，类型为${parsedMessage.MsgType}`, { parsedMessage })
      }

      // 处理解析后的消息
      await callbackService.handleCallback(parsedMessage)

      res.status(200).send('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '处理回调消息失败'
      logger.error('处理 POST 回调消息失败:', error)
      res.status(400).send(message)
    }
  }

  // 注册路由处理器
  router.get('/callback', handleGetCallback)
  router.post('/callback', handlePostCallback)

  return router
}
