# 企业微信客服消息系统

基于 Node.js 和 TypeScript 开发的企业微信客服消息收发系统。本系统专注于处理企业微信客服消息，提供完整的消息处理流程，包括：

- 消息收发与加密解密
- 语音消息自动转换（AMR 转 MP3）
- 客服账号管理
- 消息历史同步
- AI 智能回复（基于 OpenAI）

## 技术栈

- Node.js 18+
- TypeScript 5.3+
- Express 4.18
- FFmpeg (音频转换)
- Winston (日志管理)
- Webpack 5 (构建工具)
- Docker & Docker Compose
- OpenAI API (智能对话)

## 主要功能

- 消息收发
  - 支持文本、图片、语音、视频、文件等多种消息类型
  - 语音消息自动转换（AMR 转 MP3）
  - 消息加密解密
  - AI 智能自动回复
- 客服管理
  - 获取客服列表
  - 客服账号管理
- 历史消息同步
  - 支持增量同步
  - 游标分页
- 安全验证
  - 回调消息签名验证
  - 消息内容加密传输
  - 自动 Token 管理
- AI 对话
  - 基于 OpenAI GPT 模型
  - 智能上下文理解
  - 自然语言处理

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 7+
- FFmpeg (用于语音转换)
- Docker (可选，用于容器化部署)
- OpenAI API Key

### 安装

```bash
# 克隆项目
git clone https://github.com/PeanutSplash/WeCom

# 安装依赖
pnpm install

# 安装 FFmpeg（MacOS）
brew install ffmpeg

# 安装 FFmpeg（Ubuntu/Debian）
apt-get update && apt-get install -y ffmpeg

# 安装 FFmpeg（Windows）
# 1. 从 https://github.com/BtbN/FFmpeg-Builds/releases 下载最新版本
# 2. 解压下载的文件
# 3. 将解压后的 bin 目录添加到系统环境变量 Path 中
# 4. 重启终端验证安装
ffmpeg -version
```

### 配置

1. 复制环境变量模板

```bash
cp .env.example .env
```

2. 配置环境变量

```env
# 企业微信配置
WECOM_CORPID=your_corpid
WECOM_SECRET=your_secret
WECOM_TOKEN=your_token
WECOM_ENCODING_AES_KEY=your_encoding_aes_key

# OpenAI 配置
OPENAI_API_KEY=your_openai_api_key

# 服务配置
PORT=3000
NODE_ENV=development
```

### 开发

```bash
# 开发模式（支持热重载）
pnpm dev

# 代码检查
pnpm lint

# 代码格式化
pnpm lint:fix

# 构建
pnpm build

# 生产环境运行
pnpm start:prod
```

## 项目结构

```
src/
├── index.ts          # 应用入口
├── routes/           # API 路由
│   ├── wecom.ts      # 企业微信相关接口
│   └── callback.ts   # 回调处理接口
├── services/         # 业务逻辑
│   ├── wecom.ts      # 企业微信服务
│   ├── callback.ts   # 回调处理服务
│   └── openai.ts     # OpenAI 服务
├── types/            # TypeScript 类型定义
│   └── wecom.ts      # 企业微信相关类型
├── utils/            # 工具函数
│   ├── audio.ts      # 音频处理
│   ├── wecom.ts      # 企业微信工具
│   └── logger.ts     # 日志工具
└── test/            # 测试文件
    └── api.test.ts   # API 测试
```

## API 接口

### 消息相关

- 发送消息

  - POST `/api/wecom/send`
  - 支持多种消息类型(text/image/voice/video/file/link/miniprogram/msgmenu/location)

- 同步消息
  - POST `/api/wecom/sync/messages`
  - 支持分页和游标
  - 自动处理语音消息转换

### 客服相关

- 获取客服列表

  - GET `/api/wecom/servicer/list`

- 获取客服账号列表
  - GET `/api/wecom/account/list`
  - 支持分页

### 回调接口

- 回调消息处理

  - POST `/api/wecom/callback`
  - 自动解密和验证签名
  - 支持事件消息处理
  - 语音消息自动转换

- 回调配置验证
  - GET `/api/wecom/callback`
  - 用于配置回调 URL 时的验证

## Docker 部署

### 使用 Docker Compose（推荐）

1. 配置 docker-compose.yml

```bash
cp docker-compose.example.yml docker-compose.yml
```

2. 构建并启动服务

```bash
# 构建并启动
pnpm docker:compose:build

# 查看日志
pnpm docker:logs
```

### 手动 Docker 部署

1. 构建镜像

```bash
pnpm docker:build
```

2. 运行容器

```bash
docker run -p 3000:3000 --env-file .env peanutsplash/wecom-kf:latest
```

## 回调配置说明

### 配置步骤

1. 启动服务

```bash
# 开发环境
pnpm dev

# 或生产环境
pnpm start:prod
```

2. 配置企业微信客服回调地址

- 登录企业微信管理后台
- 进入【客服】-【客服管理】-【接收消息设置】
- 设置接收消息服务器配置：
  - URL: `http://your-domain/api/wecom/callback`
  - Token: 填写 .env 中配置的 WECOM_TOKEN
  - EncodingAESKey: 填写 .env 中配置的 WECOM_ENCODING_AES_KEY
  - 点击【保存】并等待验证通过

3. 测试回调接口

```bash
# 测试开发环境
pnpm test:api

# 测试生产环境
pnpm test:api:prod
```

### 回调消息类型

系统支持以下类型的回调消息处理：

- 文本消息
- 图片消息
- 语音消息（自动转换为 MP3）
- 事件消息（进入会话、消息发送失败、消息撤回等）

每个回调消息都会：

1. 验证消息签名
2. 解密消息内容
3. 根据消息类型进行相应处理
4. 返回处理结果

## 常见问题排查

1. 回调验证失败

- 检查 Token 和 EncodingAESKey 配置是否正确
- 确认回调 URL 是否完整且正确
- 查看服务日志中的具体错误信息

2. 收不到回调消息

- 确认服务是否正常运行
- 检查回调配置是否已保存并验证通过
- 查看服务日志是否有接收到请求

3. 消息处理失败

- 检查日志中的错误信息
- 确认消息格式是否符合预期
- 验证相关服务（如语音转换）是否正常运行

## 注意事项

1. 推荐使用 Docker 部署以确保环境一致性
2. 配置足够的存储空间用于媒体文件
3. 正确配置企业微信的回调地址和加密信息
4. 生产环境必须使用 HTTPS
