import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCategoryTree,
  flattenCategoryTree,
  getAncestorCategoryIds,
  getCategoryPath,
  getDescendantCategoryIds,
  normalizeCategories,
} from './categoryTree.ts';
import type { Category } from '../types.ts';

const categories: Category[] = [
  { id: 'common', name: '常用推荐', icon: 'Star' },
  { id: 'dev', name: '开发工具', icon: 'Code' },
  { id: 'frontend', name: '前端', icon: 'Folder', parentId: 'dev' },
  { id: 'react', name: 'React', icon: 'Folder', parentId: 'frontend' },
  { id: 'backend', name: '后端', icon: 'Folder', parentId: 'dev' },
  { id: 'design', name: '设计资源', icon: 'Palette' },
];

test('buildCategoryTree preserves unlimited nested children', () => {
  const tree = buildCategoryTree(categories);
  const dev = tree.find(cat => cat.id === 'dev');

  assert.equal(dev?.children.length, 2);
  assert.equal(dev?.children[0].id, 'frontend');
  assert.equal(dev?.children[0].children[0].id, 'react');
});

test('getDescendantCategoryIds returns the whole subtree including the selected category', () => {
  assert.deepEqual(getDescendantCategoryIds(categories, 'dev').sort(), [
    'backend',
    'dev',
    'frontend',
    'react',
  ]);
});

test('getCategoryPath disambiguates duplicate names by ancestor path', () => {
  assert.equal(getCategoryPath(categories, 'react'), '开发工具 / 前端 / React');
  assert.equal(getCategoryPath(categories, 'missing'), '');
});

test('getAncestorCategoryIds returns parents from root to direct parent', () => {
  assert.deepEqual(getAncestorCategoryIds(categories, 'react'), ['dev', 'frontend']);
});

test('flattenCategoryTree exposes depth and path for selects', () => {
  const flat = flattenCategoryTree(categories);
  const react = flat.find(item => item.category.id === 'react');

  assert.equal(react?.depth, 2);
  assert.equal(react?.path, '开发工具 / 前端 / React');
});

test('normalizeCategories keeps common at root and lifts invalid parents', () => {
  const normalized = normalizeCategories([
    { id: 'common', name: '常用推荐', icon: 'Star', parentId: 'dev' },
    { id: 'orphan', name: '孤儿', icon: 'Folder', parentId: 'missing' },
    { id: 'self', name: '自循环', icon: 'Folder', parentId: 'self' },
  ]);

  assert.equal(normalized.find(cat => cat.id === 'common')?.parentId, undefined);
  assert.equal(normalized.find(cat => cat.id === 'orphan')?.parentId, undefined);
  assert.equal(normalized.find(cat => cat.id === 'self')?.parentId, undefined);
});

test('buildCategoryTree sorts siblings by stored order', () => {
  const ordered: Category[] = [
    { id: 'common', name: '常用推荐', icon: 'Star' },
    { id: 'dev', name: '开发工具', icon: 'Code', order: 2 },
    { id: 'design', name: '设计资源', icon: 'Palette', order: 1 },
    { id: 'backend', name: '后端', icon: 'Folder', parentId: 'dev', order: 2 },
    { id: 'frontend', name: '前端', icon: 'Folder', parentId: 'dev', order: 1 },
  ];

  const tree = buildCategoryTree(ordered);
  const rootIds = tree.map(node => node.id);
  const devChildren = tree.find(node => node.id === 'dev')?.children.map(node => node.id);

  assert.deepEqual(rootIds, ['common', 'design', 'dev']);
  assert.deepEqual(devChildren, ['frontend', 'backend']);
});
