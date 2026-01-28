import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from './utils/audio-helpers';
import Visualizer from './components/Visualizer';

interface SelectedFile {
  data: string;
  mimeType: string;
  url: string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  images?: string[];
  generatedImage?: string;
}

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const outAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stopSession = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    if (sessionRef.current) { try { sessionRef.current.close(); } catch(e){} sessionRef.current = null; }
    activeSourcesRef.current.forEach(s => s.stop());
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const startLiveSession = async () => {
    try {
      setIsConnecting(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      outAudioCtxRef.current = outAudioCtxRef.current || new AudioContext({ sampleRate: 24000 });
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const inCtx = new AudioContext({ sampleRate: 16000 });
            const source = inCtx.createMediaStreamSource(mic);
            const proc = inCtx.createScriptProcessor(4096, 1, 1);
            proc.onaudioprocess = (e) => {
              if (sessionRef.current) sessionRef.current.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
            };
            source.connect(proc); proc.connect(inCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const buf = await decodeAudioData(decode(audioData), outAudioCtxRef.current!, 24000, 1);
              const s = outAudioCtxRef.current!.createBufferSource();
              s.buffer = buf; s.connect(outAudioCtxRef.current!.destination);
              setIsModelSpeaking(true);
              s.onended = () => {
                activeSourcesRef.current.delete(s);
                if (activeSourcesRef.current.size === 0) setIsModelSpeaking(false);
              };
              const now = Math.max(nextStartTimeRef.current, outAudioCtxRef.current!.currentTime);
              s.start(now);
              nextStartTimeRef.current = now + buf.duration;
              activeSourcesRef.current.add(s);
            }
          },
          onclose: () => stopSession(),
          onerror: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
          systemInstruction: "आपका नाम Jeet AI है। आप एक मजेदार और वफादार सहायक हैं। Fenrir आवाज का उपयोग करें। Hinglish में बात करें। आप हर तरह की मदद कर सकते हैं, जैसे फोटो देखना, जानकारी ढूँढना या बस गप्पे मारना।",
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { stopSession(); }
  };

  const handleAction = async () => {
    if (!chatInput.trim() && selectedFiles.length === 0) return;
    setIsGenerating(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Check if user wants to generate an image
    const imageKeywords = ['banao', 'make', 'create', 'generate', 'photo', 'image', 'picture', 'chitra', 'drawing', 'art', 'dikhao', 'paint'];
    const isImageRequest = imageKeywords.some(key => chatInput.toLowerCase().includes(key));
    const shouldUseImageModel = selectedFiles.length > 0 || isImageRequest;

    try {
      const model = shouldUseImageModel ? 'gemini-2.5-flash-image' : 'gemini-3-flash-preview';
      const contents: any[] = [];
      
      selectedFiles.forEach(file => {
        contents.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
      });
      
      contents.push({ text: chatInput || (shouldUseImageModel ? "Create an epic full-screen high-quality visual masterpiece." : "Hello") });

      const config: any = shouldUseImageModel 
        ? { imageConfig: { aspectRatio: "1:1" } } 
        : { tools: [{ googleSearch: {} }] };

      const res = await ai.models.generateContent({ 
        model, 
        contents: { parts: contents }, 
        config 
      });

      let text = '';
      let generatedImg = '';
      if (res.candidates?.[0]?.content?.parts) {
        for (const p of res.candidates[0].content.parts) {
          if (p.text) text += p.text;
          if (p.inlineData) generatedImg = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
        }
      }

      setMessages(prev => [...prev, 
        { 
          role: 'user', 
          text: chatInput, 
          images: selectedFiles.map(f => f.url) 
        }, 
        { 
          role: 'model', 
          text: text || (generatedImg ? "Boss, ye rahi aapki full visual output!" : "Neural processing complete!"),
          generatedImage: generatedImg || undefined
        }
      ]);
      
      setChatInput('');
      setSelectedFiles([]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: "Neural synthesis fail ho gaya. Kripya phir se koshish karein." }]);
    } finally { setIsGenerating(false); }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedFiles(prev => [...prev, {
            data: (reader.result as string).split(',')[1],
            mimeType: file.type,
            url: URL.createObjectURL(file)
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
    // RESET: Crucial fix for repeating file selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].url);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const downloadImage = (base64Data: string) => {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = `JeetAI-Neural-Art-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-black selection:bg-indigo-500 selection:text-white">
      {/* HEADER */}
      <header className="bg-[#f97316] py-4 flex items-center justify-center border-b-[4px] border-black shadow-2xl relative z-50">
        <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-black rounded-full animate-ping"></div>
            <h1 className="text-3xl font-black italic uppercase text-black tech-title">JEET AI</h1>
            <div className="w-2 h-2 bg-black rounded-full animate-ping"></div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="absolute inset-0 purple-gradient z-0 opacity-95"></div>

        {/* MAIN CHAT AREA */}
        <div className="flex-1 relative z-10 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden max-w-5xl mx-auto w-full">
            <div className={`transition-all duration-700 relative ${messages.length > 0 ? 'h-16 w-16 mb-4' : 'w-72 h-72 mb-10'}`}>
              <Visualizer isActive={isActive} isModelSpeaking={isModelSpeaking} mode="neural" />
            </div>
            
            <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col gap-8 px-2 pb-10">
               {messages.length === 0 && !isActive && (
                 <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-10">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="text-[12px] uppercase font-black tracking-[0.8em] tech-title text-indigo-400">Neural Synthesis Active</p>
                    <p className="text-[10px] mt-4 font-bold uppercase tracking-widest leading-relaxed text-white/50">Boss, bina photo ke bhi 'banao' likh kar generate karein.<br/>Select photos up to 10 for magic transformation.</p>
                 </div>
               )}
               {messages.map((m, i) => (
                 <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                   <div className={`chat-msg p-5 rounded-[2rem] text-[15px] leading-relaxed w-full max-w-[95%] ${m.role === 'user' ? 'bg-indigo-600/90 text-white rounded-tr-none border border-white/10' : 'bg-white/95 text-black rounded-tl-none font-medium shadow-2xl'}`}>
                     {m.images && m.images.length > 0 && (
                       <div className="flex flex-wrap gap-2 mb-4">
                         {m.images.map((img, idx) => (
                           <img 
                            key={idx} 
                            src={img} 
                            onClick={() => setPreviewImage(img)}
                            className="w-20 h-20 object-cover rounded-2xl border-2 border-white/20 cursor-zoom-in hover:scale-105 transition-all shadow-lg" 
                           />
                         ))}
                       </div>
                     )}
                     {m.text && <p className="mb-3 whitespace-pre-wrap">{m.text}</p>}
                     {m.generatedImage && (
                       <div className="mt-4 relative group">
                         <div className="overflow-hidden rounded-3xl border-2 border-black/10 shadow-2xl">
                             <img 
                                src={m.generatedImage} 
                                onClick={() => setPreviewImage(m.generatedImage!)}
                                className="w-full aspect-square object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-700 brightness-110" 
                             />
                         </div>
                         <div className="absolute top-4 right-4 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => downloadImage(m.generatedImage!)}
                                className="bg-black/80 backdrop-blur-xl hover:bg-black text-white p-4 rounded-full shadow-2xl transition-all active:scale-90"
                                title="Download Full Resolution"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                         </div>
                         <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                            <span className="bg-indigo-600/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.3em] text-white shadow-xl">Jeet AI Masterpiece</span>
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
               ))}
               <div ref={scrollRef} />
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER CONTROLS */}
      <footer className="bg-black px-6 py-8 flex flex-col gap-6 border-t-[4px] border-black z-50">
        {selectedFiles.length > 0 && (
          <div className="flex flex-col gap-3 bg-indigo-900/10 p-4 rounded-[2.5rem] border border-white/5 animate-in zoom-in-95">
            <div className="flex items-center justify-between px-3">
               <span className="text-[11px] text-indigo-400 uppercase font-black tracking-[0.3em]">{selectedFiles.length} / 10 Materials Loaded</span>
               <button onClick={() => setSelectedFiles([])} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[9px] font-black uppercase px-3 py-1 rounded-full border border-red-500/20 transition-all">Clear All</button>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar py-1 px-1">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="relative flex-shrink-0 group">
                  <img src={file.url} className="w-20 h-20 object-cover rounded-2xl border-2 border-white/10 group-hover:border-indigo-500 transition-all shadow-xl" />
                  <button 
                    onClick={() => removeFile(idx)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shadow-2xl border-2 border-black"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-white/[0.03] rounded-full px-8 py-5 flex items-center border border-white/5 shadow-2xl focus-within:border-indigo-500/50 focus-within:bg-white/[0.05] transition-all">
            <input 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAction()}
              placeholder={selectedFiles.length > 0 ? "Describe the transformation..." : "E.g. 'Ek sher ki photo banao'..."} 
              className="w-full bg-transparent outline-none text-white text-base font-medium placeholder:text-white/20"
            />
          </div>
          
          <div className="flex items-center gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className={`w-14 h-14 flex items-center justify-center rounded-full transition-all border-2 ${selectedFiles.length > 0 ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)]' : 'bg-white/5 border-white/5 text-white/40 hover:text-white'}`}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={onFileChange} accept="image/*" multiple />

              <button 
                onClick={handleAction}
                disabled={!chatInput.trim() && selectedFiles.length === 0}
                className="w-14 h-14 bg-blue-600 hover:bg-blue-500 disabled:opacity-5 disabled:grayscale rounded-full flex items-center justify-center text-white transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] active:scale-90"
              >
                <svg className="w-6 h-6 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
              </button>

              <button 
                onClick={isActive ? stopSession : startLiveSession}
                className={`w-16 h-16 rounded-full border-[4px] border-black transition-all flex items-center justify-center shadow-2xl ${isActive ? 'bg-white scale-110 shadow-[0_0_40px_white]' : 'bg-red-600 hover:bg-red-500 active:scale-95 shadow-[0_0_30px_rgba(220,38,38,0.4)]'}`}
              >
                {isConnecting ? (
                  <div className="w-7 h-7 border-[3px] border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <div className={`w-6 h-6 rounded-full ${isActive ? 'bg-red-600' : 'border-2 border-white'}`}></div>
                )}
              </button>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300"
          onClick={() => setPreviewImage(null)}
        >
          <div className="absolute top-10 right-10 flex gap-6">
             <button 
                onClick={(e) => { e.stopPropagation(); downloadImage(previewImage); }} 
                className="text-white bg-indigo-600 p-5 rounded-full shadow-[0_0_50px_rgba(79,70,229,0.5)] hover:scale-110 active:scale-90 transition-all border-2 border-indigo-400"
             >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
             </button>
             <button onClick={() => setPreviewImage(null)} className="text-white bg-white/5 p-5 rounded-full shadow-2xl hover:bg-white/10 border border-white/10 transition-all">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
          <img 
            src={previewImage} 
            className="max-w-full max-h-[90vh] object-contain rounded-3xl shadow-[0_0_150px_rgba(99,102,241,0.25)] border border-white/10"
            onClick={(e) => e.stopPropagation()} 
          />
          <p className="mt-12 text-[12px] font-black uppercase tracking-[1.5em] text-white/30 tech-title animate-pulse">Neural View Engine</p>
        </div>
      )}

      {isGenerating && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-2xl z-[100] flex flex-col items-center justify-center gap-10 animate-in fade-in duration-500">
          <div className="relative w-36 h-36">
            <div className="absolute inset-0 border-[6px] border-indigo-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-[6px] border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-8 border-[6px] border-white/5 border-b-transparent rounded-full animate-spin-slow"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_50px_#6366f1]"></div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="text-xl font-black uppercase tracking-[1em] text-white tech-title">Neural Synthesis</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-indigo-500/80">Boss, please wait... high-res image logic active...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;