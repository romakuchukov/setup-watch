import { expect, test } from 'claude-code/testing'

import { diff } from './watch'

test('diff groups added, removed and changed items by kind', () => {
  const before = {
    'Claude Code': { version: '2.1.0' },
    plugins: { 'a@m': '1.0.0' },
    'MCP servers': { old: '3' },
  }
  const after = {
    'Claude Code': { version: '2.1.1' },
    plugins: { 'a@m': '1.0.0' },
    'MCP servers': { new: '5', other: '1' },
    'builtin tools': { Read: '' },
  }

  expect(diff(before, after)).toEqual([
    '~ Claude Code: version 2.1.0 -> 2.1.1',
    '+ MCP servers: new, other',
    '- MCP servers: old',
    '+ builtin tools: Read',
  ])
  expect(diff(after, after)).toEqual([])
})
