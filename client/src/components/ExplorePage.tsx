import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Wand2, Code, PenTool, BarChart3, Lightbulb, Briefcase, BookOpen, Sparkles } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { createConversation } from '../lib/api';
import { toast } from '../lib/toast';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'writing', label: 'Writing', icon: PenTool },
  { id: 'coding', label: 'Coding', icon: Code },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
  { id: 'creative', label: 'Creative', icon: Lightbulb },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'learning', label: 'Learning', icon: BookOpen },
];

const TEMPLATES = [
  { category: 'writing', title: 'Summarize', description: 'Condense a long article or text into key points', prompt: 'Summarize the following text into concise bullet points:' },
  { category: 'writing', title: 'Proofread', description: 'Check grammar and improve clarity', prompt: 'Proofread and improve the clarity of this text:' },
  { category: 'writing', title: 'Rewrite', description: 'Paraphrase in a different tone or style', prompt: 'Rewrite the following in a professional tone:' },
  { category: 'writing', title: 'Expand', description: 'Elaborate on a brief idea or outline', prompt: 'Expand on the following idea with more detail and examples:' },
  { category: 'coding', title: 'Explain Code', description: 'Break down what code does step by step', prompt: 'Explain what this code does step by step:' },
  { category: 'coding', title: 'Debug', description: 'Find and fix bugs in code', prompt: 'Debug this code and explain the fix:' },
  { category: 'coding', title: 'Generate Function', description: 'Create a function from requirements', prompt: 'Write a function that does the following:' },
  { category: 'coding', title: 'Refactor', description: 'Clean up and optimize existing code', prompt: 'Refactor this code to be cleaner and more efficient:' },
  { category: 'analysis', title: 'Compare', description: 'Compare two options or approaches', prompt: 'Compare these two options with pros and cons:' },
  { category: 'analysis', title: 'SWOT Analysis', description: 'Strengths, weaknesses, opportunities, threats', prompt: 'Perform a SWOT analysis on:' },
  { category: 'creative', title: 'Story Idea', description: 'Generate a creative story concept', prompt: 'Generate a creative story idea about:' },
  { category: 'creative', title: 'Brainstorm', description: 'Come up with ideas on a topic', prompt: 'Brainstorm creative ideas for:' },
  { category: 'business', title: 'Write Email', description: 'Professional email for any situation', prompt: 'Write a professional email about:' },
  { category: 'business', title: 'Meeting Notes', description: 'Structure notes from a meeting', prompt: 'Organize these meeting notes into clear sections:' },
  { category: 'learning', title: 'Explain Concept', description: 'Break down a complex topic simply', prompt: 'Explain this concept as if teaching a beginner:' },
  { category: 'learning', title: 'Quiz Me', description: 'Generate practice questions', prompt: 'Generate 5 quiz questions about:' },
];

export function ExplorePage({ onBack }: { onBack: () => void }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const personality = useSettingsStore((s) => s.personality);
  const setConversations = useChatStore((s) => s.setConversations);
  const setCurrentConversation = useChatStore((s) => s.setCurrentConversation);
  const setMessages = useChatStore((s) => s.setMessages);

  const filtered = TEMPLATES.filter((t) => {
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch = !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleUseTemplate = async (prompt: string) => {
    try {
      const conv = await createConversation(undefined, personality);
      const currentConversations = useChatStore.getState().conversations;
      setConversations([conv, ...currentConversations]);
      setCurrentConversation(conv);
      setMessages([]);
      setTimeout(() => {
        const input = document.querySelector('textarea');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          setter?.call(input, prompt);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
        }
      }, 100);
      onBack();
      toast('New conversation created', 'success');
    } catch (err) {
      toast('Failed to create conversation', 'error');
    }
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
        <h2 className="text-sm font-semibold">Explore</h2>
      </header>

      <div className="px-4 py-3 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-xl bg-muted/40 border border-border/50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary/30 transition-all placeholder:text-muted-foreground/25"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-card/80 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <cat.icon size={12} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((template) => (
              <motion.div
                key={template.title}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -2 }}
                className="rounded-xl bg-card/80 border border-border/50 p-4 cursor-pointer hover:border-primary/20 hover:bg-muted/30 transition-all group"
                onClick={() => handleUseTemplate(template.prompt)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wand2 size={14} className="text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">{template.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">{template.description}</p>
                <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-primary font-medium">Click to use →</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Search size={32} className="mx-auto text-muted-foreground/10 mb-3" />
            <p className="text-sm text-muted-foreground/30">No templates match your search</p>
          </div>
        )}
      </div>
    </main>
  );
}
