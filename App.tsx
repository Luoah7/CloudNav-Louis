
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import {
  Search, Plus, Upload, Menu,
  Trash2, Edit2, Loader2, Cloud, Check, CheckCircle2, AlertCircle,
  Settings, Lock, CloudCog, GripVertical, Save, LogOut, ExternalLink, X,
  ChevronRight, Star, Folder, FolderPlus
} from 'lucide-react';
import {
  DndContext,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS } from './types';
import { parseBookmarks } from './services/bookmarkParser';
import { normalizeAppData } from './services/appData';
import { filterLinksByQuery, resolveDefaultSearchSource, shouldRunExternalSearch, createDefaultSearchSources } from './services/searchBehavior';
import {
  getCategoryPath,
  normalizeCategories,
  getAncestorCategoryIds,
} from './services/categoryTree';
import type { CategoryTreeNode } from './services/categoryTree';
import Icon from './components/Icon';
import ContextMenu from './components/ContextMenu';

// Hooks
import { useTheme } from './hooks/useTheme';
import { useSiteSettings, normalizeSiteSettings } from './hooks/useSiteSettings';
import { useAuth } from './hooks/useAuth';
import { useSearch } from './hooks/useSearch';
import { useCategoryManagement } from './hooks/useCategoryManagement';
import { useBatchSelection } from './hooks/useBatchSelection';
import { useSorting } from './hooks/useSorting';
import { useContextMenu } from './hooks/useContextMenu';

// Lazy-loaded modals
const AuthModal = lazy(() => import('./components/AuthModal'));
const BackupModal = lazy(() => import('./components/BackupModal'));
const ImportModal = lazy(() => import('./components/ImportModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const SearchConfigModal = lazy(() => import('./components/SearchConfigModal'));
const CategoryManagerModal = lazy(() => import('./components/CategoryManagerModal'));
const LinkModal = lazy(() => import('./components/LinkModal'));
const CategoryEditorModal = lazy(() => import('./components/CategoryEditorModal'));
const CategoryDeleteModal = lazy(() => import('./components/CategoryDeleteModal'));
const CategoryAuthModal = lazy(() => import('./components/CategoryAuthModal'));
const QRCodeModal = lazy(() => import('./components/QRCodeModal'));

const APP_VERSION = 'v1.8.2';

function App() {
  // --- Hooks ---
  const siteSettingsHook = useSiteSettings({ authToken: '' });
  const { siteSettings, setSiteSettings, aiConfig, setAiConfig, webDavConfig, setWebDavConfig, handleViewModeChange, handleSaveAIConfig, handleRestoreAIConfig, handleSaveWebDavConfig } = siteSettingsHook;

  const themeHook = useTheme();
  const { darkMode, themeMode, isThemeMenuOpen, setIsThemeMenuOpen, themeMenuRef, themeOptions, currentThemeOption, handleThemeModeChange } = themeHook;

  const [selectedCategory, setSelectedCategory] = useState<string>('common');

  const loadLinkIcons = async (linksToLoad: LinkItem[]) => {
    // Placeholder - will be overridden after auth hook is ready
  };

  const authHook = useAuth({
    siteSettings,
    setSiteSettings,
    setAiConfig,
    loadLinkIcons,
  });
  const { links, setLinks, categories, setCategories, syncStatus, authToken, setAuthToken, requiresAuth, setRequiresAuth, isCheckingAuth, setIsCheckingAuth, isAuthOpen, setIsAuthOpen, loadFromLocal, updateData, handleLogin, handleLogout } = authHook;

  // Re-define loadLinkIcons with access to authToken
  const loadLinkIconsReal = async (linksToLoad: LinkItem[]) => {
    if (!authToken) return;
    const updatedLinks = [...linksToLoad];
    const domainsToFetch: string[] = [];

    for (const link of updatedLinks) {
      if (link.url) {
        try {
          let domain = link.url;
          if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
            domain = 'https://' + link.url;
          }
          if (domain.startsWith('http://') || domain.startsWith('https://')) {
            const urlObj = new URL(domain);
            domainsToFetch.push(urlObj.hostname);
          }
        } catch (e) {}
      }
    }

    if (domainsToFetch.length > 0) {
      const iconPromises = domainsToFetch.map(async (domain) => {
        try {
          const response = await fetch(`/api/storage?getConfig=favicon&domain=${encodeURIComponent(domain)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.cached && data.icon) {
              return { domain, icon: data.icon };
            }
          }
        } catch (error) {}
        return null;
      });

      const iconResults = await Promise.all(iconPromises);

      iconResults.forEach(result => {
        if (result) {
          const linkToUpdate = updatedLinks.find(link => {
            if (!link.url) return false;
            try {
              let domain = link.url;
              if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
                domain = 'https://' + link.url;
              }
              if (domain.startsWith('http://') || domain.startsWith('https://')) {
                const urlObj = new URL(domain);
                return urlObj.hostname === result.domain;
              }
            } catch (e) { return false; }
            return false;
          });

          if (linkToUpdate) {
            if (!linkToUpdate.icon || linkToUpdate.icon.includes('faviconextractor.com') || !result.icon.includes('faviconextractor.com')) {
              linkToUpdate.icon = result.icon;
            }
          }
        }
      });

      setLinks(updatedLinks);
    }
  };

  const searchHook = useSearch({ authToken });
  const { searchQuery, setSearchQuery, searchMode, setSearchMode, externalSearchSources, setExternalSearchSources, isLoadingSearchConfig, setIsLoadingSearchConfig, isMobileSearchOpen, setIsMobileSearchOpen, showSearchSourcePopup, setShowSearchSourcePopup, hoveredSearchSource, setHoveredSearchSource, selectedSearchSource, setSelectedSearchSource, isIconHovered, setIsIconHovered, isPopupHovered, setIsPopupHovered, currentSearchSource, handleSaveSearchConfig, handleSearchSourceSelect, handleExternalSearch, getSearchSourceIconUrl } = searchHook;

  const catHook = useCategoryManagement({
    categories,
    links,
    selectedCategory,
    authToken,
    updateData,
    setSelectedCategory,
    setIsAuthOpen,
  });
  const { selectedCategoryIds, categoryTree, flatCategories, currentChildCategories, isCategoryLocked, unlockedCategoryIds, commonCategoryName, expandedCategoryIds, setExpandedCategoryIds, categoryEditor, deletingCategory, setDeletingCategory, catAuthModalData, setCatAuthModalData, isCategoryManagerOpen, setIsCategoryManagerOpen, pendingCategoryManagerSave, setPendingCategoryManagerSave, commonNameEditorOpen, setCommonNameEditorOpen, commonNameDraft, setCommonNameDraft, categoryEditorParentOptions, toggleCategoryExpanded, openCreateCategory, openCategoryManager, openEditCategory, closeCategoryEditor, handleSaveCategory, handleSaveCategoryManager, openDeleteCategory, handleCategoryClick, handleUnlockCategory, handleDeleteCategory, openCommonNameEditor, handleSaveCommonName } = catHook;

  const batchHook = useBatchSelection({
    links,
    categories,
    selectedCategory,
    flatCategories,
    displayedLinks: [],
    currentChildCategories,
    authToken,
    updateData,
    setSelectedCategory,
    setIsAuthOpen,
  });
  const { selectedLinks, selectedCategories, batchActionMenuOpen, setBatchActionMenuOpen, selectedItemCount, isBatchSelectionActive, isAllCurrentSelected, currentSelectableLinkIds, currentSelectableCategoryIds, batchMoveTargetOptions, clearBatchSelection, toggleLinkSelection, toggleCategorySelection, handleSelectAll, handleBatchDelete, handleBatchMove, handleBatchCopyLinks } = batchHook;

  const sortingHook = useSorting({
    links,
    categories,
    selectedCategory,
    selectedCategoryIds,
    updateData,
  });
  const { isSortingMode, sensors, handleDragEnd, startSorting, saveSorting, cancelSorting } = sortingHook;

  const contextMenuHook = useContextMenu({
    isBatchSelectionActive,
    isSortingMode,
    selectedCategory,
    isCategoryLocked,
    links,
    categories,
    updateData,
  });
  const { contextMenu, folderMenu, contentBlankMenu, qrCodeModal, setQrCodeModal, editingLink, setEditingLink, prefillLink, setPrefillLink, isModalOpen, setIsModalOpen, closeContextMenu, closeContentBlankMenu, handleContextMenu, copyLinkToClipboard, showQRCode, editLinkFromContextMenu, deleteLinkFromContextMenu, handleFolderContextMenu, handleContentBlankContextMenu } = contextMenuHook;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Effects ---
  useEffect(() => {
    const savedToken = localStorage.getItem('cloudnav_auth_token');
    const lastLoginTime = localStorage.getItem('lastLoginTime');

    if (savedToken) {
      const currentTime = Date.now();
      if (lastLoginTime) {
        const lastLogin = parseInt(lastLoginTime);
        const timeDiff = currentTime - lastLogin;
        const expiryDays = siteSettings.passwordExpiryDays || 7;
        const expiryTimeMs = expiryDays > 0 ? expiryDays * 24 * 60 * 60 * 1000 : 0;

        if (expiryTimeMs > 0 && timeDiff > expiryTimeMs) {
          localStorage.removeItem('cloudnav_auth_token');
          localStorage.removeItem('lastLoginTime');
          setAuthToken(null);
        } else {
          setAuthToken(savedToken);
        }
      } else {
        setAuthToken(savedToken);
      }
    }

    const savedWebDav = localStorage.getItem('cloudnav_webdav_config');
    if (savedWebDav) {
      try { setWebDavConfig(JSON.parse(savedWebDav)); } catch (e) {}
    }

    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
      const addTitle = urlParams.get('add_title') || '';
      window.history.replaceState({}, '', window.location.pathname);
      setPrefillLink({ title: addTitle, url: addUrl, categoryId: 'common' });
      setEditingLink(undefined);
      setIsModalOpen(true);
    }

    const initData = async () => {
      try {
        const authRes = await fetch('/api/storage?checkAuth=true');
        if (authRes.ok) {
          const authData = await authRes.json();
          setRequiresAuth(authData.requiresAuth);
          if (authData.requiresAuth && !savedToken) {
            setIsCheckingAuth(false);
            setIsAuthOpen(true);
            return;
          }
        }
      } catch (e) {}

      let hasCloudData = false;
      try {
        const res = await fetch('/api/storage', {
          headers: authToken ? { 'x-auth-password': authToken } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.links && data.links.length > 0) {
            const normalized = normalizeAppData(data.links, data.categories || DEFAULT_CATEGORIES);
            setLinks(normalized.links);
            setCategories(normalized.categories);
            localStorage.setItem('cloudnav_data_cache', JSON.stringify(normalized));
            loadLinkIconsReal(normalized.links);
            hasCloudData = true;
          }
        } else if (res.status === 401) {
          const errorData = await res.json();
          if (errorData.error && errorData.error.includes('过期')) {
            setAuthToken(null);
            localStorage.removeItem('cloudnav_auth_token');
            setIsAuthOpen(true);
            setIsCheckingAuth(false);
            return;
          }
        }
      } catch (e) {}

      let hasSearchConfig = false;
      try {
        const searchConfigRes = await fetch('/api/storage?getConfig=search');
        if (searchConfigRes.ok) {
          const searchConfigData = await searchConfigRes.json();
          if (searchConfigData && (searchConfigData.mode || searchConfigData.externalSources || searchConfigData.defaultSourceId || searchConfigData.selectedSource)) {
            const loadedSources = searchConfigData.externalSources || [];
            const defaultSource = resolveDefaultSearchSource(loadedSources, searchConfigData.defaultSourceId || searchConfigData.selectedSource?.id);
            setSearchMode(searchConfigData.mode || 'external');
            setExternalSearchSources(loadedSources);
            setSelectedSearchSource(defaultSource || searchConfigData.selectedSource || null);
            hasSearchConfig = true;
          }
        }

        const websiteConfigRes = await fetch('/api/storage?getConfig=website');
        if (websiteConfigRes.ok) {
          const websiteConfigData = await websiteConfigRes.json();
          if (websiteConfigData) {
            setSiteSettings((prev: any) => normalizeSiteSettings({ ...prev, ...websiteConfigData }));
          }
        }
      } catch (e) {}

      if (hasCloudData) {
        setIsCheckingAuth(false);
        return;
      }

      loadFromLocal();

      if (!hasSearchConfig) {
        const defaultSources = createDefaultSearchSources();
        setSearchMode('external');
        setExternalSearchSources(defaultSources);
        setSelectedSearchSource(defaultSources[0] || null);
      }

      setIsLoadingSearchConfig(false);
      setIsCheckingAuth(false);
    };

    initData();
  }, []);

  // Auto-expand ancestors when category changes
  useEffect(() => {
    if (selectedCategory === 'all') return;
    const ancestorIds = getAncestorCategoryIds(categories, selectedCategory);
    if (!ancestorIds.length) return;
    setExpandedCategoryIds(prev => {
      const next = new Set(prev);
      ancestorIds.forEach(id => next.add(id));
      return next;
    });
  }, [categories, selectedCategory]);

  // --- Derived state ---
  const displayedLinks = useMemo(() => {
    let result = links;
    result = result.filter(l => !isCategoryLocked(l.categoryId));
    result = filterLinksByQuery(result, categories, searchQuery);
    if (selectedCategory === 'common') {
      result = result.filter(l => l.categoryId === 'common' || l.favorite);
    } else if (selectedCategory !== 'all') {
      result = result.filter(l => selectedCategoryIds.has(l.categoryId));
    }
    return [...result].sort((a, b) => {
      const aOrder = a.order !== undefined ? a.order : a.createdAt;
      const bOrder = b.order !== undefined ? b.order : b.createdAt;
      return aOrder - bOrder;
    });
  }, [links, selectedCategory, selectedCategoryIds, searchQuery, categories, unlockedCategoryIds]);

  const otherCategoryResults = useMemo<Record<string, LinkItem[]>>(() => {
    if (!searchQuery.trim() || selectedCategory === 'all') return {};
    const otherLinks = filterLinksByQuery(links, categories, searchQuery).filter(link => {
      if (selectedCategory === 'common' && (link.categoryId === 'common' || link.favorite)) return false;
      if (selectedCategory !== 'common' && selectedCategoryIds.has(link.categoryId)) return false;
      if (isCategoryLocked(link.categoryId)) return false;
      return true;
    });
    const groupedByCategory = otherLinks.reduce((acc, link) => {
      if (!acc[link.categoryId]) acc[link.categoryId] = [];
      acc[link.categoryId].push(link);
      return acc;
    }, {} as Record<string, LinkItem[]>);
    Object.keys(groupedByCategory).forEach(categoryId => {
      groupedByCategory[categoryId].sort((a, b) => {
        const aOrder = a.order !== undefined ? a.order : a.createdAt;
        const bOrder = b.order !== undefined ? b.order : b.createdAt;
        return aOrder - bOrder;
      });
    });
    return groupedByCategory;
  }, [links, selectedCategory, selectedCategoryIds, searchQuery, categories, unlockedCategoryIds]);

  const currentFolderCategory = categories.find(cat => cat.id === selectedCategory) || null;
  const canCreateFolderHere = selectedCategory !== 'common' && selectedCategory !== 'all';
  const canDeleteCurrentFolder = selectedCategory !== 'common' && selectedCategory !== 'all' && !!currentFolderCategory;

  // --- Helpers ---
  const getLinkHostname = (url: string) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url.replace(/^https?:\/\//, '').split('/')[0] || url; }
  };

  // --- Render functions ---
  const renderCategoryNavItems = (nodes: CategoryTreeNode[], depth = 0): React.ReactNode => (
    nodes.map(cat => {
      const isLocked = isCategoryLocked(cat.id);
      const isExpanded = expandedCategoryIds.has(cat.id);
      const hasChildren = cat.children.length > 0;
      const isSelected = selectedCategory === cat.id;
      const indent = Math.min(depth, 8) * 12;

      return (
        <div key={cat.id}>
          <div className="flex items-center" style={{ paddingLeft: indent }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleCategoryExpanded(cat.id); }} className={`w-6 h-9 flex items-center justify-center rounded-lg transition-colors ${hasChildren ? 'text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-white/5' : 'text-transparent'}`} disabled={!hasChildren}>
              <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
            <button onClick={() => handleCategoryClick(cat)} className={`flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-95 group ${isSelected ? 'bg-blue-50/80 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 font-medium shadow-sm border border-blue-100/50 dark:border-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50/80 dark:hover:bg-white/5 border border-transparent'}`} title={getCategoryPath(categories, cat.id)}>
              <div className={`p-1.5 rounded-lg transition-colors flex items-center justify-center shadow-sm ${isSelected ? 'bg-blue-100/80 dark:bg-blue-500/30 text-blue-600 dark:text-blue-300' : 'bg-slate-100/80 dark:bg-white/10'}`}>
                {isLocked ? <Lock size={16} className="text-amber-500" /> : <Icon name={cat.icon} size={16} />}
              </div>
              <span className="truncate flex-1 text-left text-[13px]">{cat.name}</span>
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
            </button>
          </div>
          {hasChildren && isExpanded && (
            <div className="mt-1 space-y-1">{renderCategoryNavItems(cat.children, depth + 1)}</div>
          )}
        </div>
      );
    })
  );

  const renderSelectionCheckbox = (checked: boolean, onToggle: (event: React.MouseEvent) => void, title: string, className = 'left-3 top-3') => (
    <button type="button" onClick={onToggle} className={`absolute ${className} z-20 flex h-5 w-5 items-center justify-center rounded border transition-all ${checked || isBatchSelectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${checked ? 'border-blue-500 bg-blue-600 text-white shadow-sm' : 'border-slate-300 bg-white text-transparent hover:border-blue-400 dark:border-slate-500 dark:bg-slate-900'}`} title={title} aria-pressed={checked}>
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );

  const renderLinkIcon = (link: LinkItem, isDetailedView: boolean) => (
    <div className={`flex shrink-0 items-center justify-center font-semibold uppercase text-blue-600 dark:text-blue-400 ${isDetailedView ? 'h-12 w-12 rounded-lg border border-slate-200/90 bg-white/70 text-base dark:border-white/10 dark:bg-white/10' : 'h-8 w-8 rounded-lg bg-white/70 text-sm dark:bg-white/10'}`}>
      {link.icon ? <img src={link.icon} alt="" className={isDetailedView ? 'h-8 w-8 rounded-md object-contain' : 'h-5 w-5 object-contain'} /> : link.title.charAt(0)}
    </div>
  );

  const renderLinkContent = (link: LinkItem, isDetailedView: boolean) => {
    const hostname = getLinkHostname(link.url);
    if (isDetailedView) {
      return (
        <>
          {renderLinkIcon(link, true)}
          <div className="min-w-0 flex-1 pr-12">
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 truncate text-[13px] font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400" title={link.title}>{link.title}</h3>
              <p className="max-w-[46%] shrink-0 truncate text-right text-[11px] leading-5 text-slate-400 dark:text-slate-500" title={link.url}>{hostname}</p>
            </div>
            {link.description && <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-slate-600 dark:text-slate-400">{link.description}</p>}
          </div>
        </>
      );
    }
    return (
      <>
        {renderLinkIcon(link, false)}
        <h3 className="min-w-0 truncate text-[13px] font-medium text-slate-800 transition-colors group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400" title={link.title}>{link.title}</h3>
      </>
    );
  };

  const SortableLinkCard = ({ link }: { link: LinkItem }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
    const isDetailedView = siteSettings.cardStyle === 'detailed';
    const style = { transform: CSS.Transform.toString(transform), transition: isDragging ? 'none' : transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1000 : 'auto' };

    return (
      <div ref={setNodeRef} style={style} className={`group relative min-w-0 max-w-full cursor-grab overflow-hidden border transition-colors active:cursor-grabbing ${isSortingMode ? 'border-green-200 bg-green-50 dark:border-[#6a9955] dark:bg-[#2a3326]' : 'liquid-surface border-slate-200/90 dark:border-white/10'} ${isDragging ? 'scale-[1.02] shadow-xl' : ''} ${isDetailedView ? 'flex min-h-[96px] rounded-lg px-4 py-3 hover:border-green-400 dark:hover:border-green-500' : 'flex items-center rounded-xl p-3 shadow-sm hover:border-green-300 dark:hover:border-green-600'}`} {...attributes} {...listeners}>
        <div className={`flex flex-1 min-w-0 overflow-hidden ${isDetailedView ? 'items-center gap-4' : 'items-center gap-3'}`}>
          {renderLinkContent(link, isDetailedView)}
        </div>
      </div>
    );
  };

  const renderFolderCard = (category: Category) => {
    const isSelected = selectedCategories.has(category.id);
    return (
      <div key={category.id} onContextMenu={(e) => handleFolderContextMenu(e, category)} className={`liquid-surface group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-hover dark:hover:shadow-hover-dark ${isSelected ? 'border-blue-400 bg-blue-50/80 dark:border-blue-500/50 dark:bg-blue-500/10' : 'border-slate-200/70 hover:border-blue-300 dark:border-white/5 dark:hover:border-blue-500/30'}`} title={getCategoryPath(categories, category.id)}>
        {renderSelectionCheckbox(isSelected, (event) => toggleCategorySelection(category.id, event), isSelected ? '取消选择文件夹' : '选择文件夹')}
        <button type="button" onClick={() => handleCategoryClick(category)} className="flex min-h-[88px] w-full items-center gap-4 p-4 pl-10 pr-28 text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200/50 bg-white/80 text-blue-500 shadow-sm dark:border-white/5 dark:bg-white/5">
            <Icon name={category.icon || 'Folder'} size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{category.name}</h3>
              {category.password && <Lock size={13} className="shrink-0 text-amber-500" />}
            </div>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{categories.filter(cat => cat.parentId === category.id).length} 个子文件夹</p>
          </div>
        </button>
        {!isBatchSelectionActive && (
          <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" onClick={(e) => { e.stopPropagation(); openEditCategory(category); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/70 hover:text-blue-500 hover:scale-110 active:scale-95 transition-all duration-200 dark:hover:bg-white/10" title="编辑文件夹">
              <Edit2 size={15} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderLinkCard = (link: LinkItem) => {
    const isSelected = selectedLinks.has(link.id);
    const isDetailedView = siteSettings.cardStyle === 'detailed';

    return (
      <div key={link.id} className={`group relative min-w-0 overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-hover dark:hover:shadow-hover-dark ${isSelected ? 'border-blue-400 bg-blue-50/80 dark:border-blue-500/50 dark:bg-blue-500/10' : 'liquid-surface border-slate-200/70 hover:border-blue-300 dark:border-white/5 dark:hover:border-blue-500/30'} ${isDetailedView ? 'flex min-h-[96px] px-5 py-4' : 'flex items-center justify-between p-4 shadow-sm'}`} onContextMenu={(e) => handleContextMenu(e, link)}>
        {renderSelectionCheckbox(isSelected, (event) => toggleLinkSelection(link.id, event), isSelected ? '取消选择书签' : '选择书签', isDetailedView ? 'left-3 top-3' : 'left-2 top-1/2 -translate-y-1/2')}
        <a href={link.url} target="_blank" rel="noopener noreferrer" className={`flex flex-1 min-w-0 overflow-hidden ${isDetailedView ? 'items-center gap-4 pl-6' : 'items-center gap-3 pl-7 pr-12'}`} title={isDetailedView ? link.url : (link.description || link.url)}>
          {renderLinkContent(link, isDetailedView)}
          {!isDetailedView && link.description && (
            <div className="tooltip-custom absolute left-0 -top-8 w-max max-w-[200px] truncate rounded bg-black p-2 text-xs text-white opacity-0 transition-all pointer-events-none invisible group-hover:visible group-hover:opacity-100 z-20">{link.description}</div>
          )}
        </a>
        {!isBatchSelectionActive && !isSortingMode && (
          <div className={`liquid-menu absolute flex items-center justify-center gap-1 rounded-lg p-1 opacity-0 transition-opacity group-hover:opacity-100 ${isDetailedView ? 'right-3 top-3' : 'right-2 top-1/2 -translate-y-1/2'}`}>
            {link.categoryId !== 'common' && (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!authToken) { setIsAuthOpen(true); return; } const updated = links.map(l => l.id === link.id ? { ...l, favorite: !l.favorite } : l); updateData(updated, categories); }} className={`rounded-md p-1 ${link.favorite ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100 hover:text-amber-500 dark:hover:bg-white/10'}`} title={link.favorite ? '取消常用推荐' : '加入常用推荐'}>
                <Star size={18} className={link.favorite ? 'fill-current' : ''} />
              </button>
            )}
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingLink(link); setIsModalOpen(true); }} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-500 dark:hover:bg-white/10" title="编辑">
              <Edit2 size={18} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const handleImportConfirm = (newLinks: LinkItem[], newCategories: Category[]) => {
    const mergedCategories = [...categories];
    const existingPaths = new Set(mergedCategories.map(c => getCategoryPath(mergedCategories, c.id)));
    if (!mergedCategories.some(c => c.id === 'common')) {
      mergedCategories.push({ id: 'common', name: '常用推荐', icon: 'Star' });
    }
    newCategories.forEach(nc => {
      const path = getCategoryPath([...mergedCategories, ...newCategories], nc.id);
      if (!mergedCategories.some(c => c.id === nc.id) && !existingPaths.has(path)) {
        mergedCategories.push(nc);
        existingPaths.add(path);
      }
    });
    const mergedLinks = [...links, ...newLinks];
    updateData(mergedLinks, mergedCategories);
    setIsImportModalOpen(false);
    alert(`成功导入 ${newLinks.length} 个书签!`);
  };

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSearchConfigModalOpen, setIsSearchConfigModalOpen] = useState(false);

  // --- Init effect for search config loading ---
  useEffect(() => {
    const savedToken = localStorage.getItem('cloudnav_auth_token');
    if (savedToken) setAuthToken(savedToken);
  }, []);

  // --- Return ---
  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      {requiresAuth && !authToken && (
        <div className="fixed inset-0 z-50 backdrop-blur-3xl bg-white/90 dark:bg-black/90 flex items-center justify-center">
          <div className="w-full max-w-md p-6">
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">需要身份验证</h1>
              <p className="text-slate-600 dark:text-slate-400">此导航页面设置了访问密码，请输入密码以继续访问</p>
            </div>
            <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>}>
              <AuthModal isOpen={true} onLogin={handleLogin} />
            </Suspense>
          </div>
        </div>
      )}

      {(!requiresAuth || authToken) && (
        <>
          <Suspense fallback={null}>
            <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} />
            <CategoryAuthModal isOpen={!!catAuthModalData} category={catAuthModalData} onClose={() => setCatAuthModalData(null)} onUnlock={handleUnlockCategory} />
            <CategoryEditorModal isOpen={categoryEditor.isOpen} mode={categoryEditor.mode} category={categoryEditor.category} parentId={categoryEditor.parentId} parentName={categoryEditor.parentId ? getCategoryPath(categories, categoryEditor.parentId) : undefined} parentOptions={categoryEditorParentOptions} onClose={closeCategoryEditor} onSave={handleSaveCategory} />
            <CategoryDeleteModal isOpen={!!deletingCategory} category={deletingCategory} categories={categories} onClose={() => setDeletingCategory(null)} onConfirm={handleDeleteCategory} />
            <BackupModal isOpen={isBackupModalOpen} onClose={() => setIsBackupModalOpen(false)} links={links} categories={categories} onRestore={(l, c) => { updateData(l, c); setIsBackupModalOpen(false); }} webDavConfig={webDavConfig} onSaveWebDavConfig={handleSaveWebDavConfig} searchConfig={{ mode: searchMode, externalSources: externalSearchSources, defaultSourceId: selectedSearchSource?.id, selectedSource: selectedSearchSource }} onRestoreSearchConfig={(sc) => handleSaveSearchConfig(sc.externalSources, sc.mode, sc.defaultSourceId || sc.selectedSource?.id)} aiConfig={aiConfig} onRestoreAIConfig={handleRestoreAIConfig} />
            <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} existingLinks={links} categories={categories} onImport={handleImportConfirm} onImportSearchConfig={(sc) => handleSaveSearchConfig(sc.externalSources, sc.mode, sc.defaultSourceId || sc.selectedSource?.id)} onImportAIConfig={handleRestoreAIConfig} />
            <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} config={aiConfig} siteSettings={siteSettings} onSave={handleSaveAIConfig} links={links} categories={categories} onUpdateLinks={(newLinks) => updateData(newLinks, categories)} authToken={authToken} />
            <SearchConfigModal isOpen={isSearchConfigModalOpen} onClose={() => setIsSearchConfigModalOpen(false)} sources={externalSearchSources} defaultSourceId={selectedSearchSource?.id} onSave={(sources, defaultSourceId) => handleSaveSearchConfig(sources, searchMode, defaultSourceId)} />
            <CategoryManagerModal isOpen={isCategoryManagerOpen} onClose={() => setIsCategoryManagerOpen(false)} categories={categories} onSave={handleSaveCategoryManager} />
            <LinkModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }} onSave={editingLink ? (data) => { if (!authToken) { setIsAuthOpen(true); return; } let processedUrl = data.url; if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) { processedUrl = 'https://' + processedUrl; } const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data, url: processedUrl } : l); updateData(updated, categories); setEditingLink(undefined); } : (data) => { if (!authToken) { setIsAuthOpen(true); return; } let processedUrl = data.url; if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) { processedUrl = 'https://' + processedUrl; } const categoryLinks = links.filter(link => data.categoryId === 'all' || link.categoryId === data.categoryId); const maxOrder = categoryLinks.length > 0 ? Math.max(...categoryLinks.map(link => link.order || 0)) : -1; const newLink: LinkItem = { ...data, url: processedUrl, id: Date.now().toString(), createdAt: Date.now(), order: maxOrder + 1 }; const updatedLinks = [...links, newLink].sort((a, b) => { const aOrder = a.order !== undefined ? a.order : a.createdAt; const bOrder = b.order !== undefined ? b.order : b.createdAt; return aOrder - bOrder; }); updateData(updatedLinks, categories); setPrefillLink(undefined); }} onDelete={editingLink ? (id) => { if (!authToken) { setIsAuthOpen(true); return; } if (confirm('确定删除此链接吗?')) { updateData(links.filter(l => l.id !== id), categories); } } : undefined} categories={categories} initialData={editingLink || (prefillLink as LinkItem)} aiConfig={aiConfig} defaultCategoryId={selectedCategory !== 'all' ? selectedCategory : undefined} />
            <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} onClose={closeContextMenu} onCopyLink={copyLinkToClipboard} onShowQRCode={showQRCode} onEditLink={editLinkFromContextMenu} onDeleteLink={deleteLinkFromContextMenu} />
            <QRCodeModal isOpen={qrCodeModal.isOpen} url={qrCodeModal.url || ''} title={qrCodeModal.title || ''} onClose={() => setQrCodeModal({ isOpen: false, url: '', title: '' })} />
          </Suspense>

          {commonNameEditorOpen && (
            <div className="liquid-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="liquid-panel w-full max-w-sm overflow-hidden rounded-2xl">
                <div className="flex items-center justify-between border-b liquid-divider p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">修改常用推荐名称</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">仅修改左侧菜单和页面标题显示。</p>
                  </div>
                  <button type="button" onClick={() => setCommonNameEditorOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/70"><X size={18} /></button>
                </div>
                <div className="space-y-4 p-4">
                  <input value={commonNameDraft} onChange={(event) => setCommonNameDraft(event.target.value)} className="liquid-input w-full rounded-xl px-3 py-2 text-sm outline-none dark:text-white" placeholder="常用推荐" autoFocus />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setCommonNameEditorOpen(false)} className="rounded-xl bg-white/55 px-4 py-2 text-sm text-slate-600 hover:bg-white/80 dark:bg-slate-700/60 dark:text-slate-300">取消</button>
                    <button type="button" onClick={handleSaveCommonName} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200">保存常用推荐</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {sidebarOpen && <div className="liquid-overlay fixed inset-0 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

          <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out bg-white/80 dark:bg-[#121212]/80 backdrop-blur-3xl border-r border-slate-200/50 dark:border-white/5 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
            <div className="h-16 flex items-center justify-center px-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">{siteSettings.navTitle || 'CloudNav'}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
              <div className="group relative">
                <button onClick={() => { setSelectedCategory('common'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 pr-10 transition-all ${selectedCategory === 'common' ? 'bg-blue-50 dark:bg-[#37373d] text-blue-600 dark:text-white font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                  <div className="p-1"><Icon name="Star" size={18} /></div>
                  <span className="truncate text-[13px]">{commonCategoryName}</span>
                </button>
                <button type="button" onClick={openCommonNameEditor} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-blue-500 hover:scale-110 active:scale-95 transition-all duration-200 group-hover:block dark:hover:bg-slate-700" title="修改常用推荐名称"><Edit2 size={14} /></button>
              </div>
              <div className="flex items-center justify-between pt-4 pb-2 px-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">目录</span>
                <div className="flex items-center gap-1">
                  <button onClick={openCategoryManager} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-500 dark:hover:bg-white/5" title="管理目录"><GripVertical size={14} /></button>
                  <button onClick={() => openCreateCategory()} className="rounded p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-white/5" title="新增一级目录"><Plus size={14} /></button>
                </div>
              </div>
              <div className="space-y-1">{renderCategoryNavItems(categoryTree.filter(cat => cat.id !== 'common'))}</div>
            </div>
            <div className="p-4 border-t liquid-divider bg-white/25 dark:bg-[#252526]/60 shrink-0">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsImportModalOpen(true); }} className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 rounded-lg border border-slate-200 dark:border-white/10 transition-all" title="导入书签"><Upload size={14} /><span>导入</span></button>
                <button onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsBackupModalOpen(true); }} className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 rounded-lg border border-slate-200 dark:border-white/10 transition-all" title="备份与恢复"><CloudCog size={14} /><span>备份</span></button>
                <button onClick={() => setIsSettingsModalOpen(true)} className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 rounded-lg border border-slate-200 dark:border-white/10 transition-all" title="AI 设置"><Settings size={14} /><span>设置</span></button>
              </div>
              <div className="mt-4 flex items-center justify-between border-t liquid-divider px-1 pt-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  {syncStatus === 'saving' && <Loader2 className="animate-spin w-3 h-3 text-blue-500" />}
                  {syncStatus === 'saved' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  {syncStatus === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                  {authToken ? <span className="text-green-600">已同步</span> : <span className="text-amber-500">离线</span>}
                </div>
                <span className="text-slate-400 dark:text-[#8c8c8c]">{APP_VERSION}</span>
              </div>
            </div>
          </aside>

          <main className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative">
            <header className="bg-white/60 dark:bg-[#0a0a0a]/60 backdrop-blur-2xl h-16 px-4 lg:px-8 flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 sticky top-0 z-10 shrink-0 transition-all duration-300 shadow-sm">
              <div className="flex items-center gap-4 flex-1">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300"><Menu size={24} /></button>
                <div className="flex flex-1 min-w-0 justify-center">
                  <button onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)} className="sm:flex md:hidden lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors" title="搜索"><Search size={20} /></button>
                  <div className={`relative w-full max-w-[640px] ${isMobileSearchOpen ? 'block' : 'hidden'} sm:block`}>
                    {showSearchSourcePopup && (
                      <div className="liquid-menu absolute left-0 top-full mt-2 w-full rounded-xl p-3 z-50" onMouseEnter={() => setIsPopupHovered(true)} onMouseLeave={() => setIsPopupHovered(false)}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {externalSearchSources.filter(source => source.enabled).map((source, index) => (
                            <button key={index} onClick={() => handleSearchSourceSelect(source)} onMouseEnter={() => setHoveredSearchSource(source)} onMouseLeave={() => setHoveredSearchSource(null)} className="px-2 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 flex items-center gap-1 justify-center">
                              <img src={`https://www.faviconextractor.com/favicon/${new URL(source.url).hostname}?larger=true`} alt={source.name} className="w-4 h-4" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNlYXJjaCI+PHBhdGggZD0ibTIxIDIxLTQuMzQtNC4zNCI+PC9wYXRoPjxjaXJjbGUgY3g9IjExIiBjeT0iMTEiIHI9IjgiPjwvY2lyY2xlPjwvc3ZnPg=='; }} />
                              <span className="truncate hidden sm:inline">{source.name}</span>
                            </button>
                          ))}
                        </div>
                        <button onClick={() => { setShowSearchSourcePopup(false); setIsSearchConfigModalOpen(true); }} className="mt-3 flex w-full items-center justify-center gap-2 border-t border-slate-200 pt-3 text-xs font-medium text-slate-500 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-blue-400"><Settings size={13} />管理搜索源</button>
                      </div>
                    )}
                    <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" onMouseEnter={() => setIsIconHovered(true)} onMouseLeave={() => setIsIconHovered(false)} onClick={() => setShowSearchSourcePopup(!showSearchSourcePopup)} title="切换搜索引擎">
                      {currentSearchSource && getSearchSourceIconUrl(currentSearchSource) ? <img src={getSearchSourceIconUrl(currentSearchSource)} alt={currentSearchSource.name} className="w-4 h-4" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNlYXJjaCI+PHBhdGggZD0ibTIxIDIxLTQuMzQtNC4zNCI+PC9wYXRoPjxjaXJjbGUgY3g9IjExIiBjeT0iMTEiIHI9IjgiPjwvY2lyY2xlPjwvc3ZnPg=='; }} /> : <Search size={16} />}
                    </button>
                    <input type="text" placeholder={currentSearchSource ? `搜索书签，或无结果时用${currentSearchSource.name}` : '搜索书签...'} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && shouldRunExternalSearch(searchQuery, displayedLinks.length)) { handleExternalSearch(); } }} className="w-full pl-9 pr-4 py-2 rounded-full bg-slate-100/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-[13px] text-center focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-blue-500/50 focus:border-transparent dark:text-white placeholder-slate-400 placeholder:text-center outline-none transition-all duration-300 shadow-sm" inputMode="search" enterKeyHint="search" />
                    {shouldRunExternalSearch(searchQuery, displayedLinks.length) && <button onClick={handleExternalSearch} className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-500" title="执行站外搜索"><ExternalLink size={14} /></button>}
                    {searchQuery.trim() && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 transition-all" title="清空搜索"><X size={12} strokeWidth={2.5} /></button>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleViewModeChange(siteSettings.cardStyle === 'simple' ? 'detailed' : 'simple')} className={`${isMobileSearchOpen ? 'hidden' : 'flex'} lg:flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-blue-600 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-[#37373d] dark:hover:text-blue-400`} title={siteSettings.cardStyle === 'simple' ? '当前：简约，点击切换到详情' : '当前：详情，点击切换到简约'}>
                  <Menu size={14} /><span>{siteSettings.cardStyle === 'simple' ? '简约' : '详情'}</span>
                </button>
                <div ref={themeMenuRef} className={`${isMobileSearchOpen ? 'hidden' : 'relative flex'} lg:flex`}>
                  <button onClick={() => setIsThemeMenuOpen(prev => !prev)} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-blue-600 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-[#37373d] dark:hover:text-blue-400" title="主题设置">
                    <currentThemeOption.icon size={15} /><span className="hidden sm:inline">{currentThemeOption.label}</span>
                  </button>
                  {isThemeMenuOpen && (
                    <div data-menu-surface className="liquid-menu absolute right-0 top-full z-30 mt-2 min-w-[180px] overflow-hidden rounded-xl p-2">
                      {themeOptions.map(option => (
                        <button key={option.id} type="button" onClick={() => handleThemeModeChange(option.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${themeMode === option.id ? 'bg-blue-50 text-blue-600 dark:bg-[#37373d] dark:text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}>
                          <span className="flex items-center gap-2"><option.icon size={15} />{option.label}</span>
                          {themeMode === option.id && <Check size={15} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'}`}>
                  {!authToken ? (
                    <button onClick={() => setIsAuthOpen(true)} className="flex items-center gap-2 bg-slate-200 dark:bg-white/10 px-3 py-1.5 rounded-full text-xs font-medium"><Cloud size={14} /> <span className="hidden sm:inline">登录</span></button>
                  ) : (
                    <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-200 dark:bg-white/10 px-3 py-1.5 rounded-full text-xs font-medium"><LogOut size={14} /> <span className="hidden sm:inline">退出</span></button>
                  )}
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8" onContextMenu={handleContentBlankContextMenu}>
              {(selectedCategory !== 'all' || searchQuery) && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      {selectedCategory === 'all' ? (searchQuery ? '搜索结果' : '所有链接') : (
                        <>
                          {getCategoryPath(categories, selectedCategory) || categories.find(c => c.id === selectedCategory)?.name}
                          {isCategoryLocked(selectedCategory) && <Lock size={14} className="text-amber-500" />}
                          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-[#37373d] text-blue-600 dark:text-white rounded-full">{displayedLinks.length}</span>
                        </>
                      )}
                    </h2>
                    {selectedCategory !== 'all' && !isCategoryLocked(selectedCategory) && (
                      isSortingMode === selectedCategory ? (
                        <div className="flex gap-2">
                          <button onClick={saveSorting} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-full transition-colors"><Save size={14} /><span>保存顺序</span></button>
                          <button onClick={cancelSorting} className="px-3 py-1.5 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full hover:bg-slate-300 dark:hover:bg-[#37373d] transition-all">取消</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {canCreateFolderHere && <button onClick={() => openCreateCategory(selectedCategory)} className="liquid-surface flex items-center gap-1 px-3 py-1.5 border text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full hover:border-blue-300 hover:text-blue-600 transition-colors"><FolderPlus size={14} /><span>文件夹</span></button>}
                          <button onClick={() => { setEditingLink(undefined); setPrefillLink(undefined); setIsModalOpen(true); if (!authToken) setIsAuthOpen(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200 text-white text-xs font-medium rounded-full"><Plus size={14} /><span>书签</span></button>
                          <button onClick={() => startSorting(selectedCategory)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200 text-white text-xs font-medium rounded-full"><GripVertical size={14} /><span>排序</span></button>
                        </div>
                      )
                    )}
                  </div>

                  {isBatchSelectionActive && (
                    <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <button type="button" onClick={handleSelectAll} className="flex items-center gap-2 text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400">
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${isAllCurrentSelected ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-900'}`}>{isAllCurrentSelected && <Check size={11} strokeWidth={3} />}</span><span>全选</span>
                      </button>
                      <div className="h-4 w-px bg-slate-200 dark:bg-white/10" /><span>已选择 {selectedItemCount} 项</span>
                      <div className="relative">
                        <button type="button" onClick={() => setBatchActionMenuOpen(prev => !prev)} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"><Upload size={15} />移动或复制</button>
                        {batchActionMenuOpen && (
                          <div data-menu-surface className="liquid-menu absolute left-0 top-full z-30 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl p-2">
                            <div className="px-2 py-1 text-xs font-medium text-slate-400">移动到</div>
                            {batchMoveTargetOptions.map(({ category, depth, path }) => (
                              <button key={`move-${category.id}`} type="button" onClick={() => handleBatchMove(category.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" title={path}><span className="truncate" style={{ paddingLeft: depth * 10 }}>{path}</span></button>
                            ))}
                            {selectedLinks.size > 0 && (
                              <>
                                <div className="my-1 border-t liquid-divider" /><div className="px-2 py-1 text-xs font-medium text-slate-400">复制书签到</div>
                                {batchMoveTargetOptions.map(({ category, depth, path }) => (
                                  <button key={`copy-${category.id}`} type="button" onClick={() => handleBatchCopyLinks(category.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" title={path}><span className="truncate" style={{ paddingLeft: depth * 10 }}>{path}</span></button>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={handleBatchDelete} className="flex items-center gap-1.5 text-blue-600 hover:text-red-600 dark:text-blue-400 dark:hover:text-red-400"><Trash2 size={15} />删除</button>
                      <button type="button" onClick={clearBatchSelection} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"><X size={15} />取消批量操作</button>
                    </div>
                  )}

                  {currentChildCategories.length > 0 && !searchQuery.trim() && (
                    <div className="mb-6">
                      <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Folder size={14} />文件夹</h3></div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{currentChildCategories.map(renderFolderCard)}</div>
                    </div>
                  )}

                  {displayedLinks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                      {isCategoryLocked(selectedCategory) ? (
                        <><Lock size={40} className="text-amber-400 mb-4" /><p>该目录已锁定</p><button onClick={() => setCatAuthModalData(categories.find(c => c.id === selectedCategory) || null)} className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg">输入密码解锁</button></>
                      ) : (
                        <><Search size={40} className="opacity-30 mb-4" /><p>{searchQuery ? '没有找到相关内容' : '这里还没有书签'}</p>{!searchQuery && selectedCategory !== 'all' && (
                          <div className="mt-4 flex flex-wrap justify-center gap-2">
                            {canCreateFolderHere && <button onClick={() => openCreateCategory(selectedCategory)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300">文件夹</button>}
                            <button onClick={() => { setEditingLink(undefined); setPrefillLink(undefined); setIsModalOpen(true); if (!authToken) setIsAuthOpen(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200">书签</button>
                          </div>
                        )}</>
                      )}
                    </div>
                  ) : (
                    isSortingMode === selectedCategory ? (
                      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                        <SortableContext items={displayedLinks.map(link => link.id)} strategy={rectSortingStrategy}>
                          <div className={`grid gap-3 ${siteSettings.cardStyle === 'detailed' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'}`}>
                            {displayedLinks.map(link => <React.Fragment key={link.id}><SortableLinkCard link={link} /></React.Fragment>)}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div className={`grid gap-3 ${siteSettings.cardStyle === 'detailed' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'}`}>
                        {displayedLinks.map(link => renderLinkCard(link))}
                      </div>
                    )
                  )}
                </section>
              )}

              {searchQuery.trim() && selectedCategory !== 'all' && (
                <section className="mt-8 pt-8 border-t-2 border-slate-200 dark:border-slate-700">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
                    其他目录搜索结果
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-full">{Object.values(otherCategoryResults).flat().length}</span>
                  </h2>
                  {Object.keys(otherCategoryResults).length > 0 ? (
                    (Object.entries(otherCategoryResults) as [string, LinkItem[]][]).map(([categoryId, categoryLinks]) => {
                      const category = categories.find(c => c.id === categoryId);
                      if (!category) return null;
                      return (
                        <div key={categoryId} className="mb-6 last:mb-0">
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{category.name}</h3>
                            <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 rounded-full">{categoryLinks.length}</span>
                          </div>
                          <div className={`grid gap-3 ${siteSettings.cardStyle === 'detailed' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'}`}>
                            {categoryLinks.map(link => renderLinkCard(link))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mb-4"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
                      <p className="text-sm">其他目录中没有找到相关内容</p>
                    </div>
                  )}
                </section>
              )}
            </div>
          </main>

          {folderMenu.isOpen && folderMenu.category && (
            <div data-menu-surface className="liquid-menu fixed z-50 min-w-[180px] overflow-hidden rounded-xl py-1" style={{ left: Math.min(folderMenu.position.x, window.innerWidth - 210), top: Math.min(folderMenu.position.y, window.innerHeight - 180) }}>
              <button onClick={() => folderMenu.category && openEditCategory(folderMenu.category)} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"><Edit2 size={15} />编辑文件夹</button>
            </div>
          )}

          {contentBlankMenu.isOpen && (
            <div data-menu-surface className="liquid-menu fixed z-50 min-w-[180px] overflow-hidden rounded-xl py-1" style={{ left: Math.min(contentBlankMenu.position.x, window.innerWidth - 210), top: Math.min(contentBlankMenu.position.y, window.innerHeight - 180) }}>
              {canCreateFolderHere && <button onClick={() => openCreateCategory(selectedCategory)} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"><FolderPlus size={15} />文件夹</button>}
              <button onClick={() => { setEditingLink(undefined); setPrefillLink(undefined); setIsModalOpen(true); if (!authToken) setIsAuthOpen(true); }} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"><Plus size={15} />书签</button>
              {canDeleteCurrentFolder && <button onClick={() => currentFolderCategory && openDeleteCategory(currentFolderCategory)} className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"><Trash2 size={15} />删除当前文件夹</button>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
