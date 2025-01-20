FROM node:18-alpine

# 只安装必要的 FFmpeg 包
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-libs \
    libavcodec-extra

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

# 创建媒体文件目录并设置权限
RUN mkdir -p media && chmod 777 media

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["pnpm", "start:prod"]