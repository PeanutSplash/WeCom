import { Router } from 'express'
import { WeComService } from '../services/wecom'
import { setupLogger } from '../utils/logger'

const router = Router()
const logger = setupLogger()

// 初始化 WeComService
const wecomService = new WeComService(process.env.WECOM_CORPID || '', process.env.WECOM_SECRET || '')

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

// 获取客服列表
router.get('/servicers', async (req, res) => {
  try {
    const result = await wecomService.getServicerList()
    res.json(result)
  } catch (error) {
    logger.error('获取客服列表失败:', error)
    res.status(500).json({ error: '获取客服列表失败' })
  }
})

// 同步消息
router.post('/sync', async (req, res) => {
  try {
    const { cursor, token, limit } = req.body
    const result = await wecomService.syncMessage(cursor, token, limit)
    res.json(result)
  } catch (error) {
    logger.error('同步消息失败:', error)
    res.status(500).json({ error: '同步消息失败' })
  }
})

export const wecomRouter = router
