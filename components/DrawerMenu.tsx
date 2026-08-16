import React from "react";
import {
  X,
  Radio,
  Puzzle,
  ImageIcon,
  MessageSquare,
  Phone,
  Plus,
  Maximize2,
  Minimize2,
  LogOut,
  Sparkles,
  ChevronRight,
  Shield,
  Smile,
  Zap,
} from "lucide-react";
import { getDisplayVoiceName } from "./VoiceModal";

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: "chat" | "gallery";
  onSelectViewMode: (mode: "chat" | "gallery") => void;
  selectedVoice: string;
  onOpenVoiceModal: () => void;
  onOpenPluginsModal: () => void;
  onStartLiveCall: () => void;
  onNewChat: () => void;
  onPromptImage?: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  userName: string;
  userEmail?: string;
  onLogout: () => void;
  galleryCount: number;
}

export const DrawerMenu: React.FC<DrawerMenuProps> = ({
  isOpen,
  onClose,
  viewMode,
  onSelectViewMode,
  selectedVoice,
  onOpenVoiceModal,
  onOpenPluginsModal,
  onStartLiveCall,
  onNewChat,
  onPromptImage,
  isFullscreen,
  onToggleFullscreen,
  userName,
  userEmail,
  onLogout,
  galleryCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Dark Backdrop with Blur */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-sm w-full bg-[#131418] border-l border-white/10 shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-in-out animate-slide-left">
        {/* Drawer Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#2e6eff] to-[#7bddff] flex items-center justify-center shadow-lg shadow-[#2e6eff]/30 border border-white/15">
              <Zap className="w-5 h-5 text-white" fill="currentColor" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-white text-base tracking-tight">ZoZo AI</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2e6eff]/20 text-[#7bddff] border border-[#2e6eff]/30 font-medium">
                  Funny & Best
                </span>
              </div>
              <p className="text-xs text-[#9aa0a6] flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active & Ready</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#9aa0a6] hover:text-white hover:bg-white/10 border border-white/5 transition-all"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 mt-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2e6eff]/20 border border-[#2e6eff]/30 flex items-center justify-center text-[#7bddff] font-bold text-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white truncate">{userName}</div>
              <div className="text-[10px] text-[#9aa0a6] truncate">{userEmail || "ZoZo AI User"}</div>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all text-xs flex items-center gap-1"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        {/* Action Options List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6] px-2 mb-1">
            Features & Modes
          </div>

          {/* Chat Mode */}
          <button
            onClick={() => {
              onSelectViewMode("chat");
              onClose();
            }}
            className={`w-full p-3 rounded-2xl flex items-center justify-between border transition-all text-left group ${
              viewMode === "chat"
                ? "bg-[#2e6eff]/15 border-[#2e6eff]/40 text-white shadow-md shadow-[#2e6eff]/10"
                : "bg-white/[0.02] border-white/5 text-[#c4c7c5] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-[#2e6eff]/20 flex items-center justify-center text-[#7bddff]">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Chat Studio</div>
                <div className="text-[11px] text-[#9aa0a6]">Hinglish text & smart research</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9aa0a6] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Live Speak-to-Speak Call */}
          <button
            onClick={() => {
              onClose();
              onStartLiveCall();
            }}
            className="w-full p-3.5 rounded-2xl flex items-center justify-between border border-[#2e6eff]/40 bg-gradient-to-r from-[#2e6eff]/25 via-[#7bddff]/15 to-transparent hover:from-[#2e6eff]/35 transition-all text-left group shadow-lg shadow-[#2e6eff]/20"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2e6eff] to-[#7bddff] flex items-center justify-center text-white shadow-md shadow-[#2e6eff]/30 shrink-0">
                <Phone className="w-5 h-5 fill-current animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-black text-white flex items-center gap-2">
                  <span>Live Voice Call</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 font-bold uppercase tracking-wider border border-emerald-500/30">
                    Full Size
                  </span>
                </div>
                <div className="text-[11px] text-[#7bddff]/90 mt-0.5">Direct 2-way AI Voice Talking</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#7bddff] group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Gallery Studio */}
          <button
            onClick={() => {
              onSelectViewMode("gallery");
              onClose();
            }}
            className={`w-full p-3 rounded-2xl flex items-center justify-between border transition-all text-left group ${
              viewMode === "gallery"
                ? "bg-[#2e6eff]/15 border-[#2e6eff]/40 text-white shadow-md shadow-[#2e6eff]/10"
                : "bg-white/[0.02] border-white/5 text-[#c4c7c5] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-[#c58af9]/20 flex items-center justify-center text-[#c58af9]">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Photo Gallery</span>
                  {galleryCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#c58af9]/20 text-[#c58af9] font-bold">
                      {galleryCount}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#9aa0a6]">ZoZo AI Ultra-HD Creations</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9aa0a6] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Quick Create Photo */}
          <button
            onClick={() => {
              onClose();
              onSelectViewMode("chat");
              if (onPromptImage) onPromptImage();
            }}
            className="w-full p-3 rounded-2xl flex items-center justify-between border border-[#c58af9]/30 bg-[#c58af9]/10 hover:bg-[#c58af9]/20 text-[#c58af9] hover:text-white transition-all text-left group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-[#c58af9]/20 flex items-center justify-center text-[#c58af9]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Create HD Photo</div>
                <div className="text-[11px] text-[#c58af9]/80">Instant Photorealistic AI Prompt</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#c58af9] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Voice Selector */}
          <button
            onClick={() => {
              onClose();
              onOpenVoiceModal();
            }}
            className="w-full p-3 rounded-2xl flex items-center justify-between border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-[#c4c7c5] hover:text-white transition-all text-left group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Neural Voice</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    {getDisplayVoiceName(selectedVoice).split(' ')[0]}
                  </span>
                </div>
                <div className="text-[11px] text-[#9aa0a6]">8 Desi Indian AI voices (Jeet, Aarav, etc.)</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9aa0a6] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Plugins & API Key */}
          <button
            onClick={() => {
              onClose();
              onOpenPluginsModal();
            }}
            className="w-full p-3 rounded-2xl flex items-center justify-between border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-[#c4c7c5] hover:text-white transition-all text-left group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-[#7bddff]/20 flex items-center justify-center text-[#7bddff]">
                <Puzzle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Plugins & API Key</div>
                <div className="text-[11px] text-[#9aa0a6]">Google Search, Imagen 3 & Key</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9aa0a6] group-hover:translate-x-0.5 transition-transform" />
          </button>

          <div className="pt-2 text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6] px-2">
            Quick Actions
          </div>

          {/* New Chat */}
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full p-3 rounded-2xl flex items-center justify-between border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-[#c4c7c5] hover:text-white transition-all text-left group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">New Chat</div>
                <div className="text-[11px] text-[#9aa0a6]">Start fresh conversation</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9aa0a6] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => {
              onToggleFullscreen();
              onClose();
            }}
            className="w-full p-3 rounded-2xl flex items-center justify-between border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-[#c4c7c5] hover:text-white transition-all text-left group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
                </div>
                <div className="text-[11px] text-[#9aa0a6]">
                  {isFullscreen ? "Standard browser view" : "Immersive full screen view"}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9aa0a6] group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-xs text-[#9aa0a6]">
          <span className="flex items-center gap-1">
            <Smile className="w-3.5 h-3.5 text-[#7bddff]" />
            <span>ZoZo AI v2.5</span>
          </span>
          <span className="text-[10px] text-[#777]">Powered by Gemini 2.5</span>
        </div>
      </div>
    </div>
  );
};
