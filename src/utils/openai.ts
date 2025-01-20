import OpenAI from 'openai'
import fs from 'fs'
import { env } from './env'
import { prompts } from '../prompts'

export class OpenAIService {
  private client: OpenAI

  constructor() {
    const baseURL = env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    logger.info(`初始化 OpenAI 客户端，使用 base URL: ${baseURL}`)

    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: baseURL,
    })
  }

  async transcribeAudio(audioFilePath: string): Promise<string> {
    try {
      logger.info(`开始转录音频文件: ${audioFilePath}`)
      const response = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language: 'zh',
        prompt: prompts.transcription.content,
      })

      logger.info('音频转录完成')
      return response.text
    } catch (error) {
      logger.error('音频转录失败:', error)
      throw error
    }
  }

  async generateResponse(userMessage: string): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: prompts.calligraphyMaster.content,
          },
          { role: 'user', content: userMessage },
        ],
        model: 'gpt-4o-mini',
      })

      const response = completion.choices[0]?.message?.content || '抱歉，我现在无法回答这个问题。'
      logger.info('OpenAI 响应:', { userMessage, response })
      return response
    } catch (error) {
      logger.error('调用 OpenAI API 失败:', error)
      return '抱歉，我暂时无法处理您的请求，请稍后再试。'
    }
  }
}
