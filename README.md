# 企业微信客服消息系统

基于 Node.js 和 TypeScript 开发的企业微信客服消息收发系统。

## 功能特性

- 发送客服消息
- 获取客服列表
- 同步历史消息
- 支持多种消息类型（文本、图片、语音、视频、文件、链接）

## 技术栈

- Node.js
- TypeScript
- Express
- Winston (日志)
- Axios (HTTP 请求)
- dotenv (环境变量)

## 开始使用

### 环境要求

- Node.js 16+
- pnpm 7+

### 安装

```bash
# 安装依赖
pnpm install
```

### 配置

1. 复制环境变量模板文件
```bash
cp .env.example .env
```

2. 修改 `.env` 文件，填入企业微信配置信息
```env
WECOM_CORPID=your_corpid
WECOM_SECRET=your_secret
WECOM_TOKEN=your_token
WECOM_ENCODING_AES_KEY=your_encoding_aes_key
```

### 开发

```bash
# 启动开发服务器
pnpm dev
```

### 构建和运行

```bash
# 构建
pnpm build

# 运行
pnpm start
```

## API 接口

### 发送消息
- POST `/api/wecom/send`

### 获取客服列表
- GET `/api/wecom/servicers`

### 同步消息
- POST `/api/wecom/sync`

## 许可证

ISC 