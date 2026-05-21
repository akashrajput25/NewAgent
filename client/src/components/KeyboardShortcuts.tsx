import { motion, AnimatePresence } from 'framer-motion';
import { X, Command, MessageSquare, Search, Settings, Sun, Moon, Download, Pin } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  {
    category: 'Navigation',
    items: [
      { keys: ['⌘', 'K'], label: 'Open Command Palette' },
      { keys: ['⌘', 'Shift', 'F'], label: 'Toggle focus mode' },
      { keys: ['?'], label: 'Show Keyboard Shortcuts' },
      { keys: ['Esc'], label: 'Close sidebar / dialogs' },
    ],
  },
  {
    category: 'Chat',
    items: [
      { keys: ['⌘', 'N'], label: 'New conversation' },
      { keys: ['⌘', 'Shift', 'S'], label: 'Focus search' },
      { keys: ['↑'], label: 'Browse message history' },
      { keys: ['Shift', 'Enter'], label: 'New line in message' },
    ],
  },
  {
    category: 'Actions',
    items: [
      { keys: ['Enter'], label: 'Send message' },
      { keys: ['Esc'], label: 'Cancel voice / clear input' },
    ],
  },
];

export function KeyboardShortcuts({ isOpen, onClose }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto py-3 scrollbar-hide">
              {SHORTCUTS.map((section) => (
                <div key={section.category} className="px-5 py-2">
                  <p className="text-[10px] font-bold text-muted-foreground/20 uppercase tracking-wider mb-2">
                    {section.category}
                  </p>
                  <div className="space-y-1.5">
                    {section.items.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between py-1"
                      >
                        <span className="text-sm text-muted-foreground/60">
                          {item.label}
                        </span>
                        <span className="flex items-center gap-1">
                          {item.keys.map((key, i) => (
                            <kbd
                              key={i}
                              className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-md bg-muted text-[10px] text-muted-foreground/40 border border-border/40 font-mono"
                            >
                              {key}
                            </kbd>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer tip */}
            <div className="px-5 py-3 border-t border-border/40 bg-muted/20">
              <p className="text-[11px] text-muted-foreground/30 text-center">
                Press <kbd className="px-1 rounded bg-muted border border-border/30 font-mono">?</kbd> anytime to show this help
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
