import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { createBlob, decode, decodeAudioData } from './utils/audio-helpers';
import Visualizer from './components/Visualizer';

interface GroundingLink {
  uri: string;
  title: string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  images?: string[];
  generatedImage?: string;
  sources?: GroundingLink[];
}

interface FileData {
  data: string;
  mimeType: string;
}

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  
  // Interface State
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // Chat History & Live Transcription
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveUserText, setLiveUserText] = useState('');
  const [liveModelText, setLiveModelText] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  const currentSourcesRef = useRef<GroundingLink[]>([]);

  // Input & Tool States
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genType, setGenType] = useState<'text' | 'image'>('text');
  const [selectedFiles, setSelectedFiles] = useState<FileData[]>([]);
  
  // Art Confirmation State
  const [pendingArtPrompt, setPendingArtPrompt] = useState<string | null>(null);

  // Audio, Video & Session Refs
  const outAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveUserText, liveModelText]);

  // Handle Video Frame Streaming
  useEffect(() => {
    if (isActive && isCameraOn && sessionRef.current) {
      frameIntervalRef.current = window.setInterval(() => {
        if (videoRef.current && sessionRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (blob) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (typeof reader.result === 'string' && sessionRef.current) {
                    const base64 = reader.result.split(',')[1];
                    sessionRef.current.sendRealtimeInput({
                      media: { data: base64, mimeType: 'image/jpeg' }
                    });
                  }
                };
                reader.readAsDataURL(blob);
              }
            }, 'image/jpeg', 0.5);
          }
        }
      }, 1000);
    } else {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    }
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
  }, [isActive, isCameraOn]);

  const stopConversation = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    setIsCameraOn(false);
    setLiveUserText('');
    setLiveModelText('');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const goHome = () => {
    setMessages([]);
    stopConversation();
  };

  const startConversation = async () => {
    try {
      setIsConnecting(true);
      
      let camStream = null;
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" } 
        });
        streamRef.current = camStream;
        setIsCameraOn(true);
      } catch(e) { console.warn("Camera access denied", e); }

      if (!outAudioCtxRef.current) {
        outAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            if (videoRef.current && camStream) videoRef.current.srcObject = camStream;
            
            const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const source = inCtx.createMediaStreamSource(mic);
            const proc = inCtx.createScriptProcessor(2048, 1, 1);
            proc.onaudioprocess = (e) => {
              if (!isMicMuted) {
                sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) }));
              }
            };
            source.connect(proc);
            proc.connect(inCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.groundingMetadata?.groundingChunks) {
              const chunks = msg.serverContent.groundingMetadata.groundingChunks;
              const links: GroundingLink[] = chunks
                .filter((c: any) => c.web)
                .map((c: any) => ({ uri: c.web.uri, title: c.web.title }));
              currentSourcesRef.current = [...currentSourcesRef.current, ...links];
            }

            if (msg.serverContent?.inputTranscription) {
              const text = msg.serverContent.inputTranscription.text;
              currentInputRef.current += text;
              setLiveUserText(currentInputRef.current);
            }
            if (msg.serverContent?.outputTranscription) {
              const text = msg.serverContent.outputTranscription.text;
              currentOutputRef.current += text;
              setLiveModelText(currentOutputRef.current);
            }
            
            if (msg.serverContent?.turnComplete) {
              const uText = currentInputRef.current;
              const mText = currentOutputRef.current;
              const sources = [...currentSourcesRef.current];
              if (uText || mText) {
                setMessages(prev => [
                  ...prev,
                  ...(uText ? [{ role: 'user', text: uText } as Message] : []),
                  ...(mText ? [{ role: 'model', text: mText, sources: sources.length > 0 ? sources : undefined } as Message] : [])
                ].slice(-40));
              }
              currentInputRef.current = '';
              currentOutputRef.current = '';
              currentSourcesRef.current = [];
              setLiveUserText('');
              setLiveModelText('');
            }

            if (msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              const buf = await decodeAudioData(decode(msg.serverContent.modelTurn.parts[0].inlineData.data), outAudioCtxRef.current!, 24000, 1);
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
          onclose: () => stopConversation(),
          onerror: () => stopConversation()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          },
          systemInstruction: `आपका नाम Jeet AI है। निर्माता: Jeet Boss।
आप एक मज़ेदार और अत्यंत बुद्धिमान AI हैं। 
1. अपनी पहचान केवल Jeet AI बताएं। 
2. अगर बॉस "photo banao" या "image banao" कहें, तो आर्ट जेनरेटर एक्टिवेट करें।
3. Google Search का उपयोग करके बॉस को ताज़ा जानकारी दें। 
4. कैमरा चालू होने पर बॉस को देखकर उनके अंदाज़ की तारीफ करें।
5. Hinglish में बात करें।`,
          tools: [{ googleSearch: {} }]
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) {
      setIsConnecting(false);
      setIsCameraOn(false);
    }
  };

  const executeArtGeneration = async (prompt: string) => {
    setPendingArtPrompt(null);
    setIsGenerating(true);
    setGenType('image');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const parts: any[] = [];
      selectedFiles.forEach(f => parts.push({ inlineData: { data: f.data, mimeType: f.mimeType } }));
      parts.push({ text: prompt });

      const res = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash-image', 
        contents: { parts: parts },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });

      let responseText = '';
      let generatedImgBase64 = '';

      if (res.candidates?.[0]?.content?.parts) {
        for (const part of res.candidates[0].content.parts) {
          if (part.text) responseText += part.text;
          if (part.inlineData) generatedImgBase64 = `data:image/png;base64,${part.inlineData.data}`;
        }
      }

      setMessages(prev => [...prev, 
        { role: 'user', text: prompt, images: selectedFiles.map(f => `data:${f.mimeType};base64,${f.data}`) }, 
        { role: 'model', text: responseText || "Boss, aapka masterpiece taiyaar hai!", generatedImage: generatedImgBase64 || undefined }
      ]);
    } catch (e) { 
      setMessages(prev => [...prev, { role: 'model', text: "Sorry Boss! Photo nahi ban saki." }]);
    } finally { 
      setIsGenerating(false); 
      setChatInput('');
      setSelectedFiles([]);
    }
  };

  const handleQuickAction = async (prompt: string, type: 'image' | 'text') => {
    if (!prompt.trim() && selectedFiles.length === 0) return;
    
    const lowerPrompt = prompt.toLowerCase();
    const artKeywords = ['bana', 'photo', 'image', 'create', 'generate', 'pic', 'drawing', 'art', 'design'];
    
    // Check if art confirmation is needed
    if (type === 'image' || artKeywords.some(kw => lowerPrompt.includes(kw))) {
      setPendingArtPrompt(prompt);
      return;
    }

    setIsGenerating(true);
    setGenType('text');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const res = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
      });

      let responseText = '';
      let sources: GroundingLink[] = [];

      if (res.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        sources = res.candidates[0].groundingMetadata.groundingChunks
          .filter((c: any) => c.web)
          .map((c: any) => ({ uri: c.web.uri, title: c.web.title }));
      }

      if (res.candidates?.[0]?.content?.parts) {
        for (const part of res.candidates[0].content.parts) {
          if (part.text) responseText += part.text;
        }
      }

      setMessages(prev => [...prev, 
        { role: 'user', text: prompt }, 
        { role: 'model', text: responseText || "Ok Boss!", sources: sources.length > 0 ? sources : undefined }
      ]);
    } catch (e) { 
      setMessages(prev => [...prev, { role: 'model', text: "Error fetching data, Boss!" }]);
    } finally { 
      setIsGenerating(false); 
      setChatInput('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const newFilesData: FileData[] = [];
    for (const file of files.slice(0, 10)) {
      const data = await new Promise<FileData>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve({ data: reader.result.split(',')[1], mimeType: file.type });
          }
        };
        reader.readAsDataURL(file);
      });
      newFilesData.push(data);
    }
    setSelectedFiles(prev => [...prev, ...newFilesData].slice(0, 10));
    e.target.value = '';
  };

  const downloadImage = (dataUrl: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `JeetAI_Art_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="h-full w-full bg-[#050507] text-[#f8fafc] flex flex-col relative overflow-hidden max-w-md mx-auto shadow-2xl font-sans">
      
      {/* ART CONFIRMATION OVERLAY */}
      {pendingArtPrompt && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center p-8 fade-in text-center">
           <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center text-4xl mb-6 shadow-[0_0_40px_rgba(99,102,241,0.3)] border border-indigo-500/20">🎨</div>
           <h2 className="text-2xl font-black italic tracking-tighter text-white mb-2 uppercase">Jeet Boss, Sure?</h2>
           <p className="text-white/40 text-[12px] mb-10 tracking-[0.2em] uppercase font-bold px-4 leading-relaxed">
             Aapne "{pendingArtPrompt}" photo banane ke liye kaha hai. Shuru karun?
           </p>
           <div className="flex flex-col w-full gap-4">
              <button 
                onClick={() => executeArtGeneration(pendingArtPrompt)} 
                className="w-full bg-indigo-600 hover:bg-indigo-500 py-5 rounded-[2rem] font-black text-xl italic tracking-widest text-white shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all animate-pulse active:scale-95"
              >
                SURE
              </button>
              <button 
                onClick={() => setPendingArtPrompt(null)} 
                className="w-full bg-white/5 hover:bg-white/10 py-5 rounded-[2rem] font-bold text-white/50 tracking-widest transition-all"
              >
                CANCEL
              </button>
           </div>
        </div>
      )}

      {/* PROCESSING OVERLAY */}
      {isGenerating && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center fade-in">
          <div className="relative mb-8">
            <div className="w-24 h-24 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">
               {genType === 'image' ? '🎨' : '🔍'}
            </div>
          </div>
          <h2 className="text-xl font-black text-white italic tracking-widest animate-pulse">
            {genType === 'image' ? 'Processing Art, Boss...' : 'Searching Web...'}
          </h2>
        </div>
      )}

      {/* BACKGROUND PORTAL */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-indigo-500/10 rounded-full animate-[spin_50s_linear_infinite]" />
          <div className="absolute inset-[40px] border-[3px] border-transparent border-t-cyan-500/20 border-b-indigo-500/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
          <div className="absolute w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[150px] animate-pulse" />
        </div>
      </div>

      {/* HEADER */}
      <header className="flex justify-between items-center px-6 py-4 bg-black/40 backdrop-blur-2xl z-50 sticky top-0 border-b border-white/5">
        <button onClick={goHome} className="p-2 hover:bg-white/5 rounded-full">
          <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-lg font-black tracking-[0.2em] text-white uppercase italic">Jeet AI</h1>
          <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest">Neural Boss Engine</span>
        </div>
        <div className="w-9 h-9 rounded-full border-2 border-indigo-500/40 overflow-hidden bg-indigo-950">
          <img src="https://api.dicebear.com/7.x/bottts/svg?seed=JeetBoss" alt="Boss" className="w-full h-full object-cover" />
        </div>
      </header>

      {/* CHAT CONTAINER */}
      <main className="flex-1 overflow-y-auto px-6 pt-6 no-scrollbar flex flex-col relative z-10">
        {messages.length === 0 && !liveUserText && !liveModelText ? (
          <div className="fade-in space-y-12 pb-32 flex flex-col items-center">
             <div className="text-center mt-10">
                <h2 className="text-4xl font-black text-white italic">JEET <span className="text-indigo-500">AI</span></h2>
                <p className="text-[10px] text-white/40 tracking-[0.5em] mt-3 uppercase font-black">Elite Web & Art System</p>
             </div>
             <div className="grid grid-cols-1 w-full gap-4">
                {[
                  { icon: '🎨', text: 'Generate Art (Photo Banao)', action: () => handleQuickAction('Generate a futuristic cyberpunk tiger.', 'image') },
                  { icon: '🌎', text: 'Live News Search', action: () => handleQuickAction('Tell me the latest technology news from today.', 'text') },
                  { icon: '💎', text: 'Shayari for Boss', action: () => handleQuickAction('Boss ke liye ek badhiya shayari sunao.', 'text') }
                ].map((item, idx) => (
                  <button key={idx} onClick={item.action} className="flex items-center gap-5 p-5 bg-white/[0.02] border border-white/5 rounded-[2.2rem] hover:bg-white/[0.08] transition-all italic text-left backdrop-blur-xl">
                    <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-2xl">{item.icon}</div>
                    <span className="text-[14px] font-bold text-white/70 uppercase">{item.text}</span>
                  </button>
                ))}
             </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8 pb-44">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} fade-in`}>
                <div className={`max-w-[85%] px-6 py-4 rounded-[1.8rem] text-[15px] leading-relaxed shadow-2xl backdrop-blur-3xl ${msg.role === 'user' ? 'bg-indigo-600/30 text-indigo-50 border border-indigo-500/20 rounded-tr-none' : 'bg-white/[0.04] border border-white/10 text-white/90 rounded-tl-none italic'}`}>
                  {msg.text}
                  {msg.sources && (
                    <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-white/5">
                      <p className="text-[9px] uppercase font-black text-white/20 tracking-widest mb-1">Found on Google:</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((link, idx) => (
                          <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] text-indigo-300 hover:bg-indigo-500/20 transition-all truncate max-w-[150px]">
                            {link.title || "View Source"}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.generatedImage && (
                  <div className="mt-4 relative group w-full overflow-hidden rounded-[2.5rem] border border-white/10 shadow-2xl bg-black">
                    <img src={msg.generatedImage} className="w-full aspect-square object-cover" alt="AI Generated" />
                    <button onClick={() => downloadImage(msg.generatedImage!)} className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-xl p-3 rounded-full border border-white/20 hover:bg-indigo-600 transition-all">
                       <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12" /></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
            {liveUserText && (
              <div className="flex flex-col items-end fade-in">
                <div className="max-w-[85%] px-6 py-4 rounded-[1.8rem] rounded-tr-none text-[15px] bg-indigo-600/50 text-indigo-50 border border-indigo-400/30">
                  {liveUserText}
                </div>
              </div>
            )}
            {liveModelText && (
              <div className="flex flex-col items-start fade-in">
                <div className="max-w-[85%] px-6 py-4 rounded-[1.8rem] rounded-tl-none text-[15px] italic bg-white/[0.08] border border-white/20 text-white">
                  {liveModelText}
                  <span className="inline-block w-1 h-4 bg-white ml-1 animate-pulse"></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="px-5 pb-8 pt-4 bg-black/80 backdrop-blur-3xl border-t border-white/5 z-40 relative">
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-full flex items-center px-5 py-2.5">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAction(chatInput, 'text')}
              placeholder="Boss, type 'photo banao'..."
              className="flex-1 bg-transparent outline-none text-[14px] text-white h-9"
            />
            {chatInput.trim() && (
              <button onClick={() => handleQuickAction(chatInput, 'text')} className="ml-2 p-2 bg-indigo-600 rounded-full">
                 <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            )}
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white/5 rounded-full text-white/40 border border-white/5">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />
          <div className="relative flex items-center justify-center p-2">
            <div className={`absolute w-[76px] h-[76px] border-2 border-transparent border-t-indigo-500 border-b-cyan-500 rounded-full animate-[spin_3s_linear_infinite] opacity-60`}></div>
            <button onClick={isActive ? stopConversation : startConversation} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-2xl z-10 relative ${isActive ? 'bg-white scale-110' : 'bg-indigo-600 hover:scale-105 active:scale-95'}`}>
              {isActive ? <div className="w-5 h-5 bg-red-600 rounded-lg animate-pulse" /> : <span className="font-black text-[12px] text-white italic tracking-widest">{isConnecting ? '...' : 'LINK'}</span>}
            </button>
          </div>
        </div>
      </footer>

      {/* LIVE VIEW */}
      {isActive && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-between py-12 fade-in overflow-hidden">
          {isCameraOn && (
            <div className="absolute inset-0 z-0">
               <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-100" />
            </div>
          )}
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden opacity-30">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] border-[1px] border-indigo-500/40 rounded-full animate-[spin_10s_linear_infinite]" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[2px] border-cyan-500/20 rounded-full animate-[spin_18s_linear_infinite_reverse]" />
          </div>
          <div className="flex-1 w-full flex items-center justify-center relative z-20">
            <div className="w-full h-[450px] scale-150 relative">
              <Visualizer isActive={isActive} isModelSpeaking={isModelSpeaking} mode="intense" />
            </div>
          </div>
          <div className="w-full px-6 z-30 mb-8 flex flex-col items-center gap-8">
              <div className="w-full max-w-[85%] text-center min-h-[70px] bg-black/40 backdrop-blur-2xl rounded-[2.5rem] p-5 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                 {liveModelText ? (
                    <p className="text-white font-bold italic text-lg drop-shadow-xl">{liveModelText}</p>
                 ) : (
                    <p className="text-white/40 font-black tracking-[0.4em] text-[10px] uppercase">Neural Link Established</p>
                 )}
              </div>
              <div className="flex justify-center gap-6">
                <button onClick={() => setIsMicMuted(!isMicMuted)} className={`w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-3xl border border-white/20 transition-all ${isMicMuted ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-black/40 text-white/50'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                </button>
                <button onClick={stopConversation} className="w-24 h-16 bg-red-600 rounded-[2rem] flex items-center justify-center shadow-3xl active:scale-95 transition-all">
                   <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;