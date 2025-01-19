import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

export const setupLogger = () => {
  return winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize(),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? '\n' + JSON.stringify(meta, null, 2) : ''
        return `${timestamp} [${level}]: ${message}${metaStr}`
      }),
    ),
    transports: [
      new winston.transports.Console(),
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
      }),
      new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
      }),
    ],
  })
}
