import type { Category, LinkItem } from '../types.ts';
import { DEFAULT_CATEGORIES, INITIAL_LINKS } from '../types.ts';
import { normalizeCategories } from './categoryTree.ts';

export const normalizeAppData = (
  rawLinks: LinkItem[] = INITIAL_LINKS,
  rawCategories: Category[] = DEFAULT_CATEGORIES
) => {
  const normalizedCategories = normalizeCategories(rawCategories);
  const validCategoryIds = new Set(normalizedCategories.map(c => c.id));
  const normalizedLinks = rawLinks.map(link => {
    const { pinned, pinnedOrder, ...rest } = link;
    return {
      ...rest,
      favorite: link.favorite || pinned || undefined,
      categoryId: validCategoryIds.has(link.categoryId) ? link.categoryId : 'common',
    };
  });

  return { links: normalizedLinks, categories: normalizedCategories };
};
