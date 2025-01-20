export type PromptTemplate = {
  name: string
  content: string
  description?: string
}

export type PromptConfig = {
  [key: string]: PromptTemplate
} 