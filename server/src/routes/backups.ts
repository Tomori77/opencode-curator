import { existsSync } from 'node:fs'
import { Router } from 'express'
import type { SessionService } from '../services/session-service'

export function backupsRouter(service: SessionService): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json({ data: service.listBackups() })
  })

  router.get('/:name', (req, res) => {
    let file: string
    try {
      file = service.backupPath(req.params.name)
    } catch (error) {
      res.status(400).json({ error: (error as Error).message })
      return
    }
    if (!existsSync(file)) {
      res.status(404).json({ error: 'not found' })
      return
    }
    res.download(file)
  })

  router.post('/:name/restore', async (req, res) => {
    try {
      service.backupPath(req.params.name)
    } catch (error) {
      res.status(400).json({ error: (error as Error).message })
      return
    }
    try {
      res.json({ data: await service.restoreBackup(req.params.name) })
    } catch (error) {
      if ((error as Error).message === 'not found') {
        res.status(404).json({ error: 'not found' })
        return
      }
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.delete('/:name', async (req, res) => {
    try {
      service.backupPath(req.params.name)
    } catch (error) {
      res.status(400).json({ error: (error as Error).message })
      return
    }
    try {
      await service.deleteBackup(req.params.name)
      res.json({ ok: true })
    } catch (error) {
      if ((error as Error).message === 'not found') {
        res.status(404).json({ error: 'not found' })
        return
      }
      res.status(502).json({ error: (error as Error).message })
    }
  })

  return router
}
