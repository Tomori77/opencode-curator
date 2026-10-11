import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from './config'
import { HttpOpencodeClient } from './opencode/http-client'
import { SessionService } from './services/session-service'
import { ProtectedStore } from './store/protected-store'
import { healthRouter } from './routes/health'
import { sessionsRouter } from './routes/sessions'
import { protectedRouter } from './routes/protected'
import { backupsRouter } from './routes/backups'

const projectRoot = resolve(__dirname, '..', '..')
const client = new HttpOpencodeClient(config.opencodeUrl)
const store = new ProtectedStore(resolve(projectRoot, 'data', 'protected.json'))
const sessionService = new SessionService(client, store)

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/health', healthRouter(client, sessionService))
app.use('/api/sessions', sessionsRouter(sessionService))
app.use('/api/protected', protectedRouter(sessionService))
app.use('/api/backups', backupsRouter(sessionService))

const webDist = resolve(projectRoot, 'web', 'dist')
if (existsSync(resolve(webDist, 'index.html'))) {
  app.use(express.static(webDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(resolve(webDist, 'index.html'))
  })
}

app.listen(config.port, () => {
  console.log(`opencode-curator server listening on http://127.0.0.1:${config.port}`)
  console.log(`opencode server: ${config.opencodeUrl}`)
})
