export type KnowledgeItem = {
  // 问题关键词或正则表达式
  pattern: string | RegExp
  // 是否使用正则表达式匹配
  isRegex?: boolean
  // 回答内容
  response?: string
  // 可选的描述信息
  description?: string
  // 缓存的语音媒体ID
  voiceMediaId?: string
  // 语音媒体ID的过期时间（企业微信媒体文件3天过期）
  voiceMediaExpireTime?: number
  // 链接消息配置
  link?: {
    title: string
    desc?: string
    url: string
    // 本地图片路径（相对于项目根目录）
    imagePath: string
    // 缓存的图片媒体ID
    thumbMediaId?: string
    // 图片媒体ID的过期时间
    thumbMediaExpireTime?: number
  }
}

export type KnowledgeBase = {
  items: KnowledgeItem[]
}
