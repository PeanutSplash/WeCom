import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'

async function copyEnvFile() {
  try {
    // 复制 .env 文件到多个位置以确保能被找到
    if (fs.existsSync('.env')) {
      // 确保目标目录存在
      if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist')
      }

      // 复制到多个位置
      fs.copyFileSync('.env', 'dist/.env')
      console.log('✨ .env 文件已复制到 dist/.env')
    } else {
      console.warn('⚠️ 未找到 .env 文件')
    }
  } catch (error) {
    console.error('复制 .env 文件失败:', error)
  }
}

async function build() {
  try {
    // 清理构建
    await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      minify: true,
      sourcemap: true,
      format: 'cjs',
      outfile: 'dist/index.js',
      treeShaking: true,
      plugins: [],
    })
    console.log('✨ 构建成功')

    // 复制 .env 文件
    await copyEnvFile()
  } catch (error) {
    console.error('构建失败:', error)
    process.exit(1)
  }
}

build()
