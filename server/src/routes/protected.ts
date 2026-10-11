import { Router } from 'express'
import type { SessionService } from '../services/session-service'

export function protectedRouter(service: SessionService): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json({ data: service.listProtected() })
  })

  router.post('/', (req, res) => {
    const id = req.body?.id
    if (typeof id !== 'string' || !id) {
      res.status(400).json({ error: 'id is required' })
      return
    }
    service.protect(id)
    res.json({ ok: true })
  })

  router.delete('/:id', (req, res) => {
    service.unprotect(req.params.id)
    res.json({ ok: true })
  })

  return router
}
