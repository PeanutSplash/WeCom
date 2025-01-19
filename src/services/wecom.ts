import axios from 'axios'
import { WeComResponse, SendMessage } from '../types/wecom'

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

    this.accessToken = response.data.access_token as string
    this.tokenExpireTime = Date.now() + response.data.expires_in * 1000
    return this.accessToken
  }

  // 发送消息
  async sendMessage(message: SendMessage): Promise<WeComResponse> {
    const accessToken = await this.getAccessToken()
    const response = await axios.post<WeComResponse>(`${this.baseUrl}/kf/send_msg?access_token=${accessToken}`, message)

    if (response.data.errcode !== 0) {
      throw new Error(`发送消息失败: ${response.data.errmsg}`)
    }

    return response.data
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

  // 同步消息
  async syncMessage(cursor: string = '', token: string = '', limit: number = 1000): Promise<WeComResponse> {
    const accessToken = await this.getAccessToken()
    const response = await axios.post<WeComResponse>(`${this.baseUrl}/kf/sync_msg?access_token=${accessToken}`, {
      cursor,
      token,
      limit,
    })

    if (response.data.errcode !== 0) {
      throw new Error(`同步消息失败: ${response.data.errmsg}`)
    }

    return response.data
  }
}
