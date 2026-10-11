import { homedir } from 'node:os'
import { join } from 'node:path'

export interface AppConfig {
  port: number
  opencodeUrl: string
  opencodeDataDir: string
  opencodeBin: string
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 8787),
  opencodeUrl: process.env.OPENCODE_SERVER_URL ?? 'http://127.0.0.1:4096',
  opencodeDataDir: process.env.OPENCODE_DATA_DIR ?? join(homedir(), '.local', 'share', 'opencode'),
  opencodeBin: process.env.OPENCODE_BIN ?? 'opencode',
}
