import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBookmarkHtml } from './exportService.ts';
import type { Category, LinkItem } from '../types.ts';

test('generateBookmarkHtml exports nested category folders recursively', () => {
  const categories: Category[] = [
    { id: 'common', name: 'Common', icon: 'Star' },
    { id: 'dev', name: 'Dev', icon: 'Folder' },
    { id: 'frontend', name: 'Frontend', icon: 'Folder', parentId: 'dev' },
    { id: 'react', name: 'React', icon: 'Folder', parentId: 'frontend' },
  ];
  const links: LinkItem[] = [
    { id: 'l1', title: 'React Docs', url: 'https://react.dev', categoryId: 'react', createdAt: 1000 },
  ];

  const html = generateBookmarkHtml(links, categories);

  assert.ok(html.indexOf('>Dev</H3>') < html.indexOf('>Frontend</H3>'));
  assert.ok(html.indexOf('>Frontend</H3>') < html.indexOf('>React</H3>'));
  assert.ok(html.includes('<DT><A HREF="https://react.dev" ADD_DATE="1">React Docs</A>'));
});

test('generateBookmarkHtml keeps common internal and does not duplicate favorite links', () => {
  const categories: Category[] = [
    { id: 'common', name: 'Common', icon: 'Star' },
    { id: 'dev', name: 'Dev', icon: 'Folder' },
  ];
  const links: LinkItem[] = [
    { id: 'l1', title: 'Root Link', url: 'https://root.example', categoryId: 'common', createdAt: 1000 },
    { id: 'l2', title: 'Dev Link', url: 'https://dev.example', categoryId: 'dev', createdAt: 2000, favorite: true },
  ];

  const html = generateBookmarkHtml(links, categories);

  assert.ok(!html.includes('>Common</H3>'));
  assert.ok(html.includes('    <DT><A HREF="https://root.example" ADD_DATE="1">Root Link</A>'));
  assert.equal(html.match(/HREF="https:\/\/dev\.example"/g)?.length, 1);
});
