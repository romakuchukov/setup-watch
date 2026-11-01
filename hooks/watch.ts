import type { EngineInterface, Register } from 'claude-code'

// kind -> item name -> detail (a version, a tool count)
type Snapshot = Record<string, Record<string, string>>

// Bump when Snapshot's shape changes: an older stored value is then ignored, not misread.
const STORE_KEY = 'snapshot-4'
// MCP servers connect after session.start; listing earlier reports them as removed.
const SETTLE_MS = 15_000
const COMMAND = 'setup-watch'
const USAGE = 'Usage: /setup-watch (status and last report), /setup-watch own on|off'

function commandNames(snapshot: Snapshot): Set<string> {
  return new Set(
    Object.entries(snapshot)
      .filter(([kind]) => kind.endsWith(' commands'))
      .flatMap(([, names]) => Object.keys(names)),
  )
}

export function diff(before: Snapshot, after: Snapshot): string[] {
  const lines: string[] = []
  // A plugin command shadowing a builtin one of the same name (/diff) is listed under either kind
  // from session to session, so a command name present on both sides only moved.
  const afterCommands = commandNames(after)
  const moved = new Set([...commandNames(before)].filter((name) => afterCommands.has(name)))
  for (const kind of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const old = before[kind] ?? {}
    const now = after[kind] ?? {}
    const isMove = (name: string) => kind.endsWith(' commands') && moved.has(name)
    const added = Object.keys(now).filter((name) => !(name in old) && !isMove(name))
    const removed = Object.keys(old).filter((name) => !(name in now) && !isMove(name))
    const changed = Object.keys(now)
      .filter((name) => name in old && old[name] !== now[name])
      .map((name) => `${name} ${old[name]} -> ${now[name]}`)
    if (added.length > 0) lines.push(`+ ${kind}: ${added.join(', ')}`)
    if (removed.length > 0) lines.push(`- ${kind}: ${removed.join(', ')}`)
    if (changed.length > 0) lines.push(`~ ${kind}: ${changed.join(', ')}`)
  }
  return lines
}

// Kinds that only change when you act: your own ~/.claude skills and the MCP servers you added.
const OWN_KINDS = ['user commands', 'MCP servers (yours)']

// Drops what you changed yourself, so the report shows only what changed under you.
export function withoutOwn(before: Snapshot, after: Snapshot): [Snapshot, Snapshot] {
  const oldPlugins = before.plugins ?? {}
  const newPlugins = after.plugins ?? {}
  // Plugins you installed or uninstalled; version bumps of the rest are auto-updates and stay.
  const touched = [...Object.keys(oldPlugins), ...Object.keys(newPlugins)].filter(
    (id) => !(id in oldPlugins) || !(id in newPlugins),
  )
  const touchedNames = new Set(touched.map((id) => id.split('@')[0]))
  const strip = (snapshot: Snapshot): Snapshot => {
    const kept: Snapshot = {}
    for (const [kind, names] of Object.entries(snapshot)) {
      if (OWN_KINDS.includes(kind)) continue
      kept[kind] = Object.fromEntries(
        Object.entries(names).filter(([name, detail]) =>
          kind === 'plugins' ? !touched.includes(name) : !(kind === 'plugin commands' && touchedNames.has(detail)),
        ),
      )
    }
    return kept
  }
  return [strip(before), strip(after)]
}

function add(items: Snapshot, kind: string, name: string, detail: string) {
  items[kind] ??= {}
  items[kind][name] = detail
}

// skill name -> publisher (`Anthropic`, or the source claude.ai reports)
async function readSyncedSkills($: EngineInterface): Promise<Map<string, string>> {
  const skills = new Map<string, string>()
  const syncedDir = `${await $.env.get('HOME')}/.claude/skills/synced`
  if (!(await $.fs.exists(syncedDir))) return skills
  for (const entry of await $.fs.list(syncedDir)) {
    const manifestPath = `${syncedDir}/${entry.name}/manifest.json`
    if (entry.kind !== 'dir' || !(await $.fs.exists(manifestPath))) continue
    const manifest = JSON.parse(await $.fs.read(manifestPath))
    for (const skill of manifest.skills ?? []) {
      const source = String(skill.source ?? 'unknown')
      skills.set(skill.name, source.startsWith('anthropic') ? 'Anthropic' : source)
    }
  }
  return skills
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

  const syncedSkills = await readSyncedSkills($)
  for (const command of await $.command.list()) {
    // claude.ai syncs skills into ~/.claude/skills/synced, and the API labels them `user` like your own.
    const publisher = command.source === 'user' ? syncedSkills.get(command.name) : undefined
    if (publisher !== undefined) add(items, `skills synced from claude.ai (${publisher})`, command.name, '')
    else add(items, `${command.source} commands`, command.name, command.plugin ?? '')
  }

  for (const tool of await $.tool.list()) {
    if (tool.mcp) {
      const server = tool.name.split('__')[1]
      const kind = server.startsWith('plugin_')
        ? 'MCP servers (from plugins)'
        : server.startsWith('claude_ai_')
          ? 'MCP servers (claude.ai connectors)'
          : 'MCP servers (yours)'
      add(items, kind, server, String(Number(items[kind]?.[server] ?? 0) + 1))
    } else add(items, 'builtin tools', tool.name, '')
  }

  return items
}

const TRACK_OWN_KEY = 'track-own'

async function isTrackingOwn($: EngineInterface): Promise<boolean> {
  return (await $.store.get(TRACK_OWN_KEY)) === true
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Show what changed in your setup, or turn tracking of your own changes on or off',
      argumentHint: 'own on|off',
    })
    $.clock.after(SETTLE_MS, async () => {
      const current = await snapshot($)
      const previous = (await $.store.get(STORE_KEY)) as Snapshot | undefined
      await $.store.set(STORE_KEY, current)

      if (previous === undefined) {
        $.ui.log('baseline saved, changes show from the next session')
        return
      }
      // Filtered at report time, so turning the option on or off never shows false changes.
      const changes = (await isTrackingOwn($)) ? diff(previous, current) : diff(...withoutOwn(previous, current))
      await $.store.set('last-report', changes)
      if (changes.length === 0) return
      // A log row is one line: newlines draw as junk, so each change gets its own row.
      $.ui.log('changed since last session:')
      for (const line of changes) $.ui.log(line)
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const [subcommand, value] = e.args.trim().split(/\s+/)
    if (subcommand === 'own' && (value === 'on' || value === 'off')) {
      await $.store.set(TRACK_OWN_KEY, value === 'on')
      return { text: `Tracking your own changes is now ${value}. It applies from the next session's report.` }
    }
    if (subcommand !== undefined && subcommand !== '') return { text: USAGE }

    const report = ((await $.store.get('last-report')) as string[] | undefined) ?? []
    const lines = [
      `Tracking your own changes: ${(await isTrackingOwn($)) ? 'on' : 'off'}`,
      report.length > 0 ? 'Changed at the start of this session:' : 'Nothing changed at the start of this session.',
      ...report,
      USAGE,
    ]
    return { text: lines.join('\n') }
  })
}
