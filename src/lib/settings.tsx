import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface PlatformSettings {
  platformName: string | null;
  supportLink: string | null;
  loginText: string | null;
  logo: string | null;
  favicon: string | null;
  sosChatLink: string | null;
  sosAudioFile: string | null;
}

interface SettingsContextType {
  settings: PlatformSettings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const defaultSettings: PlatformSettings = {
  platformName: 'Платформа трезвости',
  supportLink: null,
  loginText: null,
  logo: null,
  favicon: null,
  sosChatLink: null,
  sosAudioFile: null,
};

const SettingsContext = createContext<SettingsContextType | null>(null);

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
        sosAudioFile: data.sosAudioFile || null,
      });
    } catch (error) {
      console.error('Failed to load platform settings:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh: loadSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    return { settings: defaultSettings, loading: false, refresh: async () => {} };
  }
  return context;
}
