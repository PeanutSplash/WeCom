import axios from 'axios'
import { WeComResponse, SendMessage, MessageType } from '../types/wecom'

import FormData from 'form-data'
import fs from 'fs'
import { convertAmrToMp3, ensureMediaDirectory, type VoiceMessageResult } from '../utils/audio'

interface SendVoiceMessageParams {
  touser: string
  open_kfid: string
  msgtype: 'voice'
  voice: {
    media_id: string
  }
}

interface SendTextMessageParams {
  touser: string
  open_kfid: string
  msgtype: MessageType.TEXT
  text: {
    content: string
  }
}

interface SendLinkMessageParams {
  touser: string
  open_kfid: string
  msgtype: MessageType.LINK
  link: {
    title: string
    desc?: string
    url: string
    thumb_media_id: string
  }
}

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
      logger.debug(`开始同步消息，cursor: ${cursor}, token: ${token}, limit: ${limit}`)

      const response = await axios.post<WeComResponse>(`${this.baseUrl}/kf/sync_msg?access_token=${accessToken}`, {
        cursor,
        token,
        limit,
      })

      if (response.data.errcode !== 0) {
        throw new Error(`同步消息失败: ${response.data.errmsg}`)
      }

      logger.debug(`消息同步成功，next_cursor: ${response.data.next_cursor || '无'}`)
      return response.data
    } catch (error) {
      logger.error('同步消息时发生错误:', error)
      throw error
    }
  }

  // 上传临时素材
  async uploadMedia(type: 'image' | 'voice' | 'video' | 'file', filePathOrBuffer: string | Buffer, fileName?: string): Promise<string> {
    try {
      const accessToken = await this.getAccessToken()
      logger.debug(`准备上传${type}类型的临时素材`)

      const formData = new FormData()

      if (Buffer.isBuffer(filePathOrBuffer)) {
        // 处理 Buffer 类型输入
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const defaultFileName = `${type}_${timestamp}.${type === 'voice' ? 'mp3' : 'bin'}`
        formData.append('media', filePathOrBuffer, fileName || defaultFileName)
      } else {
        // 处理文件路径字符串
        formData.append('media', fs.createReadStream(filePathOrBuffer))
      }

      const response = await axios.post<WeComResponse>(`${this.baseUrl}/media/upload?access_token=${accessToken}&type=${type}`, formData, {
        headers: formData.getHeaders(),
      })

      if (response.data.errcode !== 0) {
        throw new Error(`上传临时素材失败: ${response.data.errmsg}`)
      }

      const mediaId = response.data.media_id
      if (!mediaId) {
        throw new Error('上传临时素材失败: 未返回 media_id')
      }

      logger.debug(`临时素材上传成功，media_id: ${mediaId}`)
      return mediaId
    } catch (error) {
      logger.error('上传临时素材时发生错误:', error)
      throw error
    }
  }

  async sendVoiceMessage(params: SendVoiceMessageParams): Promise<WeComResponse> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await axios.post<WeComResponse>(`${this.baseUrl}/kf/send_msg?access_token=${accessToken}`, params)

      if (response.data.errcode !== 0) {
        throw new Error(`发送语音消息失败: ${response.data.errmsg}`)
      }
      logger.info(`语音消息发送成功，消息ID: ${response.data.msgid}`)
      return response.data
    } catch (error) {
      logger.error('发送语音消息时发生错误:', error)
      throw error
    }
  }

  /**
   * 获取临时素材
   * @param mediaId 媒体文件ID
   * @param start 开始字节位置（用于断点下载）
   * @param end 结束字节位置（用于断点下载）
   * @returns 返回文件的 Buffer 和相关的元数据
   */
  async getMedia(
    mediaId: string,
    start?: number,
    end?: number,
  ): Promise<{
    data: Buffer
    contentType: string
    contentLength: number
    fileName: string
  }> {
    try {
      const accessToken = await this.getAccessToken()
      logger.info(`开始获取临时素材，mediaId: ${mediaId}${start !== undefined ? `, 断点下载 ${start}-${end}` : ''}`)

      const headers: Record<string, string> = {}
      if (start !== undefined && end !== undefined) {
        headers['Range'] = `bytes=${start}-${end}`
      }

      const response = await axios.get(`${this.baseUrl}/media/get`, {
        params: {
          access_token: accessToken,
          media_id: mediaId,
        },
        headers,
        responseType: 'arraybuffer',
        validateStatus: status => status >= 200 && status <= 206,
      })

      // 检查错误响应
      if (response.headers['content-type']?.includes('application/json')) {
        const errorData = JSON.parse(response.data.toString())
        throw new Error(`获取临时素材失败: ${errorData.errmsg}`)
      }

      const contentType = response.headers['content-type'] || 'application/octet-stream'
      const contentLength = parseInt(response.headers['content-length'] || '0', 10)
      const contentDisposition = response.headers['content-disposition'] || ''
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = contentDisposition.split('filename="').pop()?.split('"')[0]
      const finalFileName = fileName && fileName !== '.amr' ? fileName : `voice_${timestamp}_${mediaId}.amr`

      logger.info(`临时素材获取成功，文件名: ${finalFileName}, 大小: ${contentLength} 字节`)

      return {
        data: Buffer.from(response.data),
        contentType,
        contentLength,
        fileName: finalFileName,
      }
    } catch (error) {
      logger.error('获取临时素材时发生错误:', error)
      throw error
    }
  }

  /**
   * 处理语音消息
   */
  async handleVoiceMessage(message: any): Promise<VoiceMessageResult> {
    try {
      const voiceMessage = Array.isArray(message.msg_list) ? message.msg_list[0] : message

      if (!voiceMessage.voice?.media_id) {
        logger.error('没有找到 media_id', {
          voiceData: voiceMessage.voice,
        })
        return { success: false, error: '没有找到 media_id' }
      }

      const mediaId = voiceMessage.voice.media_id
      logger.info(`收到语音消息，media_id: ${mediaId}`)

      // 获取语音文件
      const result = await this.getMedia(mediaId)

      // 确保 media 目录存在
      const mediaDir = 'media'
      await ensureMediaDirectory(mediaDir)

      // 直接转换为 MP3 格式
      const conversionResult = await convertAmrToMp3(result.data, mediaId, mediaDir)

      if (!conversionResult.success) {
        logger.error(`转换MP3失败: ${conversionResult.error}`)
        return {
          success: false,
          error: conversionResult.error,
          fileInfo: {
            contentType: result.contentType,
            contentLength: result.contentLength,
            fileName: result.fileName,
          },
        }
      }

      logger.info(`语音文件已转换为MP3: ${conversionResult.filePath}`)

      return {
        success: true,
        mp3FilePath: conversionResult.filePath,
        fileInfo: {
          contentType: result.contentType,
          contentLength: result.contentLength,
          fileName: result.fileName,
        },
        rawData: result.data
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '处理语音消息失败'
      logger.error('处理语音消息失败:', error)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  async sendTextMessage(params: SendTextMessageParams): Promise<WeComResponse> {
    return this.sendMessage(params)
  }

  async sendLinkMessage(params: SendLinkMessageParams): Promise<WeComResponse> {
    try {
      logger.info(`准备发送链接消息，标题: ${params.link.title}, URL: ${params.link.url}`)
      return this.sendMessage(params)
    } catch (error) {
      logger.error('发送链接消息时发生错误:', error)
      throw error
    }
  }
}
