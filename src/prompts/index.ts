export * from '../types/prompt'
export * from './audio'
export * from './chat'

import { audioPrompts } from './audio'
import { chatPrompts } from './chat'

export const prompts = {
  ...audioPrompts,
  ...chatPrompts,
} 