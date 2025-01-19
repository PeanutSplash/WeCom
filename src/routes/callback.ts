import { Router } from 'express'
import { CallbackService } from '../services/callback'
import { WeComCallbackMessageType } from '../types/wecom'
import { setupLogger } from '../utils/logger'
import { verifySignature, parseCallbackMessage } from '../utils/wecom'

const logger = setupLogger()
const router = Router()

export const setupCallbackRoutes = (callbackService: CallbackService) => {
  // 处理回调消息验证
  router.get('/callback', (req, res) => {
    try {
      const { msg_signature, timestamp, nonce, echostr } = req.query

      // 验证参数完整性
      if (!msg_signature || !timestamp || !nonce || !echostr) {
        logger.error('缺少必要的验证参数')
        return res.status(400).send('缺少必要的验证参数')
      }

      const token = process.env.WECOM_TOKEN
      const encodingAESKey = process.env.WECOM_ENCODING_AES_KEY

      if (!token || !encodingAESKey) {
        logger.error('缺少 WECOM_TOKEN 或 WECOM_ENCODING_AES_KEY 配置')
        return res.status(500).send('服务器配置错误')
      }

      const isSignatureValid = verifySignature({
        token,
        timestamp: timestamp as string,
        nonce: nonce as string,
        msgSignature: msg_signature as string,
        echostr: echostr as string,
      })

      if (isSignatureValid) {
        // 使用 CallbackService 解密 echostr
        const decryptedEchoStr = callbackService.decryptMessage(echostr as string)
        // 直接写入响应流而不是用 res.send()
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(decryptedEchoStr)
      } else {
        logger.error('签名验证失败')
        res.status(403).send('签名验证失败')
      }
    } catch (error) {
      logger.error('处理回调验证请求失败:', error)
      res.status(500).send('处理回调验证请求失败')
    }
  })

  // 处理回调消息
  router.post('/callback', async (req, res) => {
    try {
      const message = await parseCallbackMessage(req.body)
      const response = await callbackService.handleCallback(message)

      if (response.success) {
        res.status(200).send('success')
      } else {
        logger.error('处理回调消息失败:', response.message)
        res.status(500).send(response.message)
      }
    } catch (error) {
      logger.error('处理回调请求失败:', error)
      res.status(500).send('处理回调请求失败')
    }
  })

  return router
}
