import { Request, Response } from 'express'
import { WeComService } from '../services/wecom'

export class WeComController {
  private wecomService: WeComService

  constructor(wecomService: WeComService) {
    this.wecomService = wecomService
  }

  public async sendMessage(req: Request, res: Response) {
    try {
      const message = req.body
      const result = await this.wecomService.sendMessage(message)
      res.json(result)
    } catch (error) {
      logger.error('发送消息失败:', error)
      res.status(500).json({ error: '发送消息失败' })
    }
  }

  public async getServicerList(req: Request, res: Response) {
    try {
      const result = await this.wecomService.getServicerList()
      res.json(result)
    } catch (error) {
      logger.error('获取客服列表失败:', error)
      res.status(500).json({ error: '获取客服列表失败' })
    }
  }

  public async getAccountList(req: Request, res: Response) {
    try {
      const { offset = '0', limit = '100' } = req.query
      const result = await this.wecomService.getAccountList(parseInt(offset as string), parseInt(limit as string))
      res.json(result)
    } catch (error) {
      logger.error('获取客服账号列表失败:', error)
      res.status(500).json({ error: '获取客服账号列表失败' })
    }
  }

  public async syncMessages(req: Request, res: Response) {
    try {
      const { cursor = '', token = '', limit = 1000 } = req.body
      const result = await this.wecomService.syncMessage(cursor, token, limit)
      res.json(result)
    } catch (error) {
      logger.error('同步消息失败:', error)
      res.status(500).json({ error: '同步消息失败' })
    }
  }
}
