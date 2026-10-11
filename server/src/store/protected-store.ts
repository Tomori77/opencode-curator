import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

interface ProtectedData {
  ids: string[]
}

export class ProtectedStore {
  private ids: string[]

  constructor(private readonly filePath: string) {
    this.ids = this.read()
  }

  list(): string[] {
    return [...this.ids]
  }

  has(id: string): boolean {
    return this.ids.includes(id)
  }

  add(id: string): void {
    if (this.ids.includes(id)) return
    this.ids.push(id)
    this.write()
  }

  remove(id: string): void {
    const next = this.ids.filter((value) => value !== id)
    if (next.length === this.ids.length) return
    this.ids = next
    this.write()
  }

  private read(): string[] {
    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as ProtectedData
      return Array.isArray(parsed.ids) ? parsed.ids.filter((id) => typeof id === 'string') : []
    } catch {
      return []
    }
  }

  private write(): void {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(this.filePath, JSON.stringify({ ids: this.ids }, null, 2))
  }
}
