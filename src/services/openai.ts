import OpenAI from 'openai'
import { setupLogger } from '../utils/logger'

const logger = setupLogger()

export class OpenAIService {
  private client: OpenAI

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 环境变量未设置')
    }

    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    logger.info(`初始化 OpenAI 客户端，使用 base URL: ${baseURL}`)

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: baseURL,
    })
  }

  async generateResponse(userMessage: string): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: '你是一个友好的客服助手，请用简洁专业的语气回答用户的问题。',
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
