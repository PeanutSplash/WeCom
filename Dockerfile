FROM node:18-alpine

# 安装 ffmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["pnpm", "start:prod"] 