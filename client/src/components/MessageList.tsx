import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useRef, useCallback, useState, useMemo, isValidElement, cloneElement, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import {
  User, Sparkles, Copy, Volume2, VolumeX, Check, ThumbsUp, ThumbsDown,
  RotateCcw, ChevronDown, ChevronUp, Maximize2, X, Pencil, Trash2, Clock, Star, Share2,
  Hexagon, BrainCircuit, Eye, EyeOff, Reply
} from 'lucide-react';

function AgentAvatar({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16" />
      <path d="M12 6v13" />
    </svg>
  );
}
import { CodeBlock } from './CodeBlock';
import { toast } from '../lib/toast';
import type { Message } from '../types';

let speechGeneration = 0;
let cachedVoices: SpeechSynthesisVoice[] = [];

function preloadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length > 0) cachedVoices = v;
  return cachedVoices;
}

function ensureVoicesReady(callback: (voices: SpeechSynthesisVoice[]) => void): void {
  const voices = preloadVoices();
  if (voices.length > 0) {
    callback(voices);
    return;
  }

  let called = false;
  const done = (loaded: SpeechSynthesisVoice[]) => {
    if (called) return;
    called = true;
    callback(loaded);
  };

  const handler = () => {
    const loaded = window.speechSynthesis.getVoices();
    if (loaded.length > 0) {
      cachedVoices = loaded;
      window.speechSynthesis.onvoiceschanged = null;
      clearInterval(interval);
      clearTimeout(fallbackTimeout);
      done(loaded);
    }
  };

  window.speechSynthesis.onvoiceschanged = handler;

  const interval = setInterval(() => {
    const loaded = window.speechSynthesis.getVoices();
    if (loaded.length > 0) {
      cachedVoices = loaded;
      clearInterval(interval);
      clearTimeout(fallbackTimeout);
      window.speechSynthesis.onvoiceschanged = null;
      done(loaded);
    }
  }, 100);

  const fallbackTimeout = setTimeout(() => {
    clearInterval(interval);
    window.speechSynthesis.onvoiceschanged = null;
    done(window.speechSynthesis.getVoices());
  }, 3000);
}

function speakText(text: string, voiceURI?: string, onEnd?: () => void) {
  console.log('[TAI Speak] Called, text length:', text.length);

  if (!window.speechSynthesis) {
    console.error('[TAI Speak] speechSynthesis API not available');
    toast('Speech synthesis not available in this browser', 'error');
    onEnd?.();
    return;
  }

  const gen = ++speechGeneration;
  console.log('[TAI Speak] Generation:', gen, 'speaking:', window.speechSynthesis.speaking, 'pending:', window.speechSynthesis.pending, 'paused:', window.speechSynthesis.paused);

  ensureVoicesReady((voices) => {
    if (gen !== speechGeneration) {
      console.log('[TAI Speak] Stale generation, aborting');
      return;
    }

    if (voices.length === 0) {
      console.error('[TAI Speak] No voices available');
      toast('No speech voices available on this system', 'error');
      onEnd?.();
      return;
    }

    console.log('[TAI Speak] Voices ready, count:', voices.length);

    const plain = text
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<\/?(?:label|div|span|p|input|form|button|script|style)(?:\s[^>]*)?>/gi, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/[#*`]/g, '')
      .replace(/\n/g, ' ')
      .trim();

    console.log('[TAI Speak] Plain text:', plain.substring(0, 60) + (plain.length > 60 ? '...' : ''));

    if (!plain) {
      console.log('[TAI Speak] Empty text after stripping, aborting');
      onEnd?.();
      return;
    }

    // Only use an explicit voice if the user selected one.
    // Letting Chrome pick its own default avoids broken voice issues.
    let voice: SpeechSynthesisVoice | undefined;
    if (voiceURI) {
      voice = voices.find((v) => v.voiceURI === voiceURI);
      if (voice) console.log('[TAI Speak] Matched voiceURI:', voice.name, 'lang:', voice.lang);
    }

    let hasStarted = false;

    const setupUtterance = (): SpeechSynthesisUtterance => {
      const u = new SpeechSynthesisUtterance(plain);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang || 'en-US';
      }
      u.rate = Math.max(0.1, Math.min(2, useSettingsStore.getState().voiceRate || 1));
      u.pitch = 1;
      u.volume = 1;

      u.onstart = () => {
        hasStarted = true;
        clearTimeout(startTimeout);
        console.log('[TAI Speak] onstart fired!');
      };

      u.onend = () => {
        clearTimeout(startTimeout);
        console.log('[TAI Speak] onend fired');
        if (gen === speechGeneration) onEnd?.();
      };

      u.onerror = (e) => {
        clearTimeout(startTimeout);
        console.error('[TAI Speak] onerror:', e.error);
        if (gen === speechGeneration) {
          if (e.error !== 'canceled') toast(`Speech error: ${e.error}`, 'error');
          onEnd?.();
        }
      };

      u.onpause = () => {
        console.warn('[TAI Speak] onpause fired, resuming');
        window.speechSynthesis.resume();
      };

      return u;
    };

    const startTimeout = setTimeout(() => {
      if (!hasStarted && gen === speechGeneration) {
        console.error('[TAI Speak] onstart never fired');
        toast('Speech failed to start — try reloading the page', 'error');
        onEnd?.();
      }
    }, 3000);

    // Speak synchronously to preserve Chrome user-gesture context.
    if (gen !== speechGeneration) return;
    window.speechSynthesis.resume();
    console.log('[TAI Speak] Calling speak() synchronously');
    window.speechSynthesis.speak(setupUtterance());
  });
}

function FuturisticOrb() {
  const bars = [
    { h: [14, 44, 22, 52, 14], d: '0s' },
    { h: [28, 16, 48, 20, 28], d: '0.08s' },
    { h: [20, 52, 18, 44, 20], d: '0.16s' },
    { h: [40, 22, 38, 16, 40], d: '0.24s' },
    { h: [16, 36, 28, 48, 16], d: '0.32s' },
  ];

  return (
    <div className="flex items-end justify-center gap-[5px] h-16">
      {bars.map((bar, i) => (
        <motion.div
          key={i}
          className="w-[5px] rounded-full bg-gradient-to-t from-gray-400 to-gray-300"
          initial={{ height: bar.h[0] }}
          animate={{ height: bar.h }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: parseFloat(bar.d),
          }}
        />
      ))}
    </div>
  );
}

const SUGGESTED_PROMPTS = [
  'Explain quantum computing in simple terms',
  'Write a Python function to sort a list',
  'Analyze this image and describe what you see',
  'Help me brainstorm ideas for a mobile app',
  'Translate "Hello, how are you?" to Japanese',
  'Summarize the theory of relativity',
];

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-primary/25 text-primary rounded px-0.5 font-medium">{part}</mark>
    ) : part
  );
}

function highlightInNode(node: React.ReactNode, query: string): React.ReactNode {
  if (!query || !node) return node;
  if (typeof node === 'string') {
    return highlightMatches(node, query);
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => (
      <Fragment key={i}>{highlightInNode(child, query)}</Fragment>
    ));
  }
  if (isValidElement(node)) {
    const { children, ...props } = node.props;
    return cloneElement(node, {
      ...props,
      children: highlightInNode(children, query),
    } as any);
  }
  return node;
}

function parseThinking(content: string): { thinking: string | null; response: string } {
  const match = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  if (match) {
    const thinking = match[1].trim();
    const endIdx = content.indexOf('</thinking>') + '</thinking>'.length;
    const response = content.slice(endIdx).trim();
    return { thinking: thinking || null, response };
  }
  return { thinking: null, response: content };
}

function readingTime(text: string): string {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
  const mins = Math.ceil(words / 200);
  return mins <= 1 ? '~1 min read' : `~${mins} min read`;
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
    return 'Today';
  }
  if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) {
    return 'Yesterday';
  }
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function MessageList({ searchQuery, onRegenerate }: { searchQuery?: string; onRegenerate?: () => void }) {
  const messages = useChatStore((s) => s.messages);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const thinkingContent = useChatStore((s) => s.thinkingContent);
  const isLoading = useChatStore((s) => s.isLoading);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const filteredMessages = searchQuery
    ? messages.filter((msg) => msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const lastAssistantId = messages.reduce((lastId, msg) => msg.role === 'assistant' ? msg.id : lastId, -1 as number);
  const autoSpeak = useSettingsStore((s) => s.autoSpeak);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const selectedVoice = useSettingsStore((s) => s.selectedVoice);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const lastAutoSpokenIdRef = useRef<number>(-1);
  const currentConvId = useChatStore((s) => s.currentConversation?.id);

  // Reset auto-speak tracking when switching conversations
  useEffect(() => {
    lastAutoSpokenIdRef.current = -1;
  }, [currentConvId]);

  // Diagnostic: check speech synthesis availability and preload voices on mount
  useEffect(() => {
    console.log('[TAI Speech Diag] Checking speech synthesis...');
    if (!window.speechSynthesis) {
      console.error('[TAI Speech Diag] window.speechSynthesis is undefined');
      toast('Speech synthesis not supported in this browser', 'error');
      return;
    }
    preloadVoices();
    console.log('[TAI Speech Diag] Initial voices count:', cachedVoices.length);
    if (cachedVoices.length > 0) {
      console.log('[TAI Speech Diag] Voices:', cachedVoices.map((v) => `${v.name} (${v.lang})`).join(', '));
    }

    const onVoices = () => {
      preloadVoices();
      console.log('[TAI Speech Diag] Voices loaded:', cachedVoices.length, cachedVoices.map((v) => v.name).join(', '));
    };
    window.speechSynthesis.onvoiceschanged = onVoices;

    // Chrome lazy-loads voices; give it a moment
    setTimeout(() => {
      preloadVoices();
    }, 500);

    setTimeout(() => {
      if (cachedVoices.length === 0) {
        console.error('[TAI Speech Diag] Voices never loaded after 3s');
        toast('No speech voices found on this system', 'error');
      }
    }, 3000);

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = distanceFromBottom < 100;
      setShowScrollBtn(!nearBottom);
      if (distanceFromBottom > 200) {
        setAutoScrollPaused(true);
      } else if (nearBottom) {
        setAutoScrollPaused(false);
        setHasNewMessages(false);
      }
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (autoScrollPaused) {
      setHasNewMessages(true);
      return;
    }
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streamingContent, autoScrollPaused]);

  useEffect(() => {
    if (!autoSpeak || !voiceEnabled || messages.length === 0) return;

    const last = messages[messages.length - 1];
    if (last.role !== 'assistant') return;
    if (last.id === lastAutoSpokenIdRef.current) return;

    lastAutoSpokenIdRef.current = last.id;
    setSpeakingId(last.id);
    speakText(last.content, selectedVoice, () => setSpeakingId(null));
  }, [messages, autoSpeak, voiceEnabled, selectedVoice]);

  const handleSpeakToggle = useCallback(
    (id: number, text: string) => {
      console.log('[TAI Toggle] clicked, id:', id, 'current speakingId:', speakingId);
      if (speakingId === id) {
        console.log('[TAI Toggle] stopping speech for', id);
        ++speechGeneration;
        window.speechSynthesis.cancel();
        setSpeakingId(null);
      } else {
        console.log('[TAI Toggle] starting speech for', id);
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
        setSpeakingId(id);
        speakText(text, selectedVoice, () => setSpeakingId(null));
      }
    },
    [speakingId, selectedVoice]
  );

  // Group consecutive messages by same role
  const groupedMessages = useMemo(() => {
    const groups: { role: string; messages: Message[] }[] = [];
    for (const msg of filteredMessages) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.role === msg.role) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({ role: msg.role, messages: [msg] });
      }
    }
    return groups;
  }, [filteredMessages]);

  const itemsWithSeparators = useMemo(() => {
    const items = [] as (
      | { type: 'separator'; date: string; key: string }
      | { type: 'group'; group: typeof groupedMessages[0]; index: number }
    )[];
    let lastDateKey: string | null = null;

    for (let i = 0; i < groupedMessages.length; i++) {
      const group = groupedMessages[i];
      const dateKey = getDateKey(group.messages[0].created_at);
      if (dateKey !== lastDateKey) {
        items.push({ type: 'separator', date: group.messages[0].created_at, key: `sep-${dateKey}` });
        lastDateKey = dateKey;
      }
      items.push({ type: 'group', group, index: i });
    }
    return items;
  }, [groupedMessages]);

  return (
    <>
      <div ref={scrollRef} className="h-full overflow-y-auto px-3 md:px-6 py-4 md:py-6 space-y-1">
        <AnimatePresence initial={false}>
          {messages.length === 0 && !streamingContent && !isLoading && !searchQuery && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center min-h-full"
            >
              <div className="text-center space-y-8 max-w-xl mx-auto px-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-4"
                >
                  <FuturisticOrb />
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Hello, Ask Me Anything...</h2>
                    <p className="text-xs text-muted-foreground/60 mt-1.5">Last Update: {new Date().toLocaleDateString()}</p>
                  </div>
                </motion.div>

                <div className="flex gap-3 pb-2 scrollbar-hide overflow-x-auto md:overflow-visible md:flex-wrap md:justify-center">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <motion.button
                      key={prompt}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        const conv = useChatStore.getState().currentConversation;
                        if (!conv) return;
                        const input = document.querySelector('textarea');
                        if (input) {
                          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLTextAreaElement.prototype, 'value'
                          )?.set;
                          nativeInputValueSetter?.call(input, prompt);
                          input.dispatchEvent(new Event('input', { bubbles: true }));
                          input.focus();
                        }
                      }}
                      className="flex-shrink-0 text-left p-4 rounded-2xl border border-border/50 bg-card/80 hover:border-gray-400/20 hover:bg-muted transition-all text-[13px] text-muted-foreground/85 hover:text-foreground w-40"
                    >
                      <span className="w-2 h-2 rounded-full bg-gradient-to-br from-primary to-accent inline-block mb-2" />
                      <p className="leading-snug">{prompt}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {itemsWithSeparators.map((item) => {
            if (item.type === 'separator') {
              return <DateSeparator key={item.key} date={item.date} />;
            }
            return (
              <MessageGroup
                key={`${item.group.role}-${item.index}`}
                group={item.group}
                groupIndex={item.index}
                isFirstGroup={item.index === 0}
                speakingId={speakingId}
                onSpeakToggle={handleSpeakToggle}
                onRegenerate={onRegenerate}
                lastAssistantId={lastAssistantId}
                searchQuery={searchQuery}
                onImageClick={setLightboxImage}
              />
            );
          })}

          {searchQuery && filteredMessages.length === 0 && !streamingContent && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-muted-foreground py-12"
            >
              <p className="text-sm">No messages match &quot;{searchQuery}&quot;</p>
            </motion.div>
          )}

          {streamingContent && (!searchQuery || streamingContent.toLowerCase().includes(searchQuery.toLowerCase())) && (
            <MessageGroup
              group={{ role: 'assistant', messages: [{
                id: -1, conversation_id: 0, role: 'assistant',
                content: streamingContent, created_at: new Date().toISOString(),
              }] }}
              groupIndex={groupedMessages.length}
              isFirstGroup={false}
              isStreaming
              streamingThinking={thinkingContent}
            />
          )}

          {isLoading && !streamingContent && !searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 pl-8 md:pl-10 py-2"
            >
              <div className="flex items-center gap-2.5 bg-card/80 rounded-[18px] px-4 py-3 border border-border/50">
                <Sparkles size={13} className="text-primary/60" />
                <div className="flex items-center gap-1">
                  {[0, 0.15, 0.3].map((delay, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4], y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 0.9, delay }}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground/50 ml-0.5">Thinking...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToBottom}
            className="absolute bottom-24 right-4 md:right-8 z-20 p-2.5 rounded-full bg-card/80 backdrop-blur-md border border-border/40 shadow-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            <ChevronDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* New messages indicator */}
      <AnimatePresence>
        {autoScrollPaused && hasNewMessages && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setAutoScrollPaused(false); setHasNewMessages(false); scrollToBottom(); }}
            className="absolute bottom-32 right-4 md:right-8 z-20 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg shadow-primary/25 hover:brightness-110 transition-all"
          >
            New messages
          </motion.button>
        )}
      </AnimatePresence>

      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setLightboxImage(null)}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-4 right-4 p-2 rounded-full bg-muted/50 text-white hover:bg-muted/60 transition-colors"
              onClick={() => setLightboxImage(null)}
            >
              <X size={20} />
            </motion.button>
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={lightboxImage}
              alt="Full size"
              className="max-w-full max-h-[90vh] rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageGroup({
  group,
  groupIndex,
  isFirstGroup,
  isStreaming,
  speakingId,
  onSpeakToggle,
  onRegenerate,
  lastAssistantId,
  searchQuery,
  onImageClick,
  streamingThinking,
}: {
  group: { role: string; messages: Message[] };
  groupIndex: number;
  isFirstGroup: boolean;
  isStreaming?: boolean;
  speakingId?: number | null;
  onSpeakToggle?: (id: number, text: string) => void;
  onRegenerate?: () => void;
  lastAssistantId?: number;
  searchQuery?: string;
  onImageClick?: (url: string) => void;
  streamingThinking?: string;
}) {
  const isUser = group.role === 'user';
  const profile = useSettingsStore((s) => s.profile);
  const firstMsg = group.messages[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: isFirstGroup ? 0 : 0.05 }}
      className={`flex gap-2 md:gap-3 ${isUser ? 'flex-row-reverse' : ''} ${isStreaming ? 'animate-pulse' : ''}`}
    >
      {/* Avatar */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 400 }}
        className={`flex-shrink-0 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/20'
            : 'bg-muted text-muted-foreground border border-border/50'
        }`}
      >
        {isUser ? (
          profile.avatar ? (
            <img src={profile.avatar} className="w-full h-full rounded-full object-cover" alt="" />
          ) : (
            <User size={11} />
          )
        ) : (
          <AgentAvatar size={11} />
        )}
      </motion.div>

      {/* Messages */}
      <div className="max-w-[85%] md:max-w-[75%] min-w-0 space-y-1">
        {group.messages.map((msg, msgIndex) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isUser={isUser}
            isLastInGroup={msgIndex === group.messages.length - 1}
            isStreaming={isStreaming && msgIndex === group.messages.length - 1}
            isSpeaking={speakingId === msg.id}
            onSpeakToggle={onSpeakToggle}
            onRegenerate={!searchQuery && lastAssistantId === msg.id ? onRegenerate : undefined}
            onImageClick={onImageClick}
            delay={msgIndex * 0.03}
            searchQuery={searchQuery}
            streamingThinking={streamingThinking}
          />
        ))}
      </div>
    </motion.div>
  );
}

const COLLAPSE_THRESHOLD = 600;

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="mb-2 rounded-xl bg-muted/40 border border-border/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        <BrainCircuit size={12} />
        <span>Thinking</span>
        {isStreaming && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
        <span className="ml-auto">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 text-xs text-muted-foreground/50 italic leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="h-px bg-border/25 flex-1 max-w-[100px]" />
      <span className="px-3 text-[10px] text-muted-foreground/30 font-medium tracking-wide">
        {formatDateSeparator(date)}
      </span>
      <div className="h-px bg-border/25 flex-1 max-w-[100px]" />
    </div>
  );
}

function MessageBubble({
  message,
  isUser,
  isLastInGroup,
  isStreaming,
  isSpeaking,
  onSpeakToggle,
  onRegenerate,
  onImageClick,
  delay = 0,
  searchQuery,
  streamingThinking,
}: {
  message: Message;
  isUser: boolean;
  isLastInGroup: boolean;
  isStreaming?: boolean;
  isSpeaking?: boolean;
  onSpeakToggle?: (id: number, text: string) => void;
  onRegenerate?: () => void;
  onImageClick?: (url: string) => void;
  delay?: number;
  searchQuery?: string;
  streamingThinking?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const reactions = useChatStore((s) => s.reactions);
  const setReaction = useChatStore((s) => s.setReaction);
  const bookmarks = useChatStore((s) => s.bookmarks);
  const toggleBookmark = useChatStore((s) => s.toggleBookmark);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const editMessage = useChatStore((s) => s.editMessage);
  const currentReaction = reactions[message.id];
  const isBookmarked = bookmarks.includes(message.id);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isExpanded, setIsExpanded] = useState(false);

  const { thinking: parsedThinking, response: parsedResponse } = parseThinking(message.content);
  const thinking = (!isUser && (isStreaming ? streamingThinking : parsedThinking)) || null;
  const responseText = isUser ? message.content : parsedResponse.replace(/<\/?(?:label|div|span|p|input|form|button|script|style)(?:\s[^>]*)?>/gi, '');
  const shouldCollapse = !isUser && !isStreaming && responseText.length > COLLAPSE_THRESHOLD;
  const displayText = shouldCollapse && !isExpanded ? responseText.slice(0, COLLAPSE_THRESHOLD) + '...' : responseText;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const timestamp = timeAgo(message.created_at);
  const fullTimestamp = new Date(message.created_at).toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className="group relative"
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {/* Timestamp tooltip */}
      <AnimatePresence>
        {showTimestamp && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`absolute ${isUser ? 'right-0' : 'left-0'} -top-5 z-10`}
          >
            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1 whitespace-nowrap" title={fullTimestamp}>
              <Clock size={9} />
              {timestamp}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {message.metadata?.replyToId && (
        <div className="mb-2 rounded-lg bg-muted/40 border border-border/30 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 mb-0.5">
            <Reply size={9} />
            <span>Replying to {message.metadata.replyRole === 'assistant' ? 'AI' : 'you'}</span>
          </div>
          <p className="text-[11px] text-muted-foreground/50 line-clamp-2 italic">
            {message.metadata.replyPreview}
          </p>
        </div>
      )}

      {thinking && (
        <ThinkingBlock content={thinking} isStreaming={isStreaming} />
      )}

      <div
        className={`rounded-[22px] px-4 md:px-5 py-3 md:py-3.5 shadow-sm transition-shadow ${
          isUser
            ? 'bg-gradient-to-br from-primary via-cyan-500 to-accent text-white'
            : 'bg-card/90 border border-border/50 text-foreground'
        } ${isStreaming ? 'ring-1 ring-gray-500/20' : ''}`}
      >
        {isUser ? (
          isEditing ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 border border-border/50 focus:outline-none focus:border-border/70 resize-none"
                rows={3}
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => { setIsEditing(false); setEditContent(message.content); }}
                  className="text-[11px] px-2 py-1 rounded-md bg-muted/50 hover:bg-muted/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    editMessage(message.id, editContent);
                    setIsEditing(false);
                    toast('Message updated', 'success');
                  }}
                  className="text-[11px] px-2 py-1 rounded-md bg-white text-primary font-medium hover:bg-white/90 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <UserMessageContent content={displayText} onImageClick={onImageClick} searchQuery={searchQuery} />
          )
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre: ({ children }: any) => <>{children}</>,
                code: ({ children, className }: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  if (match) {
                    return (
                      <CodeBlock
                        code={String(children).replace(/\n$/, '')}
                        language={match[1]}
                      />
                    );
                  }
                  return (
                    <code className="bg-black/20 dark:bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono">
                      {highlightInNode(children, searchQuery || '')}
                    </code>
                  );
                },
                p: ({ children }: any) => <p>{highlightInNode(children, searchQuery || '')}</p>,
                li: ({ children }: any) => <li>{highlightInNode(children, searchQuery || '')}</li>,
                h1: ({ children }: any) => <h1>{highlightInNode(children, searchQuery || '')}</h1>,
                h2: ({ children }: any) => <h2>{highlightInNode(children, searchQuery || '')}</h2>,
                h3: ({ children }: any) => <h3>{highlightInNode(children, searchQuery || '')}</h3>,
                h4: ({ children }: any) => <h4>{highlightInNode(children, searchQuery || '')}</h4>,
                strong: ({ children }: any) => <strong>{highlightInNode(children, searchQuery || '')}</strong>,
                em: ({ children }: any) => <em>{highlightInNode(children, searchQuery || '')}</em>,
                a: ({ children, href }: any) => <a href={href} className="text-primary hover:underline">{highlightInNode(children, searchQuery || '')}</a>,
                del: ({ children }: any) => <del>{highlightInNode(children, searchQuery || '')}</del>,
                blockquote: ({ children }: any) => <blockquote>{highlightInNode(children, searchQuery || '')}</blockquote>,
              }}
            >
              {displayText}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Action bar */}
      {!isStreaming && isLastInGroup && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`flex items-center gap-0.5 mt-1 ${isUser ? 'justify-end' : ''}`}
        >
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Copy message"
          >
            {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setReplyingTo(message)}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Reply to message"
          >
            <Reply size={13} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => toggleBookmark(message)}
            className={`p-1.5 rounded-lg transition-all ${
              isBookmarked
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/60'
            }`}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark message'}
          >
            <Star size={13} fill={isBookmarked ? 'currentColor' : 'none'} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (confirm('Delete this message?')) deleteMessage(message.id);
            }}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete message"
          >
            <Trash2 size={13} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              const shareText = `${message.content}\n\n-- Shared from TAI`;
              if (navigator.share) {
                navigator.share({ text: shareText }).catch(() => {});
              } else {
                navigator.clipboard.writeText(shareText);
                toast('Message copied to clipboard', 'success');
              }
            }}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Share message"
          >
            <Share2 size={13} />
          </motion.button>

          {isUser && (
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { setIsEditing(true); setEditContent(message.content); }}
              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Edit message"
            >
              <Pencil size={13} />
            </motion.button>
          )}

          {!isUser && (
            <>
              <div className="flex items-center gap-0.5">
                {['👍','👎','❤️','🔥','😂','🤔','💡'].map((emoji) => (
                  <motion.button
                    key={emoji}
                    whileHover={{ scale: 1.25 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setReaction(message.id, currentReaction === emoji ? null : emoji)}
                    className={`px-1 py-0.5 rounded-md text-[11px] transition-all ${
                      currentReaction === emoji
                        ? 'bg-primary/10 scale-110 opacity-100'
                        : 'hover:bg-muted/40 opacity-50 hover:opacity-80'
                    }`}
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>

              {onRegenerate && (
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onRegenerate}
                  className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
                  title="Regenerate response"
                >
                  <RotateCcw size={13} />
                </motion.button>
              )}
            </>
          )}

          {!isUser && voiceEnabled && (
            <>
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onSpeakToggle?.(message.id, message.content)}
                className={`p-1.5 rounded-lg transition-all ${
                  isSpeaking
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/60'
                }`}
                title={isSpeaking ? 'Stop speaking' : 'Speak message'}
              >
                {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </motion.button>

              {isSpeaking && (
                <div className="flex items-end gap-[2px] h-4 px-1">
                  {[0, 0.1, 0.2, 0.15, 0.25].map((d, i) => (
                    <motion.div
                      key={i}
                      className="w-[3px] bg-primary rounded-full"
                      animate={{
                        height: [4, 14, 6, 16, 5],
                        opacity: [0.6, 1, 0.7, 1, 0.6],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.6,
                        delay: d,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Reading time & expand/collapse */}
      {!isUser && !isStreaming && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground/30">{readingTime(responseText)}</span>
          {message.metadata?.responseTimeMs && (
            <span className="text-[10px] text-muted-foreground/20">· {(message.metadata.responseTimeMs / 1000).toFixed(1)}s</span>
          )}
          {shouldCollapse && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[10px] text-primary/60 hover:text-primary transition-colors flex items-center gap-0.5"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={10} /> Show less
                </>
              ) : (
                <>
                  <ChevronDown size={10} /> Show more
                </>
              )}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function UserMessageContent({ content, onImageClick, searchQuery }: { content: string; onImageClick?: (url: string) => void; searchQuery?: string }) {
  const imageRegex = /!\[.*?\]\((data:image\/[^)]+)\)/;
  const match = content.match(imageRegex);

  if (match) {
    const textParts = content.split(match[0]);
    return (
      <div className="space-y-2">
        {textParts[0] && <p className="text-sm whitespace-pre-wrap">{highlightMatches(textParts[0].trim(), searchQuery || '')}</p>}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative cursor-zoom-in inline-block"
          onClick={() => onImageClick?.(match[1])}
        >
          <motion.img
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            src={match[1]}
            alt="Attached"
            className="max-h-48 rounded-lg object-contain border border-border/50"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <div className="p-1.5 rounded-full bg-black/40 backdrop-blur-sm">
              <Maximize2 size={14} className="text-white" />
            </div>
          </div>
        </motion.div>
        {textParts[1] && <p className="text-sm whitespace-pre-wrap">{highlightMatches(textParts[1].trim(), searchQuery || '')}</p>}
      </div>
    );
  }

  return <p className="text-sm whitespace-pre-wrap">{highlightMatches(content, searchQuery || '')}</p>;
}
