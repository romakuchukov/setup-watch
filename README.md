# setup-watch: a Claude Code plugin that tracks new skills, MCP servers and tools in your context window

**setup-watch** is a free, open source [Claude Code](https://docs.claude.com/en/docs/claude-code) plugin (also called a Claude Code mod or extension). At the start of every session it tells you which **skills, slash commands, MCP servers, plugins and built-in tools** were added, removed or updated since your last session. Use it to catch context window bloat early and keep your token usage down.

- No setup. Install it and it runs.
- No model calls. It costs **zero tokens**.
- Silent when nothing changed.

## Why track Claude Code changes?

Every skill, tool and MCP server you have loaded is listed in the **context window** of every Claude Code session, whether you use it or not. Claude Code updates, plugin updates and marketplace syncs add new ones silently. Over time:

- your free context shrinks and **auto-compact** kicks in sooner
- each request sends more tokens, so responses get **slower and more expensive**
- nothing tells you why

The `/context` command shows what is loaded right now, but not what is **new**. setup-watch fills that gap. Once you know what changed, you can disable what you don't use with `/plugin` and `/mcp` before it piles up.

## Example output

Fifteen seconds into a session, after a Claude Code update:

```
setup-watch: changed since last session:
setup-watch: ~ Claude Code: version 2.1.314 -> 2.1.316
setup-watch: + builtin commands: design, slides, verify
setup-watch: + plugins: foo@bar
setup-watch: ~ MCP servers: headroom 3 -> 5
setup-watch: - user commands: old-skill
```

`+` added, `-` removed, `~` changed. MCP server numbers are tool counts.

## What it tracks

| What | Detects |
| --- | --- |
| Claude Code version | CLI updates that ship new built-in skills and tools |
| Installed plugins | new, removed, updated, enabled or disabled plugins |
| MCP servers | new or removed servers, and changes in each server's tool count |
| Skills and slash commands | built-in, plugin, MCP and your own `~/.claude` skills and commands |
| Built-in tools | new or removed tools such as `WebSearch` or `Monitor` |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install setup-watch --marketplace romakuchukov/setup-watch
```

From a shell:

```
claude plugin install setup-watch --marketplace romakuchukov/setup-watch
```

Answer `y` to add the marketplace, then pick a scope (user scope covers all your projects).

In the Claude desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `romakuchukov/setup-watch`, then **Add plugin**.

Your first session saves a baseline. Changes show from the next session on.

## FAQ

### How do I see what's using my Claude Code context window?

Run `/context` for a breakdown by category, and `/context all` to list every skill and tool. setup-watch adds the missing piece: what changed since your last session.

### How do I disable a skill, plugin or MCP server I don't need?

Use `/plugin` to disable or uninstall plugins, which also removes their skills. Use `/mcp` to disable MCP servers.

### Does setup-watch use tokens or send data anywhere?

No. It reads Claude Code's own lists of commands, tools and plugins locally, and stores one snapshot in the plugin's local store. It never calls the model or the network.

### Why does it wait 15 seconds?

MCP servers connect in the background after a session starts. Taking the snapshot sooner would report slow servers as removed.

### Does it work with Claude Code updates?

Yes, that's the main use case. It detects the version change and lists every new built-in skill, command and tool the update shipped. It uses Claude Code's plugin API, which is in early access and can change between releases.

## License

[MIT](LICENSE)
