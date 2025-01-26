import WebSocket from 'ws'
import crypto from 'crypto'
import { env } from './env'

/**
 * 讯飞语音识别选项接口
 */
export interface IflytekASROptions {
  /** 语种，默认 zh_cn。支持：zh_cn(中文)、en_us(英文) */
  language?: string
  /** 应用领域，默认 iat。可选：iat(日常用语)、medical(医疗)等 */
  domain?: string
  /** 方言，默认 mandarin(普通话) */
  accent?: string
  /** VAD后端点检测时间，默认3000ms，最大10000ms */
  vadEos?: number
  /** 是否开启标点符号，默认开启 */
  enablePunctuation?: boolean
}

/**
 * 讯飞语音识别服务
 *
 * @remarks
 * 限制说明：
 * - 最大并发数：50路
 * - 单次音频最长：60秒
 * - 超过10秒未发送数据会自动断开连接
 * - 整个会话最长持续60秒
 *
 * 音频要求：
 * - 采样率：16k或8k
 * - 位长：16bit
 * - 声道：单声道
 * - 格式：pcm、speex、speex-wb、mp3(仅中文普通话和英文支持)
 */
export class IflytekASRService {
  private readonly appId: string
  private readonly apiKey: string
  private readonly apiSecret: string
  private readonly hostUrl: string

  constructor() {
    if (!env.IFLYTEK_APP_ID || !env.IFLYTEK_API_KEY || !env.IFLYTEK_API_SECRET) {
      throw new Error('讯飞语音识别服务配置不完整')
    }

    this.appId = env.IFLYTEK_APP_ID
    this.apiKey = env.IFLYTEK_API_KEY
    this.apiSecret = env.IFLYTEK_API_SECRET
    this.hostUrl = 'wss://iat-api.xfyun.cn/v2/iat'
    logger.info('语音识别服务：讯飞')
  }

  /**
   * 生成鉴权URL
   * @private
   * @returns 包含鉴权信息的WebSocket URL
   */
  private getAuthUrl(): string {
    const date = new Date().toUTCString()
    const host = new URL(this.hostUrl).host
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`

    const hmac = crypto.createHmac('sha256', this.apiSecret)
    const signature = hmac.update(signatureOrigin).digest('base64')

    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
    const authorization = Buffer.from(authorizationOrigin).toString('base64')

    const url = new URL(this.hostUrl)
    url.searchParams.append('authorization', authorization)
    url.searchParams.append('date', date)
    url.searchParams.append('host', host)

    return url.toString()
  }

  /**
   * 执行语音识别
   *
   * @param audioBuffer - 音频数据Buffer，支持pcm、speex等格式
   * @param options - 识别选项
   * @returns 识别结果文本
   *
   * @throws {Error}
   * - 鉴权失败 (10005)
   * - 音频解码失败 (10043)
   * - 会话超时 (10114)
   * - 日流控超限 (11201)
   */
  public async recognizeSpeech(audioBuffer: Buffer, options: IflytekASROptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = this.getAuthUrl()
      const ws = new WebSocket(url)
      let result = ''

      ws.on('open', () => {
        logger.info('讯飞语音识别WebSocket连接已建立')

        // 发送业务参数
        const params = {
          common: {
            app_id: this.appId,
          },
          business: {
            language: options.language || 'zh_cn',
            domain: options.domain || 'iat',
            accent: options.accent || 'mandarin',
            vad_eos: options.vadEos || 3000,
            ptt: options.enablePunctuation ? 1 : 0,
          },
          data: {
            status: 0,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: audioBuffer.toString('base64'),
          },
        }

        ws.send(JSON.stringify(params))

        // 发送结束标志
        ws.send(
          JSON.stringify({
            data: {
              status: 2,
            },
          }),
        )
      })

      ws.on('message', (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString())

          if (response.code !== 0) {
            ws.close()
            reject(new Error(`讯飞服务错误: ${response.code} - ${response.message}`))
            return
          }

          if (response.data && response.data.result) {
            const text = response.data.result.ws.map((ws: any) => ws.cw.map((cw: any) => cw.w).join('')).join('')
            result += text
          }

          if (response.data && response.data.status === 2) {
            ws.close()
            resolve(result)
          }
        } catch (error) {
          logger.error('解析讯飞响应失败:', error)
          ws.close()
          reject(error)
        }
      })

      ws.on('error', (error: any) => {
        logger.error('讯飞WebSocket连接错误:', error)
        reject(error)
      })

      ws.on('close', () => {
        logger.debug('讯飞WebSocket连接已关闭')
      })
    })
  }
}
