import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

// 修改自定义格式
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let logMessage = `[${timestamp} ${level}] ${message}`

  // 如果有额外的元数据，将其添加到日志消息中
  if (Object.keys(metadata).length > 0) {
    logMessage += ` ${JSON.stringify(metadata)}`
  }

  return logMessage
})

// 创建全局的 logger 实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    customFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), customFormat),
    }),
    // 添加每日轮转日志文件传输
    new DailyRotateFile({
      dirname: 'logs', // 日志文件存放目录
      filename: 'application-%DATE%.log', // 日志文件名格式
      datePattern: 'YYYY-MM-DD', // 日期格式
      zippedArchive: true, // 是否压缩归档
      maxSize: '20m', // 每个文件最大尺寸
      maxFiles: '14d', // 保留14天的日志文件
      format: customFormat,
    }),
  ],
})

// 声明全局类型
declare global {
  var logger: winston.Logger
}

// 设置全局变量
global.logger = logger

// 导出单例 logger 实例
export default logger
