import type { Category, ExternalSearchSource, LinkItem } from '../types.ts';
import { getCategoryPath } from './categoryTree.ts';

export const createDefaultSearchSources = (createdAt = Date.now()): ExternalSearchSource[] => [
  {
    id: 'bing',
    name: '必应',
    url: 'https://www.bing.com/search?q={query}',
    icon: 'Search',
    enabled: true,
    createdAt
  },
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com/search?q={query}',
    icon: 'Search',
    enabled: true,
    createdAt
  },
  {
    id: 'baidu',
    name: '百度',
    url: 'https://www.baidu.com/s?wd={query}',
    icon: 'Globe',
    enabled: true,
    createdAt
  },
  {
    id: 'sogou',
    name: '搜狗',
    url: 'https://www.sogou.com/web?query={query}',
    icon: 'Globe',
    enabled: true,
    createdAt
  },
  {
    id: 'yandex',
    name: 'Yandex',
    url: 'https://yandex.com/search/?text={query}',
    icon: 'Globe',
    enabled: true,
    createdAt
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/search?q={query}',
    icon: 'Github',
    enabled: true,
    createdAt
  },
  {
    id: 'linuxdo',
    name: 'Linux.do',
    url: 'https://linux.do/search?q={query}',
    icon: 'Terminal',
    enabled: true,
    createdAt
  },
  {
    id: 'bilibili',
    name: 'B站',
    url: 'https://search.bilibili.com/all?keyword={query}',
    icon: 'Play',
    enabled: true,
    createdAt
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/results?search_query={query}',
    icon: 'Video',
    enabled: true,
    createdAt
  },
  {
    id: 'wikipedia',
    name: '维基',
    url: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}',
    icon: 'BookOpen',
    enabled: true,
    createdAt
  }
];

export const resolveDefaultSearchSource = (
  sources: ExternalSearchSource[],
  preferredSourceId?: string
) => (
  sources.find(source => source.enabled && source.id === preferredSourceId) ||
  sources.find(source => source.enabled) ||
  null
);

export const filterLinksByQuery = (
  links: LinkItem[],
  categories: Category[],
  query: string
) => {
  const q = query.trim().toLowerCase();
  if (!q) return links;

  return links.filter(link => {
    const categoryPath = getCategoryPath(categories, link.categoryId).toLowerCase();
    return (
      link.title.toLowerCase().includes(q) ||
      link.url.toLowerCase().includes(q) ||
      (link.description || '').toLowerCase().includes(q) ||
      categoryPath.includes(q)
    );
  });
};

export const shouldRunExternalSearch = (query: string, localResultCount: number) => (
  query.trim().length > 0 && localResultCount === 0
);
