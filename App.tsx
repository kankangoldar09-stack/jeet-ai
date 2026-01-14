import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { createBlob, decode, decodeAudioData, createWavFile } from './utils/audio-helpers';
import Visualizer from './components/Visualizer';

const BOSS_PASSWORD = "JEET8474947203";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jeetai' | 'power' | 'studio'>('jeetai');
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  
  // Power Mode States
  const [powerPrompt, setPowerPrompt] = useState('');
  const [isGeneratingPower, setIsGeneratingPower] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);

  // Studio Mode States
  const [studioText, setStudioText] = useState('');
  const [isGeneratingStudio, setIsGeneratingStudio] = useState(false);
  const [studioAudioUrl, setStudioAudioUrl] = useState<string | null>(null);

  // Verification & Mode
  const [isBossVerified, setIsBossVerified] = useState(false);
  const [isGfMode, setIsGfMode] = useState(false);

  // Refs for Audio & Session
  const outAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const applyWatermark = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          
          const padding = canvas.width * 0.05;
          const fontSize = canvas.width * 0.15;
          ctx.font = `italic 900 ${fontSize}px Inter, sans-serif`;
          
          const gradient = ctx.createLinearGradient(
            canvas.width - padding - fontSize, 
            canvas.height - padding - fontSize, 
            canvas.width - padding, 
            canvas.height - padding
          );
          gradient.addColorStop(0, '#6366f1');
          gradient.addColorStop(1, '#ffffff');
          
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 20;
          ctx.fillStyle = gradient;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText('J', canvas.width - padding, canvas.height - padding);
          resolve(canvas.toDataURL('image/png'));
      };
      img.src = base64;
    });
  };

  const stopConversation = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    if (frameIntervalRef.current) window.clearInterval(frameIntervalRef.current);
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(s => s.close());
        sessionPromiseRef.current = null;
    }
  }, []);

  const startConversation = async () => {
    try {
      setIsConnecting(true);
      if (!outAudioCtxRef.current) outAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await outAudioCtxRef.current.resume();

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const systemInstruction = `
        IDENTITY: Your name is 'Jeet AI'. Creator/Owner is 'Jeet Boss'.
        GREETING: As soon as you connect, immediately say: "Hello mera naam Jeet hai main aapka kya help kar satha hu".
        PERSONALITY: Respectful, high energy, witty. Use "Ji" and "Aap" for everyone. 
        VERIFICATION: Password for Jeet Boss is '${BOSS_PASSWORD}'.
        TOOLS: You can open YouTube, show boss photo, and get location.
      `;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const inCtx = new AudioContext({ sampleRate: 16000 });
            const source = inCtx.createMediaStreamSource(micStream);
            const proc = inCtx.createScriptProcessor(4096, 1, 1);
            proc.onaudioprocess = (e) => {
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) }));
            };
            source.connect(proc); proc.connect(inCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
                for (const fc of msg.toolCall.functionCalls) {
                    let res: any = "Done";
                    if (fc.name === 'open_youtube') {
                        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(fc.args.query as string || '')}`, '_blank');
                    } else if (fc.name === 'show_boss_photo') {
                        window.open('https://ffjeetgamer1234.blogspot.com/2025/11/jeet.html', '_blank');
                    }
                    sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: res } } }));
                }
            }
            if (msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              const ctx = outAudioCtxRef.current!;
              setIsModelSpeaking(true);
              const buf = await decodeAudioData(decode(msg.serverContent.modelTurn.parts[0].inlineData.data), ctx, 24000, 1);
              const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination);
              s.onended = () => {
                  activeSourcesRef.current.delete(s);
                  if (activeSourcesRef.current.size === 0) setIsModelSpeaking(false);
              };
              const now = Math.max(nextStartTimeRef.current, ctx.currentTime);
              s.start(now); nextStartTimeRef.current = now + buf.duration;
              activeSourcesRef.current.add(s);
            }
          },
          onerror: stopConversation,
          onclose: stopConversation,
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          tools: [
              { googleSearch: {} },
              { functionDeclarations: [
                  { name: 'open_youtube', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } } } },
                  { name: 'show_boss_photo', parameters: { type: Type.OBJECT, properties: {} } }
              ]}
          ]
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (e) {
      setIsConnecting(false);
      alert("Microphone access needed Boss!");
    }
  };

  const generatePowerImage = async () => {
    if (!powerPrompt) return;
    setIsGeneratingPower(true);
    setGeneratedResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: powerPrompt + " high quality cinematic style" }] }
      });
      const part = res.candidates[0].content.parts.find(p => p.inlineData);
      if (part?.inlineData) {
          const watermarked = await applyWatermark(`data:image/png;base64,${part.inlineData.data}`);
          setGeneratedResult(watermarked);
      }
    } catch (e) { alert("Power error Boss!"); }
    finally { setIsGeneratingPower(false); }
  };

  const generateStudioVoice = async () => {
    if (!studioText) return;
    setIsGeneratingStudio(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: studioText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });
      const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (data) {
        const url = URL.createObjectURL(createWavFile(decode(data), 24000));
        setStudioAudioUrl(url);
        new Audio(url).play();
      }
    } catch (e) { alert("Studio error Boss!"); }
    finally { setIsGeneratingStudio(false); }
  };

  return (
    <div className="h-[100dvh] w-full bg-black text-white flex flex-col relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#4338ca_0%,transparent_70%)]"></div>
      </div>

      <header className="relative z-50 pt-12 pb-6 px-6 bg-black/40 backdrop-blur-xl border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-xl shadow-[0_0_20px_rgba(79,70,229,0.5)]">⚡</div>
          <div>
            <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">JEET <span className="text-indigo-400">AI</span></h1>
            <p className="text-[8px] font-bold opacity-30 uppercase tracking-[0.3em] mt-1">Neural Interface v5.0</p>
          </div>
        </div>
        
        <nav className="flex bg-white/5 p-1 rounded-full border border-white/10 scale-90 origin-right">
            {['jeetai', 'power', 'studio'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => { stopConversation(); setActiveTab(tab as any); }}
                  className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40'}`}
                >
                    {tab === 'jeetai' ? 'AI Chat' : tab.toUpperCase()}
                </button>
            ))}
        </nav>
      </header>

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center overflow-y-auto custom-scrollbar px-6 py-8">
        {activeTab === 'jeetai' && (
          <div className="w-full flex flex-col items-center animate-in">
            <div className="w-64 h-64 relative mb-16">
              <Visualizer isActive={isActive} isModelSpeaking={isModelSpeaking} mode={isGfMode ? 'happy' : 'normal'} />
              {isConnecting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-full z-50">
                      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
              )}
            </div>

            <button 
              onClick={isActive ? stopConversation : startConversation}
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-2xl border-4 border-white/10 active:scale-95 ${isActive ? 'bg-red-600' : 'bg-indigo-600'}`}
            >
              <span className="text-4xl font-black">{isActive ? '✕' : '⚡'}</span>
            </button>
            
            <p className="mt-8 text-[10px] uppercase font-black tracking-[0.5em] text-white/20">
              {isActive ? (isModelSpeaking ? 'AI Speaking...' : 'Listening Boss...') : 'Click Bolt to Link'}
            </p>
          </div>
        )}

        {activeTab === 'power' && (
          <div className="w-full max-w-sm flex flex-col gap-6 animate-in">
            {generatedResult ? (
              <div className="relative group animate-in">
                <img src={generatedResult} className="w-full aspect-square rounded-[2.5rem] object-cover border-4 border-white/5 shadow-2xl" />
                <button onClick={() => setGeneratedResult(null)} className="absolute -top-3 -right-3 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center font-bold">✕</button>
                <a href={generatedResult} download="jeet_power.png" className="absolute bottom-6 left-1/2 -translate-x-1/2 px-8 py-3 bg-indigo-600 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl">Download Ji</a>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <textarea 
                  value={powerPrompt}
                  onChange={e => setPowerPrompt(e.target.value)}
                  placeholder="Describe your vision Boss..."
                  className="w-full h-40 bg-white/5 border border-white/10 rounded-[2rem] p-6 text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:opacity-20 resize-none"
                />
                <button 
                  onClick={generatePowerImage}
                  disabled={isGeneratingPower || !powerPrompt}
                  className="w-full py-5 bg-indigo-600 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-20 shadow-2xl"
                >
                  {isGeneratingPower ? 'Building Vision...' : 'Generate Power ⚡'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="w-full max-w-sm flex flex-col gap-6 animate-in">
            <textarea 
              value={studioText}
              onChange={e => setStudioText(e.target.value)}
              placeholder="What should I say for you?"
              className="w-full h-48 bg-white/5 border border-white/10 rounded-[2rem] p-6 text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:opacity-20 resize-none"
            />
            <button 
              onClick={generateStudioVoice}
              disabled={isGeneratingStudio || !studioText}
              className="w-full py-5 bg-indigo-600 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-20 shadow-2xl"
            >
              {isGeneratingStudio ? 'Recording...' : 'Record Studio Voice 🔊'}
            </button>
            {studioAudioUrl && (
              <div className="bg-white/5 p-4 rounded-3xl border border-white/10 animate-in">
                <audio controls src={studioAudioUrl} className="w-full h-8 opacity-60" />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="relative z-20 pb-12 pt-6 px-6 text-center opacity-30">
        <p className="text-[9px] font-black uppercase tracking-[0.5em]">Jeet Boss • Neural Encryption Active</p>
      </footer>
    </div>
  );
};

export default App;