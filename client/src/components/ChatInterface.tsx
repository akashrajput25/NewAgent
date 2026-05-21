import { useState, useEffect, useCallback } from 'react';
import { Download, X, Search, Hexagon, Wand2, ChevronLeft, Share2, Command, BrainCircuit, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { exportConversation, sendMessageStream, updateConversation } from '../lib/api';
import { toast } from '../lib/toast';

export function ChatInterface({ onToggleSidebar, isMobile }: { onToggleSidebar: () => void; isMobile: boolean }) {
  const currentConversation = useChatStore((s) => s.currentConversation);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const focusMode = useSettingsStore((s) => s.focusMode);
  const setFocusMode = useSettingsStore((s) => s.setFocusMode);
  const messages = useChatStore((s) => s.messages);
  const messageCount = messages.length;
  const wordCount = messages.reduce((acc, msg) => acc + msg.content.trim().split(/\s+/).filter(w => w.length > 0).length, 0);

  useEffect(() => {
    const handler = () => setShowSettings((prev) => !prev);
    window.addEventListener('open-settings', handler);
    return () => window.removeEventListener('open-settings', handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowShortcuts(true);
    window.addEventListener('show-shortcuts', handler);
    return () => window.removeEventListener('show-shortcuts', handler);
  }, []);

  const handleExport = async () => {
    if (!currentConversation) return;
    try {
      const blob = await exportConversation(currentConversation.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${currentConversation.id}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Conversation exported', 'success');
    } catch (err) {
      toast('Failed to export conversation', 'error');
      console.error(err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      if (e.key !== 'Escape') return;

      if (showShortcuts) {
        setShowShortcuts(false);
      } else if (showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      } else if (showSettings) {
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, showSettings, showShortcuts]);

  const handleRegenerate = useCallback(async () => {
    const conv = useChatStore.getState().currentConversation;
    const msgs = useChatStore.getState().messages;
    if (!conv || msgs.length < 2) return;

    let lastAiIndex = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        lastAiIndex = i;
        break;
      }
    }
    if (lastAiIndex === -1) return;

    let userMsgIndex = -1;
    for (let i = lastAiIndex - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        userMsgIndex = i;
        break;
      }
    }
    if (userMsgIndex === -1) return;

    const userMessage = msgs[userMsgIndex];
    const newMessages = msgs.slice(0, lastAiIndex);
    useChatStore.getState().setMessages(newMessages);
    useChatStore.getState().setIsLoading(true);
    useChatStore.getState().setStreamingContent('');
    useChatStore.getState().setThinkingContent('');

    let streamedContent = '';
    const requestStartTime = Date.now();
    const state = useSettingsStore.getState();
    const personality = state.personality;
    const temperature = state.temperature;
    const model = state.selectedModel;
    const systemPrompt = state.customSystemPrompt;
    const thinkingMode = state.thinkingMode;

    try {
      await sendMessageStream(
        conv.id,
        userMessage.content.replace(/\n\n!\[Attached image\]\(data:image\/[^)]+\)/, '').trim(),
        undefined,
        personality,
        temperature,
        model,
        systemPrompt,
        thinkingMode,
        (chunk) => {
          streamedContent += chunk;
          useChatStore.getState().appendStreamingContent(chunk);
        },
        () => {},
        () => {},
        () => {
          useChatStore.getState().setIsLoading(false);
          useChatStore.getState().setStreamingContent('');
          useChatStore.getState().setThinkingContent('');
          const now = new Date().toISOString();
          useChatStore.getState().updateConversation(conv.id, { updated_at: now });
          useChatStore.getState().addMessage({
            id: Date.now(),
            conversation_id: conv.id,
            role: 'assistant',
            content: streamedContent,
            metadata: { responseTimeMs: Date.now() - requestStartTime },
            created_at: now,
          });
        }
      );
    } catch (err) {
      useChatStore.getState().setIsLoading(false);
      useChatStore.getState().setStreamingContent('');
      toast('Failed to regenerate response', 'error');
      console.error(err);
    }
  }, []);

  const handleRename = async () => {
    if (!currentConversation || !editTitle.trim() || editTitle.trim() === currentConversation.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await updateConversation(currentConversation.id, { title: editTitle.trim() });
      useChatStore.getState().updateConversation(currentConversation.id, { title: editTitle.trim() });
      setIsEditingTitle(false);
      toast('Conversation renamed', 'success');
    } catch (err) {
      toast('Failed to rename conversation', 'error');
      console.error(err);
    }
  };

  const handleShare = async () => {
    if (!currentConversation) return;
    const shareData = {
      title: currentConversation.title,
      text: `Check out my conversation with TAI: ${currentConversation.title}`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      toast('Link copied to clipboard', 'success');
    }
  };

  const handleBack = () => {
    useChatStore.getState().setCurrentConversation(null);
    useChatStore.getState().setMessages([]);
  };

  if (!currentConversation) {
    return (
      <main className="flex-1 flex flex-col bg-background/50 relative overflow-hidden">
        <AnimatePresence>
          {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
        </AnimatePresence>

        {/* Animated background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gray-500/[0.03] rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-gray-400/[0.04] rounded-full blur-[100px] pointer-events-none animate-pulse" />

        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center space-y-8 relative z-10 px-8 py-10 bg-background/60 backdrop-blur-md rounded-3xl border border-border/20"
          >
            <div className="relative inline-flex">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/20">
                <Hexagon size={48} className="text-white" strokeWidth={2} />
              </div>
              <motion.div
                className="absolute inset-0 rounded-2xl bg-primary/20"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute -inset-3 rounded-3xl border border-primary/10"
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 0.5 }}
              />
            </div>

            <div>
              <motion.h1
                className="text-5xl font-bold gradient-text tracking-tight"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                TAI
              </motion.h1>
              <motion.p
                className="text-muted-foreground text-sm mt-3 tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Thinking AI Assistant
              </motion.p>
            </div>

            <motion.div
              className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {['Intelligent Responses', 'Voice Enabled', 'Vision Ready', 'Real-time'].map((tag, i) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/70 border border-border/40"
                >
                  {i === 0 && <Wand2 size={11} />}
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                  {tag}
                </motion.span>
              ))}
            </motion.div>

            <motion.p
              className="text-muted-foreground text-sm max-w-xs mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              Select a conversation or press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border/50">
                {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}N
              </kbd>{' '}
              to start chatting
            </motion.p>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-background/80 backdrop-blur-sm relative">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border/60 px-3 md:px-5 py-3 bg-background/50 backdrop-blur-md z-10">
        {isMobile && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleBack}
            className="p-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <ChevronLeft size={18} />
          </motion.button>
        )}

        {showSearch ? (
          <div className="flex items-center gap-2 flex-1">
            <Search size={15} className="text-muted-foreground/40 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/30"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowSearch(false);
                  setSearchQuery('');
                }
              }}
            />
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
              className="p-1 rounded-lg hover:bg-muted/40 text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <div className="min-w-0 flex-1 flex justify-center">
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => handleRename()}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsEditingTitle(false); }}
                className="text-sm font-semibold bg-transparent border-b border-gray-400/50 outline-none w-full max-w-sm focus:border-gray-400 transition-colors text-center"
              />
            ) : (
              <div
                className="flex flex-col items-center cursor-pointer group"
                onClick={() => { setIsEditingTitle(true); setEditTitle(currentConversation.title); }}
              >
                <h2 className="text-sm font-semibold truncate group-hover:text-gray-400 transition-colors">
                  {currentConversation.title}
                </h2>
                <span className="text-[10px] text-muted-foreground/30 capitalize">
                  {currentConversation.personality} mode · {messageCount} messages · {wordCount} words
                </span>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setFocusMode(!focusMode)}
            className={`rounded-lg p-2 transition-all ${focusMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground/40 hover:text-foreground hover:bg-muted/40'}`}
            title={focusMode ? 'Exit focus mode' : 'Focus mode'}
          >
            {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}
            className={`rounded-lg p-2 transition-all ${showSearch ? 'bg-gray-500/10 text-gray-400' : 'text-muted-foreground/40 hover:text-foreground hover:bg-muted/40'}`}
            title="Search messages"
          >
            <Search size={16} />
          </button>
          <button
            onClick={handleExport}
            className="rounded-lg p-2 text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-all"
            title="Export conversation"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleShare}
            className="rounded-lg p-2 text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-all"
            title="Share conversation"
          >
            <Share2 size={16} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      </AnimatePresence>

      <div className="flex-1 overflow-hidden">
        <MessageList searchQuery={searchQuery} onRegenerate={handleRegenerate} />
      </div>

      <ChatInput isMobile={isMobile} />
    </main>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const personality = useSettingsStore((s) => s.personality);
  const setPersonality = useSettingsStore((s) => s.setPersonality);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useSettingsStore((s) => s.setVoiceEnabled);
  const autoSpeak = useSettingsStore((s) => s.autoSpeak);
  const setAutoSpeak = useSettingsStore((s) => s.setAutoSpeak);
  const syntaxHighlighting = useSettingsStore((s) => s.syntaxHighlighting);
  const setSyntaxHighlighting = useSettingsStore((s) => s.setSyntaxHighlighting);
  const selectedVoice = useSettingsStore((s) => s.selectedVoice);
  const setSelectedVoice = useSettingsStore((s) => s.setSelectedVoice);
  const soundEffects = useSettingsStore((s) => s.soundEffects);
  const setSoundEffects = useSettingsStore((s) => s.setSoundEffects);
  const temperature = useSettingsStore((s) => s.temperature);
  const setTemperature = useSettingsStore((s) => s.setTemperature);
  const customSystemPrompt = useSettingsStore((s) => s.customSystemPrompt);
  const setCustomSystemPrompt = useSettingsStore((s) => s.setCustomSystemPrompt);
  const selectedModel = useSettingsStore((s) => s.selectedModel);
  const setSelectedModel = useSettingsStore((s) => s.setSelectedModel);
  const voiceRate = useSettingsStore((s) => s.voiceRate);
  const setVoiceRate = useSettingsStore((s) => s.setVoiceRate);
  const thinkingMode = useSettingsStore((s) => s.thinkingMode);
  const setThinkingMode = useSettingsStore((s) => s.setThinkingMode);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const personalities = ['professional', 'casual', 'creative', 'coding', 'sarcastic', 'vibe'];
  const models = [
    'openrouter/free',
    'google/gemini-2.5-pro-exp-03-25:free',
    'deepseek/deepseek-chat:free',
    'meta-llama/llama-4-maverick:free',
    'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
  ];

  const ToggleButton = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`w-full rounded-lg px-2 py-1.5 text-xs font-semibold border transition-all ${
        active
          ? 'bg-primary/10 text-primary border-primary/30'
          : 'bg-background/50 border-border/50 hover:bg-muted/40 text-muted-foreground'
      }`}
    >
      {label}
    </motion.button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="border-b border-border/40 px-5 py-4 space-y-4 bg-card/50 backdrop-blur-md overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Settings</h3>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X size={14} />
        </motion.button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Personality</label>
          <select
            value={personality}
            onChange={(e) => setPersonality(e.target.value as any)}
            className="w-full rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/25 transition-all"
          >
            {personalities.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Theme</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="w-full rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/25 transition-all"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">TTS</label>
          <ToggleButton active={voiceEnabled} onClick={() => setVoiceEnabled(!voiceEnabled)} label={voiceEnabled ? 'On' : 'Off'} />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Auto-speak</label>
          <ToggleButton active={autoSpeak} onClick={() => setAutoSpeak(!autoSpeak)} label={autoSpeak ? 'On' : 'Off'} />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Syntax</label>
          <ToggleButton active={syntaxHighlighting} onClick={() => setSyntaxHighlighting(!syntaxHighlighting)} label={syntaxHighlighting ? 'On' : 'Off'} />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Voice</label>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            disabled={!voiceEnabled || voices.length === 0}
            className="w-full rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/25 transition-all"
          >
            <option value="">Default</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name.length > 25 ? v.name.slice(0, 25) + '...' : v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="pt-3 border-t border-border/30 space-y-3">
        <h4 className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">AI Configuration</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/25 transition-all"
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Temperature ({temperature})</label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/30">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Voice Rate ({voiceRate}x)</label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={voiceRate}
              onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/30">
              <span>Slow</span>
              <span>Normal</span>
              <span>Fast</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Sounds</label>
            <ToggleButton active={soundEffects} onClick={() => setSoundEffects(!soundEffects)} label={soundEffects ? 'On' : 'Off'} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
              <BrainCircuit size={9} /> Thinking
            </label>
            <ToggleButton active={thinkingMode} onClick={() => setThinkingMode(!thinkingMode)} label={thinkingMode ? 'On' : 'Off'} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Custom Instructions</label>
          <textarea
            value={customSystemPrompt}
            onChange={(e) => setCustomSystemPrompt(e.target.value)}
            placeholder="Add custom instructions for the AI..."
            rows={2}
            className="w-full rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/25 transition-all resize-none placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      <div className="pt-3 border-t border-border/30 flex items-center justify-between">
        <button
          onClick={() => {
            if (!confirm('Clear all messages in this conversation?')) return;
            useChatStore.getState().setMessages([]);
            toast('Messages cleared', 'success');
          }}
          className="text-xs font-medium text-destructive/70 hover:text-destructive transition-colors"
        >
          Clear all messages
        </button>
        <span className="text-[10px] text-muted-foreground/30 font-mono">TAI v1.0</span>
      </div>
    </motion.div>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: ['Ctrl / Cmd', 'N'], action: 'New conversation' },
    { keys: ['Enter'], action: 'Send message' },
    { keys: ['Shift', 'Enter'], action: 'New line' },
    { keys: ['Esc'], action: 'Close / Cancel' },
    { keys: ['↑', '↓'], action: 'Recall message history' },
    { keys: ['?'], action: 'Toggle shortcuts' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-sm bg-card border border-border/50 rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Command size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.action} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-muted-foreground/60">{shortcut.action}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <span key={key}>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/40 text-[11px] font-mono text-muted-foreground/70">
                      {key}
                    </kbd>
                    {i < shortcut.keys.length - 1 && <span className="text-muted-foreground/30 mx-0.5">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
