import { PromptConfig } from '../types/prompt'

export const audioPrompts: PromptConfig = {
  transcription: {
    name: 'audio_transcription',
    description: '音频转文字的基础 prompt',
    content: '请将音频内容转换为清晰的文字。要求:1)忽略背景噪音、语气词和口头禅;2)准确识别并保留所有专业术语和技术词汇;3)根据说话人的语气和停顿合理分段;4)保持语言表达的流畅性和逻辑性;5)如遇到英文单词和数字,保持原有形式不翻译'
  }
} 