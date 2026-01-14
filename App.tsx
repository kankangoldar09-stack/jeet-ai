import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { createBlob, decode, decodeAudioData } from './utils/audio-helpers';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'neural' | 'power' | 'log'>('neural');
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callerName, setCallerName] = useState('');
  
  const [powerPrompt, setPowerPrompt] = useState('');
  const [isGeneratingPower, setIsGeneratingPower] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ role: 'user' | 'ai', text: string }[]>([]);

  const outAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptionRef = useRef({ user: '', ai: '' });
  const visionIntervalRef = useRef<number | null>(null);

  const stopConversation = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    if (visionIntervalRef.current) {
      clearInterval(visionIntervalRef.current);
      visionIntervalRef.current = null;
    }
  }, []);

  const startConversation = async () => {
    try {
      const key = process.env.API_KEY;
      if (!key || key.trim() === "") {
        alert("Boss, API Key missing! Please check your environment variables.");
        return;
      }

      setIsConnecting(true);
      
      // Initialize Audio Context on User Interaction
      if (!outAudioCtxRef.current) {
        outAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      await outAudioCtxRef.current.resume();

      const ai = new GoogleGenAI({ apiKey: key });
      
      // Get User Media
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const camStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, frameRate: { ideal: 15 } } 
      }).catch((err) => {
        console.warn("Camera access denied or not available:", err);
        return null;
      });
      
      if (videoRef.current && camStream) {
        videoRef.current.srcObject = camStream;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            
            // Audio Input Processing
            const inCtx = new AudioContext({ sampleRate: 16000 });
            const source = inCtx.createMediaStreamSource(micStream);
            const proc = inCtx.createScriptProcessor(4096, 1, 1);
            proc.onaudioprocess = (e) => {
              if (sessionRef.current) {
                sessionRef.current.sendRealtimeInput({ 
                  media: createBlob(e.inputBuffer.getChannelData(0)) 
                });
              }
            };
            source.connect(proc);
            proc.connect(inCtx.destination);

            // Vision Input Processing (Frames)
            if (camStream) {
              visionIntervalRef.current = window.setInterval(() => {
                if (!sessionRef.current || !videoRef.current || !canvasRef.current) return;
                const ctx = canvasRef.current.getContext('2d');
                if (!ctx) return;
                
                // Draw frame to hidden canvas
                ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                
                sessionRef.current.sendRealtimeInput({ 
                  media: { data: base64, mimeType: 'image/jpeg' } 
                });
              }, 800);
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Tool Calls Handling
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'make_call') {
                  const name = (fc.args as any).contact_name || "Unknown";
                  setCallerName(name);
                  setIsCalling(true);
                  sessionRef.current?.sendToolResponse({ 
                    functionResponses: [{ id: fc.id, name: fc.name, response: { status: "Initiating elite connection..." } }]
                  });
                }
              }
            }

            // Transcriptions
            if (msg.serverContent?.inputTranscription) {
              transcriptionRef.current.user += msg.serverContent.inputTranscription.text;
            }
            if (msg.serverContent?.outputTranscription) {
              transcriptionRef.current.ai += msg.serverContent.outputTranscription.text;
            }

            // Audio Response Processing
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const ctx = outAudioCtxRef.current!;
              setIsModelSpeaking(true);
              const buf = await decodeAudioData(decode(audioData), ctx, 24000, 1);
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

            // Log Completion
            if (msg.serverContent?.turnComplete) {
              if (transcriptionRef.current.user || transcriptionRef.current.ai) {
                setLogs(prev => [
                  ...prev, 
                  { role: 'user', text: transcriptionRef.current.user || "(Audio input)" },
                  { role: 'ai', text: transcriptionRef.current.ai || "(Thinking...)" }
                ]);
                transcriptionRef.current = { user: '', ai: '' };
              }
            }
          },
          onerror: (e) => { 
            console.error("Neural Link Error:", e); 
            stopConversation(); 
          },
          onclose: () => { 
            console.log("Neural Link Terminated");
            stopConversation(); 
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{
            functionDeclarations: [{
              name: 'make_call',
              description: 'Initiates a phone call to a contact.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  contact_name: { type: Type.STRING },
                  phone_number: { type: Type.STRING }
                },
                required: ['contact_name']
              }
            }]
          }],
          systemInstruction: "IDENTITY: Your name is 'Jeet AI'. Created by 'Jeet Boss'. Language: Hinglish. PERSONALITY: Sharp, elite assistant. Always call user 'Boss'. PROTOCOL: If Boss says 'Papa se baat karao', respond politely: 'Hello Jeet ke papa, Namaste! Aapke dono ladke bahut acche hain aur sanskari bhi hain.' VISION: You can see via camera frames. Use make_call tool when requested."
        }
      });
      
      sessionRef.current = await sessionPromise;
    } catch (e) {
      console.error("Initialization Failed:", e);
      setIsConnecting(false);
      alert("Neural initialization failed. Please ensure mic and camera permissions are granted.");
    }
  };

  const generateImage = async () => {
    if (!powerPrompt) return;
    setIsGeneratingPower(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `${powerPrompt}. Ultra-realistic, 8k cinematic lighting, masterwork.` }] }
      });
      const part = res.candidates[0].content.parts.find(p => p.inlineData);
      if (part?.inlineData) setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
    } catch (e) {
      console.error("Image Generation Error:", e);
      alert("Nano Banana module encountered an error.");
    } finally {
      setIsGeneratingPower(false);
    }
  };

  return (
    <div className="h-full w-full bg-black text-white flex flex-col relative overflow-hidden fade-in">
      <div className="fixed inset-0 neural-glow pointer-events-none opacity-50" />

      {/* CALLING UI OVERLAY */}
      {isCalling && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center">
           <div className="relative mb-12">
             <div className="w-48 h-48 bg-indigo-600 rounded-full flex items-center justify-center text-7xl font-black animate-pulse shadow-[0_0_80px_rgba(99,102,241,0.5)]">
               {callerName.charAt(0)}
             </div>
             <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-[pulse-ring_3s_infinite]" />
           </div>
           <h2 className="text-4xl font-black italic uppercase mb-2 tracking-tighter">CALLING...</h2>
           <p className="text-xl text-white/50 mb-20">{callerName}</p>
           <button 
             onClick={() => setIsCalling(false)} 
             className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl"
           >
             <span className="text-3xl font-bold">✕</span>
           </button>
        </div>
      )}

      {/* HEADER */}
      <header className="relative z-50 py-6 px-8 border-b border-white/5 flex justify-between items-center backdrop-blur-md">
        <h1 className="text-2xl font-black italic tracking-tighter uppercase">JEET <span className="text-indigo-500">AI</span></h1>
        
        <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
            {['neural', 'power', 'log'].map(tab => (
                <button 
                  key={tab} 
                  onClick={() => { if(tab !== 'log' && isActive) stopConversation(); setActiveTab(tab as any); }} 
                  className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white/70'}`}
                >
                    {tab === 'neural' ? 'Neural' : tab === 'power' ? 'Nano Banana' : 'History'}
                </button>
            ))}
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 relative z-10 p-6 flex flex-col items-center justify-center overflow-hidden">
        
        {activeTab === 'neural' && (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 flex items-center justify-center opacity-25 pointer-events-none">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-110 blur-sm" />
            </div>
            
            <div className="relative z-20 w-80 h-80">
              <Visualizer isActive={isActive} isModelSpeaking={isModelSpeaking} mode="normal" />
            </div>

            <div className="mt-12 text-center relative z-30">
               {isConnecting ? (
                 <div className="space-y-4">
                   <p className="text-indigo-400 font-black animate-pulse tracking-[0.3em] text-xs">ESTABLISHING NEURAL LINK...</p>
                   <div className="w-48 h-1 bg-white/10 mx-auto rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 animate-[loading_1.5s_infinite]" style={{width: '30%'}} />
                   </div>
                 </div>
               ) : isActive ? (
                 <button onClick={stopConversation} className="px-12 py-4 bg-white text-black font-black uppercase rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all">TERMINATE LINK</button>
               ) : (
                 <button onClick={startConversation} className="px-12 py-4 bg-indigo-600 font-black uppercase rounded-full shadow-[0_0_50px_rgba(99,102,241,0.5)] hover:scale-105 active:scale-95 transition-all">INITIALIZE NEURAL LINK</button>
               )}
            </div>
            <canvas ref={canvasRef} width={320} height={240} className="hidden" />
          </div>
        )}

        {activeTab === 'power' && (
          <div className="w-full max-w-2xl flex flex-col gap-8 h-full overflow-y-auto custom-scrollbar pt-10">
            <div className="text-center">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Nano Banana <span className="text-indigo-500 text-sm">v2.5</span></h2>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Premium Image Synthesis Engine</p>
            </div>

            <div className="relative group">
               <input 
                 type="text" 
                 value={powerPrompt}
                 onChange={e => setPowerPrompt(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && generateImage()}
                 placeholder="Describe your vision, Boss..."
                 className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-lg font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-white/20"
               />
               <button 
                 onClick={generateImage}
                 disabled={isGeneratingPower || !powerPrompt}
                 className="absolute right-3 top-3 bottom-3 px-6 bg-indigo-600 rounded-xl font-black uppercase text-xs disabled:opacity-30 disabled:cursor-not-allowed"
               >
                 {isGeneratingPower ? 'SYNTHESIZING...' : 'GENERATE'}
               </button>
            </div>

            {generatedImage ? (
              <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-white/5 animate-in zoom-in duration-700">
                <img src={generatedImage} alt="Generated" className="w-full h-auto" />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/5 rounded-3xl opacity-20 italic">
                Awaiting your prompt...
              </div>
            )}
          </div>
        )}

        {activeTab === 'log' && (
          <div className="w-full max-w-3xl h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar px-2 py-10">
             {logs.length === 0 ? (
               <div className="h-full flex items-center justify-center opacity-20 italic">No neural activity logs found.</div>
             ) : (
               logs.map((log, i) => (
                 <div key={i} className={`flex flex-col gap-1 ${log.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-4`}>
                   <span className="text-[9px] font-black uppercase opacity-30 tracking-widest">{log.role === 'user' ? 'Boss' : 'Jeet AI'}</span>
                   <div className={`px-5 py-3 rounded-2xl max-w-[85%] text-sm ${log.role === 'user' ? 'bg-indigo-600 text-indigo-100 rounded-tr-none border border-indigo-400/30 shadow-lg' : 'bg-white/5 text-white/80 rounded-tl-none border border-white/10 backdrop-blur-xl'}`}>
                     {log.text}
                   </div>
                 </div>
               ))
             )}
          </div>
        )}

      </main>

      <footer className="relative z-50 py-4 px-8 border-t border-white/5 bg-black text-[9px] font-bold text-white/20 uppercase tracking-[0.5em] text-center">
        &copy; 2025 Jeet Private Cloud &bull; Neural Node 0x7F &bull; {isActive ? "CONNECTED" : "IDLE"}
      </footer>
      
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
};

export default App;