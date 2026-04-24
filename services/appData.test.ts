import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppData } from './appData.ts';
import type { Category, LinkItem } from '../types.ts';

test('normalizeAppData migrates legacy pinned links to favorite and removes pinned fields', () => {
  const categories: Category[] = [
    { id: 'common', name: '常用推荐', icon: 'Star' },
    { id: 'dev', name: '开发工具', icon: 'Code' },
  ];
  const links: LinkItem[] = [
    {
      id: 'github',
      title: 'GitHub',
      url: 'https://github.com',
      categoryId: 'dev',
      createdAt: 1,
      pinned: true,
      pinnedOrder: 0,
    },
    {
      id: 'react',
      title: 'React',
      url: 'https://react.dev',
      categoryId: 'dev',
      createdAt: 2,
      favorite: true,
    },
  ];

  const result = normalizeAppData(links, categories);

  assert.equal(result.links[0].favorite, true);
  assert.equal('pinned' in result.links[0], false);
  assert.equal('pinnedOrder' in result.links[0], false);
  assert.equal(result.links[1].favorite, true);
});

test('normalizeAppData sends invalid link categories to common', () => {
  const result = normalizeAppData(
    [{ id: 'x', title: 'X', url: 'https://x.example', categoryId: 'missing', createdAt: 1 }],
    [{ id: 'common', name: '常用推荐', icon: 'Star' }]
  );

  assert.equal(result.links[0].categoryId, 'common');
});
