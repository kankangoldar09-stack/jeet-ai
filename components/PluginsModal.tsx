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
    const keyToTest = apiKeyInput.trim();
    if (!keyToTest) {
      setTestingStatus('error');
      setStatusMessage('कृपया वैध Google AI Studio API Key दर्ज करें।');
      return;
    }

    setTestingStatus('testing');
    setStatusMessage('Google AI Studio से कनेक्शन जाँचा जा रहा है...');

    try {
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [{ parts: [{ text: 'Respond with only "OK"' }] }],
      });

      if (response.text) {
        setTestingStatus('success');
        setStatusMessage('API Key सफलतापूर्वक सत्यापित हो गई! Quota सक्रिय है।');
        onSaveApiKey(keyToTest);
      } else {
        throw new Error('No response received');
      }
    } catch (err: any) {
      setTestingStatus('error');
      const errText = err?.message || '';
      if (errText.includes('403') || errText.includes('API_KEY_INVALID')) {
        setStatusMessage('गलत API Key! कृपया AI Studio से सही key कॉपी करें।');
      } else if (errText.includes('429') || errText.includes('RESOURCE_EXHAUSTED')) {
        setStatusMessage('इस API Key का कोटा समाप्त हो चुका है। नई key बनाएँ।');
      } else {
        setStatusMessage(`कनेक्शन त्रुटि: ${errText.slice(0, 100)}`);
      }
    }
  };

  const handleSave = () => {
    const cleaned = apiKeyInput.trim();
    onSaveApiKey(cleaned);
    setTestingStatus('success');
    setStatusMessage(cleaned ? 'API Key सुरक्षित रूप से सेव हो गई!' : 'डिफ़ॉल्ट Key पर रीसेट किया गया।');
  };

  const handleRemoveKey = () => {
    setApiKeyInput('');
    onSaveApiKey('');
    setTestingStatus('idle');
    setStatusMessage('कस्टम API Key हटा दी गई है। डिफ़ॉल्ट Key का उपयोग होगा।');
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8ab4f8]/20 to-[#c58af9]/20 border border-[#8ab4f8]/30 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-[#8ab4f8]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                AI Studio Plugins & API Key
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8ab4f8]/10 text-[#8ab4f8] border border-[#8ab4f8]/20">
                  Jeet Neural
                </span>
              </h2>
              <p className="text-xs text-[#9aa0a6]">
                Google AI Studio API Key जोड़ें और उन्नत AI प्लगइन्स कस्टमाइज़ करें
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
                <KeyRound className="w-4 h-4 text-[#8ab4f8]" />
                <label className="text-sm font-semibold text-white">
                  Google AI Studio API Key
                </label>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#8ab4f8] hover:underline flex items-center gap-1 font-medium"
              >
                <span>Free Key लें</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-[#9aa0a6] leading-relaxed">
              अपनी निजी Google AI Studio API Key डालने से आपको <b>Zero Rate-Limits</b> और तेज़ रिस्पॉन्स मिलता है।
            </p>

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
                className="w-full bg-[#1e1f20] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#8ab4f8] pr-20 font-mono"
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
                className="px-4 py-2 bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#131314] font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {testingStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>जाँच रहे हैं...</span>
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
                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white font-medium text-xs rounded-xl border border-white/10 transition-all"
              >
                Save
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
                      लाइव मार्केट भाव (सोना, चांदी, शेयर), मौसम और ताज़ा खबरें
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
                      प्रॉम्प्ट से हाई-क्वालिटी AI फोटो और आर्टवर्क निर्माण
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
                      हिंदी व अंग्रेज़ी में रीयल-टाइम आवाज़ आउटपुट और वॉइस प्लेबैक
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
                      कठिन कोडिंग और गणितीय सवालों पर विस्तृत तर्क
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
