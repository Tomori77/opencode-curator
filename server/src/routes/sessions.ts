import { Router } from 'express'
import { SessionGoneError, SessionProtectedError } from '../services/session-service'
import type { SessionService } from '../services/session-service'
import type { MessageQuery, SessionQuery, TreeQuery } from '../opencode/types'

const ARCHIVED_VALUES = ['false', 'true', 'all'] as const
const SORT_VALUES = ['updated', 'created', 'cost', 'tokens', 'title', 'directory'] as const
const ORDER_VALUES = ['asc', 'desc'] as const

function parseQuery(query: Record<string, unknown>): SessionQuery {
  const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined => {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : undefined
  }
  const q: SessionQuery = {
    search: typeof query.search === 'string' ? query.search : undefined,
    directory: typeof query.directory === 'string' ? query.directory : undefined,
    projectId: typeof query.projectId === 'string' ? query.projectId : undefined,
    roots: query.roots === 'true' ? true : undefined,
    archived: pick(query.archived, ARCHIVED_VALUES),
    sort: pick(query.sort, SORT_VALUES),
    order: pick(query.order, ORDER_VALUES),
    page: query.page != null ? Number(query.page) : undefined,
    pageSize: query.pageSize != null ? Number(query.pageSize) : undefined,
  }
  return q
}

export function sessionsRouter(service: SessionService): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    try {
      res.json(await service.query(parseQuery(req.query)))
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.get('/facets', async (_req, res) => {
    try {
      res.json(await service.facets())
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.get('/stats', async (_req, res) => {
    try {
      res.json(await service.stats())
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.get('/tree', async (req, res) => {
    try {
      const value = req.query.archived
      const q: TreeQuery = {
        archived:
          typeof value === 'string' && (ARCHIVED_VALUES as readonly string[]).includes(value)
            ? (value as TreeQuery['archived'])
            : 'false',
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      }
      res.json({ data: await service.tree(q) })
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.post('/bulk-delete', async (req, res) => {
    try {
      const ids = req.body?.ids
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids must be a non-empty array' })
        return
      }
      const force = req.body?.force === true
      const backup = req.body?.backup === true
      res.json({ data: await service.bulkDelete(ids, { force, backup }) })
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.get('/:id/messages', async (req, res) => {
    try {
      const messages: MessageQuery = {
        limit: req.query.limit != null ? Number(req.query.limit) : undefined,
        before: typeof req.query.before === 'string' ? req.query.before : undefined,
      }
      res.json({ data: await service.messages(req.params.id, messages) })
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.get('/:id/todos', async (req, res) => {
    try {
      res.json({ data: await service.todos(req.params.id) })
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.get('/:id/children', async (req, res) => {
    try {
      res.json({ data: await service.children(req.params.id) })
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.get('/:id/impact', async (req, res) => {
    try {
      res.json({ data: await service.impact(req.params.id) })
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.get('/:id/export', async (req, res) => {
    try {
      const bundle = await service.exportBundle(req.params.id)
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.json"`)
      res.json(bundle)
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.post('/:id/backup', async (req, res) => {
    try {
      res.json({ data: await service.backup(req.params.id) })
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.get('/:id', async (req, res) => {
    try {
      res.json(await service.get(req.params.id))
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.patch('/:id', async (req, res) => {
    try {
      res.json(await service.update(req.params.id, req.body))
    } catch (error) {
      res.status(502).json({ error: (error as Error).message })
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      const force = req.query.force === 'true'
      await service.delete(req.params.id, force)
      res.json({ ok: true })
    } catch (error) {
      if (error instanceof SessionProtectedError) {
        res.status(409).json({ error: 'protected', protected: true })
        return
      }
      if (error instanceof SessionGoneError) {
        res.status(404).json({
          error: 'not_found',
          message: '会话不存在（可能已被删除或属于其它存储）',
        })
        return
      }
      res.status(502).json({ error: (error as Error).message })
    }
  })

  return router
}
