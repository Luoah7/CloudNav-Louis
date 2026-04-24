import type { LinkItem, Category } from '../types';

// Simple UUID generator fallback
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export interface ImportResult {
  links: LinkItem[];
  categories: Category[];
}

export const parseBookmarks = async (file: File): Promise<ImportResult> => {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');

  const links: LinkItem[] = [];
  const categories: Category[] = [];
  const categoryMap = new Map<string, string>(); // Parent path + name -> ID

  // Helper to get or create category ID
  const getCategoryId = (name: string, parentId?: string): string => {
    const normalizedName = name.trim();
    if (!normalizedName) return parentId || 'common';
    const key = `${parentId || 'root'}::${normalizedName}`;

    if (categoryMap.has(key)) {
      return categoryMap.get(key)!;
    }
    
    const newId = generateId();
    const newCategory: Category = {
      id: newId,
      name: normalizedName,
      icon: 'Folder' // Default icon for imported folders
    };

    if (parentId) {
      newCategory.parentId = parentId;
    }

    categories.push(newCategory);
    categoryMap.set(key, newId);
    return newId;
  };

  // Traverse the DL/DT structure
  // Chrome structure: <DT><H3>Folder Name</H3><DL> ...items... </DL>
  
  const getDirectChild = (element: Element, tagName: string) => (
    Array.from(element.children).find(child => child.tagName.toUpperCase() === tagName)
  );

  const traverse = (element: Element, currentCategoryId?: string) => {
    const children = Array.from(element.children);
    
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      const tagName = node.tagName.toUpperCase();

      if (tagName === 'DT') {
        // DT can contain an H3 (Folder) or A (Link)
        const h3 = getDirectChild(node, 'H3');
        const a = getDirectChild(node, 'A');
        const dl = getDirectChild(node, 'DL') || (
          node.nextElementSibling?.tagName.toUpperCase() === 'DL' ? node.nextElementSibling : null
        );

        if (h3 && dl) {
            // It's a folder
            const folderName = h3.textContent || 'Unknown';
            const folderId = getCategoryId(folderName, currentCategoryId);
            traverse(dl, folderId);
        } else if (a) {
            // It's a link
            const title = a.textContent || a.getAttribute('href') || 'No Title';
            const url = a.getAttribute('href');
            
            if (url && !url.startsWith('chrome://') && !url.startsWith('about:')) {
                links.push({
                    id: generateId(),
                    title: title,
                    url: url,
                    categoryId: currentCategoryId || 'common',
                    createdAt: Date.now(),
                    icon: a.getAttribute('icon') || undefined
                });
            }
        }
      }
    }
  };

  const rootDl = doc.querySelector('dl');
  if (rootDl) {
    traverse(rootDl);
  }

  return { links, categories };
};
