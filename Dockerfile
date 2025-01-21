# 第一阶段: 构建应用程序
# 使用 Node.js 20 Alpine 作为基础镜像以减小体积
FROM node:20-alpine AS builder

# 设置应用程序工作目录
WORKDIR /app

# 安装构建工具和包管理器
# curl: 用于下载依赖
# xz: 用于解压缩
RUN apk add --no-cache curl xz && \
    npm install -g pnpm

# 优先复制依赖配置文件以利用 Docker 缓存层
COPY package.json pnpm-lock.yaml ./

# 安装项目依赖
RUN pnpm install

# 复制所有源代码并执行构建
COPY . .
RUN pnpm build

# 第二阶段: 生产环境
# 使用轻量级基础镜像
FROM node:20-alpine

WORKDIR /app

# 安装和配置 FFmpeg
# 1. 安装必要工具
# 2. 下载并解压 FFmpeg
# 3. 移动二进制文件到可执行目录
# 4. 设置执行权限
# 5. 清理临时文件
# 6. 验证安装和编解码器支持
RUN apk add --no-cache curl xz && \
    curl -L -o /tmp/ffmpeg-release-amd64-static.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    tar xvf /tmp/ffmpeg-release-amd64-static.tar.xz -C /tmp && \
    mv /tmp/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ && \
    mv /tmp/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ && \
    chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe && \
    rm -rf /tmp/ffmpeg-* /tmp/ffmpeg-release-amd64-static.tar.xz && \
    ffmpeg -version && ffmpeg -codecs | grep amr

# 从构建阶段复制编译产物和运行依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 创建并设置媒体文件存储目录权限
RUN mkdir -p media && chmod 777 media

# 声明容器运行时监听的端口
EXPOSE 3000

# 指定容器启动命令
CMD ["node", "dist/index.js"]