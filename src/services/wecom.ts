import axios from 'axios'
import { WeComResponse, SendMessage } from '../types/wecom'
import { setupLogger } from '../utils/logger'
import FormData from 'form-data'
import fs from 'fs'

const logger = setupLogger()

export class WeComService {
  private accessToken: string | null = null
  private tokenExpireTime: number = 0

  constructor(private readonly corpid: string, private readonly secret: string, private readonly baseUrl: string = 'https://qyapi.weixin.qq.com/cgi-bin') {}

  // 获取访问令牌
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken
    }

    const response = await axios.get<WeComResponse>(`${this.baseUrl}/gettoken`, {
      params: {
        corpid: this.corpid,
        corpsecret: this.secret,
      },
    })

    if (response.data.errcode !== 0) {
      throw new Error(`获取访问令牌失败: ${response.data.errmsg}`)
    }

    if (!response.data.access_token) {
      throw new Error('获取访问令牌失败: 返回数据不完整')
    }

    this.accessToken = response.data.access_token
    this.tokenExpireTime = Date.now() + (response.data.expires_in || 7200) * 1000
    return this.accessToken
  }

  // 发送消息
  async sendMessage(message: SendMessage): Promise<WeComResponse> {
    try {
      const accessToken = await this.getAccessToken()
      logger.info(`准备发送消息，类型: ${message.msgtype}, 接收者: ${message.touser}`)

      const response = await axios.post<WeComResponse>(`${this.baseUrl}/kf/send_msg?access_token=${accessToken}`, message)

      if (response.data.errcode !== 0) {
        throw new Error(`发送消息失败: ${response.data.errmsg}`)
      }

      logger.info(`消息发送成功，消息ID: ${response.data.msgid || message.msgid}`)
      return response.data
    } catch (error) {
      throw error
    }
  }

  // 获取客服列表
  async getServicerList(): Promise<WeComResponse> {
    const accessToken = await this.getAccessToken()
    const response = await axios.get<WeComResponse>(`${this.baseUrl}/kf/servicer/list?access_token=${accessToken}`)

    if (response.data.errcode !== 0) {
      throw new Error(`获取客服列表失败: ${response.data.errmsg}`)
    }

    return response.data
  }

  // 获取客服账号列表（支持分页）
  async getAccountList(offset: number = 0, limit: number = 100): Promise<WeComResponse> {
    try {
      const accessToken = await this.getAccessToken()
      logger.info(`获取客服账号列表，offset: ${offset}, limit: ${limit}`)

      if (limit < 1 || limit > 100) {
        throw new Error('limit 参数必须在 1-100 之间')
      }

      const response = await axios.post<WeComResponse>(`${this.baseUrl}/kf/account/list?access_token=${accessToken}`, {
        offset,
        limit,
      })

      if (response.data.errcode !== 0) {
        logger.error(`获取客服账号列表失败: ${response.data.errmsg}`, {
          error: response.data,
          params: { offset, limit },
        })
        throw new Error(`获取客服账号列表失败: ${response.data.errmsg}`)
      }

      logger.info(`成功获取客服账号列表，数量: ${response.data.account_list?.length || 0}`)
      return response.data
    } catch (error) {
      logger.error('获取客服账号列表时发生错误:', error)
      throw error
    }
  }

  // 获取消息
  async syncMessage(cursor: string = '', token: string = '', limit: number = 1000): Promise<WeComResponse> {
    try {
      // 验证limit参数范围
      if (limit < 1 || limit > 1000) {
        throw new Error('limit 参数必须在 1-1000 之间')
      }

      const accessToken = await this.getAccessToken()
      logger.info(`开始同步消息，cursor: ${cursor}, token: ${token}, limit: ${limit}`)

      const response = await axios.post<WeComResponse>(`${this.baseUrl}/kf/sync_msg?access_token=${accessToken}`, {
        cursor,
        token,
        limit,
      })

      if (response.data.errcode !== 0) {
        throw new Error(`同步消息失败: ${response.data.errmsg}`)
      }

      logger.info(`消息同步成功，next_cursor: ${response.data.next_cursor || '无'}`)
      return response.data
    } catch (error) {
      logger.error('同步消息时发生错误:', error)
      throw error
    }
  }

  // 上传临时素材
  async uploadMedia(type: 'image' | 'voice' | 'video' | 'file', filePath: string): Promise<string> {
    try {
      const accessToken = await this.getAccessToken()
      logger.info(`准备上传${type}类型的临时素材: ${filePath}`)

      const formData = new FormData()
      formData.append('media', fs.createReadStream(filePath))

      const response = await axios.post<WeComResponse>(`${this.baseUrl}/media/upload?access_token=${accessToken}&type=${type}`, formData, {
        headers: formData.getHeaders(),
      })

      if (response.data.errcode !== 0) {
        logger.error(`上传临时素材失败: ${response.data.errmsg}`, {
          error: response.data,
          type,
          filePath,
        })
        throw new Error(`上传临时素材失败: ${response.data.errmsg}`)
      }

      const mediaId = response.data.media_id
      if (!mediaId) {
        throw new Error('上传临时素材失败: 未返回 media_id')
      }

      logger.info(`临时素材上传成功，media_id: ${mediaId}`)
      return mediaId
    } catch (error) {
      logger.error('上传临时素材时发生错误:', error)
      throw error
    }
  }
}
