import { Router } from 'express'
import { WeComService } from '../services/wecom'
import { setupLogger } from '../utils/logger'

const logger = setupLogger()
const router = Router()
const corpid = process.env.WECOM_CORPID
const secret = process.env.WECOM_SECRET

if (!corpid || !secret) {
  logger.error('缺少必需的环境变量: WECOM_CORPID 或 WECOM_SECRET')
  throw new Error('请在 .env 文件中配置 WECOM_CORPID 和 WECOM_SECRET')
}

// 初始化 WeComService
const wecomService = new WeComService(corpid, secret)

// 发送消息
router.post('/send', async (req, res) => {
  try {
    const message = req.body
    const result = await wecomService.sendMessage(message)
    res.json(result)
  } catch (error) {
    logger.error('发送消息失败:', error)
    res.status(500).json({ error: '发送消息失败' })
  }
})

export const setupWeComRoutes = (wecomService: WeComService) => {
  // 获取客服列表
  router.get('/servicer/list', async (req, res) => {
    try {
      const result = await wecomService.getServicerList()
      res.json(result)
    } catch (error) {
      logger.error('获取客服列表失败:', error)
      res.status(500).json({ error: '获取客服列表失败' })
    }
  })

  // 获取客服账号列表
  router.get('/account/list', async (req, res) => {
    try {
      const { offset = '0', limit = '100' } = req.query
      const result = await wecomService.getAccountList(parseInt(offset as string), parseInt(limit as string))
      res.json(result)
    } catch (error) {
      logger.error('获取客服账号列表失败:', error)
      res.status(500).json({ error: '获取客服账号列表失败' })
    }
  })

  // 同步消息
  router.post('/sync/messages', async (req, res) => {
    try {
      const { cursor = '', token = '', limit = 1000 } = req.body
      const result = await wecomService.syncMessage(cursor, token, limit)
      res.json(result)
    } catch (error) {
      logger.error('同步消息失败:', error)
      res.status(500).json({ error: '同步消息失败' })
    }
  })

  return router
}
