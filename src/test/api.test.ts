import axios from 'axios'
import { SendMessage, WeComResponse, MessageType } from '../types/wecom'

const BASE_URL = process.env.NODE_ENV === 'production' ? 'http://47.76.201.205:3002/api/wecom' : 'http://localhost:3000/api/wecom'

// 测试发送文本消息
const testSendTextMessage = async () => {
  console.log('发送文本消息请求开始...')
  try {
    const message: SendMessage = {
      touser: 'external_user_id', // 替换为实际的外部联系人ID
      open_kfid: 'open_kfid', // 替换为实际的客服帐号ID
      msgtype: MessageType.TEXT,
      text: {
        content: '这是一条测试消息',
      },
    }
    await sendMessage(message, '文本消息')
  } catch (error) {
    handleError('发送文本消息失败', error)
  }
}

// 测试发送图片消息
const testSendImageMessage = async () => {
  console.log('发送图片消息请求开始...')
  try {
    const message: SendMessage = {
      touser: 'external_user_id',
      open_kfid: 'open_kfid',
      msgtype: MessageType.IMAGE,
      image: {
        media_id: 'MEDIA_ID', // 替换为实际的媒体文件ID
      },
    }
    await sendMessage(message, '图片消息')
  } catch (error) {
    handleError('发送图片消息失败', error)
  }
}

// 测试发送语音消息
const testSendVoiceMessage = async () => {
  console.log('发送语音消息请求开始...')
  try {
    const message: SendMessage = {
      touser: 'external_user_id',
      open_kfid: 'open_kfid',
      msgtype: MessageType.VOICE,
      voice: {
        media_id: 'MEDIA_ID',
      },
    }
    await sendMessage(message, '语音消息')
  } catch (error) {
    handleError('发送语音消息失败', error)
  }
}

// 测试发送视频消息
const testSendVideoMessage = async () => {
  console.log('发送视频消息请求开始...')
  try {
    const message: SendMessage = {
      touser: 'external_user_id',
      open_kfid: 'open_kfid',
      msgtype: MessageType.VIDEO,
      video: {
        media_id: 'MEDIA_ID',
      },
    }
    await sendMessage(message, '视频消息')
  } catch (error) {
    handleError('发送视频消息失败', error)
  }
}

// 测试发送文件消息
const testSendFileMessage = async () => {
  console.log('发送文件消息请求开始...')
  try {
    const message: SendMessage = {
      touser: 'external_user_id',
      open_kfid: 'open_kfid',
      msgtype: MessageType.FILE,
      file: {
        media_id: 'MEDIA_ID',
      },
    }
    await sendMessage(message, '文件消息')
  } catch (error) {
    handleError('发送文件消息失败', error)
  }
}

// 测试发送图文链接消息
const testSendLinkMessage = async () => {
  console.log('发送图文链接消息请求开始...')
  try {
    const message: SendMessage = {
      touser: 'external_user_id',
      open_kfid: 'open_kfid',
      msgtype: MessageType.LINK,
      link: {
        title: '测试链接消息',
        desc: '这是一条测试的图文链接消息',
        url: 'https://work.weixin.qq.com',
        thumb_media_id: 'MEDIA_ID',
      },
    }
    await sendMessage(message, '图文链接消息')
  } catch (error) {
    handleError('发送图文链接消息失败', error)
  }
}

// 测试发送小程序消息
const testSendMiniprogramMessage = async () => {
  console.log('发送小程序消息请求开始...')
  try {
    const message: SendMessage = {
      touser: 'external_user_id',
      open_kfid: 'open_kfid',
      msgtype: MessageType.MINIPROGRAM,
      miniprogram: {
        appid: 'wx1234567890',
        title: '测试小程序',
        thumb_media_id: 'MEDIA_ID',
        pagepath: 'pages/index.html',
      },
    }
    await sendMessage(message, '小程序消息')
  } catch (error) {
    handleError('发送小程序消息失败', error)
  }
}

// 测试发送菜单消息
const testSendMenuMessage = async () => {
  console.log('发送菜单消息请求开始...')
  try {
    const message: SendMessage = {
      touser: 'external_user_id',
      open_kfid: 'open_kfid',
      msgtype: MessageType.MSGMENU,
      msgmenu: {
        head_content: '请选择以下选项：',
        list: [
          {
            type: 'click',
            click: {
              id: '101',
              content: '满意',
            },
          },
          {
            type: 'view',
            view: {
              url: 'https://work.weixin.qq.com',
              content: '更多信息',
            },
          },
        ],
        tail_content: '感谢您的反馈',
      },
    }
    await sendMessage(message, '菜单消息')
  } catch (error) {
    handleError('发送菜单消息失败', error)
  }
}

// 测试发送地理位置消息
const testSendLocationMessage = async () => {
  console.log('发送地理位置消息请求开始...')
  try {
    const message: SendMessage = {
      touser: 'external_user_id',
      open_kfid: 'open_kfid',
      msgtype: MessageType.LOCATION,
      location: {
        name: '测试位置',
        address: '北京市海淀区',
        latitude: 39.9,
        longitude: 116.3,
      },
    }
    await sendMessage(message, '地理位置消息')
  } catch (error) {
    handleError('发送地理位置消息失败', error)
  }
}

// 测试回调接口的URL验证
const testCallbackUrlVerification = async () => {
  console.log('测试回调接口URL验证开始...')
  try {
    const params = {
      msg_signature: '1d3360d7e5315146f9ff4e2eb67b42326cc63e91',
      timestamp: '1737264078',
      nonce: 'alt3g3idhpe',
      echostr: '6eVgp4/kHcH+H2VmNKoUw4OIcG10/SBQeMTFd80lh1+Q0eAxXhUEJiOJjHpTLtcS+nYt/z0QQ5Pym0yvjQ2m7A==',
    }

    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')

    const response = await axios.get<string>(`${BASE_URL}/callback?${queryString}`)
    console.log('回调接口URL验证响应：')
    console.log(response.data)
  } catch (error) {
    handleError('回调接口URL验证失败', error)
  }
}

// 通用发送消息函数
const sendMessage = async (message: SendMessage, type: string) => {
  console.log(`发送${type}消息：`)
  console.log(JSON.stringify(message, null, 2))
  const response = await axios.post<WeComResponse>(`${BASE_URL}/send`, message)
  console.log(`${type}消息响应：`)
  console.log(JSON.stringify(response.data, null, 2))
  return response
}

// 通用错误处理函数
const handleError = (message: string, error: any) => {
  console.error(message + ':')
  if (error.response) {
    console.error(JSON.stringify(error.response.data, null, 2))
  } else if (error.request) {
    console.error('请求发送失败:', error.message)
  } else {
    console.error('错误信息:', error.message)
  }
}

// 测试获取客服列表
const testGetServicers = async () => {
  console.log('获取客服列表：')
  try {
    const response = await axios.get<WeComResponse>(`${BASE_URL}/servicers`)
    console.log(JSON.stringify(response.data, null, 2))
  } catch (error) {
    handleError('获取客服列表失败', error)
  }
}

// 测试获取客服账号列表
const testGetAccounts = async () => {
  console.log('获取客服账号列表：')
  try {
    const params = {
      offset: 0,
      limit: 100,
    }
    const response = await axios.get<WeComResponse>(`${BASE_URL}/accounts`, { params })
    console.log(JSON.stringify(response.data, null, 2))
  } catch (error) {
    handleError('获取客服账号列表失败', error)
  }
}

// 测试同步消息
const testSyncMessages = async () => {
  console.log('同步消息：')
  try {
    const params = {
      cursor: '',
      token: '',
      limit: 100,
    }
    const response = await axios.post<WeComResponse>(`${BASE_URL}/sync`, params)
    console.log(JSON.stringify(response.data, null, 2))
  } catch (error) {
    handleError('同步消息失败', error)
  }
}

// 运行测试
const runTests = async () => {
  console.log('=== 开始测试 ===')
  console.log('BASE_URL:', BASE_URL)
  console.log('当前时间:', new Date().toISOString())

  // 消息发送测试
  //   console.log('\n1. 测试发送文本消息')
  //   await testSendTextMessage()

  //   console.log('\n2. 测试发送图片消息')
  //   await testSendImageMessage()

  //   console.log('\n3. 测试发送语音消息')
  //   await testSendVoiceMessage()

  //   console.log('\n4. 测试发送视频消息')
  //   await testSendVideoMessage()

  //   console.log('\n5. 测试发送文件消息')
  //   await testSendFileMessage()

  //   console.log('\n6. 测试发送图文链接消息')
  //   await testSendLinkMessage()

  //   console.log('\n7. 测试发送小程序消息')
  //   await testSendMiniprogramMessage()

  //   console.log('\n8. 测试发送菜单消息')
  //   await testSendMenuMessage()

  //   console.log('\n9. 测试发送地理位置消息')
  //   await testSendLocationMessage()

  //   console.log('\n10. 测试获取客服列表')
  //   await testGetServicers()

  //   console.log('\n11. 测试获取客服账号列表')
  //   await testGetAccounts()

  //   console.log('\n12. 测试同步消息')
  //   await testSyncMessages()

  console.log('\n13. 测试回调接口URL验证')
  await testCallbackUrlVerification()

  console.log('\n=== 测试完成 ===')
  console.log('完成时间:', new Date().toISOString())
}

// 执行测试
runTests()
