import express from 'express'
import dotenv from 'dotenv'
import { setupLogger } from './utils/logger'
import { wecomRouter } from './routes/wecom'

// 加载环境变量
dotenv.config()

// 初始化日志
const logger = setupLogger()

const app = express()
const port = process.env.PORT || 3000

// 中间件
app.use(express.json())

// 路由
app.use('/api/wecom', wecomRouter)

// 健康检查
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' })
})

// 启动服务器
app.listen(port, () => {
  logger.info(`服务器运行在 http://localhost:${port}`)
})
