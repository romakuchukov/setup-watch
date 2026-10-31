import type { EngineInterface, Register } from 'claude-code'

// kind -> item name -> detail (a version, a tool count)
type Snapshot = Record<string, Record<string, string>>

// Bump when Snapshot's shape changes: an older stored value is then ignored, not misread.
const STORE_KEY = 'snapshot-2'
// MCP servers connect after session.start; listing earlier reports them as removed.
const SETTLE_MS = 15_000

export function diff(before: Snapshot, after: Snapshot): string[] {
  const lines: string[] = []
  for (const kind of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const old = before[kind] ?? {}
    const now = after[kind] ?? {}
    const added = Object.keys(now).filter((name) => !(name in old))
    const removed = Object.keys(old).filter((name) => !(name in now))
    const changed = Object.keys(now)
      .filter((name) => name in old && old[name] !== now[name])
      .map((name) => `${name} ${old[name]} -> ${now[name]}`)
    if (added.length > 0) lines.push(`+ ${kind}: ${added.join(', ')}`)
    if (removed.length > 0) lines.push(`- ${kind}: ${removed.join(', ')}`)
    if (changed.length > 0) lines.push(`~ ${kind}: ${changed.join(', ')}`)
  }
  return lines
}

function add(items: Snapshot, kind: string, name: string, detail: string) {
  items[kind] ??= {}
  items[kind][name] = detail
}

async function snapshot($: EngineInterface): Promise<Snapshot> {
  const items: Snapshot = {}
  add(items, 'Claude Code', 'version', (await $.session.version()).version)

  const { exitCode, stdout } = await $.process.run(['claude', 'plugin', 'list', '--json'])
  if (exitCode === 0) {
    for (const plugin of JSON.parse(stdout)) {
      add(items, 'plugins', plugin.id, plugin.enabled ? plugin.version : `${plugin.version} (disabled)`)
    }
  }

  for (const command of await $.command.list()) {
    add(items, `${command.source} commands`, command.name, command.plugin ?? '')
  }

  for (const tool of await $.tool.list()) {
    if (tool.mcp) {
      const server = tool.name.split('__')[1]
      const count = Number(items['MCP servers']?.[server] ?? 0) + 1
      add(items, 'MCP servers', server, String(count))
    } else add(items, 'builtin tools', tool.name, '')
  }

  return items
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.clock.after(SETTLE_MS, async () => {
      const current = await snapshot($)
      const previous = (await $.store.get(STORE_KEY)) as Snapshot | undefined
      await $.store.set(STORE_KEY, current)

      if (previous === undefined) {
        $.ui.log('baseline saved, changes show from the next session')
        return
      }
      const changes = diff(previous, current)
      if (changes.length === 0) return
      // A log row is one line: newlines draw as junk, so each change gets its own row.
      $.ui.log('changed since last session:')
      for (const line of changes) $.ui.log(line)
    })

    return next(e)
  })
}
