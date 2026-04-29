import { useState, useEffect } from 'react';
import type { WebDavConfig, AIConfig, SiteSettings } from '../types';

const WEBDAV_CONFIG_KEY = 'cloudnav_webdav_config';
const AI_CONFIG_KEY = 'cloudnav_ai_config';

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

export const normalizeSiteSettings = (settings?: Partial<SiteSettings>): SiteSettings => ({
  ...DEFAULT_SITE_SETTINGS,
  ...settings,
  title: removeLegacyBrandPrefix(settings?.title) || DEFAULT_SITE_SETTINGS.title,
  navTitle: removeLegacyBrandPrefix(settings?.navTitle) || DEFAULT_SITE_SETTINGS.navTitle,
  cardStyle: settings?.cardStyle || DEFAULT_SITE_SETTINGS.cardStyle,
  passwordExpiryDays: settings?.passwordExpiryDays !== undefined
    ? settings.passwordExpiryDays
    : DEFAULT_SITE_SETTINGS.passwordExpiryDays,
});

interface UseSiteSettingsParams {
  authToken: string;
}

export function useSiteSettings({ authToken }: UseSiteSettingsParams) {
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
    url: '',
    username: '',
    password: '',
    enabled: false,
  });

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
      model: 'gemini-2.5-flash',
    };
  });

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

  useEffect(() => {
    if (siteSettings.title) {
      document.title = siteSettings.title;
    }

    if (siteSettings.favicon) {
      const existingFavicons = document.querySelectorAll('link[rel="icon"]');
      existingFavicons.forEach(favicon => favicon.remove());

      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.href = siteSettings.favicon;
      document.head.appendChild(favicon);
    }
  }, [siteSettings.title, siteSettings.favicon]);

  const handleViewModeChange = (cardStyle: 'detailed' | 'simple') => {
    const newSiteSettings = { ...siteSettings, cardStyle };
    setSiteSettings(newSiteSettings);
    localStorage.setItem('cloudnav_site_settings', JSON.stringify(newSiteSettings));
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
            'x-auth-password': authToken,
          },
          body: JSON.stringify({
            saveConfig: 'ai',
            config,
          }),
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
              'x-auth-password': authToken,
            },
            body: JSON.stringify({
              saveConfig: 'website',
              config: newSiteSettings,
            }),
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

    if (authToken) {
      try {
        const response = await fetch('/api/storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': authToken,
          },
          body: JSON.stringify({
            saveConfig: 'ai',
            config,
          }),
        });

        if (!response.ok) {
          console.error('Failed to restore AI config to KV:', response.statusText);
        }
      } catch (error) {
        console.error('Error restoring AI config to KV:', error);
      }
    }
  };

  const handleSaveWebDavConfig = (config: WebDavConfig) => {
    setWebDavConfig(config);
    localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  };

  return {
    webDavConfig,
    setWebDavConfig,
    aiConfig,
    setAiConfig,
    siteSettings,
    setSiteSettings,
    handleViewModeChange,
    handleSaveAIConfig,
    handleRestoreAIConfig,
    handleSaveWebDavConfig,
  };
}
