# setup-watch

## Why

Every skill, tool and MCP server you have loaded is listed in the context window of every session, whether you use it or not. CLI updates and plugin updates add new ones silently. Over time your free context shrinks, responses get slower and costlier, and nothing tells you why. `/context` shows what is loaded, but not what is new.

setup-watch closes that gap. It saves a snapshot of your setup and, 15 seconds into each session, prints what changed since the last one. You can then disable what you don't need (`/plugin`, `/mcp`) before it piles up:

```
setup-watch: changed since last session
~ cli: 2.1.314 -> 2.1.316
+ plugin foo@bar (1.0.0)
~ mcp headroom: 3 tools -> 5 tools
- user command old-skill
```

It prints nothing when nothing changed. It makes no model calls and costs no tokens.

## What it tracks

- Claude Code version
- Installed plugins: version and enabled state
- MCP servers and how many tools each one has
- Skills and slash commands: built-in, from plugins, from MCP servers and from `~/.claude`
- Built-in tools

## Install

At the prompt of a terminal session:

```
/plugin install setup-watch --marketplace <owner>/<repo>
```

From a shell:

```
claude plugin install setup-watch --marketplace <owner>/<repo>
```

Answer `y` to add the marketplace, then pick a scope.
