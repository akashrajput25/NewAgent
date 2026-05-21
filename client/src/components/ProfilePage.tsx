import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Camera, User, Mail, FileText, MessageSquare, Clock, Save
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { useChatStore } from '../stores/chatStore';
import { toast } from '../lib/toast';

interface ProfilePageProps {
  onBack: () => void;
}

export function ProfilePage({ onBack }: ProfilePageProps) {
  const profile = useSettingsStore((s) => s.profile);
  const updateProfile = useSettingsStore((s) => s.updateProfile);
  const conversations = useChatStore((s) => s.conversations);
  const messages = useChatStore((s) => s.messages);

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalMessages = messages.length;
  const totalConversations = conversations.length;
  const bookmarkedCount = useChatStore((s) => s.bookmarks.length);

  const handleAvatarSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    updateProfile({ displayName: displayName.trim(), email: email.trim(), bio: bio.trim(), avatar });
    setTimeout(() => {
      setIsSaving(false);
      toast('Profile updated', 'success');
    }, 400);
  }, [displayName, email, bio, avatar, updateProfile]);

  const initials = displayName.trim()
    ? displayName.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'ME';

  return (
    <div className="h-full w-full bg-background/90 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ChevronLeft size={20} />
        </motion.button>
        <h1 className="text-base font-semibold">Profile</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-lg mx-auto space-y-6">

          {/* Avatar Section */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-3"
          >
            <div
              className="relative w-24 h-24 rounded-full cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt="Avatar"
                  className="w-full h-full rounded-full object-cover border-2 border-border/40"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xl font-bold border-2 border-border/40">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={18} className="text-white" />
              </div>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleAvatarSelect}
                className="hidden"
              />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-muted-foreground/60 hover:text-primary transition-colors"
            >
              Change photo
            </button>
            {avatar && (
              <button
                onClick={() => setAvatar(null)}
                className="text-[11px] text-destructive/70 hover:text-destructive transition-colors"
              >
                Remove photo
              </button>
            )}
          </motion.div>

          {/* Form Fields */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground/60 flex items-center gap-1.5">
                <User size={12} />
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl bg-muted/40 border border-border/50 px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400/20 transition-all placeholder:text-muted-foreground/25"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground/60 flex items-center gap-1.5">
                <Mail size={12} />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl bg-muted/40 border border-border/50 px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400/20 transition-all placeholder:text-muted-foreground/25"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground/60 flex items-center gap-1.5">
                <FileText size={12} />
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us a little about yourself..."
                rows={3}
                className="w-full rounded-xl bg-muted/40 border border-border/50 px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400/20 transition-all placeholder:text-muted-foreground/25 resize-none"
              />
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              { icon: MessageSquare, label: 'Messages', value: totalMessages },
              { icon: Clock, label: 'Chats', value: totalConversations },
              { icon: FileText, label: 'Bookmarks', value: bookmarkedCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-muted/30 border border-border/60 px-3 py-3 text-center"
              >
                <stat.icon size={14} className="mx-auto text-muted-foreground/30 mb-1.5" />
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground/40">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Save Button */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:brightness-110 transition-all disabled:opacity-60"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Profile'}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
