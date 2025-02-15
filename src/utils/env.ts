import { z } from 'zod'

// 定义环境变量的验证 schema
const envSchema = z.object({
  // 服务配置
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.string().default('3000'),

  // 企业微信配置
  WECOM_CORPID: z.string().min(1, '企业微信 CorpID 不能为空'),
  WECOM_SECRET: z.string().min(1, '企业微信 Secret 不能为空'),
  WECOM_TOKEN: z.string().min(1, '企业微信 Token 不能为空'),
  WECOM_ENCODING_AES_KEY: z.string().min(1, '企业微信 EncodingAESKey 不能为空'),

  // OpenAI 配置
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API Key 不能为空'),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // 讯飞配置
  IFLYTEK_APP_ID: z.string().min(1, '讯飞 APP ID 不能为空'),
  IFLYTEK_API_KEY: z.string().min(1, '讯飞 API Key 不能为空'),
  IFLYTEK_API_SECRET: z.string().min(1, '讯飞 API Secret 不能为空'),
  IFLYTEK_VOICE_NAME: z.string().default('xiaoyan'),

  // 语音识别服务选择
  SPEECH_RECOGNITION_SERVICE: z.enum(['openai', 'iflytek']).default('iflytek'),

  // Redis 配置
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_PREFIX: z.string().default('wecom-kf'),
})

// 验证环境变量
export const validateEnv = () => {
  try {
    const env = envSchema.parse(process.env)
    return env
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n')
      throw new Error(`环境变量验证失败:\n${errors}`)
    }
    throw error
  }
}

// 导出类型
export type Env = z.infer<typeof envSchema>

// 导出已验证的环境变量
export const env = validateEnv()
