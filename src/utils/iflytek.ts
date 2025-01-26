import WebSocket from 'ws'
import crypto from 'crypto'
import { env } from './env'

export class IflytekTTSService {
  private readonly appId: string
  private readonly apiKey: string
  private readonly apiSecret: string
  private readonly voiceName: string
  private readonly hostUrl: string

  constructor() {
    if (!env.IFLYTEK_APP_ID || !env.IFLYTEK_API_KEY || !env.IFLYTEK_API_SECRET) {
      throw new Error('讯飞语音合成服务配置不完整')
    }

    this.appId = env.IFLYTEK_APP_ID
    this.apiKey = env.IFLYTEK_API_KEY
    this.apiSecret = env.IFLYTEK_API_SECRET
    this.voiceName = env.IFLYTEK_VOICE_NAME || 'xiaoyan'
    this.hostUrl = 'wss://tts-api.xfyun.cn/v2/tts'

    logger.info('语音合成服务：讯飞')
  }

  private getAuthUrl(): string {
    const date = new Date().toUTCString()
    const signatureOrigin = `host: ${new URL(this.hostUrl).host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`

    const hmac = crypto.createHmac('sha256', this.apiSecret)
    const signature = hmac.update(signatureOrigin).digest('base64')

    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
    const authorization = Buffer.from(authorizationOrigin).toString('base64')

    const url = new URL(this.hostUrl)
    url.searchParams.append('authorization', authorization)
    url.searchParams.append('date', date)
    url.searchParams.append('host', url.host)

    return url.toString()
  }

  public async textToSpeech(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const url = this.getAuthUrl()
      const ws = new WebSocket(url)
      const audioChunks: Buffer[] = []

      ws.on('open', () => {
        const params = {
          common: {
            app_id: this.appId,
          },
          business: {
            aue: 'lame',
            sfl: 0,
            auf: 'audio/L16;rate=16000',
            vcn: this.voiceName,
            speed: 50,
            volume: 150,
            pitch: 50,
            bgs: 0,
            tte: 'UTF8',
          },
          data: {
            status: 2,
            text: Buffer.from(text).toString('base64'),
          },
        }

        ws.send(JSON.stringify(params))
      })

      ws.on('message', (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString())

          if (response.code !== 0) {
            ws.close()
            reject(new Error(`讯飞服务错误: ${response.code} - ${response.message}`))
            return
          }

          if (response.data && response.data.audio) {
            const audio = Buffer.from(response.data.audio, 'base64')
            audioChunks.push(audio)
          }

          if (response.data && response.data.status === 2) {
            ws.close()
            const finalAudio = Buffer.concat(audioChunks)
            resolve(finalAudio)
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
