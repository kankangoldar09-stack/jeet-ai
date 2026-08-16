import React, { useState } from 'react';
import { X, Volume2, Check, Sparkles, Radio, Play, Square, Loader2 } from 'lucide-react';

export interface VoiceOption {
  id: string;
  name: string;
  title: string;
  gender: 'Female' | 'Male' | 'Neutral';
  vibe: string;
  accentColor: string;
  badge: string;
  samplePrompt: string;
}

export const VOICES: VoiceOption[] = [
  {
    id: 'Fenrir',
    name: 'Fenrir',
    title: 'Tactical Commander',
    gender: 'Male',
    vibe: 'Deep, authoritative & commanding (JARVIS / Iron Man style)',
    accentColor: '#ef4444',
    badge: 'Tactical',
    samplePrompt: 'नमस्ते भाई, फेनरिर वॉइस इंजन एक्टिव है। बताइए आज आपकी क्या मदद करूँ?',
  },
  {
    id: 'Kore',
    name: 'Kore',
    title: 'Neural ZoZo',
    gender: 'Female',
    vibe: 'Calm, elegant, soft & graceful AI companion',
    accentColor: '#8ab4f8',
    badge: 'ZoZo Classic',
    samplePrompt: 'हाँ भाई, ज़ोज़ो (ZoZo) आपकी सेवा में हाज़िर है। बताइए आज क्या काम करना है?',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    title: 'Cyber Modern',
    gender: 'Female',
    vibe: 'Smooth, bright, lively & fast conversational tone',
    accentColor: '#38bdf8',
    badge: 'Fast & Crisp',
    samplePrompt: 'नमस्ते भाई! ज़ेफिर वॉइस तैयार है। जो भी पूछना हो, बिल्कुल बेझिझक पूछिए!',
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    title: 'Harmonic Flow',
    gender: 'Female',
    vibe: 'Melodic, warm, empathetic & expressive cadence',
    accentColor: '#ec4899',
    badge: 'Expressive',
    samplePrompt: 'जी भाई, आओएडे वॉइस कनेक्ट हो चुकी है। आपकी हर बात का साफ़ और सही जवाब मिलेगा।',
  },
  {
    id: 'Leda',
    name: 'Leda',
    title: 'Executive AI',
    gender: 'Female',
    vibe: 'Polished, structured, clear & executive precision',
    accentColor: '#a855f7',
    badge: 'Executive',
    samplePrompt: 'नमस्ते भाई, लेडा वॉइस एक्टिव है। मार्केट डेटा और जानकारी एकदम सटीक मिलेगी।',
  },
  {
    id: 'Puck',
    name: 'Puck',
    title: 'Cyber Spark',
    gender: 'Neutral',
    vibe: 'Playful, upbeat, witty & friendly companion',
    accentColor: '#10b981',
    badge: 'Energetic',
    samplePrompt: 'अरे हाँ भाई! पक सिस्टम पूरी तरह तैयार है। आज क्या नया और मज़ेदार करना है?',
  },
  {
    id: 'Charon',
    name: 'Charon',
    title: 'Deep Resonator',
    gender: 'Male',
    vibe: 'Deep, cinematic, resonant & mysterious presence',
    accentColor: '#f59e0b',
    badge: 'Cinematic',
    samplePrompt: 'सिस्टम तैयार है भाई। शैरोन वॉइस कनेक्टेड है। हुक्म दीजिए।',
  },
  {
    id: 'Orpheus',
    name: 'Orpheus',
    title: 'Dynamic Orator',
    gender: 'Male',
    vibe: 'Charismatic, confident, articulate & bold delivery',
    accentColor: '#f97316',
    badge: 'Dynamic',
    samplePrompt: 'नमस्ते भाई, ऑरफियस वॉइस एक्टिव है। बताइए आज आपकी क्या सेवा करूँ?',
  },
];

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  onPreviewVoice: (voice: VoiceOption) => Promise<void>;
  previewingVoiceId: string | null;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  onSelectVoice,
  onPreviewVoice,
  previewingVoiceId,
}) => {
  const [filter, setFilter] = useState<'All' | 'Female' | 'Male'>('All');

  if (!isOpen) return null;

  const filteredVoices = VOICES.filter((v) => {
    if (filter === 'All') return true;
    if (filter === 'Female') return v.gender === 'Female';
    if (filter === 'Male') return v.gender === 'Male' || v.gender === 'Neutral';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-md animate-fade-in">
      <div 
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#1a1b1e] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 border-b border-white/10 bg-[#141517]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8ab4f8] to-[#f97316] flex items-center justify-center shadow-[0_0_15px_rgba(138,180,248,0.3)]">
              <Radio className="w-5 h-5 text-[#0a0a0a]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg md:text-xl font-bold text-white tracking-tight">Neural Voice Matrix</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#8ab4f8]/20 text-[#8ab4f8] border border-[#8ab4f8]/30 rounded-full">
                  8 Voices
                </span>
              </div>
              <p className="text-xs text-[#9aa0a6]">Select voice for Live AI Audio & Voice Narration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#9aa0a6] hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between px-5 py-3 md:px-6 bg-[#18191c] border-b border-white/5">
          <div className="flex items-center gap-2">
            {(['All', 'Female', 'Male'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === f
                    ? 'bg-[#8ab4f8] text-[#0a0a0a] shadow-md shadow-[#8ab4f8]/20'
                    : 'text-[#9aa0a6] hover:text-white hover:bg-white/5'
                }`}
              >
                {f === 'All' ? 'All Voices (8)' : f === 'Female' ? 'Female (4)' : 'Male / Neutral (4)'}
              </button>
            ))}
          </div>
          <span className="hidden sm:inline-block text-[11px] text-[#8ab4f8] font-mono">
            Active: <strong className="text-white">{selectedVoice}</strong>
          </span>
        </div>

        {/* Voice grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {filteredVoices.map((voice) => {
              const isSelected = selectedVoice === voice.id;
              const isPreviewing = previewingVoiceId === voice.id;

              return (
                <div
                  key={voice.id}
                  onClick={() => onSelectVoice(voice.id)}
                  className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#8ab4f8]/15 via-white/5 to-transparent border-[#8ab4f8] shadow-[0_0_20px_rgba(138,180,248,0.15)] ring-1 ring-[#8ab4f8]/40'
                      : 'bg-[#141517] border-white/5 hover:border-white/20 hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-md transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: `${voice.accentColor}20`,
                          color: voice.accentColor,
                          border: `1px solid ${voice.accentColor}40`,
                        }}
                      >
                        {voice.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm md:text-base">{voice.name}</h4>
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${voice.accentColor}20`,
                              color: voice.accentColor,
                            }}
                          >
                            {voice.badge}
                          </span>
                        </div>
                        <span className="text-xs text-[#9aa0a6]">{voice.title} · {voice.gender}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#8ab4f8] text-[#0a0a0a] flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-[#c4c7c5] leading-relaxed line-clamp-2">
                    {voice.vibe}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewVoice(voice);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isPreviewing
                          ? 'bg-[#8ab4f8] text-[#0a0a0a] animate-pulse'
                          : 'bg-white/5 text-[#c4c7c5] hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {isPreviewing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Speaking...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-[#8ab4f8]" />
                          <span>Test Sample</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVoice(voice.id);
                      }}
                      className={`text-xs font-bold transition-colors ${
                        isSelected
                          ? 'text-[#8ab4f8]'
                          : 'text-[#9aa0a6] hover:text-white'
                      }`}
                    >
                      {isSelected ? 'Active Voice' : 'Set as Voice'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 md:px-6 bg-[#141517] border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#9aa0a6]">
            <Sparkles className="w-4 h-4 text-[#8ab4f8]" />
            <span>Selected voice applies to Live Audio, Narration & Voice HUD</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#8ab4f8] text-[#0a0a0a] font-bold text-xs hover:bg-white transition-all shadow-md shadow-[#8ab4f8]/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
