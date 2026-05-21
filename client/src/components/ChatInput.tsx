import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, ImagePlus, X, Code, Command, Smile, Trash2, Maximize2, Plus, Sparkles, PenTool, Wand2, BarChart3, Lightbulb } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { sendMessageStream } from '../lib/api';
import { toast } from '../lib/toast';
import { playSendSound } from '../lib/sounds';

const STARTER_PROMPTS = [
  { icon: Sparkles, label: 'Brainstorm', prompt: 'Help me brainstorm ideas for ' },
  { icon: Code, label: 'Write code', prompt: 'Write a function that ' },
  { icon: PenTool, label: 'Explain', prompt: 'Explain the concept of ' },
  { icon: Wand2, label: 'Compare', prompt: 'Compare these two options: ' },
  { icon: BarChart3, label: 'Analyze', prompt: 'Analyze the following: ' },
  { icon: Lightbulb, label: 'Create', prompt: 'Write a creative piece about ' },
];

const SLASH_COMMANDS = [
  { command: 'clear', label: 'Clear conversation', description: 'Remove all messages', icon: Trash2 },
  { command: 'focus', label: 'Toggle focus mode', description: 'Distraction-free chat', icon: Maximize2 },
  { command: 'new', label: 'New conversation', description: 'Start a fresh chat', icon: Plus },
  { command: 'help', label: 'Keyboard shortcuts', description: 'Show all shortcuts', icon: Command },
];

const EMOJIS = ['😀','😂','😊','😍','😎','😭','😡','🤔','🙄','😴','🥳','👍','👎','❤️','🔥','💯','✨','🎉','💡','⚡','🚀','💪','✌️','👌','🤞','🙏'];

export function ChatInput({ isMobile }: { isMobile?: boolean }) {
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevConvId = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const dragCounter = useRef(0);

  const currentConversation = useChatStore((s) => s.currentConversation);
  const messages = useChatStore((s) => s.messages);
  const setIsLoading = useChatStore((s) => s.setIsLoading);
  const setStreamingContent = useChatStore((s) => s.setStreamingContent);
  const appendStreamingContent = useChatStore((s) => s.appendStreamingContent);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const personality = useSettingsStore((s) => s.personality);
  const soundEffects = useSettingsStore((s) => s.soundEffects);
  const temperature = useSettingsStore((s) => s.temperature);
  const selectedModel = useSettingsStore((s) => s.selectedModel);
  const customSystemPrompt = useSettingsStore((s) => s.customSystemPrompt);
  const messageHistory = useChatStore((s) => s.messageHistory);
  const addToHistory = useChatStore((s) => s.addToHistory);
  const setThinkingContent = useChatStore((s) => s.setThinkingContent);
  const appendThinkingContent = useChatStore((s) => s.appendThinkingContent);
  const thinkingMode = useSettingsStore((s) => s.thinkingMode);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const draftInputRef = useRef('');
  const handleSendRef = useRef<(() => Promise<void>) | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (!currentConversation) return;
    if (prevConvId.current === currentConversation.id) return;
    prevConvId.current = currentConversation.id;

    const savedDraft = useChatStore.getState().drafts[currentConversation.id];
    setInput(savedDraft || '');
    setAttachedImage(null);
      }, [currentConversation]);

  useEffect(() => {
    if (!currentConversation) return;
    const timer = setTimeout(() => {
      useChatStore.getState().setDraft(currentConversation.id, input);
    }, 500);
    return () => clearTimeout(timer);
  }, [input, currentConversation]);

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast('Speech recognition not supported in this browser', 'error');
      return;
    }
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      setTimeout(() => {
        handleSendRef.current?.();
      }, 400);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };
    recognition.start();
  }, []);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setAttachedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setAttachedImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => setAttachedImage(ev.target?.result as string);
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!currentConversation || (!input.trim() && !attachedImage)) return;

    const messageText = input.trim() || (attachedImage ? 'Describe this image' : '');
    setInput('');
    setAttachedImage(null);
    setHistoryIndex(-1);
    draftInputRef.current = '';
    setIsLoading(true);
    setStreamingContent('');
    setThinkingContent('');
    const requestStartTime = Date.now();

    if (soundEffects) playSendSound();
    addToHistory(messageText);

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    addMessage({
      id: Date.now(),
      conversation_id: currentConversation.id,
      role: 'user',
      content: attachedImage ? `${messageText}\n\n![Attached image](${attachedImage})` : messageText,
      metadata: replyingTo ? {
        replyToId: replyingTo.id,
        replyPreview: replyingTo.content.substring(0, 100),
        replyRole: replyingTo.role,
      } : undefined,
      created_at: new Date().toISOString(),
    });

    setReplyingTo(null);

    let streamedContent = '';
    try {
      await sendMessageStream(
        currentConversation.id,
        messageText,
        attachedImage || undefined,
        personality,
        temperature,
        selectedModel,
        customSystemPrompt,
        thinkingMode,
        (chunk) => {
          streamedContent += chunk;
          appendStreamingContent(chunk);
        },
        () => {},
        (thinkingChunk) => {
          appendThinkingContent(thinkingChunk);
        },
        () => {
          setIsLoading(false);
          setStreamingContent('');
          setThinkingContent('');
          const now = new Date().toISOString();
          updateConversation(currentConversation.id, { updated_at: now });
          addMessage({
            id: Date.now(),
            conversation_id: currentConversation.id,
            role: 'assistant',
            content: streamedContent,
            metadata: { responseTimeMs: Date.now() - requestStartTime },
            created_at: now,
          });

          const conv = useChatStore.getState().currentConversation;
          if (conv && conv.title && /new|conversation|chat|untitled/i.test(conv.title.toLowerCase())) {
            const words = messageText.replace(/[^\w\s]/g, '').split(/\s+/).slice(0, 4).filter((w: string) => w.length > 0);
            const newTitle = words.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            if (newTitle.length > 2 && newTitle.length <= 60) {
              useChatStore.getState().updateConversation(conv.id, { title: newTitle });
              import('../lib/api').then(({ updateConversation: apiUpdate }) => {
                apiUpdate(conv.id, { title: newTitle }).catch(() => {});
              });
            }
          }
        }
      );
    } catch (err) {
      console.error('Send message error:', err);
      setIsLoading(false);
      setStreamingContent('');
      setThinkingContent('');
    }
  }, [currentConversation, input, attachedImage, personality, temperature, selectedModel, customSystemPrompt, thinkingMode, addMessage, setIsLoading, setStreamingContent, appendStreamingContent, setThinkingContent, appendThinkingContent, updateConversation, soundEffects, addToHistory]);

  handleSendRef.current = handleSend;

  // Slash command detection
  useEffect(() => {
    if (input.startsWith('/') && input.length > 0 && input.indexOf(' ') === -1) {
      setShowSlashMenu(true);
      setSlashFilter(input.slice(1).toLowerCase());
      setSlashIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  }, [input]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setShowSlashMenu(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const executeSlashCommand = useCallback((cmd: string) => {
    setInput('');
    setShowSlashMenu(false);
    switch (cmd) {
      case 'clear':
        useChatStore.getState().setMessages([]);
        toast('Messages cleared', 'success');
        break;
      case 'focus':
        useSettingsStore.getState().setFocusMode(!useSettingsStore.getState().focusMode);
        break;
      case 'new': {
        const personality = useSettingsStore.getState().personality;
        import('../lib/api').then(({ createConversation }) => {
          createConversation(undefined, personality).then((conv) => {
            const { conversations, setConversations, setCurrentConversation, setMessages } = useChatStore.getState();
            setConversations([conv, ...conversations]);
            setCurrentConversation(conv);
            setMessages([]);
            toast('New conversation created', 'success');
          }).catch(() => toast('Failed to create conversation', 'error'));
        });
        break;
      }
      case 'help':
        window.dispatchEvent(new CustomEvent('show-shortcuts'));
        break;
    }
  }, []);

  const insertEmoji = useCallback((emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setInput((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const newValue = input.slice(0, start) + emoji + input.slice(end);
    setInput(newValue);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    }, 0);
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlashMenu) {
      const cmds = SLASH_COMMANDS.filter((c) => c.command.includes(slashFilter));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % cmds.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + cmds.length) % cmds.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (cmds[slashIndex]) executeSlashCommand(cmds[slashIndex].command);
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
        setIsRecording(false);
      } else if (input) {
        setInput('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } else if (attachedImage) {
        setAttachedImage(null);
      }
    }
    if (e.key === 'ArrowUp' && !e.shiftKey && messageHistory.length > 0) {
      e.preventDefault();
      if (historyIndex === -1) draftInputRef.current = input;
      const newIndex = historyIndex + 1;
      if (newIndex < messageHistory.length) {
        setHistoryIndex(newIndex);
        setInput(messageHistory[newIndex]);
        setTimeout(adjustHeight, 0);
      }
    }
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(messageHistory[newIndex]);
        setTimeout(adjustHeight, 0);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput(draftInputRef.current);
        setTimeout(adjustHeight, 0);
      }
    }
  };

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const insertQuickAction = (prompt: string) => {
    setInput(prompt + ' ');
    textareaRef.current?.focus();
  };

  if (!currentConversation) return null;

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-0 z-30 pointer-events-none"
          >
            <div className="mx-4 mb-4 rounded-2xl border-2 border-dashed border-gray-400/30 bg-gray-500/5 backdrop-blur-sm p-8 flex flex-col items-center justify-center text-gray-400/50">
              <ImagePlus size={32} className="mb-2" />
              <p className="text-sm font-medium">Drop image here</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`border-t border-border/40 bg-gradient-to-t from-background via-background to-transparent pt-2 ${isMobile ? 'pb-20' : 'pb-4'} px-3 md:px-6`}>
        {/* Quick actions */}
        <AnimatePresence>
          {!hasMessages && !input && !attachedImage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center justify-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide"
            >
              {STARTER_PROMPTS.map((action) => (
                <motion.button
                  key={action.label}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => insertQuickAction(action.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/80 border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-gray-400/20 hover:bg-muted transition-all flex-shrink-0"
                >
                  <action.icon size={12} />
                  {action.label}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attached image preview */}
        <AnimatePresence>
          {attachedImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="mb-3 relative inline-block"
            >
              <img
                src={attachedImage}
                alt="Attached"
                className="h-20 md:h-24 rounded-xl object-cover border border-border shadow-sm"
              />
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => setAttachedImage(null)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md"
              >
                <X size={12} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reply preview */}
        <AnimatePresence>
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="mb-2 flex items-start gap-2 rounded-xl bg-muted/50 border border-border/30 px-3 py-2 max-w-4xl mx-auto"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground/40 font-medium">
                  Replying to {replyingTo.role === 'assistant' ? 'AI' : 'yourself'}
                </p>
                <p className="text-[11px] text-muted-foreground/60 line-clamp-1">
                  {replyingTo.content.replace(/!\[.*?\]\(.*?\)/g, '[image]').substring(0, 120)}
                </p>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-muted-foreground/30 hover:text-muted-foreground p-1 transition-colors"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="relative max-w-4xl mx-auto">
          <div className="flex items-end gap-2 bg-card/90 backdrop-blur-xl border border-border/50 rounded-[24px] px-3 py-2.5 md:px-5 md:py-3 shadow-lg shadow-black/10 focus-within:border-primary/20 focus-within:ring-1 focus-within:ring-primary/10 transition-all">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
            />

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 rounded-xl p-2.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Attach image"
            >
              <ImagePlus size={18} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onMouseDown={() => !isRecording && startRecording()}
              onMouseUp={() => {
                if (isRecording && recognitionRef.current) {
                  recognitionRef.current.stop();
                }
              }}
              onTouchStart={() => !isRecording && startRecording()}
              onTouchEnd={() => {
                if (isRecording && recognitionRef.current) {
                  recognitionRef.current.stop();
                }
              }}
              className={`flex-shrink-0 rounded-xl p-2.5 transition-colors relative select-none ${
                isRecording ? 'bg-red-500/10 text-red-500' : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/50'
              }`}
              title="Hold to record, release to send"
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              {/* Voice wave animation */}
              {isRecording && (
                <span className="absolute inset-0 rounded-xl border-2 border-red-500/30 animate-ping" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={`flex-shrink-0 rounded-xl p-2.5 transition-colors ${
                showEmojiPicker ? 'text-primary bg-primary/10' : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/50'
              }`}
              title="Insert emoji"
            >
              <Smile size={18} />
            </motion.button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); adjustHeight(); }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type a message, drop an image, or use voice..."
              rows={1}
              className="flex-1 resize-none bg-transparent border-none outline-none text-sm md:text-base placeholder:text-muted-foreground/35 min-h-[40px] max-h-[200px] py-2.5"
            />

            {input.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => { setInput(''); setShowSlashMenu(false); if (textareaRef.current) textareaRef.current.style.height = 'auto'; }}
                className="flex-shrink-0 rounded-xl p-2 text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Clear input"
              >
                <X size={16} />
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={!input.trim() && !attachedImage}
              className="flex-shrink-0 rounded-full bg-gradient-to-br from-primary to-accent p-2.5 text-white shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </motion.button>
          </div>
          {input.length > 0 && (
            <div className="flex justify-end px-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground/20 tabular-nums">{input.length}</span>
            </div>
          )}

          {/* Slash command menu */}
          <AnimatePresence>
            {showSlashMenu && (
              <motion.div
                ref={slashMenuRef}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute left-0 right-0 bottom-[calc(100%+0.5rem)] bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-lg shadow-black/10 overflow-hidden z-30"
              >
                {SLASH_COMMANDS.filter((c) => c.command.includes(slashFilter)).map((cmd, i) => (
                  <button
                    key={cmd.command}
                    onClick={() => executeSlashCommand(cmd.command)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === slashIndex ? 'bg-primary/10' : 'hover:bg-muted/40'
                    }`}
                  >
                    <cmd.icon size={14} className="text-muted-foreground/60" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">/{cmd.command}</p>
                      <p className="text-[10px] text-muted-foreground/40">{cmd.description}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Emoji picker */}
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                ref={emojiPickerRef}
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                className="absolute left-12 bottom-[calc(100%+0.5rem)] bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-lg shadow-black/10 p-2 z-30 w-[240px]"
              >
                <div className="grid grid-cols-7 gap-0.5">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { insertEmoji(emoji); setShowEmojiPicker(false); }}
                      className="text-base p-1 rounded hover:bg-muted/50 transition-colors text-center"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
