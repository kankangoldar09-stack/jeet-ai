import React, { useState } from 'react';
import { 
  X, 
  KeyRound, 
  ExternalLink, 
  Check, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Globe, 
  Image as ImageIcon, 
  Volume2, 
  Cpu, 
  ShieldCheck, 
  Trash2, 
  Eye, 
  EyeOff,
  Puzzle
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export interface PluginSettings {
  searchGrounding: boolean;
  imagenGeneration: boolean;
  voiceTts: boolean;
  deepReasoning: boolean;
}

interface PluginsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customApiKey: string;
  onSaveApiKey: (key: string) => void;
  pluginSettings: PluginSettings;
  onUpdatePlugins: (newSettings: PluginSettings) => void;
}

export const PluginsModal: React.FC<PluginsModalProps> = ({
  isOpen,
  onClose,
  customApiKey,
  onSaveApiKey,
  pluginSettings,
  onUpdatePlugins,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(customApiKey);
  const [showKey, setShowKey] = useState(false);
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  React.useEffect(() => {
    setApiKeyInput(customApiKey);
  }, [customApiKey]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    const rawKey = apiKeyInput.trim().replace(/^["'`]|["'`]$/g, '').trim();
    if (!rawKey) {
      setTestingStatus('error');
      setStatusMessage('Please valid Google AI Studio API Key enter karein.');
      return;
    }

    setTestingStatus('testing');
    setStatusMessage('Google AI Studio se connection check ho raha hai...');

    let isValid = false;
    let errorDetail = '';

    // Step 1: Direct Google AI Studio REST validation
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${rawKey}&pageSize=1`);
      if (res.ok) {
        isValid = true;
      } else {
        const errJson = await res.json().catch(() => null);
        errorDetail = errJson?.error?.message || `HTTP ${res.status}`;
      }
    } catch (e: any) {
      // If direct fetch is blocked by CORS/network, fallback to SDK
      console.warn('REST verification skipped, testing with SDK:', e);
    }

    // Step 2: Test with @google/genai SDK if needed
    if (!isValid) {
      try {
        const ai = new GoogleGenAI({ apiKey: rawKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: 'Say OK',
        });
        if (response && response.text) {
          isValid = true;
        }
      } catch (sdkErr: any) {
        if (!errorDetail) {
          errorDetail = sdkErr?.message || 'Unknown error';
        }
      }
    }

    if (isValid) {
      setTestingStatus('success');
      setStatusMessage('✓ Original Google AI Studio API Key successfully connect ho gayi!');
      onSaveApiKey(rawKey);
    } else {
      setTestingStatus('error');
      if (errorDetail.includes('API_KEY_INVALID') || errorDetail.includes('400') || errorDetail.includes('403')) {
        setStatusMessage('Invalid API Key! Yeh Google AI Studio ki valid key nahi hai. Please aistudio.google.com se AIzaSy... wali key copy karein.');
      } else if (errorDetail.includes('429') || errorDetail.includes('RESOURCE_EXHAUSTED')) {
        setStatusMessage('Is Key ka quota pura ho chuka hai, lekin Key valid hai aur save kar di gayi hai.');
        onSaveApiKey(rawKey);
        setTestingStatus('success');
      } else {
        // Allow saving anyway in case of network variance
        setStatusMessage(`Warning: ${errorDetail.slice(0, 90)}. Agar aapki Key authentic hai to "Direct Save" par click karein.`);
      }
    }
  };

  const handleSave = () => {
    const cleaned = apiKeyInput.trim().replace(/^["'`]|["'`]$/g, '').trim();
    onSaveApiKey(cleaned);
    setTestingStatus('success');
    setStatusMessage(cleaned ? '✓ API Key turant save kar di gayi hai aur active hai!' : 'Default Key par reset kar diya gaya.');
  };

  const handleRemoveKey = () => {
    setApiKeyInput('');
    onSaveApiKey('');
    setTestingStatus('idle');
    setStatusMessage('Custom API Key hata di gayi hai. Default Key use hogi.');
  };

  const togglePlugin = (key: keyof PluginSettings) => {
    onUpdatePlugins({
      ...pluginSettings,
      [key]: !pluginSettings[key],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#1e1f20] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#171819]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2e6eff]/20 to-[#7bddff]/20 border border-[#2e6eff]/30 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-[#7bddff]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                ZoZo AI - Plugins & API Key
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2e6eff]/10 text-[#7bddff] border border-[#2e6eff]/20">
                  Settings
                </span>
              </h2>
              <p className="text-xs text-[#9aa0a6]">
                Google AI Studio API Key add karein aur features customize karein
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#9aa0a6] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {/* API Key Section */}
          <div className="bg-[#131314] border border-white/10 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#7bddff]" />
                <label className="text-sm font-semibold text-white">
                  Google AI Studio Gemini API Key
                </label>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#7bddff] hover:underline flex items-center gap-1 font-medium bg-[#2e6eff]/10 px-2.5 py-1 rounded-lg border border-[#2e6eff]/20"
              >
                <span>Free Key Paayein</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Quick 3-Step Guide */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1.5 text-xs text-[#c4c7c5]">
              <div className="font-semibold text-white text-[11px] uppercase tracking-wider text-[#7bddff]">
                🔑 Real Gemini API Key Kaise Lein:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#9aa0a6]">
                <li><b className="text-white">"Free Key Paayein"</b> button par click karke AI Studio kholein.</li>
                <li><b className="text-white">"Create API key"</b> par click karein aur Project select karein.</li>
                <li>Key copy karein (yeh <code className="text-[#7bddff] bg-black/40 px-1 py-0.5 rounded">AIzaSy...</code> se start hoti hai) aur niche paste karein.</li>
              </ol>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setTestingStatus('idle');
                  setStatusMessage('');
                }}
                placeholder="AIzaSy..."
                className="w-full bg-[#1e1f20] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#2e6eff] pr-20 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-white p-1"
                title={showKey ? 'Hide' : 'Show'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testingStatus === 'testing' || !apiKeyInput.trim()}
                className="px-4 py-2 bg-[#2e6eff] hover:bg-[#255fd9] text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-md shadow-[#2e6eff]/20"
              >
                {testingStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Check ho raha hai...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Test & Save Key</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white font-medium text-xs rounded-xl border border-white/10 transition-all"
                title="Bina test kiye direct save karein"
              >
                Direct Save
              </button>

              {customApiKey && (
                <button
                  type="button"
                  onClick={handleRemoveKey}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium text-xs rounded-xl border border-red-500/20 flex items-center gap-1 transition-all ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div
                className={`text-xs p-3 rounded-lg flex items-center gap-2 ${
                  testingStatus === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : testingStatus === 'error'
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                    : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
                }`}
              >
                {testingStatus === 'success' ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : testingStatus === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                )}
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-[#5f6368] pt-1">
              <span>Status:</span>
              <span className={`font-semibold ${customApiKey ? 'text-emerald-400' : 'text-[#8ab4f8]'}`}>
                {customApiKey ? '● Custom AI Studio Key Active' : '○ Default Workspace Key Active'}
              </span>
            </div>
          </div>

          {/* Plugins List */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#c58af9]" />
              <h3 className="text-sm font-semibold text-white">Active Neural Plugins</h3>
            </div>

            <div className="space-y-2">
              {/* Google Search Grounding Plugin */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#131314] border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Google Search Grounding</div>
                    <div className="text-[11px] text-[#9aa0a6]">
                      Live market rates (gold, silver, stocks), weather aur breaking news
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => togglePlugin('searchGrounding')}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    pluginSettings.searchGrounding ? 'bg-[#8ab4f8]' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`bg-[#131314] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      pluginSettings.searchGrounding ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Imagen 3 Generator Plugin */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#131314] border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Imagen 3 Ultra Generator</div>
                    <div className="text-[11px] text-[#9aa0a6]">
                      Text prompt se ultra-HD AI photos aur artwork generation
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => togglePlugin('imagenGeneration')}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    pluginSettings.imagenGeneration ? 'bg-[#8ab4f8]' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`bg-[#131314] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      pluginSettings.imagenGeneration ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Voice Speech TTS Plugin */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#131314] border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Neural Voice Engine</div>
                    <div className="text-[11px] text-[#9aa0a6]">
                      Hinglish aur English mein real-time voice output aur audio playback
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => togglePlugin('voiceTts')}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    pluginSettings.voiceTts ? 'bg-[#8ab4f8]' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`bg-[#131314] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      pluginSettings.voiceTts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Deep Reasoning Plugin */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#131314] border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Turbo Neural Reasoning</div>
                    <div className="text-[11px] text-[#9aa0a6]">
                      Complex coding, logic aur mathematical questions par detailed explanation
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => togglePlugin('deepReasoning')}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    pluginSettings.deepReasoning ? 'bg-[#8ab4f8]' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`bg-[#131314] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      pluginSettings.deepReasoning ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-[#171819] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#131314] font-semibold text-xs rounded-xl transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
