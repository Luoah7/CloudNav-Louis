
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Plus, Upload, Monitor, Moon, Sun, Menu,
  Trash2, Edit2, Loader2, Cloud, Check, CheckCircle2, AlertCircle,
  Settings, Lock, CloudCog, Github, GripVertical, Save, LogOut, ExternalLink, X,
  ChevronRight, Star, Folder, FolderPlus
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS, WebDavConfig, AIConfig, SearchMode, ExternalSearchSource, SearchConfig, SiteSettings } from './types';
import { parseBookmarks } from './services/bookmarkParser';
import { normalizeAppData } from './services/appData';
import { createDefaultSearchSources, filterLinksByQuery, resolveDefaultSearchSource, shouldRunExternalSearch } from './services/searchBehavior';
import {
  buildCategoryTree,
  flattenCategoryTree,
  getAncestorCategoryIds,
  getCategoryPath,
  getDescendantCategoryIds,
  normalizeCategories,
} from './services/categoryTree';
import type { CategoryTreeNode } from './services/categoryTree';
import Icon from './components/Icon';
import LinkModal from './components/LinkModal';
import AuthModal from './components/AuthModal';
import CategoryEditorModal from './components/CategoryEditorModal';
import CategoryDeleteModal from './components/CategoryDeleteModal';
import type { DeleteCategoryOptions } from './components/CategoryDeleteModal';
import CategoryManagerModal, { type CategoryManagerSavePayload } from './components/CategoryManagerModal';
import BackupModal from './components/BackupModal';
import CategoryAuthModal from './components/CategoryAuthModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import SearchConfigModal from './components/SearchConfigModal';
import ContextMenu from './components/ContextMenu';
import QRCodeModal from './components/QRCodeModal';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';
const AUTH_KEY = 'cloudnav_auth_token';
const WEBDAV_CONFIG_KEY = 'cloudnav_webdav_config';
const AI_CONFIG_KEY = 'cloudnav_ai_config';
const SEARCH_CONFIG_KEY = 'cloudnav_search_config';
const THEME_STORAGE_KEY = 'theme';
const SYSTEM_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const APP_VERSION = 'v1.8.1';

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  title: 'CloudNav',
  navTitle: 'CloudNav',
  favicon: '',
  cardStyle: 'detailed',
  passwordExpiryDays: 7,
};

const removeLegacyBrandPrefix = (value?: string) => {
  if (!value) return '';
  if (value === '云航 CloudNav' || value === '云航') return 'CloudNav';
  return value.replace(/^云航\s+/, '');
};

const normalizeSiteSettings = (settings?: Partial<SiteSettings>): SiteSettings => ({
  ...DEFAULT_SITE_SETTINGS,
  ...settings,
  title: removeLegacyBrandPrefix(settings?.title) || DEFAULT_SITE_SETTINGS.title,
  navTitle: removeLegacyBrandPrefix(settings?.navTitle) || DEFAULT_SITE_SETTINGS.navTitle,
  cardStyle: settings?.cardStyle || DEFAULT_SITE_SETTINGS.cardStyle,
  passwordExpiryDays: settings?.passwordExpiryDays !== undefined
    ? settings.passwordExpiryDays
    : DEFAULT_SITE_SETTINGS.passwordExpiryDays,
});

type ThemeMode = 'light' | 'dark' | 'system';

const normalizeThemeMode = (value: string | null): ThemeMode => (
  value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system'
);

function App() {
  // --- State ---
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => normalizeThemeMode(localStorage.getItem(THEME_STORAGE_KEY)));
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Search Mode State
  const [searchMode, setSearchMode] = useState<SearchMode>('external');
  const [externalSearchSources, setExternalSearchSources] = useState<ExternalSearchSource[]>([]);
  const [isLoadingSearchConfig, setIsLoadingSearchConfig] = useState(true);

  // Category Security State
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());

  // WebDAV Config State
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
      url: '',
      username: '',
      password: '',
      enabled: false
  });

  // AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
      const saved = localStorage.getItem(AI_CONFIG_KEY);
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) {}
      }
      return {
          provider: 'gemini',
          apiKey: process.env.API_KEY || '',
          baseUrl: '',
          model: 'gemini-2.5-flash'
      };
  });

  // Site Settings State
  const [siteSettings, setSiteSettings] = useState(() => {
      const saved = localStorage.getItem('cloudnav_site_settings');
      if (saved) {
          try {
              const normalized = normalizeSiteSettings(JSON.parse(saved));
              localStorage.setItem('cloudnav_site_settings', JSON.stringify(normalized));
              return normalized;
          } catch (e) {}
      }
      return DEFAULT_SITE_SETTINGS;
  });

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSearchConfigModalOpen, setIsSearchConfigModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [pendingCategoryManagerSave, setPendingCategoryManagerSave] = useState<CategoryManagerSavePayload | null>(null);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    parentId?: string;
    category?: Category | null;
  }>({ isOpen: false, mode: 'create' });
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [folderMenu, setFolderMenu] = useState<{
    isOpen: boolean;
    category: Category | null;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    category: null,
    position: { x: 0, y: 0 }
  });
  const [contentBlankMenu, setContentBlankMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    position: { x: 0, y: 0 }
  });
  const [commonNameEditorOpen, setCommonNameEditorOpen] = useState(false);
  const [commonNameDraft, setCommonNameDraft] = useState('');

  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  // State for data pre-filled from Bookmarklet
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);

  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string>('');
  const [requiresAuth, setRequiresAuth] = useState<boolean | null>(null); // null表示未检查，true表示需要认证，false表示不需要
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Sort State
  const [isSortingMode, setIsSortingMode] = useState<string | null>(null); // 存储正在排序的分类ID，null表示不在排序模式

  // Batch Selection State
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [batchActionMenuOpen, setBatchActionMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    link: LinkItem | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    link: null
  });

  // QR Code Modal State
  const [qrCodeModal, setQrCodeModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
  }>({
    isOpen: false,
    url: '',
    title: ''
  });

  // Mobile Search State
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // --- Helpers & Sync Logic ---

  const loadFromLocal = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const normalized = normalizeAppData(parsed.links || INITIAL_LINKS, parsed.categories || DEFAULT_CATEGORIES);

        setLinks(normalized.links);
        setCategories(normalized.categories);
      } catch (e) {
        setLinks(INITIAL_LINKS);
        setCategories(normalizeCategories(DEFAULT_CATEGORIES));
      }
    } else {
      setLinks(INITIAL_LINKS);
      setCategories(normalizeCategories(DEFAULT_CATEGORIES));
    }
  };

  const syncToCloud = async (newLinks: LinkItem[], newCategories: Category[], token: string) => {
    setSyncStatus('saving');
    try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': token
            },
            body: JSON.stringify({ links: newLinks, categories: newCategories })
        });

        if (response.status === 401) {
            // 检查是否是密码过期
            try {
                const errorData = await response.json();
                if (errorData.error && errorData.error.includes('过期')) {
                    alert('您的密码已过期，请重新登录');
                }
            } catch (e) {
                // 如果无法解析错误信息，使用默认提示
                console.error('Failed to parse error response', e);
            }

            setAuthToken('');
            localStorage.removeItem(AUTH_KEY);
            setIsAuthOpen(true);
            setSyncStatus('error');
            return false;
        }

        if (!response.ok) throw new Error('Network response was not ok');

        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return true;
    } catch (error) {
        console.error("Sync failed", error);
        setSyncStatus('error');
        return false;
    }
  };

  const updateData = (newLinks: LinkItem[], newCategories: Category[]) => {
      const normalized = normalizeAppData(newLinks, newCategories);
      // 1. Optimistic UI Update
      setLinks(normalized.links);
      setCategories(normalized.categories);

      // 2. Save to Local Cache
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: normalized.links, categories: normalized.categories }));

      // 3. Sync to Cloud (if authenticated)
      if (authToken) {
          syncToCloud(normalized.links, normalized.categories, authToken);
      }
  };

  const selectedItemCount = selectedLinks.size + selectedCategories.size;
  const isBatchSelectionActive = selectedItemCount > 0;

  // --- Context Menu Functions ---
  const handleContextMenu = (event: React.MouseEvent, link: LinkItem) => {
    event.preventDefault();
    event.stopPropagation();
	
    // 选择态下禁用右键菜单，避免批量操作和单项操作冲突
    if (isBatchSelectionActive) return;

    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      link: link
    });
    setFolderMenu(prev => ({ ...prev, isOpen: false }));
    setContentBlankMenu(prev => ({ ...prev, isOpen: false }));
  };

  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      link: null
    });
  };

  const copyLinkToClipboard = () => {
    if (!contextMenu.link) return;

    navigator.clipboard.writeText(contextMenu.link.url)
      .then(() => {
        // 可以添加一个短暂的提示
        console.log('链接已复制到剪贴板');
      })
      .catch(err => {
        console.error('复制链接失败:', err);
      });

    closeContextMenu();
  };

  const showQRCode = () => {
    if (!contextMenu.link) return;

    setQrCodeModal({
      isOpen: true,
      url: contextMenu.link.url,
      title: contextMenu.link.title
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

  // 加载链接图标缓存
  const loadLinkIcons = async (linksToLoad: LinkItem[]) => {
    if (!authToken) return; // 只有在已登录状态下才加载图标缓存

    const updatedLinks = [...linksToLoad];
    const domainsToFetch: string[] = [];

    // 收集所有链接的域名（包括已有图标的链接）
    for (const link of updatedLinks) {
      if (link.url) {
        try {
          let domain = link.url;
          if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
            domain = 'https://' + link.url;
          }

          if (domain.startsWith('http://') || domain.startsWith('https://')) {
            const urlObj = new URL(domain);
            domain = urlObj.hostname;
            domainsToFetch.push(domain);
          }
        } catch (e) {
          console.error("Failed to parse URL for icon loading", e);
        }
      }
    }

    // 批量获取图标
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
        } catch (error) {
          console.log(`Failed to fetch cached icon for ${domain}`, error);
        }
        return null;
      });

      const iconResults = await Promise.all(iconPromises);

      // 更新链接的图标
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
            } catch (e) {
              return false;
            }
            return false;
          });

          if (linkToUpdate) {
            // 只有当链接没有图标，或者当前图标是faviconextractor.com生成的，或者缓存中的图标是自定义图标时才更新
            if (!linkToUpdate.icon ||
                linkToUpdate.icon.includes('faviconextractor.com') ||
                !result.icon.includes('faviconextractor.com')) {
              linkToUpdate.icon = result.icon;
            }
          }
        }
      });

      // 更新状态
      setLinks(updatedLinks);
    }
  };

  // --- Effects ---

  useEffect(() => {
    // Load Token and check expiry
    const savedToken = localStorage.getItem(AUTH_KEY);
    const lastLoginTime = localStorage.getItem('lastLoginTime');

    if (savedToken) {
      const currentTime = Date.now();

      if (lastLoginTime) {
        const lastLogin = parseInt(lastLoginTime);
        const timeDiff = currentTime - lastLogin;

        const expiryDays = siteSettings.passwordExpiryDays || 7;
        const expiryTimeMs = expiryDays > 0 ? expiryDays * 24 * 60 * 60 * 1000 : 0;

        if (expiryTimeMs > 0 && timeDiff > expiryTimeMs) {
          localStorage.removeItem(AUTH_KEY);
          localStorage.removeItem('lastLoginTime');
          setAuthToken(null);
        } else {
          setAuthToken(savedToken);
        }
      } else {
        setAuthToken(savedToken);
      }
    }

    // Load WebDAV Config
    const savedWebDav = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (savedWebDav) {
        try {
            setWebDavConfig(JSON.parse(savedWebDav));
        } catch (e) {}
    }

    // Handle URL Params for Bookmarklet (Add Link)
    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
        const addTitle = urlParams.get('add_title') || '';
        // Clean URL params to avoid re-triggering on refresh
        window.history.replaceState({}, '', window.location.pathname);

        setPrefillLink({
            title: addTitle,
            url: addUrl,
            categoryId: 'common' // Default, Modal will handle selection
        });
        setEditingLink(undefined);
        setIsModalOpen(true);
    }

    // Initial Data Fetch
    const initData = async () => {
        // 首先检查是否需要认证
        try {
            const authRes = await fetch('/api/storage?checkAuth=true');
            if (authRes.ok) {
                const authData = await authRes.json();
                setRequiresAuth(authData.requiresAuth);

                // 如果需要认证但用户未登录，则不获取数据
                if (authData.requiresAuth && !savedToken) {
                    setIsCheckingAuth(false);
                    setIsAuthOpen(true);
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to check auth requirement.", e);
        }

        // 获取数据
        let hasCloudData = false;
        try {
            const res = await fetch('/api/storage', {
                headers: authToken ? { 'x-auth-password': authToken } : {}
            });
            if (res.ok) {
                const data = await res.json();
                if (data.links && data.links.length > 0) {
                    const normalized = normalizeAppData(data.links, data.categories || DEFAULT_CATEGORIES);
                    setLinks(normalized.links);
                    setCategories(normalized.categories);
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));

                    // 加载链接图标缓存
                    loadLinkIcons(normalized.links);
                    hasCloudData = true;
                }
            } else if (res.status === 401) {
                // 如果返回401，可能是密码过期，清除本地token并要求重新登录
                const errorData = await res.json();
                if (errorData.error && errorData.error.includes('过期')) {
                    setAuthToken(null);
                    localStorage.removeItem(AUTH_KEY);
                    setIsAuthOpen(true);
                    setIsCheckingAuth(false);
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to fetch from cloud, falling back to local.", e);
        }

        let hasSearchConfig = false;

        // 无论是否有云端数据，都尝试从KV空间加载搜索配置和网站配置
        try {
            const searchConfigRes = await fetch('/api/storage?getConfig=search');
            if (searchConfigRes.ok) {
                const searchConfigData = await searchConfigRes.json();
                // 检查搜索配置是否有效（包含必要的字段）
                if (searchConfigData && (searchConfigData.mode || searchConfigData.externalSources || searchConfigData.defaultSourceId || searchConfigData.selectedSource)) {
                    const loadedSources = searchConfigData.externalSources || [];
                    const defaultSource = resolveDefaultSearchSource(
                      loadedSources,
                      searchConfigData.defaultSourceId || searchConfigData.selectedSource?.id
                    );

                    setSearchMode(searchConfigData.mode || 'external');
                    setExternalSearchSources(loadedSources);
                    setSelectedSearchSource(defaultSource || searchConfigData.selectedSource || null);
                    hasSearchConfig = true;
                }
            }

            // 获取网站配置（包括密码过期时间设置）
            const websiteConfigRes = await fetch('/api/storage?getConfig=website');
            if (websiteConfigRes.ok) {
                const websiteConfigData = await websiteConfigRes.json();
                if (websiteConfigData) {
                    setSiteSettings(prev => normalizeSiteSettings({
                        ...prev,
                        ...websiteConfigData,
                    }));
                }
            }
        } catch (e) {
            console.warn("Failed to fetch configs from KV.", e);
        }

        // 如果有云端数据，则不需要加载本地数据
        if (hasCloudData) {
            setIsCheckingAuth(false);
            return;
        }

        // 如果没有云端数据，则加载本地数据
        loadFromLocal();

        // 如果从KV空间加载搜索配置失败，直接使用默认配置（不使用localStorage回退）
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

  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_THEME_MEDIA_QUERY);
    const syncTheme = () => {
      const nextDarkMode = themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
      setDarkMode(nextDarkMode);
      document.documentElement.classList.toggle('dark', nextDarkMode);
    };

    syncTheme();

    if (themeMode !== 'system') {
      return;
    }

    const handleChange = () => syncTheme();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  useEffect(() => {
    if (!isThemeMenuOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (themeMenuRef.current?.contains(target)) return;
      setIsThemeMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsThemeMenuOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isThemeMenuOpen]);

  // Update page title and favicon when site settings change
  useEffect(() => {
    if (siteSettings.title) {
      document.title = siteSettings.title;
    }

    if (siteSettings.favicon) {
      // Remove existing favicon links
      const existingFavicons = document.querySelectorAll('link[rel="icon"]');
      existingFavicons.forEach(favicon => favicon.remove());

      // Add new favicon
      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.href = siteSettings.favicon;
      document.head.appendChild(favicon);
    }
  }, [siteSettings.title, siteSettings.favicon]);

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    setIsThemeMenuOpen(false);
  };

  // 视图模式切换处理函数
  const handleViewModeChange = (cardStyle: 'detailed' | 'simple') => {
    const newSiteSettings = { ...siteSettings, cardStyle };
    setSiteSettings(newSiteSettings);
    localStorage.setItem('cloudnav_site_settings', JSON.stringify(newSiteSettings));
  };

  const themeOptions: Array<{
    id: ThemeMode;
    label: string;
    icon: typeof Sun;
  }> = [
    { id: 'light', label: '浅色', icon: Sun },
    { id: 'dark', label: '深色', icon: Moon },
    { id: 'system', label: '跟随系统', icon: Monitor },
  ];

  const currentThemeOption = themeOptions.find(option => option.id === themeMode) || themeOptions[2];

  // --- Batch Selection Functions ---
  const clearBatchSelection = () => {
    setSelectedLinks(new Set());
    setSelectedCategories(new Set());
    setBatchActionMenuOpen(false);
  };

  const toggleLinkSelection = (linkId: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(linkId)) {
        newSet.delete(linkId);
      } else {
        newSet.add(linkId);
      }
      return newSet;
    });
  };

  const toggleCategorySelection = (categoryId: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allSelected =
      (currentSelectableLinkIds.length > 0 || currentSelectableCategoryIds.length > 0) &&
      currentSelectableLinkIds.every(id => selectedLinks.has(id)) &&
      currentSelectableCategoryIds.every(id => selectedCategories.has(id));

    if (allSelected) {
      clearBatchSelection();
      return;
    }

    setSelectedLinks(new Set(currentSelectableLinkIds));
    setSelectedCategories(new Set(currentSelectableCategoryIds));
  };

  const handleBatchDelete = () => {
    if (!authToken) { setIsAuthOpen(true); return; }

    if (selectedItemCount === 0) {
      alert('请先选择要删除的项目');
      return;
    }

    const deletingCategoryIds = new Set<string>();
    selectedCategories.forEach(categoryId => {
      getDescendantCategoryIds(categories, categoryId).forEach(id => deletingCategoryIds.add(id));
    });
    const affectedLinkCount = links.filter(link => selectedLinks.has(link.id) || deletingCategoryIds.has(link.categoryId)).length;
    const message = `确定删除选中的 ${selectedItemCount} 项吗？${deletingCategoryIds.size > 0 ? `\n将同时删除 ${deletingCategoryIds.size} 个文件夹及其中 ${affectedLinkCount} 个书签。` : ''}`;

    if (confirm(message)) {
      const newLinks = links.filter(link => !selectedLinks.has(link.id) && !deletingCategoryIds.has(link.categoryId));
      const newCategories = categories.filter(category => !deletingCategoryIds.has(category.id));
      updateData(newLinks, newCategories);
      if (deletingCategoryIds.has(selectedCategory)) {
        setSelectedCategory('common');
      }
      clearBatchSelection();
    }
  };

  const handleBatchMove = (targetCategoryId: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }

    if (selectedItemCount === 0) {
      alert('请先选择要移动的项目');
      return;
    }

    const blockedTargetIds = new Set<string>();
    selectedCategories.forEach(categoryId => {
      getDescendantCategoryIds(categories, categoryId).forEach(id => blockedTargetIds.add(id));
    });
    if (blockedTargetIds.has(targetCategoryId)) {
      alert('不能移动到选中文件夹自身或其子文件夹中');
      return;
    }

    const newLinks = links.map(link =>
      selectedLinks.has(link.id) ? { ...link, categoryId: targetCategoryId } : link
    );
    const newCategories = categories.map(category =>
      selectedCategories.has(category.id)
        ? { ...category, parentId: targetCategoryId }
        : category
    );
    updateData(newLinks, newCategories);
    clearBatchSelection();
  };

  const handleBatchCopyLinks = (targetCategoryId: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (selectedLinks.size === 0) {
      alert('请选择要复制的书签');
      return;
    }

    const now = Date.now();
    const copiedLinks = links
      .filter(link => selectedLinks.has(link.id))
      .map((link, index) => ({
        ...link,
        id: `${now}-${index}-${link.id}`,
        categoryId: targetCategoryId,
        createdAt: now + index,
        order: undefined,
      }));

    updateData([...links, ...copiedLinks], categories);
    clearBatchSelection();
  };

  // --- Actions ---

  const handleLogin = async (password: string): Promise<boolean> => {
      try {
        // 首先验证密码
        const authResponse = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-password': password
            },
            body: JSON.stringify({ authOnly: true }) // 只用于验证密码，不更新数据
        });

        if (authResponse.ok) {
            setAuthToken(password);
            localStorage.setItem(AUTH_KEY, password);
            setIsAuthOpen(false);
            setSyncStatus('saved');
            const pendingManagerSave = pendingCategoryManagerSave;
            if (pendingManagerSave) {
              setPendingCategoryManagerSave(null);
              applyCategoryManagerSave(pendingManagerSave);
            }

            // 登录成功后，获取网站配置（包括密码过期时间设置）
            try {
                const websiteConfigRes = await fetch('/api/storage?getConfig=website');
                if (websiteConfigRes.ok) {
                    const websiteConfigData = await websiteConfigRes.json();
                    if (websiteConfigData) {
                        setSiteSettings(prev => normalizeSiteSettings({
                            ...prev,
                            ...websiteConfigData,
                        }));
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch website config after login.", e);
            }

            // 检查密码是否过期
            const lastLoginTime = localStorage.getItem('lastLoginTime');
            const currentTime = Date.now();

            if (lastLoginTime) {
                const lastLogin = parseInt(lastLoginTime);
                const timeDiff = currentTime - lastLogin;

                const expiryTimeMs = (siteSettings.passwordExpiryDays || 7) > 0 ? (siteSettings.passwordExpiryDays || 7) * 24 * 60 * 60 * 1000 : 0;

                if (expiryTimeMs > 0 && timeDiff > expiryTimeMs) {
                    setAuthToken(null);
                    localStorage.removeItem(AUTH_KEY);
                    setIsAuthOpen(true);
                    alert('您的密码已过期，请重新登录');
                    return false;
                }
            }

            localStorage.setItem('lastLoginTime', currentTime.toString());

            // 登录成功后，从服务器获取数据
            try {
                const res = await fetch('/api/storage');
                if (res.ok) {
                    const data = await res.json();
                    // 如果服务器有数据，使用服务器数据
                    if (data.links && data.links.length > 0) {
                        const normalized = normalizeAppData(data.links, data.categories || DEFAULT_CATEGORIES);
                        setLinks(normalized.links);
                        setCategories(normalized.categories);
                        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));

                        // 加载链接图标缓存
                        loadLinkIcons(normalized.links);
                    } else {
                        // 如果服务器没有数据，使用本地数据
                        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links, categories }));
                        // 并将本地数据同步到服务器
                        syncToCloud(links, categories, password);

                        // 加载链接图标缓存
                        loadLinkIcons(links);
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch data after login.", e);
                loadFromLocal();
                // 尝试将本地数据同步到服务器
                syncToCloud(links, categories, password);
            }

            // 登录成功后，从KV空间加载AI配置
            try {
                const aiConfigRes = await fetch('/api/storage?getConfig=ai');
                if (aiConfigRes.ok) {
                    const aiConfigData = await aiConfigRes.json();
                    if (aiConfigData && Object.keys(aiConfigData).length > 0) {
                        setAiConfig(aiConfigData);
                        localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiConfigData));
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch AI config after login.", e);
            }

            return true;
        }
        return false;
      } catch (e) {
          return false;
      }
  };

  const handleLogout = () => {
      setAuthToken(null);
      localStorage.removeItem(AUTH_KEY);
      setSyncStatus('offline');
      // 退出后重新加载本地数据
      loadFromLocal();
  };

  const handleImportConfirm = (newLinks: LinkItem[], newCategories: Category[]) => {
      // Merge categories: Avoid duplicate names/IDs
      const mergedCategories = [...categories];
      const existingPaths = new Set(mergedCategories.map(c => getCategoryPath(mergedCategories, c.id)));

      // 确保"常用推荐"分类始终存在
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

  const handleAddLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }

    // 处理URL，确保有协议前缀
    let processedUrl = data.url;
    if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }

    const categoryLinks = links.filter(link => data.categoryId === 'all' || link.categoryId === data.categoryId);

    // 计算新链接的order值，使其排在分类最后
    const maxOrder = categoryLinks.length > 0
      ? Math.max(...categoryLinks.map(link => link.order || 0))
      : -1;

    const newLink: LinkItem = {
      ...data,
      url: processedUrl, // 使用处理后的URL
      id: Date.now().toString(),
      createdAt: Date.now(),
      order: maxOrder + 1, // 设置为当前分类的最大order值+1，确保排在最后
    };

    const updatedLinks = [...links, newLink].sort((a, b) => {
      const aOrder = a.order !== undefined ? a.order : a.createdAt;
      const bOrder = b.order !== undefined ? b.order : b.createdAt;
      return aOrder - bOrder;
    });
    updateData(updatedLinks, categories);

    // Clear prefill if any
    setPrefillLink(undefined);
  };

  const handleEditLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!editingLink) return;

    // 处理URL，确保有协议前缀
    let processedUrl = data.url;
    if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }

    const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data, url: processedUrl } : l);
    updateData(updated, categories);
    setEditingLink(undefined);
  };

  // 拖拽结束事件处理函数
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 获取当前分类下的所有链接
      const categoryLinks = links.filter(link =>
        selectedCategory === 'all' ||
        (selectedCategory === 'common'
          ? link.categoryId === 'common' || link.favorite
          : selectedCategoryIds.has(link.categoryId))
      );

      // 找到被拖拽元素和目标元素的索引
      const activeIndex = categoryLinks.findIndex(link => link.id === active.id);
      const overIndex = categoryLinks.findIndex(link => link.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        // 重新排序当前分类的链接
        const reorderedCategoryLinks = arrayMove<LinkItem>(categoryLinks, activeIndex, overIndex);

        // 更新所有链接的顺序
        const updatedLinks = links.map(link => {
          const reorderedIndex = reorderedCategoryLinks.findIndex(l => l.id === link.id);
          if (reorderedIndex !== -1) {
            return { ...link, order: reorderedIndex };
          }
          return link;
        });

        // 按照order字段重新排序
        updatedLinks.sort((a, b) => (a.order || 0) - (b.order || 0));

        updateData(updatedLinks, categories);
      }
    }
  };

  // 开始排序
  const startSorting = (categoryId: string) => {
    setIsSortingMode(categoryId);
  };

  // 保存排序
  const saveSorting = () => {
    // 在保存排序时，确保将当前排序后的数据保存到服务器和本地存储
    updateData(links, categories);
    setIsSortingMode(null);
  };

  // 取消排序
  const cancelSorting = () => {
    setIsSortingMode(null);
  };

  // 设置dnd-kit的传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要拖动8px才开始拖拽，避免误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDeleteLink = (id: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (confirm('确定删除此链接吗?')) {
      updateData(links.filter(l => l.id !== id), categories);
    }
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!authToken) { setIsAuthOpen(true); return; }

      const updated = links.map(l => l.id === id ? { ...l, favorite: !l.favorite } : l);
      updateData(updated, categories);
  };

  const handleSaveAIConfig = async (config: AIConfig, newSiteSettings?: any) => {
      setAiConfig(config);
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));

      if (newSiteSettings) {
          setSiteSettings(newSiteSettings);
          localStorage.setItem('cloudnav_site_settings', JSON.stringify(newSiteSettings));
      }

      if (authToken) {
          try {
              const response = await fetch('/api/storage', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'x-auth-password': authToken
                  },
                  body: JSON.stringify({
                      saveConfig: 'ai',
                      config: config
                  })
              });

              if (!response.ok) {
                  console.error('Failed to save AI config to KV:', response.statusText);
              }
          } catch (error) {
              console.error('Error saving AI config to KV:', error);
          }

          if (newSiteSettings) {
              try {
                  const response = await fetch('/api/storage', {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                          'x-auth-password': authToken
                      },
                      body: JSON.stringify({
                          saveConfig: 'website',
                          config: newSiteSettings
                      })
                  });

                  if (!response.ok) {
                      console.error('Failed to save website config to KV:', response.statusText);
                  }
              } catch (error) {
                  console.error('Error saving website config to KV:', error);
              }
          }
      }
  };

  const handleRestoreAIConfig = async (config: AIConfig) => {
      setAiConfig(config);
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));

      // 同时保存到KV空间
      if (authToken) {
          try {
              const response = await fetch('/api/storage', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'x-auth-password': authToken
                  },
                  body: JSON.stringify({
                      saveConfig: 'ai',
                      config: config
                  })
              });

              if (!response.ok) {
                  console.error('Failed to restore AI config to KV:', response.statusText);
              }
          } catch (error) {
              console.error('Error restoring AI config to KV:', error);
          }
      }
  };

  // --- Category Management & Security ---

  const openCreateCategory = (parentId?: string) => {
      setFolderMenu(prev => ({ ...prev, isOpen: false }));
      closeContentBlankMenu();
      if (!authToken) { setIsAuthOpen(true); return; }
      setCategoryEditor({ isOpen: true, mode: 'create', parentId });
  };

  const openCategoryManager = () => {
      setIsCategoryManagerOpen(true);
  };

  const closeContentBlankMenu = () => {
    setContentBlankMenu({
      isOpen: false,
      position: { x: 0, y: 0 }
    });
  };

  const openCreateLink = () => {
    setFolderMenu(prev => ({ ...prev, isOpen: false }));
    closeContentBlankMenu();
    if (!authToken) { setIsAuthOpen(true); return; }
    setEditingLink(undefined);
    setPrefillLink(undefined);
    setIsModalOpen(true);
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
      position: { x: event.clientX, y: event.clientY }
    });
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, link: null });
    setFolderMenu(prev => ({ ...prev, isOpen: false }));
  };

  const openEditCategory = (category: Category) => {
      setFolderMenu(prev => ({ ...prev, isOpen: false }));
      closeContentBlankMenu();
      if (!authToken) { setIsAuthOpen(true); return; }
      if (category.id === 'common') return;
      setCategoryEditor({ isOpen: true, mode: 'edit', category });
  };

  const openCommonNameEditor = (event?: React.MouseEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (!authToken) { setIsAuthOpen(true); return; }
      setCommonNameDraft(commonCategoryName);
      setCommonNameEditorOpen(true);
  };

  const handleSaveCommonName = () => {
      if (!authToken) { setIsAuthOpen(true); return; }
      const nextName = commonNameDraft.trim() || '常用推荐';
      const hasCommon = categories.some(category => category.id === 'common');
      const nextCategories = hasCommon
        ? categories.map(category => category.id === 'common' ? { ...category, name: nextName, icon: category.icon || 'Star' } : category)
        : [{ id: 'common', name: nextName, icon: 'Star' }, ...categories];

      updateData(links, nextCategories);
      setCommonNameEditorOpen(false);
  };

  const closeCategoryEditor = () => {
      setCategoryEditor({ isOpen: false, mode: 'create' });
  };

  const handleSaveCategory = (data: { name: string; icon: string; password?: string; parentId?: string }) => {
      if (!authToken) { setIsAuthOpen(true); return; }

      if (categoryEditor.mode === 'edit' && categoryEditor.category) {
          const updated = categories.map(cat => cat.id === categoryEditor.category?.id
            ? {
                ...cat,
                ...data,
                order: cat.parentId !== data.parentId ? undefined : cat.order,
              }
            : cat
          );
          updateData(links, updated);
      } else {
          const newCategory: Category = {
              id: Date.now().toString(),
              name: data.name,
              icon: data.icon,
              password: data.password,
              parentId: data.parentId || undefined,
          };
          updateData(links, [...categories, newCategory]);
          if (newCategory.parentId) {
              setExpandedCategoryIds(prev => new Set(prev).add(newCategory.parentId!));
          }
      }

      closeCategoryEditor();
  };

  const applyCategoryManagerSave = ({ categories: nextCategories, deleteActions }: CategoryManagerSavePayload) => {

      const validCategoryIds = new Set(nextCategories.map(category => category.id));
      let nextLinks = links;
      let nextSelectedCategory = selectedCategory;

      deleteActions.forEach(action => {
          const deletingIds = new Set(action.deletedCategoryIds);
          if (action.options.mode === 'move') {
              const targetCategoryId = validCategoryIds.has(action.options.targetCategoryId)
                ? action.options.targetCategoryId
                : 'common';
              nextLinks = nextLinks.map(link => deletingIds.has(link.categoryId)
                ? { ...link, categoryId: targetCategoryId }
                : link
              );
          } else {
              nextLinks = nextLinks.filter(link => !deletingIds.has(link.categoryId));
          }

          if (deletingIds.has(nextSelectedCategory)) {
              nextSelectedCategory = 'common';
          }
      });

      if (nextSelectedCategory !== selectedCategory) {
          setSelectedCategory(nextSelectedCategory);
      }

      updateData(nextLinks, nextCategories);
      setIsCategoryManagerOpen(false);
  };

  const handleSaveCategoryManager = (payload: CategoryManagerSavePayload) => {
      if (!authToken) {
          setPendingCategoryManagerSave(payload);
          setIsAuthOpen(true);
          return;
      }

      applyCategoryManagerSave(payload);
  };

  const openDeleteCategory = (category: Category) => {
      setFolderMenu(prev => ({ ...prev, isOpen: false }));
      closeContentBlankMenu();
      if (!authToken) { setIsAuthOpen(true); return; }
      if (category.id === 'common') return;
      setDeletingCategory(category);
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

  const handleCategoryClick = (cat: Category) => {
      const lockedCategory = [...getAncestorCategoryIds(categories, cat.id), cat.id]
        .map(id => categories.find(c => c.id === id))
        .find(category => category?.password && !unlockedCategoryIds.has(category.id));

      if (lockedCategory) {
          setCatAuthModalData(lockedCategory);
          setSidebarOpen(false);
          return;
      }
      setSelectedCategory(cat.id);
      setSidebarOpen(false);
  };

  const handleUnlockCategory = (catId: string) => {
      setUnlockedCategoryIds(prev => new Set(prev).add(catId));
      setSelectedCategory(catId);
  };

  const handleDeleteCategory = (catId: string, options: DeleteCategoryOptions) => {
      if (!authToken) { setIsAuthOpen(true); return; }

      // 防止删除"常用推荐"分类
      if (catId === 'common') {
          alert('"常用推荐"分类不能被删除');
          return;
      }

      const deletingIds = new Set(getDescendantCategoryIds(categories, catId));
      let newCats = categories.filter(c => !deletingIds.has(c.id));

      // 检查是否存在"常用推荐"分类，如果不存在则创建它
      if (!newCats.some(c => c.id === 'common')) {
          newCats = [
              { id: 'common', name: '常用推荐', icon: 'Star' },
              ...newCats
          ];
      }

      const newLinks = options.mode === 'move'
        ? links.map(l => deletingIds.has(l.categoryId) ? { ...l, categoryId: options.targetCategoryId } : l)
        : links.filter(l => !deletingIds.has(l.categoryId));

      if (deletingIds.has(selectedCategory)) {
        setSelectedCategory('common');
      }

      updateData(newLinks, newCats);
      setDeletingCategory(null);
  };

  // --- WebDAV Config ---
  const handleSaveWebDavConfig = (config: WebDavConfig) => {
      setWebDavConfig(config);
      localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  };

  // 搜索源选择弹出窗口状态
  const [showSearchSourcePopup, setShowSearchSourcePopup] = useState(false);
  const [hoveredSearchSource, setHoveredSearchSource] = useState<ExternalSearchSource | null>(null);
  const [selectedSearchSource, setSelectedSearchSource] = useState<ExternalSearchSource | null>(null);
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [isPopupHovered, setIsPopupHovered] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 处理弹出窗口显示/隐藏逻辑
  useEffect(() => {
    if (isIconHovered || isPopupHovered) {
      // 如果图标或弹出窗口被悬停，清除隐藏定时器并显示弹出窗口
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setShowSearchSourcePopup(true);
    } else {
      // 如果图标和弹出窗口都没有被悬停，设置一个延迟隐藏弹出窗口
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setShowSearchSourcePopup(false);
        setHoveredSearchSource(null);
      }, 100);
    }

    // 清理函数
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isIconHovered, isPopupHovered]);

  // 处理搜索源选择
  const handleSearchSourceSelect = async (source: ExternalSearchSource) => {
    // 更新默认搜索源
    setSelectedSearchSource(source);

    // 保存默认搜索源到KV空间
    await handleSaveSearchConfig(externalSearchSources, searchMode, source.id);
    setShowSearchSourcePopup(false);
    setHoveredSearchSource(null);
  };

  // --- Search Config ---
  const handleSaveSearchConfig = async (sources: ExternalSearchSource[], mode: SearchMode, defaultSourceId?: string) => {
      const defaultSource = resolveDefaultSearchSource(sources, defaultSourceId || selectedSearchSource?.id);
      const searchConfig: SearchConfig = {
          mode,
          externalSources: sources,
          defaultSourceId: defaultSource?.id,
          selectedSource: defaultSource
      };

      setExternalSearchSources(sources);
      setSearchMode(mode);
      setSelectedSearchSource(defaultSource);

      // 只保存到KV空间（搜索配置允许无密码访问）
      try {
          const headers: Record<string, string> = {
              'Content-Type': 'application/json'
          };

          // 如果有认证令牌，添加认证头
          if (authToken) {
              headers['x-auth-password'] = authToken;
          }

          const response = await fetch('/api/storage', {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({
                  saveConfig: 'search',
                  config: searchConfig
              })
          });

          if (!response.ok) {
              console.error('Failed to save search config to KV:', response.statusText);
          }
      } catch (error) {
          console.error('Error saving search config to KV:', error);
      }
  };

  const handleExternalSearch = () => {
      if (searchQuery.trim()) {
          // 如果搜索源列表为空，自动加载默认搜索源
          if (externalSearchSources.length === 0) {
              const defaultSources = createDefaultSearchSources();

              // 保存默认搜索源到状态和KV空间
              handleSaveSearchConfig(defaultSources, 'external', defaultSources[0]?.id);

              // 使用第一个默认搜索源立即执行搜索
              const searchUrl = defaultSources[0].url.replace('{query}', encodeURIComponent(searchQuery));
              window.open(searchUrl, '_blank');
              return;
          }

          // 如果有选中的搜索源，使用选中的搜索源；否则使用第一个启用的搜索源
          let source = selectedSearchSource;
          if (!source) {
              const enabledSources = externalSearchSources.filter(s => s.enabled);
              if (enabledSources.length > 0) {
                  source = enabledSources[0];
              }
          }

          if (source) {
              const searchUrl = source.url.replace('{query}', encodeURIComponent(searchQuery));
              window.open(searchUrl, '_blank');
          }
      }
  };

  const handleRestoreBackup = (restoredLinks: LinkItem[], restoredCategories: Category[]) => {
      updateData(restoredLinks, restoredCategories);
      setIsBackupModalOpen(false);
  };

  const handleRestoreSearchConfig = (restoredSearchConfig: SearchConfig) => {
      handleSaveSearchConfig(
        restoredSearchConfig.externalSources,
        restoredSearchConfig.mode,
        restoredSearchConfig.defaultSourceId || restoredSearchConfig.selectedSource?.id
      );
  };

  // --- Filtering & Memo ---

  // Helper to check if a category is "Locked" (Has password AND not unlocked)
  const isCategoryLocked = (catId: string) => {
      const categoryIds = [...getAncestorCategoryIds(categories, catId), catId];
      return categoryIds.some(id => {
        const cat = categories.find(c => c.id === id);
        return !!cat?.password && !unlockedCategoryIds.has(id);
      });
  };

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatCategories = useMemo(() => flattenCategoryTree(categories), [categories]);
  const categoryEditorParentOptions = useMemo(() => {
    const excludedIds = new Set<string>(['common']);
    if (categoryEditor.mode === 'edit' && categoryEditor.category) {
      getDescendantCategoryIds(categories, categoryEditor.category.id).forEach(id => excludedIds.add(id));
    }

    return flattenCategoryTree(categories, { includeCommon: false, excludeIds: excludedIds }).map(({ category, path }) => ({
      id: category.id,
      path,
    }));
  }, [categories, categoryEditor]);
  const selectedCategoryIds = useMemo(() => (
    selectedCategory !== 'all' && selectedCategory !== 'common'
      ? new Set(getDescendantCategoryIds(categories, selectedCategory))
      : new Set<string>()
  ), [categories, selectedCategory]);

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

  const currentChildCategories = useMemo(() => {
    const parentId = selectedCategory === 'all' ? undefined : selectedCategory;
    if (selectedCategory === 'common') return [];
    return categories
      .filter(cat => cat.id !== 'common' && cat.parentId === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [categories, selectedCategory]);

  const displayedLinks = useMemo(() => {
    let result = links;

    // Security Filter: Always hide links from locked categories
    result = result.filter(l => !isCategoryLocked(l.categoryId));

    // Search Filter
    result = filterLinksByQuery(result, categories, searchQuery);

    // Category Filter
    if (selectedCategory === 'common') {
      result = result.filter(l => l.categoryId === 'common' || l.favorite);
    } else if (selectedCategory !== 'all') {
      result = result.filter(l => selectedCategoryIds.has(l.categoryId));
    }

    // 按照order字段排序，如果没有order字段则按创建时间排序
    // 修改排序逻辑：order值越大排在越前面，新增的卡片order值最大，会排在最前面
    // 我们需要反转这个排序，让新增的卡片(order值最大)排在最后面
    return [...result].sort((a, b) => {
      const aOrder = a.order !== undefined ? a.order : a.createdAt;
      const bOrder = b.order !== undefined ? b.order : b.createdAt;
      // 改为升序排序，这样order值小(旧卡片)的排在前面，order值大(新卡片)的排在后面
      return aOrder - bOrder;
    });
  }, [links, selectedCategory, selectedCategoryIds, searchQuery, categories, unlockedCategoryIds]);

  const currentSelectableLinkIds = useMemo(() => displayedLinks.map(link => link.id), [displayedLinks]);
  const currentSelectableCategoryIds = useMemo(() => currentChildCategories.map(category => category.id), [currentChildCategories]);
  const isAllCurrentSelected = (
    (currentSelectableLinkIds.length > 0 || currentSelectableCategoryIds.length > 0) &&
    currentSelectableLinkIds.every(id => selectedLinks.has(id)) &&
    currentSelectableCategoryIds.every(id => selectedCategories.has(id))
  );
  const batchMoveTargetOptions = useMemo(() => {
    const blockedIds = new Set<string>();
    selectedCategories.forEach(categoryId => {
      getDescendantCategoryIds(categories, categoryId).forEach(id => blockedIds.add(id));
    });

    return flatCategories.filter(({ category }) => {
      if (blockedIds.has(category.id)) return false;
      if (selectedCategories.size > 0 && category.id === 'common') return false;
      return true;
    });
  }, [categories, flatCategories, selectedCategories]);

  // 计算其他目录的搜索结果
  const otherCategoryResults = useMemo<Record<string, LinkItem[]>>(() => {
    if (!searchQuery.trim() || selectedCategory === 'all') {
      return {};
    }

    // 获取其他目录中匹配的链接
    const otherLinks = filterLinksByQuery(links, categories, searchQuery).filter(link => {
      // 排除当前视图已经展示的链接
      if (selectedCategory === 'common' && (link.categoryId === 'common' || link.favorite)) {
        return false;
      }
      if (selectedCategory !== 'common' && selectedCategoryIds.has(link.categoryId)) {
        return false;
      }

      // 排除锁定的目录
      if (isCategoryLocked(link.categoryId)) {
        return false;
      }

      return true;
    });

    // 按目录分组
    const groupedByCategory = otherLinks.reduce((acc, link) => {
      if (!acc[link.categoryId]) {
        acc[link.categoryId] = [];
      }
      acc[link.categoryId].push(link);
      return acc;
    }, {} as Record<string, LinkItem[]>);

    // 对每个目录内的链接进行排序
    Object.keys(groupedByCategory).forEach(categoryId => {
      groupedByCategory[categoryId].sort((a, b) => {
        const aOrder = a.order !== undefined ? a.order : a.createdAt;
        const bOrder = b.order !== undefined ? b.order : b.createdAt;
        return aOrder - bOrder;
      });
    });

    return groupedByCategory;
  }, [links, selectedCategory, selectedCategoryIds, searchQuery, categories, unlockedCategoryIds]);


  // --- Render Components ---

  const toggleCategoryExpanded = (categoryId: string) => {
    setExpandedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getSearchSourceIconUrl = (source: ExternalSearchSource | null) => {
    if (!source) return '';
    try {
      return `https://www.faviconextractor.com/favicon/${new URL(source.url).hostname}?larger=true`;
    } catch {
      return '';
    }
  };

  const currentSearchSource = hoveredSearchSource || resolveDefaultSearchSource(externalSearchSources, selectedSearchSource?.id) || selectedSearchSource || null;
  const commonCategory = categories.find(category => category.id === 'common') || null;
  const commonCategoryName = commonCategory?.name || '常用推荐';
  const currentFolderCategory = categories.find(cat => cat.id === selectedCategory) || null;
  const canCreateFolderHere = selectedCategory !== 'common' && selectedCategory !== 'all';
  const canDeleteCurrentFolder = selectedCategory !== 'common' && selectedCategory !== 'all' && !!currentFolderCategory;

  const getLinkHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0] || url;
    }
  };

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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) toggleCategoryExpanded(cat.id);
              }}
              className={`w-6 h-9 flex items-center justify-center rounded-lg transition-colors ${
                hasChildren
                  ? 'text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-white/5'
                  : 'text-transparent'
              }`}
              aria-label={isExpanded ? '收起分类' : '展开分类'}
              disabled={!hasChildren}
            >
              <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
            <button
              onClick={() => handleCategoryClick(cat)}
              className={`flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-95 group ${
                isSelected
                  ? 'bg-blue-50/80 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 font-medium shadow-sm border border-blue-100/50 dark:border-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50/80 dark:hover:bg-white/5 border border-transparent'
              }`}
              title={getCategoryPath(categories, cat.id)}
            >
              <div className={`p-1.5 rounded-lg transition-colors flex items-center justify-center shadow-sm ${isSelected ? 'bg-blue-100/80 dark:bg-blue-500/30 text-blue-600 dark:text-blue-300' : 'bg-slate-100/80 dark:bg-white/10'}`}>
                {isLocked ? <Lock size={16} className="text-amber-500" /> : <Icon name={cat.icon} size={16} />}
              </div>
              <span className="truncate flex-1 text-left text-[13px]">{cat.name}</span>
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
            </button>
          </div>
          {hasChildren && isExpanded && (
            <div className="mt-1 space-y-1">
              {renderCategoryNavItems(cat.children, depth + 1)}
            </div>
          )}
        </div>
      );
    })
  );

  const renderSelectionCheckbox = (
    checked: boolean,
    onToggle: (event: React.MouseEvent) => void,
    title: string,
    className = 'left-3 top-3'
  ) => (
    <button
      type="button"
      onClick={onToggle}
      className={`absolute ${className} z-20 flex h-5 w-5 items-center justify-center rounded border transition-all ${
        checked || isBatchSelectionActive
          ? 'opacity-100'
          : 'opacity-0 group-hover:opacity-100'
      } ${
        checked
          ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
          : 'border-slate-300 bg-white text-transparent hover:border-blue-400 dark:border-slate-500 dark:bg-slate-900'
      }`}
      title={title}
      aria-pressed={checked}
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );

  const renderFolderCard = (category: Category) => {
    const isSelected = selectedCategories.has(category.id);

    return (
      <div
        key={category.id}
        onContextMenu={(e) => handleFolderContextMenu(e, category)}
        className={`liquid-surface group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-hover dark:hover:shadow-hover-dark ${
          isSelected ? 'border-blue-400 bg-blue-50/80 dark:border-blue-500/50 dark:bg-blue-500/10' : 'border-slate-200/70 hover:border-blue-300 dark:border-white/5 dark:hover:border-blue-500/30'
        }`}
        title={getCategoryPath(categories, category.id)}
      >
        {renderSelectionCheckbox(
          isSelected,
          (event) => toggleCategorySelection(category.id, event),
          isSelected ? '取消选择文件夹' : '选择文件夹'
        )}
        <button
          type="button"
          onClick={() => handleCategoryClick(category)}
          className="flex min-h-[88px] w-full items-center gap-4 p-4 pl-10 pr-28 text-left"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200/50 bg-white/80 text-blue-500 shadow-sm dark:border-white/5 dark:bg-white/5">
            <Icon name={category.icon || 'Folder'} size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{category.name}</h3>
              {category.password && <Lock size={13} className="shrink-0 text-amber-500" />}
            </div>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {categories.filter(cat => cat.parentId === category.id).length} 个子文件夹
            </p>
          </div>
        </button>
        {!isBatchSelectionActive && (
          <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openEditCategory(category); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/70 hover:text-blue-500 hover:scale-110 active:scale-95 transition-all duration-200 dark:hover:bg-white/10"
              title="编辑文件夹"
            >
              <Edit2 size={15} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderLinkIcon = (link: LinkItem, isDetailedView: boolean) => (
    <div className={`flex shrink-0 items-center justify-center font-semibold uppercase text-blue-600 dark:text-blue-400 ${
      isDetailedView
        ? 'h-12 w-12 rounded-lg border border-slate-200/90 bg-white/70 text-base dark:border-white/10 dark:bg-white/10'
        : 'h-8 w-8 rounded-lg bg-white/70 text-sm dark:bg-white/10'
    }`}>
      {link.icon ? (
        <img
          src={link.icon}
          alt=""
          className={isDetailedView ? 'h-8 w-8 rounded-md object-contain' : 'h-5 w-5 object-contain'}
        />
      ) : (
        link.title.charAt(0)
      )}
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
              <h3 className="min-w-0 truncate text-[13px] font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400" title={link.title}>
                {link.title}
              </h3>
              <p className="max-w-[46%] shrink-0 truncate text-right text-[11px] leading-5 text-slate-400 dark:text-slate-500" title={link.url}>
                {hostname}
              </p>
            </div>
            {link.description && (
              <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-slate-600 dark:text-slate-400">
                {link.description}
              </p>
            )}
          </div>
        </>
      );
    }

    return (
      <>
        {renderLinkIcon(link, false)}
        <h3 className="min-w-0 truncate text-[13px] font-medium text-slate-800 transition-colors group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400" title={link.title}>
          {link.title}
        </h3>
      </>
    );
  };

  // 创建可排序的链接卡片组件
  const SortableLinkCard = ({ link }: { link: LinkItem }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: link.id });

    const isDetailedView = siteSettings.cardStyle === 'detailed';

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: isDragging ? 'none' : transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 1000 : 'auto',
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative min-w-0 max-w-full cursor-grab overflow-hidden border transition-colors active:cursor-grabbing ${
          isSortingMode
            ? 'border-green-200 bg-green-50 dark:border-[#6a9955] dark:bg-[#2a3326]'
            : 'liquid-surface border-slate-200/90 dark:border-white/10'
        } ${isDragging ? 'scale-[1.02] shadow-xl' : ''} ${
          isDetailedView
            ? 'flex min-h-[96px] rounded-lg px-4 py-3 hover:border-green-400 dark:hover:border-green-500'
            : 'flex items-center rounded-xl p-3 shadow-sm hover:border-green-300 dark:hover:border-green-600'
        }`}
        {...attributes}
        {...listeners}
      >
        <div className={`flex flex-1 min-w-0 overflow-hidden ${
          isDetailedView ? 'items-center gap-4' : 'items-center gap-3'
        }`}>
          {renderLinkContent(link, isDetailedView)}
        </div>
      </div>
    );
  };

  const renderLinkCard = (link: LinkItem) => {
    const isSelected = selectedLinks.has(link.id);
    const isDetailedView = siteSettings.cardStyle === 'detailed';

    return (
      <div
        key={link.id}
        className={`group relative min-w-0 overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-hover dark:hover:shadow-hover-dark ${
          isSelected
            ? 'border-blue-400 bg-blue-50/80 dark:border-blue-500/50 dark:bg-blue-500/10'
            : 'liquid-surface border-slate-200/70 hover:border-blue-300 dark:border-white/5 dark:hover:border-blue-500/30'
        } ${
          isDetailedView
            ? 'flex min-h-[96px] px-5 py-4'
            : 'flex items-center justify-between p-4 shadow-sm'
        }`}
        onContextMenu={(e) => handleContextMenu(e, link)}
      >
        {renderSelectionCheckbox(
          isSelected,
          (event) => toggleLinkSelection(link.id, event),
          isSelected ? '取消选择书签' : '选择书签',
          isDetailedView ? 'left-3 top-3' : 'left-2 top-1/2 -translate-y-1/2'
        )}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex flex-1 min-w-0 overflow-hidden ${
            isDetailedView ? 'items-center gap-4 pl-6' : 'items-center gap-3 pl-7 pr-12'
          }`}
          title={isDetailedView ? link.url : (link.description || link.url)}
        >
          {renderLinkContent(link, isDetailedView)}
          {!isDetailedView && link.description && (
            <div className="tooltip-custom absolute left-0 -top-8 w-max max-w-[200px] truncate rounded bg-black p-2 text-xs text-white opacity-0 transition-all pointer-events-none invisible group-hover:visible group-hover:opacity-100 z-20">
              {link.description}
            </div>
          )}
        </a>

        {!isBatchSelectionActive && !isSortingMode && (
          <div className={`liquid-menu absolute flex items-center justify-center gap-1 rounded-lg p-1 opacity-0 transition-opacity group-hover:opacity-100 ${
            isDetailedView ? 'right-3 top-3' : 'right-2 top-1/2 -translate-y-1/2'
          }`}>
            {link.categoryId !== 'common' && (
              <button
                onClick={(e) => toggleFavorite(link.id, e)}
                className={`rounded-md p-1 ${
                  link.favorite
            ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-white/10'
            : 'text-slate-400 hover:bg-slate-100 hover:text-amber-500 dark:hover:bg-white/10'
                }`}
                title={link.favorite ? '取消常用推荐' : '加入常用推荐'}
              >
                <Star size={18} className={link.favorite ? 'fill-current' : ''} />
              </button>
            )}
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingLink(link); setIsModalOpen(true); }}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-500 dark:hover:bg-white/10"
              title="编辑"
            >
              <Edit2 size={18} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      {/* 认证遮罩层 - 当需要认证时显示 */}
      {requiresAuth && !authToken && (
        <div className="fixed inset-0 z-50 backdrop-blur-3xl bg-white/90 dark:bg-black/90 flex items-center justify-center">
          <div className="w-full max-w-md p-6">
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                需要身份验证
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                此导航页面设置了访问密码，请输入密码以继续访问
              </p>
            </div>
            <AuthModal isOpen={true} onLogin={handleLogin} />
          </div>
        </div>
      )}

      {/* 主要内容 - 只有在不需要认证或已认证时显示 */}
      {(!requiresAuth || authToken) && (
        <>
          <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} />

      <CategoryAuthModal
        isOpen={!!catAuthModalData}
        category={catAuthModalData}
        onClose={() => setCatAuthModalData(null)}
        onUnlock={handleUnlockCategory}
      />

      <CategoryEditorModal
        isOpen={categoryEditor.isOpen}
        mode={categoryEditor.mode}
        category={categoryEditor.category}
        parentId={categoryEditor.parentId}
        parentName={
          categoryEditor.parentId
            ? getCategoryPath(categories, categoryEditor.parentId)
            : undefined
        }
        parentOptions={categoryEditorParentOptions}
        onClose={closeCategoryEditor}
        onSave={handleSaveCategory}
      />

      <CategoryDeleteModal
        isOpen={!!deletingCategory}
        category={deletingCategory}
        categories={categories}
        onClose={() => setDeletingCategory(null)}
        onConfirm={handleDeleteCategory}
      />

      {commonNameEditorOpen && (
        <div className="liquid-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="liquid-panel w-full max-w-sm overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b liquid-divider p-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">修改常用推荐名称</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">仅修改左侧菜单和页面标题显示。</p>
              </div>
              <button
                type="button"
                onClick={() => setCommonNameEditorOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/70"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <input
                value={commonNameDraft}
                onChange={(event) => setCommonNameDraft(event.target.value)}
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm outline-none dark:text-white"
                placeholder="常用推荐"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCommonNameEditorOpen(false)}
                  className="rounded-xl bg-white/55 px-4 py-2 text-sm text-slate-600 hover:bg-white/80 dark:bg-slate-700/60 dark:text-slate-300"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveCommonName}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
                >
                  保存常用推荐
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
	
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        links={links}
        categories={categories}
        onRestore={handleRestoreBackup}
        webDavConfig={webDavConfig}
        onSaveWebDavConfig={handleSaveWebDavConfig}
        searchConfig={{ mode: searchMode, externalSources: externalSearchSources, defaultSourceId: selectedSearchSource?.id, selectedSource: selectedSearchSource }}
        onRestoreSearchConfig={handleRestoreSearchConfig}
        aiConfig={aiConfig}
        onRestoreAIConfig={handleRestoreAIConfig}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingLinks={links}
        categories={categories}
        onImport={handleImportConfirm}
        onImportSearchConfig={handleRestoreSearchConfig}
        onImportAIConfig={handleRestoreAIConfig}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={aiConfig}
        siteSettings={siteSettings}
        onSave={handleSaveAIConfig}
        links={links}
        categories={categories}
        onUpdateLinks={(newLinks) => updateData(newLinks, categories)}
        authToken={authToken}
      />

      <SearchConfigModal
        isOpen={isSearchConfigModalOpen}
        onClose={() => setIsSearchConfigModalOpen(false)}
        sources={externalSearchSources}
        defaultSourceId={selectedSearchSource?.id}
        onSave={(sources, defaultSourceId) => handleSaveSearchConfig(sources, searchMode, defaultSourceId)}
      />

      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        onSave={handleSaveCategoryManager}
      />

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="liquid-overlay fixed inset-0 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
          bg-white/80 dark:bg-[#121212]/80 backdrop-blur-3xl border-r border-slate-200/50 dark:border-white/5 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)]
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center px-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              {siteSettings.navTitle || 'CloudNav'}
            </span>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
            <div className="group relative">
              <button
                onClick={() => { setSelectedCategory('common'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 pr-10 transition-all ${
                  selectedCategory === 'common'
                    ? 'bg-blue-50 dark:bg-[#37373d] text-blue-600 dark:text-white font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <div className="p-1"><Icon name="Star" size={18} /></div>
                <span className="truncate text-[13px]">{commonCategoryName}</span>
              </button>
              <button
                type="button"
                onClick={openCommonNameEditor}
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-blue-500 hover:scale-110 active:scale-95 transition-all duration-200 group-hover:block dark:hover:bg-slate-700"
                title="修改常用推荐名称"
              >
                <Edit2 size={14} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4 pb-2 px-4">
               <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">目录</span>
               <div className="flex items-center gap-1">
                 <button
                    onClick={openCategoryManager}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-500 dark:hover:bg-white/5"
                    title="管理目录"
                 >
                    <GripVertical size={14} />
                 </button>
                 <button
                    onClick={() => openCreateCategory()}
                    className="rounded p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-white/5"
                    title="新增一级目录"
                 >
                    <Plus size={14} />
                 </button>
               </div>
            </div>

            <div className="space-y-1">
              {renderCategoryNavItems(categoryTree.filter(cat => cat.id !== 'common'))}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t liquid-divider bg-white/25 dark:bg-[#252526]/60 shrink-0">

            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsImportModalOpen(true); }}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 rounded-lg border border-slate-200 dark:border-white/10 transition-all"
                    title="导入书签"
                >
                    <Upload size={14} />
                    <span>导入</span>
                </button>

                <button
                    onClick={() => { if(!authToken) setIsAuthOpen(true); else setIsBackupModalOpen(true); }}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 rounded-lg border border-slate-200 dark:border-white/10 transition-all"
                    title="备份与恢复"
                >
                    <CloudCog size={14} />
                    <span>备份</span>
                </button>

                <button
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 rounded-lg border border-slate-200 dark:border-white/10 transition-all"
                    title="AI 设置"
                >
                    <Settings size={14} />
                    <span>设置</span>
                </button>
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative">

        {/* Header */}
        <header className="bg-white/60 dark:bg-[#0a0a0a]/60 backdrop-blur-2xl h-16 px-4 lg:px-8 flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 sticky top-0 z-10 shrink-0 transition-all duration-300 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300">
              <Menu size={24} />
            </button>

            {/* 搜索框 */}
            <div className="flex flex-1 min-w-0 justify-center">
              {/* 移动端搜索图标 - 仅在手机端显示，平板端隐藏 */}
              <button
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                className="sm:flex md:hidden lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                title="搜索"
              >
                <Search size={20} />
              </button>

              {/* 搜索框 */}
              <div className={`relative w-full max-w-[640px] ${isMobileSearchOpen ? 'block' : 'hidden'} sm:block`}>
                {/* 搜索源选择弹出窗口 */}
                {showSearchSourcePopup && (
                  <div
                    className="liquid-menu absolute left-0 top-full mt-2 w-full rounded-xl p-3 z-50"
                    onMouseEnter={() => setIsPopupHovered(true)}
                    onMouseLeave={() => setIsPopupHovered(false)}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {externalSearchSources
                        .filter(source => source.enabled)
                        .map((source, index) => (
                          <button
                            key={index}
                            onClick={() => handleSearchSourceSelect(source)}
                            onMouseEnter={() => setHoveredSearchSource(source)}
                            onMouseLeave={() => setHoveredSearchSource(null)}
                            className="px-2 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 flex items-center gap-1 justify-center"
                          >
                            <img
                              src={`https://www.faviconextractor.com/favicon/${new URL(source.url).hostname}?larger=true`}
                              alt={source.name}
                              className="w-4 h-4"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNlYXJjaCI+PHBhdGggZD0ibTIxIDIxLTQuMzQtNC4zNCI+PC9wYXRoPjxjaXJjbGUgY3g9IjExIiBjeT0iMTEiIHI9IjgiPjwvY2lyY2xlPjwvc3ZnPg==';
                              }}
                            />
                            <span className="truncate hidden sm:inline">{source.name}</span>
                          </button>
                        ))}
                    </div>
                    <button
                      onClick={() => { setShowSearchSourcePopup(false); setIsSearchConfigModalOpen(true); }}
                      className="mt-3 flex w-full items-center justify-center gap-2 border-t border-slate-200 pt-3 text-xs font-medium text-slate-500 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-blue-400"
                    >
                      <Settings size={13} />
                      管理搜索源
                    </button>
                  </div>
                )}

                {/* 搜索图标 */}
                <button
                  type="button"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                  onMouseEnter={() => setIsIconHovered(true)}
                  onMouseLeave={() => setIsIconHovered(false)}
                  onClick={() => setShowSearchSourcePopup(!showSearchSourcePopup)}
                  title="切换搜索引擎"
                >
                  {currentSearchSource && getSearchSourceIconUrl(currentSearchSource) ? (
                    <img
                      src={getSearchSourceIconUrl(currentSearchSource)}
                      alt={currentSearchSource.name}
                      className="w-4 h-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNlYXJjaCI+PHBhdGggZD0ibTIxIDIxLTQuMzQtNC4zNCI+PC9wYXRoPjxjaXJjbGUgY3g9IjExIiBjeT0iMTEiIHI9IjgiPjwvY2lyY2xlPjwvc3ZnPg==';
                      }}
                    />
                  ) : (
                    <Search size={16} />
                  )}
                </button>

                <input
                  type="text"
                  placeholder={currentSearchSource ? `搜索书签，或无结果时用${currentSearchSource.name}` : '搜索书签...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && shouldRunExternalSearch(searchQuery, displayedLinks.length)) {
                      handleExternalSearch();
                    }
                  }}
                  className="w-full pl-9 pr-4 py-2 rounded-full bg-slate-100/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-[13px] text-center focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-blue-500/50 focus:border-transparent dark:text-white placeholder-slate-400 placeholder:text-center outline-none transition-all duration-300 shadow-sm"
                  inputMode="search"
                  enterKeyHint="search"
                />

                {shouldRunExternalSearch(searchQuery, displayedLinks.length) && (
                  <button
                    onClick={handleExternalSearch}
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-500"
                    title="执行站外搜索"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}

                {searchQuery.trim() && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 transition-all"
                    title="清空搜索"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 视图切换按钮 - 显示当前选中的视图 */}
            <button
              onClick={() => handleViewModeChange(siteSettings.cardStyle === 'simple' ? 'detailed' : 'simple')}
              className={`${isMobileSearchOpen ? 'hidden' : 'flex'} lg:flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-blue-600 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-[#37373d] dark:hover:text-blue-400`}
              title={siteSettings.cardStyle === 'simple' ? '当前：简约，点击切换到详情' : '当前：详情，点击切换到简约'}
            >
              <Menu size={14} />
              <span>{siteSettings.cardStyle === 'simple' ? '简约' : '详情'}</span>
            </button>

            {/* 主题切换按钮 */}
            <div
              ref={themeMenuRef}
              className={`${isMobileSearchOpen ? 'hidden' : 'relative flex'} lg:flex`}
            >
              <button
                onClick={() => setIsThemeMenuOpen(prev => !prev)}
                className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-blue-600 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-[#37373d] dark:hover:text-blue-400"
                title="主题设置"
              >
                <currentThemeOption.icon size={15} />
                <span className="hidden sm:inline">{currentThemeOption.label}</span>
              </button>
              {isThemeMenuOpen && (
                <div
                  data-menu-surface
                  className="liquid-menu absolute right-0 top-full z-30 mt-2 min-w-[180px] overflow-hidden rounded-xl p-2"
                >
                  {themeOptions.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleThemeModeChange(option.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                        themeMode === option.id
                          ? 'bg-blue-50 text-blue-600 dark:bg-[#37373d] dark:text-white'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <option.icon size={15} />
                        {option.label}
                      </span>
                      {themeMode === option.id && <Check size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 登录/退出按钮 - 移动端：搜索框展开时隐藏，桌面端始终显示 */}
            <div className={`${isMobileSearchOpen ? 'hidden' : 'flex'}`}>
              {!authToken ? (
                  <button onClick={() => setIsAuthOpen(true)} className="flex items-center gap-2 bg-slate-200 dark:bg-white/10 px-3 py-1.5 rounded-full text-xs font-medium">
                      <Cloud size={14} /> <span className="hidden sm:inline">登录</span>
                  </button>
              ) : (
                  <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-200 dark:bg-white/10 px-3 py-1.5 rounded-full text-xs font-medium">
                      <LogOut size={14} /> <span className="hidden sm:inline">退出</span>
                  </button>
              )}
            </div>

          </div>
        </header>

        {/* Content Scroll Area */}
        <div
          className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8"
          onContextMenu={handleContentBlankContextMenu}
        >

            {/* Main Grid */}
            {(selectedCategory !== 'all' || searchQuery) && (
            <section>
                 <div className="flex items-center justify-between mb-4">
                     <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                         {selectedCategory === 'all'
                            ? (searchQuery ? '搜索结果' : '所有链接')
                            : (
                                <>
                                    {getCategoryPath(categories, selectedCategory) || categories.find(c => c.id === selectedCategory)?.name}
                                    {isCategoryLocked(selectedCategory) && <Lock size={14} className="text-amber-500" />}
                                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-[#37373d] text-blue-600 dark:text-white rounded-full">
                                        {displayedLinks.length}
                                    </span>
                                </>
                            )
                         }
                     </h2>
                     {selectedCategory !== 'all' && !isCategoryLocked(selectedCategory) && (
                         isSortingMode === selectedCategory ? (
                             <div className="flex gap-2">
                                 <button
                                     onClick={saveSorting}
                                     className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-full transition-colors"
                                     title="保存顺序"
                                 >
                                     <Save size={14} />
                                     <span>保存顺序</span>
                                 </button>
                                 <button
                                     onClick={cancelSorting}
                                     className="px-3 py-1.5 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full hover:bg-slate-300 dark:hover:bg-[#37373d] transition-all"
                                     title="取消排序"
                                 >
                                     取消
                                 </button>
                             </div>
                         ) : (
                             <div className="flex gap-2">
                                 {canCreateFolderHere && (
                                     <button
                                         onClick={() => openCreateCategory(selectedCategory)}
                                         className="liquid-surface flex items-center gap-1 px-3 py-1.5 border text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full hover:border-blue-300 hover:text-blue-600 transition-colors"
                                         title="文件夹"
                                     >
                                         <FolderPlus size={14} />
                                         <span>文件夹</span>
                                     </button>
                                 )}
                                 <button
                                     onClick={openCreateLink}
                                     className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200 text-white text-xs font-medium rounded-full transition-colors"
                                     title="书签"
                                 >
                                     <Plus size={14} />
                                     <span>书签</span>
                                 </button>
                                 <button
                                     onClick={() => startSorting(selectedCategory)}
                                     className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200 text-white text-xs font-medium rounded-full transition-colors"
                                     title="排序"
                                 >
                                     <GripVertical size={14} />
                                     <span>排序</span>
                                 </button>
                             </div>
                         )
                     )}
                 </div>

                 {isBatchSelectionActive && (
                    <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="flex items-center gap-2 text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${
                          isAllCurrentSelected
                            ? 'border-blue-500 bg-blue-600 text-white'
                            : 'border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-900'
                        }`}>
                          {isAllCurrentSelected && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span>全选</span>
                      </button>
                      <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
                      <span>已选择 {selectedItemCount} 项</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setBatchActionMenuOpen(prev => !prev)}
                          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Upload size={15} />
                          移动或复制
                        </button>
                        {batchActionMenuOpen && (
                          <div data-menu-surface className="liquid-menu absolute left-0 top-full z-30 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl p-2">
                            <div className="px-2 py-1 text-xs font-medium text-slate-400">移动到</div>
                            {batchMoveTargetOptions.map(({ category, depth, path }) => (
                              <button
                                key={`move-${category.id}`}
                                type="button"
                                onClick={() => handleBatchMove(category.id)}
                                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                                title={path}
                              >
                                <span className="truncate" style={{ paddingLeft: depth * 10 }}>{path}</span>
                              </button>
                            ))}
                            {selectedLinks.size > 0 && (
                              <>
                                <div className="my-1 border-t liquid-divider" />
                                <div className="px-2 py-1 text-xs font-medium text-slate-400">复制书签到</div>
                                {batchMoveTargetOptions.map(({ category, depth, path }) => (
                                  <button
                                    key={`copy-${category.id}`}
                                    type="button"
                                    onClick={() => handleBatchCopyLinks(category.id)}
                                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                                    title={path}
                                  >
                                    <span className="truncate" style={{ paddingLeft: depth * 10 }}>{path}</span>
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleBatchDelete}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-red-600 dark:text-blue-400 dark:hover:text-red-400"
                      >
                        <Trash2 size={15} />
                        删除
                      </button>
                      <button
                        type="button"
                        onClick={clearBatchSelection}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <X size={15} />
                        取消批量操作
                      </button>
                    </div>
                 )}

                 {currentChildCategories.length > 0 && !searchQuery.trim() && (
                    <div className="mb-6">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          <Folder size={14} />
                          文件夹
                        </h3>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {currentChildCategories.map(renderFolderCard)}
                      </div>
                    </div>
                 )}

                 {displayedLinks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        {isCategoryLocked(selectedCategory) ? (
                            <>
                                <Lock size={40} className="text-amber-400 mb-4" />
                                <p>该目录已锁定</p>
                                <button onClick={() => setCatAuthModalData(categories.find(c => c.id === selectedCategory) || null)} className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg">输入密码解锁</button>
                            </>
                        ) : (
                            <>
                                <Search size={40} className="opacity-30 mb-4" />
                                <p>{searchQuery ? '没有找到相关内容' : '这里还没有书签'}</p>
                                {!searchQuery && selectedCategory !== 'all' && (
                                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                                    {canCreateFolderHere && (
                                      <button
                                        onClick={() => openCreateCategory(selectedCategory)}
                                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300"
                                      >
                                        文件夹
                                      </button>
                                    )}
                                    <button
                                      onClick={openCreateLink}
                                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
                                    >
                                      书签
                                    </button>
                                  </div>
                                )}
                            </>
                        )}
                    </div>
                 ) : (
                    isSortingMode === selectedCategory ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCorners}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={displayedLinks.map(link => link.id)}
                                strategy={rectSortingStrategy}
                            >
                                <div className={`grid gap-3 ${
                                  siteSettings.cardStyle === 'detailed'
                                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                                }`}>
                                    {displayedLinks.map(link => (
                                        <React.Fragment key={link.id}>
                                          <SortableLinkCard link={link} />
                                        </React.Fragment>
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    ) : (
                        <div className={`grid gap-3 ${
                          siteSettings.cardStyle === 'detailed'
                            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                        }`}>
                            {displayedLinks.map(link => renderLinkCard(link))}
                        </div>
                    )
                 )}
            </section>
            )}

            {/* 其他目录搜索结果区域 */}
            {searchQuery.trim() && selectedCategory !== 'all' && (
              <section className="mt-8 pt-8 border-t-2 border-slate-200 dark:border-slate-700">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-folder-search">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                    <path d="M11 11h.01"></path>
                  </svg>
                  其他目录搜索结果
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-full">
                    {Object.values(otherCategoryResults).flat().length}
                  </span>
                </h2>

                {Object.keys(otherCategoryResults).length > 0 ? (
                  (Object.entries(otherCategoryResults) as [string, LinkItem[]][]).map(([categoryId, categoryLinks]) => {
                    const category = categories.find(c => c.id === categoryId);
                    if (!category) return null;

                    return (
                      <div key={categoryId} className="mb-6 last:mb-0">
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {category.name}
                          </h3>
                          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 rounded-full">
                            {categoryLinks.length}
                          </span>
                        </div>

                        <div className={`grid gap-3 ${
                          siteSettings.cardStyle === 'detailed'
                            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                        }`}>
                          {categoryLinks.map(link => renderLinkCard(link))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mb-4">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <p className="text-sm">其他目录中没有找到相关内容</p>
                  </div>
                )}
              </section>
            )}
        </div>
      </main>

          <LinkModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }}
            onSave={editingLink ? handleEditLink : handleAddLink}
            onDelete={editingLink ? handleDeleteLink : undefined}
            categories={categories}
            initialData={editingLink || (prefillLink as LinkItem)}
            aiConfig={aiConfig}
            defaultCategoryId={selectedCategory !== 'all' ? selectedCategory : undefined}
          />

          {/* 右键菜单 */}
          <ContextMenu
            isOpen={contextMenu.isOpen}
            position={contextMenu.position}
            onClose={closeContextMenu}
            onCopyLink={copyLinkToClipboard}
            onShowQRCode={showQRCode}
            onEditLink={editLinkFromContextMenu}
            onDeleteLink={deleteLinkFromContextMenu}
          />

          {folderMenu.isOpen && folderMenu.category && (
            <div
              data-menu-surface
              className="liquid-menu fixed z-50 min-w-[180px] overflow-hidden rounded-xl py-1"
              style={{
                left: Math.min(folderMenu.position.x, window.innerWidth - 210),
                top: Math.min(folderMenu.position.y, window.innerHeight - 180),
              }}
            >
              <button
                onClick={() => folderMenu.category && openEditCategory(folderMenu.category)}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <Edit2 size={15} />
                编辑文件夹
              </button>
            </div>
          )}

          {contentBlankMenu.isOpen && (
            <div
              data-menu-surface
              className="liquid-menu fixed z-50 min-w-[180px] overflow-hidden rounded-xl py-1"
              style={{
                left: Math.min(contentBlankMenu.position.x, window.innerWidth - 210),
                top: Math.min(contentBlankMenu.position.y, window.innerHeight - 180),
              }}
            >
              {canCreateFolderHere && (
                <button
                  onClick={() => openCreateCategory(selectedCategory)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  <FolderPlus size={15} />
                  文件夹
                </button>
              )}
              <button
                onClick={openCreateLink}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <Plus size={15} />
                书签
              </button>
              {canDeleteCurrentFolder && (
                <button
                  onClick={() => currentFolderCategory && openDeleteCategory(currentFolderCategory)}
                  className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={15} />
                  删除当前文件夹
                </button>
              )}
            </div>
          )}

          {/* 二维码模态框 */}
          <QRCodeModal
            isOpen={qrCodeModal.isOpen}
            url={qrCodeModal.url || ''}
            title={qrCodeModal.title || ''}
            onClose={() => setQrCodeModal({ isOpen: false, url: '', title: '' })}
          />
        </>
      )}
    </div>
  );
}

export default App;

