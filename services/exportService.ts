import type { Category, LinkItem } from "../types";
import { buildCategoryTree } from "./categoryTree.ts";
import type { CategoryTreeNode } from "./categoryTree.ts";

/**
 * Generates a Netscape Bookmark HTML string compatible with Chrome/Edge/Firefox import.
 */
export const generateBookmarkHtml = (links: LinkItem[], categories: Category[]): string => {
  const now = Math.floor(Date.now() / 1000);

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  // Helper to escape HTML special characters
  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Group links by category
  const linksByCat = new Map<string, LinkItem[]>();
  links.forEach(link => {
    const list = linksByCat.get(link.categoryId) || [];
    list.push(link);
    linksByCat.set(link.categoryId, list);
  });

  const renderLink = (link: LinkItem, indent: string) => {
      const date = Math.floor(link.createdAt / 1000);
      const iconAttr = link.icon ? ` ICON="${link.icon}"` : '';
      html += `${indent}<DT><A HREF="${link.url}" ADD_DATE="${date}"${iconAttr}>${escapeHtml(link.title)}</A>\n`;
  };

  const renderCategory = (cat: CategoryTreeNode, depth: number) => {
    const indent = '    '.repeat(depth + 1);
    const linkIndent = '    '.repeat(depth + 2);
    const catLinks = linksByCat.get(cat.id) || [];
    
    html += `${indent}<DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${escapeHtml(cat.name)}</H3>\n`;
    html += `${indent}<DL><p>\n`;
    
    catLinks.forEach(link => renderLink(link, linkIndent));
    cat.children.forEach(child => renderCategory(child, depth + 1));

    html += `${indent}</DL><p>\n`;
  };

  // 1. Render actual common-category links at the browser root. Favorite tags are
  // not exported as duplicate bookmarks.
  (linksByCat.get('common') || []).forEach(link => renderLink(link, '    '));

  // 2. Process Categories recursively to preserve Chrome/Edge folder trees.
  buildCategoryTree(categories)
    .filter(cat => cat.id !== 'common')
    .forEach(cat => renderCategory(cat, 0));

  // 3. Process Uncategorized (links with invalid categoryId)
  const validCatIds = new Set(categories.map(c => c.id));
  const uncategorized = links.filter(l => !validCatIds.has(l.categoryId));

  if (uncategorized.length > 0) {
    html += `    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">未分类</H3>\n`;
    html += `    <DL><p>\n`;
    uncategorized.forEach(link => renderLink(link, '        '));
    html += `    </DL><p>\n`;
  }

  html += `</DL><p>`;

  return html;
};

export const downloadHtmlFile = (content: string, filename: string = 'bookmarks.html') => {
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
