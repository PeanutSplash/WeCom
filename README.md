# 企业微信客服消息系统

基于 Node.js 和 TypeScript 开发的企业微信客服消息收发系统。本系统提供了完整的企业微信客服消息处理能力，包括消息收发、语音转换、客服管理、历史消息同步等功能。

## 主要功能
## 主要功能

- 消息收发
  - 支持文本、图片、语音、视频、文件等多种消息类型
  - 语音消息自动转换（AMR 转 MP3）
  - 消息加密解密
  - 自动回复
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

## 技术栈

- Node.js 16+
- TypeScript 5.3+
- Express 4.18
- FFmpeg (语音转换)
- Winston (日志管理)
- Axios (HTTP 请求)
- Docker (容器化部署)
- Docker (容器化部署)

## 快速开始
## 快速开始

### 环境要求

- Node.js 16+
- pnpm 7+
- FFmpeg (用于语音转换)
- Docker (可选，用于容器化部署)

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
# 1. 下载 FFmpeg
# 从 https://github.com/BtbN/FFmpeg-Builds/releases 下载最新版本
# 2. 解压下载的文件
# 3. 将解压后的 bin 目录添加到系统环境变量 Path 中
# 4. 重启终端验证安装
ffmpeg -version
```

### 配置

1. 复制环境变量模板
1. 复制环境变量模板
```bash
cp .env.example .env
```

2. 配置环境变量
2. 配置环境变量
```env
# 企业微信配置
# 企业微信配置
WECOM_CORPID=your_corpid
WECOM_SECRET=your_secret
WECOM_TOKEN=your_token
WECOM_ENCODING_AES_KEY=your_encoding_aes_key

# 服务配置
PORT=3000
NODE_ENV=development

# 服务配置
PORT=3000
NODE_ENV=development
```

### 开发

```bash
# 启动开发服务（支持热重载）
pnpm dev

# 代码检查
pnpm lint

# 代码格式化
pnpm lint:fix

# 代码检查
pnpm lint

# 代码格式化
pnpm lint:fix
```

### 构建和部署
### 构建和部署

```bash
# 构建
pnpm build:prod

# 生产环境运行
pnpm start:prod

# Docker 构建和运行
pnpm docker:compose:build
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
  - 用于配置回调URL时的验证

## 开发指南

### 项目结构

```
src/
├── index.ts          # 应用入口
├── routes/           # 路由定义
├── services/         # 业务逻辑
│   ├── wecom.ts      # 企业微信服务
│   └── callback.ts   # 回调处理服务
├── types/            # TypeScript 类型定义
├── utils/            # 工具函数
│   ├── audio.ts      # 音频处理
│   ├── wecom.ts      # 企业微信工具
│   └── logger.ts     # 日志工具
└── test/            # 测试文件
```

### 消息处理流程

1. 接收企业微信推送的加密消息
2. 验证消息签名
3. 解密消息内容
4. 根据消息类型分发处理
   - 文本消息：直接处理
   - 语音消息：下载并转换为MP3
   - 其他消息：按类型处理
5. 返回处理结果

## 部署说明

### Docker 部署（推荐）

推荐使用 Docker 进行部署，这样可以确保运行环境的一致性和简化部署流程。

1. 确保已安装 Docker 和 Docker Compose

2. 克隆项目并进入项目目录
```bash
git clone https://github.com/PeanutSplash/WeCom
cd WeCom
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的配置信息
```

4. 使用 Docker Compose 构建和运行
```bash
# 构建并启动服务
docker compose up -d

# 查看服务日志
docker compose logs -f

# 停止服务
docker compose down
```

### 传统部署（不推荐）

如果无法使用 Docker，也可以采用传统部署方式：

1. 安装依赖并构建
```bash
pnpm install
pnpm build:prod
```

2. 运行服务
```bash
pnpm start:prod
```

## 注意事项

1. 推荐使用 Docker 部署以确保环境一致性
2. 配置足够的存储空间用于媒体文件
3. 正确配置企业微信的回调地址和加密信息
4. 生产环境必须使用 HTTPS
