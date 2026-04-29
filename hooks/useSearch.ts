import { useState, useEffect, useRef } from 'react';
import type { ExternalSearchSource, SearchMode, SearchConfig } from '../types';
import { createDefaultSearchSources, resolveDefaultSearchSource } from '../services/searchBehavior';

interface UseSearchParams {
  authToken: string;
}

export function useSearch({ authToken }: UseSearchParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('external');
  const [externalSearchSources, setExternalSearchSources] = useState<ExternalSearchSource[]>([]);
  const [isLoadingSearchConfig, setIsLoadingSearchConfig] = useState(true);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const [showSearchSourcePopup, setShowSearchSourcePopup] = useState(false);
  const [hoveredSearchSource, setHoveredSearchSource] = useState<ExternalSearchSource | null>(null);
  const [selectedSearchSource, setSelectedSearchSource] = useState<ExternalSearchSource | null>(null);
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [isPopupHovered, setIsPopupHovered] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isIconHovered || isPopupHovered) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setShowSearchSourcePopup(true);
    } else {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setShowSearchSourcePopup(false);
        setHoveredSearchSource(null);
      }, 100);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isIconHovered, isPopupHovered]);

  const handleSaveSearchConfig = async (sources: ExternalSearchSource[], mode: SearchMode, defaultSourceId?: string) => {
    const defaultSource = resolveDefaultSearchSource(sources, defaultSourceId || selectedSearchSource?.id);
    const searchConfig: SearchConfig = {
      mode,
      externalSources: sources,
      defaultSourceId: defaultSource?.id,
      selectedSource: defaultSource,
    };

    setExternalSearchSources(sources);
    setSearchMode(mode);
    setSelectedSearchSource(defaultSource);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['x-auth-password'] = authToken;
      }

      const response = await fetch('/api/storage', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          saveConfig: 'search',
          config: searchConfig,
        }),
      });

      if (!response.ok) {
        console.error('Failed to save search config to KV:', response.statusText);
      }
    } catch (error) {
      console.error('Error saving search config to KV:', error);
    }
  };

  const handleSearchSourceSelect = async (source: ExternalSearchSource) => {
    setSelectedSearchSource(source);
    await handleSaveSearchConfig(externalSearchSources, searchMode, source.id);
    setShowSearchSourcePopup(false);
    setHoveredSearchSource(null);
  };

  const handleExternalSearch = () => {
    if (searchQuery.trim()) {
      if (externalSearchSources.length === 0) {
        const defaultSources = createDefaultSearchSources();
        handleSaveSearchConfig(defaultSources, 'external', defaultSources[0]?.id);
        const searchUrl = defaultSources[0].url.replace('{query}', encodeURIComponent(searchQuery));
        window.open(searchUrl, '_blank');
        return;
      }

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

  const getSearchSourceIconUrl = (source: ExternalSearchSource | null) => {
    if (!source) return '';
    try {
      return `https://www.faviconextractor.com/favicon/${new URL(source.url).hostname}?larger=true`;
    } catch {
      return '';
    }
  };

  const currentSearchSource = hoveredSearchSource || resolveDefaultSearchSource(externalSearchSources, selectedSearchSource?.id) || selectedSearchSource || null;

  return {
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    externalSearchSources,
    setExternalSearchSources,
    isLoadingSearchConfig,
    setIsLoadingSearchConfig,
    isMobileSearchOpen,
    setIsMobileSearchOpen,
    showSearchSourcePopup,
    setShowSearchSourcePopup,
    hoveredSearchSource,
    setHoveredSearchSource,
    selectedSearchSource,
    setSelectedSearchSource,
    isIconHovered,
    setIsIconHovered,
    isPopupHovered,
    setIsPopupHovered,
    currentSearchSource,
    handleSaveSearchConfig,
    handleSearchSourceSelect,
    handleExternalSearch,
    getSearchSourceIconUrl,
  };
}
