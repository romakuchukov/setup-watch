import { expect, test } from 'claude-code/testing'

import { diff, withoutOwn } from './watch'

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
