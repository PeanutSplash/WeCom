# 企业微信客服消息系统

基于 Node.js 和 TypeScript 开发的企业微信客服消息收发系统。本系统提供了完整的企业微信客服消息处理能力,包括消息收发、客服管理、历史消息同步等功能。

## 主要功能

- 消息收发
  - 支持文本、图片、语音、视频、文件等多种消息类型
  - 自动回复和消息处理
  - 消息加密解密
- 客服管理
  - 获取客服列表
  - 客服账号管理
- 历史消息同步
- 安全验证
  - 回调消息签名验证
  - 消息内容加密传输

## 技术栈

- Node.js 16+
- TypeScript 5.3+
- Express 4.18
- Winston (日志管理)
- Axios (HTTP 请求)
- Docker (容器化部署)

## 快速开始

### 环境要求

- Node.js 16+
- pnpm 7+
- Docker (可选,用于容器化部署)

### 安装

```bash
# 克隆项目
git clone [项目地址]

# 安装依赖
pnpm install
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

# 服务配置
PORT=3000
NODE_ENV=development
```

### 开发

```bash
# 启动开发服务
pnpm dev

# 代码检查
pnpm lint

# 代码格式化
pnpm lint:fix
```

### 构建和部署

```bash
# 构建
pnpm build

# 生产环境运行
pnpm start:prod

# Docker 构建
pnpm docker:build

# Docker 运行
pnpm docker:run
```

## API 接口

### 消息相关

- 发送消息
  - POST `/api/wecom/send`
  - 支持多种消息类型(text/image/voice/video/file/link/miniprogram)

- 同步消息
  - POST `/api/wecom/sync/messages`
  - 支持分页和游标

### 客服相关

- 获取客服列表
  - GET `/api/wecom/servicer/list`

- 获取客服账号列表
  - GET `/api/wecom/account/list`
  - 支持分页

### 回调接口

- 回调消息处理
  - POST `/api/wecom/callback`
  - 处理企业微信推送的消息和事件

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
├── types/            # TypeScript 类型定义
├── utils/            # 工具函数
└── test/            # 测试文件
```

### 消息处理流程

1. 接收企业微信推送的加密消息
2. 验证消息签名
3. 解密消息内容
4. 根据消息类型分发处理
5. 返回处理结果

## 部署说明

### 普通部署

1. 构建项目
```bash
pnpm build:prod
```

2. 运行服务
```bash
pnpm start:prod
```

### Docker 部署

1. 构建镜像
```bash
pnpm docker:build
```

2. 运行容器
```bash
pnpm docker:compose:build
```