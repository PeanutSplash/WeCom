// 企业微信接口返回的通用响应格式
export interface WeComResponse {
  errcode: number
  errmsg: string
  [key: string]: any
}

// 消息类型
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VOICE = 'voice',
  VIDEO = 'video',
  FILE = 'file',
  LINK = 'link',
}

// 文本消息
export interface TextMessage {
  msgtype: 'text'
  text: {
    content: string
  }
}

// 图片消息
export interface ImageMessage {
  msgtype: 'image'
  image: {
    media_id: string
  }
}

// 接收消息的通用格式
export interface ReceivedMessage {
  msgid: string
  sender: string
  msgtype: MessageType
  createtime: number
  content?: string
  media_id?: string
}

// 发送消息的通用格式
export interface SendMessage {
  touser: string
  msgtype: MessageType
  [key: string]: any
}
