import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, MessageSquare, Search, Download, Pin, Hexagon, Settings, User } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { createConversation, deleteConversation, getConversation, exportConversation } from '../lib/api';
import { formatDate } from '../lib/utils';
import { toast } from '../lib/toast';
import type { Conversation } from '../types';

export function Sidebar({ isOpen, onClose, onOpenProfile, onOpenSettings }: { isOpen: boolean; onClose: () => void; onOpenProfile?: () => void; onOpenSettings?: () => void }) {
  const conversations = useChatStore((s) => s.conversations);
  const currentConversation = useChatStore((s) => s.currentConversation);
  const setConversations = useChatStore((s) => s.setConversations);
  const setCurrentConversation = useChatStore((s) => s.setCurrentConversation);
  const setMessages = useChatStore((s) => s.setMessages);
  const personality = useSettingsStore((s) => s.personality);
  const removeConversation = useChatStore((s) => s.removeConversation);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setTick] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => {
      searchInputRef.current?.focus();
    };
    window.addEventListener('focus-search', handler);
    return () => window.removeEventListener('focus-search', handler);
  }, []);

  const handleNewChat = async () => {
    try {
      const conv = await createConversation(undefined, personality);
      setConversations([conv, ...conversations]);
      setCurrentConversation(conv);
      setMessages([]);
      onClose();
    } catch (err) {
      toast('Failed to create conversation', 'error');
      console.error(err);
    }
  };

  const handleSelect = async (conv: Conversation) => {
    setCurrentConversation(conv);
    try {
      const { messages } = await getConversation(conv.id);
      setMessages(messages);
    } catch (err) {
      toast('Failed to load conversation', 'error');
      console.error(err);
    }
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    try {
      await deleteConversation(id);
      removeConversation(id);
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
      toast('Conversation deleted', 'success');
    } catch (err) {
      toast('Failed to delete conversation', 'error');
      console.error(err);
    }
  };

  const handleExport = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const blob = await exportConversation(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${id}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Conversation exported', 'success');
    } catch (err) {
      toast('Failed to export conversation', 'error');
      console.error(err);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    try {
      const { getConversations } = await import('../lib/api');
      const results = await getConversations(query || undefined);
      setConversations(results);
    } catch (err) {
      toast('Search failed', 'error');
      console.error(err);
    }
  };

  const handlePin = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    updateConversation(conv.id, { pinned: !conv.pinned });
  };

  const sortedConversations = [...conversations].sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const pinned = sortedConversations.filter((c) => c.pinned);
  const recent = sortedConversations.filter((c) => !c.pinned);

  return (
    <aside className="w-[300px] h-full flex-shrink-0 border-r border-border/60 bg-sidebar/90 backdrop-blur-md flex flex-col">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-gray-500 flex items-center justify-center shadow-lg shadow-primary/20">
              <Hexagon size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text leading-tight">TAI</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onOpenSettings?.(); onClose(); }}
              className="p-2 rounded-xl text-muted-foreground/30 hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={() => { onOpenProfile?.(); onClose(); }}
              className="p-2 rounded-xl text-muted-foreground/30 hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Profile"
            >
              <User size={16} />
            </button>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
        >
          <Plus size={16} strokeWidth={2.5} />
          New chat
        </motion.button>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search"
            className="w-full rounded-xl bg-muted/40 border border-border/50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary/30 transition-all placeholder:text-muted-foreground/25"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <AnimatePresence initial={false} mode="popLayout">
          {/* PIN CHAT */}
          {pinned.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-3"
            >
              <p className="text-[10px] font-bold text-muted-foreground/25 uppercase tracking-widest px-1 mb-1.5">
                PINNED
              </p>
              <div className="space-y-1">
                {pinned.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    conv={conv}
                    isActive={currentConversation?.id === conv.id}
                    onSelect={handleSelect}
                    onDelete={handleDelete}
                    onExport={handleExport}
                    onPin={handlePin}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* RECENT */}
          {recent.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-[10px] font-bold text-muted-foreground/25 uppercase tracking-widest px-1 mb-1.5">
                RECENT
              </p>
              <div className="space-y-1">
                {recent.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    conv={conv}
                    isActive={currentConversation?.id === conv.id}
                    onSelect={handleSelect}
                    onDelete={handleDelete}
                    onExport={handleExport}
                    onPin={handlePin}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {conversations.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 px-4"
          >
            <MessageSquare size={28} className="mx-auto text-muted-foreground/10 mb-3" />
            <p className="text-sm text-muted-foreground/30">
              {searchQuery ? 'No results found' : 'No conversations yet'}
            </p>
          </motion.div>
        )}
      </div>
    </aside>
  );
}

const DOT_COLORS = [
  'bg-gray-300',
  'bg-gray-400',
  'bg-gray-500',
  'bg-neutral-400',
  'bg-slate-400',
  'bg-zinc-400',
  'bg-stone-400',
];

function getDotColor(id: number): string {
  return DOT_COLORS[Math.abs(id) % DOT_COLORS.length];
}

function ConversationCard({
  conv,
  isActive,
  onSelect,
  onDelete,
  onExport,
  onPin,
}: {
  conv: Conversation;
  isActive: boolean;
  onSelect: (c: Conversation) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
  onExport: (e: React.MouseEvent, id: number) => void;
  onPin: (e: React.MouseEvent, c: Conversation) => void;
}) {
  return (
    <motion.div
      layout
      whileHover={{ x: 2 }}
      onClick={() => onSelect(conv)}
      className={`group cursor-pointer rounded-xl px-3 py-2 flex items-center gap-3 transition-all ${
        isActive
          ? 'bg-primary/[0.08] border border-primary/10'
          : 'border border-transparent hover:bg-muted/30 hover:border-border/60'
      }`}
    >
      <div className={`flex-shrink-0 w-2 h-2 rounded-full ${getDotColor(conv.id)}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium truncate leading-tight">
          {conv.pinned && (
            <Pin size={9} className="inline text-gray-400 mr-1 -mt-0.5" fill="currentColor" />
          )}
          {conv.title}
        </p>
        <p className="text-[11px] text-muted-foreground/30 mt-0.5 leading-none">
          {formatDate(conv.updated_at)}
        </p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => onPin(e, conv)}
          className={`p-1.5 rounded-lg transition-colors ${
            conv.pinned ? 'text-gray-400' : 'text-muted-foreground/30 hover:text-foreground hover:bg-muted/40'
          }`}
          title={conv.pinned ? 'Unpin' : 'Pin'}
        >
          <Pin size={12} />
        </button>
        <button
          onClick={(e) => onExport(e, conv.id)}
          className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-foreground hover:bg-muted/40 transition-colors"
          title="Export"
        >
          <Download size={12} />
        </button>
        <button
          onClick={(e) => onDelete(e, conv.id)}
          className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}
