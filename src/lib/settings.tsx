import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface VisibilitySetting {
  enabled: boolean;
  tariffs: string[];
}

interface VisibilitySettings {
  lessons: VisibilitySetting;
  mentor_responses: VisibilitySetting;
  chats: VisibilitySetting;
  library: VisibilitySetting;
  schedule: VisibilitySetting;
  mini_group: VisibilitySetting;
  contacts: VisibilitySetting;
  communities: VisibilitySetting;
  sos: VisibilitySetting;
  profile: VisibilitySetting;
}

interface PlatformSettings {
  platformName: string | null;
  supportLink: string | null;
  loginText: string | null;
  logo: string | null;
  favicon: string | null;
  sosChatLink: string | null;
  sosText: string | null;
  visibility: VisibilitySettings;
}

interface SettingsContextType {
  settings: PlatformSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  isSectionVisible: (section: keyof VisibilitySettings, userTariff?: string) => boolean;
}

const defaultVisibility: VisibilitySetting = { enabled: true, tariffs: ['ALL'] };

const defaultSettings: PlatformSettings = {
  platformName: 'Платформа трезвости',
  supportLink: null,
  loginText: null,
  logo: null,
  favicon: null,
  sosChatLink: null,
  sosText: null,
  visibility: {
    lessons: defaultVisibility,
    mentor_responses: defaultVisibility,
    chats: defaultVisibility,
    library: defaultVisibility,
    schedule: defaultVisibility,
    mini_group: defaultVisibility,
    contacts: defaultVisibility,
    communities: defaultVisibility,
    sos: defaultVisibility,
    profile: defaultVisibility,
  },
};

const SettingsContext = createContext<SettingsContextType | null>(null);

function parseVisibility(value: string | null | undefined): VisibilitySetting {
  if (!value) return defaultVisibility;
  try {
    return JSON.parse(value);
  } catch {
    return defaultVisibility;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  async function loadSettings() {
    try {
      const data = await api.get<Record<string, string | null>>('/public/platform-settings');
      setSettings({
        platformName: data.platformName || defaultSettings.platformName,
        supportLink: data.supportLink || null,
        loginText: data.loginText || null,
        logo: data.logo || null,
        favicon: data.favicon || null,
        sosChatLink: data.sosChatLink || null,
        sosText: data.sosText || null,
        visibility: {
          lessons: parseVisibility(data.visibility_lessons),
          mentor_responses: parseVisibility(data.visibility_mentor_responses),
          chats: parseVisibility(data.visibility_chats),
          library: parseVisibility(data.visibility_library),
          schedule: parseVisibility(data.visibility_schedule),
          mini_group: parseVisibility(data.visibility_mini_group),
          contacts: parseVisibility(data.visibility_contacts),
          communities: parseVisibility(data.visibility_communities),
          sos: parseVisibility(data.visibility_sos),
          profile: parseVisibility(data.visibility_profile),
        },
      });
    } catch (error) {
      console.error('Failed to load platform settings:', error);
    } finally {
      setLoading(false);
    }
  }

  function isSectionVisible(section: keyof VisibilitySettings, userTariff?: string): boolean {
    const visibility = settings.visibility[section];
    if (!visibility.enabled) return false;
    if (visibility.tariffs.includes('ALL')) return true;
    if (!userTariff) return false;
    return visibility.tariffs.includes(userTariff);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh: loadSettings, isSectionVisible }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    return { 
      settings: defaultSettings, 
      loading: false, 
      refresh: async () => {},
      isSectionVisible: () => true 
    };
  }
  return context;
}

export type { VisibilitySettings };
