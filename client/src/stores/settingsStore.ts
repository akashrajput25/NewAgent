import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersonalityMode, UserProfile } from '../types';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  personality: PersonalityMode;
  voiceEnabled: boolean;
  autoSpeak: boolean;
  syntaxHighlighting: boolean;
  selectedVoice: string;
  soundEffects: boolean;
  temperature: number;
  customSystemPrompt: string;
  selectedModel: string;
  voiceRate: number;
  focusMode: boolean;
  thinkingMode: boolean;
  profile: UserProfile;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setPersonality: (personality: PersonalityMode) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setAutoSpeak: (enabled: boolean) => void;
  setSyntaxHighlighting: (enabled: boolean) => void;
  setSelectedVoice: (voice: string) => void;
  setSoundEffects: (enabled: boolean) => void;
  setTemperature: (temp: number) => void;
  setCustomSystemPrompt: (prompt: string) => void;
  setSelectedModel: (model: string) => void;
  setVoiceRate: (rate: number) => void;
  setFocusMode: (enabled: boolean) => void;
  setThinkingMode: (enabled: boolean) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      personality: 'professional',
      voiceEnabled: true,
      autoSpeak: false,
      syntaxHighlighting: true,
      selectedVoice: '',
      soundEffects: true,
      temperature: 0.7,
      customSystemPrompt: '',
      selectedModel: 'openrouter/free',
      voiceRate: 1,
      focusMode: false,
      thinkingMode: false,
      profile: { displayName: '', email: '', bio: '', avatar: null },
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      setPersonality: (personality) => set({ personality }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setAutoSpeak: (autoSpeak) => set({ autoSpeak }),
      setSyntaxHighlighting: (syntaxHighlighting) => set({ syntaxHighlighting }),
      setSelectedVoice: (selectedVoice) => set({ selectedVoice }),
      setSoundEffects: (soundEffects) => set({ soundEffects }),
      setTemperature: (temperature) => set({ temperature }),
      setCustomSystemPrompt: (customSystemPrompt) => set({ customSystemPrompt }),
      setSelectedModel: (selectedModel) => set({ selectedModel }),
      setVoiceRate: (voiceRate) => set({ voiceRate }),
      setFocusMode: (focusMode) => set({ focusMode }),
      setThinkingMode: (thinkingMode) => set({ thinkingMode }),
      updateProfile: (updates) =>
        set((state) => ({ profile: { ...state.profile, ...updates } })),
    }),
    { name: 'tai-settings' }
  )
);

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('tai-settings');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      applyTheme(parsed.state?.theme || 'dark');
    } catch { /* ignore */ }
  } else {
    applyTheme('dark');
  }
}
