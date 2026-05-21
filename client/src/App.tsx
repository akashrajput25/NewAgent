import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Compass, Bookmark, Settings, User } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { ProfilePage } from './components/ProfilePage';
import { SavedMessagesPage } from './components/SavedMessagesPage';
import { ExplorePage } from './components/ExplorePage';
import { CommandPalette } from './components/CommandPalette';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { ParticleBackground } from './components/ParticleBackground';
import { ToastContainer } from './components/Toast';
import { useChatStore } from './stores/chatStore';
import { useSettingsStore } from './stores/settingsStore';
import { getConversations } from './lib/api';
import { toast } from './lib/toast';

export default function App() {
  const setConversations = useChatStore((s) => s.setConversations);
  const theme = useSettingsStore((s) => s.theme);
  const focusMode = useSettingsStore((s) => s.focusMode);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  useEffect(() => {
    getConversations().then(setConversations).catch(console.error);
  }, [setConversations]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd/Ctrl + K → Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      // ? → Keyboard Shortcuts (only when not typing)
      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // Cmd/Ctrl + Shift + S → Focus search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-search'));
        return;
      }

      // Cmd/Ctrl + Shift + F → Focus mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        useSettingsStore.getState().setFocusMode(!useSettingsStore.getState().focusMode);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const personality = useSettingsStore.getState().personality;
        try {
          const { createConversation } = await import('./lib/api');
          const conv = await createConversation(undefined, personality);
          const { conversations, setConversations, setCurrentConversation, setMessages } = useChatStore.getState();
          setConversations([conv, ...conversations]);
          setCurrentConversation(conv);
          setMessages([]);
          if (isMobile) setSidebarOpen(false);
        } catch (err) {
          toast('Failed to create conversation', 'error');
          console.error(err);
        }
      }
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setPaletteOpen(false);
        setShortcutsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile]);

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground overflow-hidden relative">
      <ParticleBackground />

      <div className="relative z-10 flex h-full w-full">
        {/* Desktop sidebar always visible */}
        {!focusMode && (
          <div className="hidden md:block flex-shrink-0">
            <Sidebar
              isOpen={true}
              onClose={() => {}}
              onOpenProfile={() => setActiveTab('profile')}
              onOpenSettings={() => window.dispatchEvent(new CustomEvent('open-settings'))}
            />
          </div>
        )}

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {isMobile && sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed left-0 top-0 h-full z-50 md:hidden"
              >
                <Sidebar
                  isOpen={sidebarOpen}
                  onClose={() => setSidebarOpen(false)}
                  onOpenProfile={() => setActiveTab('profile')}
                  onOpenSettings={() => window.dispatchEvent(new CustomEvent('open-settings'))}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {activeTab === 'profile' ? (
          <ProfilePage onBack={() => setActiveTab('home')} />
        ) : activeTab === 'saved' ? (
          <SavedMessagesPage onBack={() => setActiveTab('home')} />
        ) : activeTab === 'explore' ? (
          <ExplorePage onBack={() => setActiveTab('home')} />
        ) : (
          <ChatInterface
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            isMobile={isMobile}
          />
        )}
        <ToastContainer />
        <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <KeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

        {/* Mobile bottom navigation */}
        {isMobile && (
          <motion.nav
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border/30 px-6 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around"
          >
            {[
              { id: 'home', icon: Home, label: 'Home' },
              { id: 'explore', icon: Compass, label: 'Explore' },
              { id: 'saved', icon: Bookmark, label: 'Saved' },
              { id: 'profile', icon: User, label: 'Profile' },
              { id: 'settings', icon: Settings, label: 'Settings' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'settings') {
                    window.dispatchEvent(new CustomEvent('open-settings'));
                    return;
                  }
                  setActiveTab(tab.id);
                  if (tab.id === 'home') {
                    const currentConv = useChatStore.getState().currentConversation;
                    if (!currentConv) setSidebarOpen(true);
                  }
                }}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary'
                    : 'text-muted-foreground/40 hover:text-muted-foreground'
                }`}
              >
                <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                <span className="text-[9px] font-medium">{tab.label}</span>
              </button>
            ))}
          </motion.nav>
        )}
      </div>
    </div>
  );
}
