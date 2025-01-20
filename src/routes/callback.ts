import { Router } from 'express'
import { OpenAIService } from '../utils/openai'
import { CallbackController } from '../controllers/callback.controller'

export const setupCallbackRoutes = (wecomService: any, openAIService: OpenAIService) => {
  const router = Router()
  const callbackController = new CallbackController(wecomService, openAIService)

  router.get('/callback', (req, res) => callbackController.handleGetCallback(req, res))
  router.post('/callback', (req, res) => callbackController.handlePostCallback(req, res))

  return router
}
