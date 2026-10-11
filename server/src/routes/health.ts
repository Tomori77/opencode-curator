import { Router } from 'express'
import type { OpencodeClient } from '../opencode/client'
import type { SessionService } from '../services/session-service'

export function healthRouter(client: OpencodeClient, service: SessionService): Router {
  const router = Router()

  router.get('/', async (_req, res) => {
    const opencode = await client.getHealth()
    res.json({ ok: opencode.reachable, service: 'opencode-curator', opencode })
  })

  router.get('/report', async (req, res) => {
    try {
      const staleDays = req.query.staleDays != null ? Number(req.query.staleDays) : 90
      res.json(await service.healthReport({ staleDays }))
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  return router
}
