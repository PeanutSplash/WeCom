// 首先加载环境变量
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// 尝试多个可能的 .env 文件位置
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
    // 输出所有环境变量（排除敏感信息）
    const safeEnvVars = Object.fromEntries(
      Object.entries(process.env)
        .filter(([key]) => !key.toLowerCase().includes('secret') && !key.toLowerCase().includes('password'))
        .map(([key, value]) => [key, value?.substring(0, 50) + (value && value.length > 50 ? '...' : '')]),
    )
    console.log('已加载的环境变量:', JSON.stringify(safeEnvVars, null, 2))
    envLoaded = true
    break
  }
}

if (!envLoaded) {
  console.warn('警告: 未能找到 .env 文件')
}

import express from 'express'
import { setupWeComRoutes } from './routes/wecom'
import { setupCallbackRoutes } from './routes/callback'
import { WeComService } from './services/wecom'
import { CallbackService } from './services/callback'
import { setupLogger } from './utils/logger'
import bodyParser from 'body-parser'

const app = express()
const logger = setupLogger()

// 配置中间件
app.use(bodyParser.text({ type: 'text/xml' }))
app.use(bodyParser.json())

// 初始化服务
const wecomService = new WeComService(process.env.WECOM_CORPID!, process.env.WECOM_SECRET!)
const callbackService = new CallbackService(wecomService)

// 注册路由
app.use('/api/wecom', setupWeComRoutes(wecomService))
app.use('/api/wecom', setupCallbackRoutes(callbackService))

// 健康检查
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' })
})

// 启动服务器
const port = process.env.PORT || 3000
app.listen(port, () => {
  logger.info(`服务器已启动，监听端口: ${port}`)
})
