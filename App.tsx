import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData, createWavFile } from './utils/audio-helpers';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jeetai' | 'power' | 'studio'>('jeetai');
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  
  const [powerPrompt, setPowerPrompt] = useState('');
  const [isGeneratingPower, setIsGeneratingPower] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [studioText, setStudioText] = useState('');
  const [isGeneratingStudio, setIsGeneratingStudio] = useState(false);
  
  const outAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const stopConversation = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(s => s.close()).catch(() => {});
        sessionPromiseRef.current = null;
    }
  }, []);

  const startConversation = async () => {
    try {
      const key = process.env.API_KEY;
      if (!key) {
        alert("Boss, API Key missing!");
        return;
      }

      setIsConnecting(true);
      if (!outAudioCtxRef.current) {
        outAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      await outAudioCtxRef.current.resume();

      const ai = new GoogleGenAI({ apiKey: key });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

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
              sessionPromise.then(s => s.sendRealtimeInput({ 
                media: createBlob(e.inputBuffer.getChannelData(0)) 
              }));
            };
            source.connect(proc); 
            proc.connect(inCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              const ctx = outAudioCtxRef.current!;
              setIsModelSpeaking(true);
              const buf = await decodeAudioData(decode(msg.serverContent.modelTurn.parts[0].inlineData.data), ctx, 24000, 1);
              const s = ctx.createBufferSource(); 
              s.buffer = buf; 
              s.connect(ctx.destination);
              s.onended = () => {
                  activeSourcesRef.current.delete(s);
                  if (activeSourcesRef.current.size === 0) setIsModelSpeaking(false);
              };
              const now = Math.max(nextStartTimeRef.current, ctx.currentTime);
              s.start(now); 
              nextStartTimeRef.current = now + buf.duration;
              activeSourcesRef.current.add(s);
            }
          },
          onerror: (e) => {
            console.error("Live Error:", e);
            stopConversation();
          },
          onclose: () => stopConversation(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "IDENTITY: Your name is 'Jeet AI'. Created by 'Jeet Boss'. Greet with: 'Hello mera naam Jeet hai main aapka kya help kar satha hu' when connected."
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (e) {
      setIsConnecting(false);
      console.error("Start Conversation Error:", e);
      alert("Please allow Microphone access Boss!");
    }
  };

  const generatePowerImage = async () => {
    const key = process.env.API_KEY;
    if (!powerPrompt || !key) return;
    setIsGeneratingPower(true);
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: powerPrompt + " cinematic masterpiece high quality" }] }
      });
      const part = res.candidates[0].content.parts.find(p => p.inlineData);
      if (part?.inlineData) {
          setGeneratedResult(`data:image/png;base64,${part.inlineData.data}`);
      }
    } catch (e) { 
      console.error(e);
      alert("Power vision failed Boss!"); 
    }
    finally { setIsGeneratingPower(false); }
  };

  const generateStudioVoice = async () => {
    const key = process.env.API_KEY;
    if (!studioText || !key) return;
    setIsGeneratingStudio(true);
    try {
      const ai = new GoogleGenAI({ apiKey: key });
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
        new Audio(url).play();
      }
    } catch (e) { 
      console.error(e);
      alert("Studio recording error!"); 
    }
    finally { setIsGeneratingStudio(false); }
  };

  return (
    <div className="h-full w-full bg-black text-white flex flex-col relative overflow-hidden">
      <div className="fixed inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,#4338ca_0%,transparent_70%)]" />

      <header className="relative z-50 pt-10 pb-4 px-6 bg-black/40 backdrop-blur-xl border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-lg shadow-[0_0_15px_rgba(79,70,229,0.5)]">⚡</div>
          <h1 className="text-lg font-black italic tracking-tighter uppercase leading-none">JEET <span className="text-indigo-400">AI</span></h1>
        </div>
        
        <nav className="flex bg-white/5 p-1 rounded-full border border-white/10 scale-90">
            {['jeetai', 'power', 'studio'].map(tab => (
                <button 
                  key={tab} 
                  onClick={() => { stopConversation(); setActiveTab(tab as any); }} 
                  className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-indigo-600' : 'text-white/40'}`}
                >
                    {tab === 'jeetai' ? 'AI' : tab}
                </button>
            ))}
        </nav>
      </header>

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-6 py-4">
        {activeTab === 'jeetai' && (
          <div className="w-full flex flex-col items-center">
            <div className="w-64 h-64 relative mb-12 flex items-center justify-center">
              <Visualizer isActive={isActive} isModelSpeaking={isModelSpeaking} mode="normal" />
              {isConnecting && <div className="absolute w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
            </div>
            <button 
              onClick={isActive ? stopConversation : startConversation} 
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl border-4 border-white/10 active:scale-90 ${isActive ? 'bg-red-600' : 'bg-indigo-600'}`}
            >
              <span className="text-3xl font-black">{isActive ? '✕' : '⚡'}</span>
            </button>
            <p className="mt-6 text-[9px] uppercase font-black tracking-[0.5em] text-white/20">
              {isActive ? 'Neural Link Active' : 'Click to Wake AI'}
            </p>
          </div>
        )}

        {activeTab === 'power' && (
          <div className="w-full max-w-sm flex flex-col gap-4">
            {generatedResult ? (
              <div className="relative animate-in fade-in duration-500">
                <img src={generatedResult} className="w-full aspect-square rounded-[2rem] object-cover border-4 border-white/5 shadow-2xl" />
                <button onClick={() => setGeneratedResult(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center font-bold">✕</button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <textarea 
                  value={powerPrompt} 
                  onChange={e => setPowerPrompt(e.target.value)} 
                  placeholder="Describe vision Boss..." 
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-[1.5rem] p-5 text-sm focus:outline-none placeholder:opacity-20 resize-none" 
                />
                <button 
                  onClick={generatePowerImage} 
                  disabled={isGeneratingPower || !powerPrompt} 
                  className="w-full py-4 bg-indigo-600 rounded-[1.5rem] font-black uppercase tracking-widest disabled:opacity-20 active:scale-95 transition-transform"
                >
                  {isGeneratingPower ? 'Building...' : 'Visualize ⚡'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="w-full max-w-sm flex flex-col gap-4">
            <textarea 
              value={studioText} 
              onChange={e => setStudioText(e.target.value)} 
              placeholder="Type voice text Boss..." 
              className="w-full h-40 bg-white/5 border border-white/10 rounded-[1.5rem] p-5 text-sm focus:outline-none placeholder:opacity-20 resize-none" 
            />
            <button 
              onClick={generateStudioVoice} 
              disabled={isGeneratingStudio || !studioText} 
              className="w-full py-4 bg-indigo-600 rounded-[1.5rem] font-black uppercase tracking-widest disabled:opacity-20 active:scale-95 transition-transform"
            >
              {isGeneratingStudio ? 'Processing...' : 'Generate Voice 🔊'}
            </button>
          </div>
        )}
      </main>

      <footer className="relative z-20 pb-8 pt-4 px-6 text-center opacity-20">
        <p className="text-[8px] font-black uppercase tracking-[0.4em]">Jeet AI Neural Interface v5.1</p>
      </footer>
    </div>
  );
};

export default App;