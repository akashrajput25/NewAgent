import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Star, Trash2, Clock, Sparkles } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { formatDate } from '../lib/utils';

export function SavedMessagesPage({ onBack }: { onBack: () => void }) {
  const bookmarkedMessages = useChatStore((s) => s.bookmarkedMessages);
  const toggleBookmark = useChatStore((s) => s.toggleBookmark);
  const setCurrentConversation = useChatStore((s) => s.setCurrentConversation);
  const setMessages = useChatStore((s) => s.setMessages);
  const conversations = useChatStore((s) => s.conversations);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery
    ? bookmarkedMessages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : bookmarkedMessages;

  const handleJumpToConversation = async (msg: any) => {
    const conv = conversations.find((c) => c.id === msg.conversation_id);
    if (!conv) return;
    setCurrentConversation(conv);
    const { getConversation } = await import('../lib/api');
    try {
      const { messages } = await getConversation(conv.id);
      setMessages(messages);
    } catch {
      /* ignore */
    }
    onBack();
  };

  return (
    <main className="flex-1 flex flex-col bg-background/50 relative overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3 bg-background/50 backdrop-blur-md z-10">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-sm font-semibold">Saved Messages</h2>
        <span className="text-[10px] text-muted-foreground/30 ml-auto">{bookmarkedMessages.length} saved</span>
      </header>

      <div className="px-4 py-3">
        <div className="relative">
          <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved messages..."
            className="w-full rounded-xl bg-muted/40 border border-border/50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary/30 transition-all placeholder:text-muted-foreground/25"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        <AnimatePresence>
          {filtered.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl bg-card/80 border border-border/50 p-4 cursor-pointer hover:border-primary/20 transition-all group"
              onClick={() => handleJumpToConversation(msg)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium ${
                  msg.role === 'user' ? 'bg-gradient-to-br from-primary to-accent text-white' : 'bg-muted text-muted-foreground border border-border/50'
                }`}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                <span className="text-[10px] text-muted-foreground/40 capitalize">{msg.role}</span>
                <span className="text-[10px] text-muted-foreground/20 ml-auto flex items-center gap-1">
                  <Clock size={9} /> {formatDate(msg.created_at)}
                </span>
              </div>
              <p className="text-sm text-foreground line-clamp-3">{msg.content.replace(/!\[.*?\]\(.*?\)/g, '[image]')}</p>
              <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBookmark(msg); }}
                  className="text-amber-400 hover:text-amber-500 transition-colors"
                  title="Remove bookmark"
                >
                  <Star size={14} fill="currentColor" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBookmark(msg); }}
                  className="text-muted-foreground/30 hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Star size={32} className="mx-auto text-muted-foreground/10 mb-3" />
            <p className="text-sm text-muted-foreground/30">
              {searchQuery ? 'No matching saved messages' : 'No saved messages yet'}
            </p>
            <p className="text-xs text-muted-foreground/20 mt-1">Bookmark messages to see them here</p>
          </div>
        )}
      </div>
    </main>
  );
}
