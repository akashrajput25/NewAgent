import { create } from 'zustand';
import type { Conversation, Message, GeneratedImage, PersonalityMode } from '../types';

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
  thinkingContent: string;
  generatedImages: GeneratedImage[];
  activeToolCalls: unknown[];
  drafts: Record<number, string>;
  reactions: Record<number, string>;
  bookmarks: number[];
  bookmarkedMessages: Message[];
  replyingTo: Message | null;
  messageHistory: string[];

  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendToLastMessage: (content: string) => void;
  setIsLoading: (loading: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  setThinkingContent: (content: string) => void;
  appendThinkingContent: (chunk: string) => void;
  addGeneratedImage: (image: GeneratedImage) => void;
  addToolCall: (tool: unknown) => void;
  clearToolCalls: () => void;
  removeConversation: (id: number) => void;
  updateConversation: (id: number, updates: Partial<Conversation>) => void;
  setDraft: (conversationId: number, text: string) => void;
  setReaction: (messageId: number, reaction: string | null) => void;
  editMessage: (messageId: number, content: string) => void;
  deleteMessage: (messageId: number) => void;
  toggleBookmark: (message: Message) => void;
  setReplyingTo: (message: Message | null) => void;
  addToHistory: (text: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  streamingContent: '',
  thinkingContent: '',
  generatedImages: [],
  activeToolCalls: [],
  drafts: {},
  reactions: {},
  bookmarks: [],
  bookmarkedMessages: [],
  replyingTo: null,
  messageHistory: [],


  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (conversation) => set({ currentConversation: conversation, messages: [] }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  appendToLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        last.content += content;
      }
      return { messages };
    }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setStreamingContent: (streamingContent) => set({ streamingContent }),
  appendStreamingContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),
  setThinkingContent: (thinkingContent) => set({ thinkingContent }),
  appendThinkingContent: (chunk) =>
    set((state) => ({ thinkingContent: state.thinkingContent + chunk })),
  addGeneratedImage: (image) =>
    set((state) => ({ generatedImages: [image, ...state.generatedImages] })),
  addToolCall: (tool) =>
    set((state) => ({ activeToolCalls: [...state.activeToolCalls, tool] })),
  clearToolCalls: () => set({ activeToolCalls: [] }),
  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentConversation: state.currentConversation?.id === id ? null : state.currentConversation,
    })),
  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      currentConversation:
        state.currentConversation?.id === id
          ? { ...state.currentConversation, ...updates }
          : state.currentConversation,
    })),
  setDraft: (conversationId, text) =>
    set((state) => ({
      drafts: { ...state.drafts, [conversationId]: text },
    })),
  setReaction: (messageId, reaction) =>
    set((state) => {
      const newReactions = { ...state.reactions };
      if (reaction) {
        newReactions[messageId] = reaction;
      } else {
        delete newReactions[messageId];
      }
      return { reactions: newReactions };
    }),
  editMessage: (messageId, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, content } : m
      ),
    })),
  deleteMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    })),
  toggleBookmark: (message) =>
    set((state) => {
      const isBookmarked = state.bookmarks.includes(message.id);
      const bookmarks = isBookmarked
        ? state.bookmarks.filter((id) => id !== message.id)
        : [...state.bookmarks, message.id];
      const bookmarkedMessages = isBookmarked
        ? state.bookmarkedMessages.filter((m) => m.id !== message.id)
        : [...state.bookmarkedMessages, message];
      return { bookmarks, bookmarkedMessages };
    }),
  setReplyingTo: (replyingTo) => set({ replyingTo }),
  addToHistory: (text) =>
    set((state) => {
      const history = [text, ...state.messageHistory].slice(0, 50);
      return { messageHistory: history };
    }),
}));
