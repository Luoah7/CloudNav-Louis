import React, { useState, useEffect } from 'react';
import type { LinkItem, Category } from '../types';

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  link: LinkItem | null;
}

interface FolderMenuState {
  isOpen: boolean;
  category: Category | null;
  position: { x: number; y: number };
}

interface ContentBlankMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
}

interface UseContextMenuParams {
  isBatchSelectionActive: boolean;
  isSortingMode: string | null;
  selectedCategory: string;
  isCategoryLocked: (catId: string) => boolean;
  links: LinkItem[];
  categories: Category[];
  updateData: (links: LinkItem[], categories: Category[]) => void;
}

export function useContextMenu({
  isBatchSelectionActive,
  isSortingMode,
  selectedCategory,
  isCategoryLocked,
  links,
  categories,
  updateData,
}: UseContextMenuParams) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    link: null,
  });

  const [folderMenu, setFolderMenu] = useState<FolderMenuState>({
    isOpen: false,
    category: null,
    position: { x: 0, y: 0 },
  });

  const [contentBlankMenu, setContentBlankMenu] = useState<ContentBlankMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });

  const [qrCodeModal, setQrCodeModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
  }>({
    isOpen: false,
    url: '',
    title: '',
  });

  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, link: null });
  };

  const closeContentBlankMenu = () => {
    setContentBlankMenu({ isOpen: false, position: { x: 0, y: 0 } });
  };

  const handleContextMenu = (event: React.MouseEvent, link: LinkItem) => {
    event.preventDefault();
    event.stopPropagation();

    if (isBatchSelectionActive) return;

    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      link,
    });
    setFolderMenu(prev => ({ ...prev, isOpen: false }));
    setContentBlankMenu(prev => ({ ...prev, isOpen: false }));
  };

  const copyLinkToClipboard = () => {
    if (!contextMenu.link) return;
    navigator.clipboard.writeText(contextMenu.link.url).catch(err => {
      console.error('复制链接失败:', err);
    });
    closeContextMenu();
  };

  const showQRCode = () => {
    if (!contextMenu.link) return;
    setQrCodeModal({
      isOpen: true,
      url: contextMenu.link.url,
      title: contextMenu.link.title,
    });
    closeContextMenu();
  };

  const editLinkFromContextMenu = () => {
    if (!contextMenu.link) return;
    setEditingLink(contextMenu.link);
    setIsModalOpen(true);
    closeContextMenu();
  };

  const deleteLinkFromContextMenu = () => {
    if (!contextMenu.link) return;
    if (window.confirm(`确定要删除"${contextMenu.link.title}"吗？`)) {
      const newLinks = links.filter(link => link.id !== contextMenu.link!.id);
      updateData(newLinks, categories);
    }
    closeContextMenu();
  };

  const handleFolderContextMenu = (event: React.MouseEvent, category: Category) => {
    event.preventDefault();
    event.stopPropagation();
    setFolderMenu({
      isOpen: true,
      category,
      position: { x: event.clientX, y: event.clientY },
    });
    setContentBlankMenu(prev => ({ ...prev, isOpen: false }));
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, link: null });
  };

  const handleContentBlankContextMenu = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button,a,input,textarea,select,[data-menu-surface]')) return;

    event.preventDefault();
    event.stopPropagation();

    if (isBatchSelectionActive || isSortingMode) return;
    if (selectedCategory !== 'all' && selectedCategory !== 'common' && isCategoryLocked(selectedCategory)) return;

    setContentBlankMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
    });
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, link: null });
    setFolderMenu(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    if (!folderMenu.isOpen && !contentBlankMenu.isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest('[data-menu-surface]')) return;

      setFolderMenu(prev => ({ ...prev, isOpen: false }));
      closeContentBlankMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setFolderMenu(prev => ({ ...prev, isOpen: false }));
      closeContentBlankMenu();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [folderMenu.isOpen, contentBlankMenu.isOpen]);

  return {
    contextMenu,
    folderMenu,
    contentBlankMenu,
    qrCodeModal,
    setQrCodeModal,
    editingLink,
    setEditingLink,
    prefillLink,
    setPrefillLink,
    isModalOpen,
    setIsModalOpen,
    closeContextMenu,
    closeContentBlankMenu,
    handleContextMenu,
    copyLinkToClipboard,
    showQRCode,
    editLinkFromContextMenu,
    deleteLinkFromContextMenu,
    handleFolderContextMenu,
    handleContentBlankContextMenu,
  };
}
