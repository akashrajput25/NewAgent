import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Settings,
  Download,
  Sun,
  Moon,
  MessageSquare,
  ArrowRight,
  Command,
} from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { createConversation, exportConversation } from '../lib/api';
import { toast } from '../lib/toast';
import type { Conversation } from '../types';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void | Promise<void>;
  conversation?: Conversation;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const conversations = useChatStore((s) => s.conversations);
  const currentConversation = useChatStore((s) => s.currentConversation);
  const setConversations = useChatStore((s) => s.setConversations);
  const setCurrentConversation = useChatStore((s) => s.setCurrentConversation);
  const setMessages = useChatStore((s) => s.setMessages);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const personality = useSettingsStore((s) => s.personality);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredConversations = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return conversations
      .filter((c) => c.title.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query, conversations]);

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [];

    // Quick actions
    list.push({
      id: 'new-chat',
      label: 'New Chat',
      description: 'Start a new conversation',
      icon: Plus,
      shortcut: '⌘ N',
      action: async () => {
        try {
          const conv = await createConversation(undefined, personality);
          setConversations([conv, ...conversations]);
          setCurrentConversation(conv);
          setMessages([]);
          toast('New conversation created', 'success');
        } catch {
          toast('Failed to create conversation', 'error');
        }
      },
    });

    if (currentConversation) {
      list.push({
        id: 'export',
        label: 'Export Conversation',
        description: 'Download current chat as markdown',
        icon: Download,
        action: async () => {
          try {
            const blob = await exportConversation(currentConversation.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `conversation-${currentConversation.id}.md`;
            a.click();
            URL.revokeObjectURL(url);
            toast('Conversation exported', 'success');
          } catch {
            toast('Failed to export conversation', 'error');
          }
        },
      });
    }

    list.push({
      id: 'toggle-theme',
      label: theme === 'dark' ? 'Switch to Light' : 'Switch to Dark',
      description: 'Toggle between light and dark mode',
      icon: theme === 'dark' ? Sun : Moon,
      action: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        toast(`Switched to ${theme === 'dark' ? 'light' : 'dark'} mode`, 'success');
      },
    });

    list.push({
      id: 'settings',
      label: 'Settings',
      description: 'Open settings panel',
      icon: Settings,
      action: () => {
        window.dispatchEvent(new CustomEvent('open-settings'));
      },
    });

    // Conversation search results
    for (const conv of filteredConversations) {
      list.push({
        id: `conv-${conv.id}`,
        label: conv.title,
        description: 'Jump to conversation',
        icon: MessageSquare,
        action: () => {
          setCurrentConversation(conv);
          import('../lib/api').then(({ getConversation }) => {
            getConversation(conv.id)
              .then(({ messages }) => setMessages(messages))
              .catch(() => toast('Failed to load conversation', 'error'));
          });
        },
        conversation: conv,
      });
    }

    return list;
  }, [
    conversations,
    currentConversation,
    filteredConversations,
    personality,
    setConversations,
    setCurrentConversation,
    setMessages,
    setTheme,
    theme,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeSelected = useCallback(() => {
    const item = items[selectedIndex];
    if (item) {
      item.action();
      onClose();
    }
  }, [items, selectedIndex, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [items.length, executeSelected, onClose]
  );

  // Scroll selected into view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const el = container.children[selectedIndex] as HTMLElement | undefined;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-xl mx-4 bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
              <Search size={18} className="text-muted-foreground/40" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search conversations or run a command..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/30"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground/40 border border-border/40 font-mono">
                <Command size={10} />
                K
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-[320px] overflow-y-auto py-2 scrollbar-hide"
            >
              {items.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground/30">
                  No results found
                </div>
              ) : (
                items.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={executeSelected}
                      className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/8'
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted/50 text-muted-foreground/40'
                        }`}
                      >
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground/30 truncate">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground/30 border border-border/40 font-mono">
                          {item.shortcut}
                        </kbd>
                      )}
                      {isSelected && (
                        <ArrowRight size={14} className="text-primary/60" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-2 border-t border-border/40 flex items-center gap-4 text-[10px] text-muted-foreground/20">
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-muted border border-border/30">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-muted border border-border/30">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-muted border border-border/30">esc</kbd>
                Close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
