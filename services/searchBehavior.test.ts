import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultSearchSources,
  filterLinksByQuery,
  resolveDefaultSearchSource,
  shouldRunExternalSearch,
} from './searchBehavior.ts';
import type { Category, LinkItem } from '../types.ts';

const categories: Category[] = [
  { id: 'common', name: '常用推荐', icon: 'Star' },
  { id: 'dev', name: '开发工具', icon: 'Code' },
  { id: 'react', name: 'React', icon: 'Folder', parentId: 'dev' },
];

const links: LinkItem[] = [
  {
    id: 'react-docs',
    title: 'React Docs',
    url: 'https://react.dev',
    description: 'UI library',
    categoryId: 'react',
    createdAt: 1,
  },
];

test('filterLinksByQuery matches title url description and category path', () => {
  assert.equal(filterLinksByQuery(links, categories, 'React').length, 1);
  assert.equal(filterLinksByQuery(links, categories, 'react.dev').length, 1);
  assert.equal(filterLinksByQuery(links, categories, 'library').length, 1);
  assert.equal(filterLinksByQuery(links, categories, '开发工具').length, 1);
});

test('shouldRunExternalSearch only runs external search when local results are empty', () => {
  assert.equal(shouldRunExternalSearch('React', 1), false);
  assert.equal(shouldRunExternalSearch('Unknown', 0), true);
  assert.equal(shouldRunExternalSearch('   ', 0), false);
});

test('resolveDefaultSearchSource prefers enabled configured default and falls back to first enabled source', () => {
  const sources = createDefaultSearchSources(1);

  assert.equal(resolveDefaultSearchSource(sources, 'google')?.id, 'google');
  assert.equal(resolveDefaultSearchSource(sources.map(source => source.id === 'google' ? { ...source, enabled: false } : source), 'google')?.id, 'bing');
  assert.equal(resolveDefaultSearchSource(sources.map(source => ({ ...source, enabled: false })), 'google'), null);
});
