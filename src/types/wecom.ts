// 企业微信接口返回的通用响应格式
export interface WeComResponse {
  errcode: number
  errmsg: string
  access_token?: string
  expires_in?: number
  msgid?: string
  media_id?: string
  next_cursor?: string
  has_more?: boolean
  msg_list?: Array<{
    msgid: string
    send_time: number
    origin: number
    msg_type: string
    content: unknown
  }>
  servicer_list?: Array<{
    userid: string
    status: number
    external_userid?: string
  }>
  account_list?: Array<{
    open_kfid: string
    name: string
    avatar: string
  }>
}

// 消息类型
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VOICE = 'voice',
  VIDEO = 'video',
  FILE = 'file',
  LINK = 'link',
  MINIPROGRAM = 'miniprogram',
  MSGMENU = 'msgmenu',
  LOCATION = 'location',
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
  open_kfid: string
  msgid?: string
  msgtype: MessageType
  text?: TextMessage['text']
  image?: ImageMessage['image']
  voice?: VoiceMessage['voice']
  video?: VideoMessage['video']
  file?: FileMessage['file']
  link?: LinkMessage['link']
  miniprogram?: MiniprogramMessage['miniprogram']
  msgmenu?: MenuMessage['msgmenu']
  location?: LocationMessage['location']
}

// 语音消息
export interface VoiceMessage {
  msgtype: 'voice'
  voice: {
    media_id: string
  }
}

// 视频消息
export interface VideoMessage {
  msgtype: 'video'
  video: {
    media_id: string
  }
}

// 文件消息
export interface FileMessage {
  msgtype: 'file'
  file: {
    media_id: string
  }
}

// 图文链接消息
export interface LinkMessage {
  msgtype: 'link'
  link: {
    title: string
    desc?: string
    url: string
    thumb_media_id: string
  }
}

// 小程序消息
export interface MiniprogramMessage {
  msgtype: 'miniprogram'
  miniprogram: {
    appid: string
    title?: string
    thumb_media_id: string
    pagepath: string
  }
}

// 菜单消息项
export interface MenuClickItem {
  type: 'click'
  click: {
    id: string
    content: string
  }
}

export interface MenuViewItem {
  type: 'view'
  view: {
    url: string
    content: string
  }
}

export interface MenuMiniprogramItem {
  type: 'miniprogram'
  miniprogram: {
    appid: string
    pagepath: string
    content: string
  }
}

// 菜单消息
export interface MenuMessage {
  msgtype: 'msgmenu'
  msgmenu: {
    head_content?: string
    list: Array<MenuClickItem | MenuViewItem | MenuMiniprogramItem>
    tail_content?: string
  }
}

// 地理位置消息
export interface LocationMessage {
  msgtype: 'location'
  location: {
    name?: string
    address?: string
    latitude: number
    longitude: number
  }
}

// 回调消息基础结构
export interface WeComCallbackMessage {
  ToUserName: string
  FromUserName: string
  CreateTime: number
  MsgType: string
  Event?: string
  Token?: string
  OpenKfId?: string
}

// 回调消息类型
export interface WeComCallbackTextMessage extends WeComCallbackMessage {
  MsgType: 'text'
  text: {
    content: string
    menu_id?: string
  }
}

export interface WeComCallbackImageMessage extends WeComCallbackMessage {
  MsgType: 'image'
  image: {
    media_id: string
  }
}

export interface WeComCallbackVoiceMessage extends WeComCallbackMessage {
  MsgType: 'voice'
  voice: {
    media_id: string
  }
}

// 事件类型
export interface WeComCallbackEventMessage extends WeComCallbackMessage {
  MsgType: 'event'
  Event: 'kf_msg_or_event' | 'enter_session' | 'msg_send_fail' | 'user_recall_msg'
  event: {
    event_type: string
    open_kfid: string
    external_userid?: string
    scene?: string
    scene_param?: string
    welcome_code?: string
    fail_msgid?: string
    fail_type?: number
    recall_msgid?: string
    wechat_channels?: {
      nickname?: string
      shop_nickname?: string
      scene?: number
    }
  }
}

// 更新 WeComCallbackMessageType 联合类型
export type WeComCallbackMessageType = WeComCallbackTextMessage | WeComCallbackImageMessage | WeComCallbackVoiceMessage | WeComCallbackEventMessage

// 回调消息处理结果
export interface WeComCallbackResult {
  success: boolean
  message?: string
  data?: any
}
