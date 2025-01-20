// 首先加载环境变量
import dotenv from 'dotenv'
import path from 'path'

const envPaths = [
  '.env', // 当前目录
  '../.env', // 上级目录
  path.resolve(__dirname, '.env'), // 相对于 __dirname
  path.resolve(__dirname, '../.env'), // 相对于 __dirname 的上级目录
  path.resolve(process.cwd(), '.env'), // 相对于 process.cwd()
]

// 尝试加载第一个存在的 .env 文件
let envLoaded = false
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath })
  if (!result.error) {
    console.log(`成功加载环境变量文件: ${envPath}`)
    envLoaded = true
    break
  }
}

if (!envLoaded) {
  console.warn('警告: 未能找到 .env 文件')
}

// 验证环境变量
import { env } from './utils/env'
import './utils/logger'
import express from 'express'
import { setupWeComRoutes } from './routes/wecom'
import { setupCallbackRoutes } from './routes/callback'
import { WeComService } from './services/wecom'
import { OpenAIService } from './utils/openai'
import bodyParser from 'body-parser'

const app = express()

// 配置中间件
app.use(bodyParser.text({ type: 'text/xml' }))
app.use(bodyParser.json())

// 初始化服务
const wecomService = new WeComService(env.WECOM_CORPID, env.WECOM_SECRET)
const openAIService = new OpenAIService()

// 注册路由
app.use('/api/wecom', setupWeComRoutes(wecomService))
app.use('/api/wecom', setupCallbackRoutes(wecomService, openAIService))

// 健康检查
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' })
})

// 启动服务器
const port = env.PORT
app.listen(port, () => {
  logger.info(`服务器已启动，监听端口: ${port}`)
})
