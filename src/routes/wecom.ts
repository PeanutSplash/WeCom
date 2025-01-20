import { Router } from 'express'
import { WeComService } from '../services/wecom'
import { WeComController } from '../controllers/wecom.controller'

const corpid = process.env.WECOM_CORPID
const secret = process.env.WECOM_SECRET

if (!corpid || !secret) {
  logger.error('缺少必需的环境变量: WECOM_CORPID 或 WECOM_SECRET')
  throw new Error('请在 .env 文件中配置 WECOM_CORPID 和 WECOM_SECRET')
}

export const setupWeComRoutes = (wecomService: WeComService) => {
  const router = Router()
  const wecomController = new WeComController(wecomService)

  // 发送消息
  router.post('/send', (req, res) => wecomController.sendMessage(req, res))

  // 获取客服列表
  router.get('/servicer/list', (req, res) => wecomController.getServicerList(req, res))

  // 获取客服账号列表
  router.get('/account/list', (req, res) => wecomController.getAccountList(req, res))

  // 同步消息
  router.post('/sync/messages', (req, res) => wecomController.syncMessages(req, res))

  return router
}
