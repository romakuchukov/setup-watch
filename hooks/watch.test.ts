import { expect, test } from 'claude-code/testing'

import { diff, tokenLine, withoutOwn } from './watch'

test('tokenLine leads with the total and ranks sources by size of change', () => {
  const before = { total: 10000, items: { 'skill a': 300, 'MCP x': 1000, gone: 200 } }
  const after = { total: 11900, items: { 'skill a': 300, 'MCP x': 2500, 'skill new (p)': 600 } }

  expect(tokenLine(before, after)).toBe(
    'context 10.0k -> 11.9k tokens (+1.9k); from: MCP x +1.5k, skill new (p) +600, gone -200',
  )
  expect(tokenLine(after, after)).toBe('')
  expect(tokenLine(undefined, after)).toBe('')
})

test('diff groups added, removed and changed items by kind', () => {
  const before = {
    'Claude Code': { version: '2.1.0' },
    plugins: { 'a@m': '1.0.0' },
    'MCP servers (yours)': { old: '3' },
  }
  const after = {
    'Claude Code': { version: '2.1.1' },
    plugins: { 'a@m': '1.0.0' },
    'MCP servers (yours)': { new: '5', other: '1' },
    'builtin tools': { Read: '' },
  }

  expect(diff(before, after)).toEqual([
    '~ Claude Code: version 2.1.0 -> 2.1.1',
    '+ MCP servers (yours): new, other',
    '- MCP servers (yours): old',
    '+ builtin tools: Read',
  ])
  expect(diff(after, after)).toEqual([])
})

test('withoutOwn keeps auto-updates and drops what you installed yourself', () => {
  const before = {
    plugins: { 'kept@m': '1.0.0', 'gone@m': '1.0.0' },
    'plugin commands': { 'kept:a': 'kept', 'gone:b': 'gone' },
    'user commands': { mine: '' },
    'MCP servers (yours)': { db: '2' },
  }
  const after = {
    plugins: { 'kept@m': '1.1.0', 'fresh@m': '1.0.0' },
    'plugin commands': { 'kept:a': 'kept', 'kept:new': 'kept', 'fresh:c': 'fresh' },
    'user commands': { mine: '', another: '' },
    'MCP servers (yours)': {},
    'skills synced from claude.ai (Anthropic)': { pdf: '' },
  }

  expect(diff(...withoutOwn(before, after))).toEqual([
    '~ plugins: kept@m 1.0.0 -> 1.1.0',
    '+ plugin commands: kept:new',
    '+ skills synced from claude.ai (Anthropic): pdf',
  ])
})

test('diff ignores a command that only moved between builtin and plugin', () => {
  const before = { 'builtin commands': { diff: '' }, 'plugin commands': {} }
  const after = { 'builtin commands': {}, 'plugin commands': { diff: 'cc-plugin-diff', fresh: 'x' } }

  expect(diff(before, after)).toEqual(['+ plugin commands: fresh'])
})
