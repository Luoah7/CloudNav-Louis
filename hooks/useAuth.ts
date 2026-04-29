import React, { useState, useCallback } from 'react';
import type { LinkItem, Category } from '../types';
import { normalizeAppData } from '../services/appData';
import { normalizeCategories } from '../services/categoryTree';
import { INITIAL_LINKS, DEFAULT_CATEGORIES } from '../types';
import { normalizeSiteSettings } from './useSiteSettings';

const LOCAL_STORAGE_KEY = 'cloudnav_data_cache';
const AUTH_KEY = 'cloudnav_auth_token';

interface UseAuthParams {
  siteSettings: { passwordExpiryDays: number };
  setSiteSettings: React.Dispatch<React.SetStateAction<any>>;
  setAiConfig: React.Dispatch<React.SetStateAction<any>>;
  loadLinkIcons: (links: LinkItem[]) => void;
}

export function useAuth({
  siteSettings,
  setSiteSettings,
  setAiConfig,
  loadLinkIcons,
}: UseAuthParams) {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string>('');
  const [requiresAuth, setRequiresAuth] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const loadFromLocal = useCallback(() => {
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
  }, []);

  const syncToCloud = useCallback(async (newLinks: LinkItem[], newCategories: Category[], token: string) => {
    setSyncStatus('saving');
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': token,
        },
        body: JSON.stringify({ links: newLinks, categories: newCategories }),
      });

      if (response.status === 401) {
        try {
          const errorData = await response.json();
          if (errorData.error && errorData.error.includes('过期')) {
            alert('您的密码已过期，请重新登录');
          }
        } catch (e) {
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
      console.error('Sync failed', error);
      setSyncStatus('error');
      return false;
    }
  }, []);

  const updateData = useCallback((newLinks: LinkItem[], newCategories: Category[]) => {
    const normalized = normalizeAppData(newLinks, newCategories);
    setLinks(normalized.links);
    setCategories(normalized.categories);

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: normalized.links, categories: normalized.categories }));

    if (authToken) {
      syncToCloud(normalized.links, normalized.categories, authToken);
    }
  }, [authToken, syncToCloud]);

  const handleLogin = useCallback(async (password: string): Promise<boolean> => {
    try {
      const authResponse = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': password,
        },
        body: JSON.stringify({ authOnly: true }),
      });

      if (authResponse.ok) {
        setAuthToken(password);
        localStorage.setItem(AUTH_KEY, password);
        setIsAuthOpen(false);
        setSyncStatus('saved');

        try {
          const websiteConfigRes = await fetch('/api/storage?getConfig=website');
          if (websiteConfigRes.ok) {
            const websiteConfigData = await websiteConfigRes.json();
            if (websiteConfigData) {
              setSiteSettings((prev: any) => normalizeSiteSettings({
                ...prev,
                ...websiteConfigData,
              }));
            }
          }
        } catch (e) {
          console.warn('Failed to fetch website config after login.', e);
        }

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

        try {
          const res = await fetch('/api/storage');
          if (res.ok) {
            const data = await res.json();
            if (data.links && data.links.length > 0) {
              const normalized = normalizeAppData(data.links, data.categories || DEFAULT_CATEGORIES);
              setLinks(normalized.links);
              setCategories(normalized.categories);
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
              loadLinkIcons(normalized.links);
            } else {
              // Use current state links/categories for sync
              setLinks(prev => {
                setCategories(prevCats => {
                  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: prev, categories: prevCats }));
                  syncToCloud(prev, prevCats, password);
                  return prevCats;
                });
                return prev;
              });
            }
          }
        } catch (e) {
          console.warn('Failed to fetch data after login.', e);
          loadFromLocal();
        }

        try {
          const aiConfigRes = await fetch('/api/storage?getConfig=ai');
          if (aiConfigRes.ok) {
            const aiConfigData = await aiConfigRes.json();
            if (aiConfigData && Object.keys(aiConfigData).length > 0) {
              setAiConfig(aiConfigData);
              localStorage.setItem('cloudnav_ai_config', JSON.stringify(aiConfigData));
            }
          }
        } catch (e) {
          console.warn('Failed to fetch AI config after login.', e);
        }

        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }, [siteSettings.passwordExpiryDays, setSiteSettings, setAiConfig, loadLinkIcons, loadFromLocal, syncToCloud]);

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem(AUTH_KEY);
    setSyncStatus('offline');
    loadFromLocal();
  }, [loadFromLocal]);

  return {
    links,
    setLinks,
    categories,
    setCategories,
    syncStatus,
    authToken,
    setAuthToken,
    requiresAuth,
    setRequiresAuth,
    isCheckingAuth,
    setIsCheckingAuth,
    isAuthOpen,
    setIsAuthOpen,
    loadFromLocal,
    syncToCloud,
    updateData,
    handleLogin,
    handleLogout,
  };
}
