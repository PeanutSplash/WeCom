import WebSocket from 'ws'
import crypto from 'crypto'

export class XunfeiTTSService {
  private apiKey: string
  private apiSecret: string
  private appId: string
  private voiceName: string
  private hostUrl: string

  constructor(appId: string, apiKey: string, apiSecret: string, voiceName = 'xiaoyan') {
    this.appId = appId
    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.voiceName = voiceName
    this.hostUrl = 'wss://tts-api.xfyun.cn/v2/tts'
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
            volume: 50,
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
        logger.info('讯飞WebSocket连接已关闭')
      })
    })
  }
}
