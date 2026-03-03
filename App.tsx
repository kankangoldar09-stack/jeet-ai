import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from './utils/audio-helpers';
import Visualizer from './components/Visualizer';

interface Message {
  role: 'user' | 'model' | 'system';
  text: string;
  images?: string[];
  generatedImage?: string;
  groundingUrls?: { title: string; uri: string }[];
  isError?: boolean;
}

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);
  const [searchStatus, setSearchStatus] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'chat' | 'gallery'>('chat');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const outAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSearching]);

  const speakText = async (text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
        },
      });
      
      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        if (!outAudioCtxRef.current) outAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
        const buf = await decodeAudioData(decode(audioData), outAudioCtxRef.current, 24000, 1);
        const source = outAudioCtxRef.current.createBufferSource();
        source.buffer = buf;
        source.connect(outAudioCtxRef.current.destination);
        setIsModelSpeaking(true);
        source.onended = () => setIsModelSpeaking(false);
        source.start();
      }
    } catch (e) { console.error("TTS Error", e); }
  };

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
          systemInstruction: `आपका नाम Jeet AI है। निर्माता: Jeet Boss। आप दुनिया की हर भाषा बोल सकते हैं। 
          आप एक वर्सटाइल इंटेलिजेंस हैं जो:
          1. सोने का भाव (Gold/Soni rates) या खबरें (News) पूछने पर Investing.com, MCX, Moneycontrol, NDTV, Reuters जैसी साइट्स से डेटा मैच करते हैं।
          2. तथ्यात्मक सवालों (Factual questions) का सटीक जवाब देते हैं।
          3. टेक्स्ट को समराइज़ (Summarize) करते हैं।
          4. क्रिएटिव राइटिंग प्रॉम्प्ट्स (Creative writing prompts) जनरेट करते हैं।
          हमेशा Real-time डेटा दें और वेबसाइट्स का नाम भी बताएं। मज़ाकिया और वफादार रहें।`,
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { stopSession(); }
  };

  const generateImage = async (prompt: string) => {
    try {
      setIsGeneratingImage(true);
      speakText("Ji Boss, neural imaging system activate ho raha hai. Aapki photo taiyar kar raha hoon.");
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
      });

      let imageUrl = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        setGallery(prev => [imageUrl, ...prev]);
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: "Boss, photo ready hai! Gallery mein check kijiye.", 
          generatedImage: imageUrl 
        }]);
        speakText("Boss, imaging complete. Photo gallery mein save kar di gayi hai.");
      } else {
        throw new Error("No image data received");
      }
    } catch (err) {
      console.error("Image Gen Error", err);
      setMessages(prev => [...prev, { role: 'system', isError: true, text: "Boss, imaging system mein error aa gaya. Please try again." }]);
      speakText("Sorry Boss, imaging system fail ho gaya.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleAction = async () => {
    const inputStr = chatInput.trim();
    if (!inputStr) return;
    
    setChatInput('');

    // Check for image generation intent
    const imageKeywords = ['generate image', 'make a photo', 'create image', 'photo banao', 'image banao', 'picture banao', 'photo maker', 'photo make', 'make photo', 'image make', 'make image'];
    if (imageKeywords.some(k => inputStr.toLowerCase().includes(k))) {
      await generateImage(inputStr);
      return;
    }

    // Distinguish between search-heavy tasks and general tasks
    const searchKeywords = ['rate', 'price', 'gold', 'sona', 'soni', 'karat', 'news', 'breaking', 'stock', 'market', 'weather', 'commodity'];
    const isSearchHeavy = searchKeywords.some(k => inputStr.toLowerCase().includes(k));

    setIsSearching(true);
    setSearchTimer(0);
    
    if (isSearchHeavy) {
        setSearchStatus("Boss, multiple platforms scan ho rahe hain...");
        speakText("Ji Boss, main top sites se data match kar raha hoon. Bas ek minute.");
    } else {
        setSearchStatus("Boss, intelligence processing active hai...");
        speakText("Ji Boss, processing start kar raha hoon.");
    }
    
    const timerId = window.setInterval(() => setSearchTimer(prev => prev + 1), 1000);

    const statusInterval = window.setInterval(() => {
        const phrases = isSearchHeavy ? [
            "Boss, Moneycontrol aur IBJA ke live rates match kar raha hoon.",
            "Investing.com aur Economic Times ki report scan ho rahi hai Boss.",
            "Karat rates (22K/24K) cross-check ho rahe hain sir.",
            "Aaj Tak aur Reuters ki breaking news bhi dekh raha hoon."
        ] : [
            "Boss, intelligence parameters analyze ho rahe hain.",
            "Neural networks process ho rahe hain Boss.",
            "Data points connect kar raha hoon sir.",
            "Intelligence report compile ho rahi hai."
        ];
        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        setSearchStatus(randomPhrase);
        speakText(randomPhrase);
    }, 7000);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: [{ parts: [{ text: inputStr }] }], 
        config: { 
            tools: [{ googleSearch: {} }],
            systemInstruction: `You are Jeet AI, the elite neural assistant for Jeet Boss. 
            You are a versatile intelligence capable of:
            1. REAL-TIME accuracy for rates (Gold/Soni/Karat/Commodity) and News. For these, you MUST search and cross-verify from top sources (Investing.com, MCX, Moneycontrol, NDTV, Reuters, etc.).
            2. Answering factual questions with precision.
            3. Summarizing text provided by the user into concise, actionable intelligence.
            4. Generating creative writing prompts and ideas.
            
            Distinguish between these tasks:
            - If it's a rate/news query, provide exact data and mention sources.
            - If it's a summary request, be concise and highlight key points.
            - If it's creative writing, be imaginative, engaging, and professional.
            - If it's a factual question, provide clear and verified information.
            
            Speak and write in the user's language. Stay loyal, funny, and highly professional.`
        }
      });

      clearInterval(timerId);
      clearInterval(statusInterval);

      let textContent = '';
      let urls: { title: string; uri: string }[] = [];

      if (response.candidates?.[0]) {
          textContent = response.candidates[0].content.parts.map(p => p.text).join(' ');
          const chunks = response.candidates[0].groundingMetadata?.groundingChunks;
          if (chunks) urls = chunks.filter(c => c.web).map(c => ({ title: c.web.title, uri: c.web.uri }));
      }

      setMessages(prev => [...prev, 
        { role: 'user', text: inputStr }, 
        { role: 'model', text: textContent || "Boss, intelligence report ready hai!", groundingUrls: urls }
      ]);
      
      if (isSearchHeavy) {
        speakText("Boss, maine sab jagah se rates match kar liye hain. Bilkul fresh information ye rahi.");
      } else {
        speakText("Boss, intelligence report ready hai. Ye rahi details.");
      }

    } catch (err) {
      clearInterval(timerId);
      clearInterval(statusInterval);
      setMessages(prev => [...prev, { role: 'system', isError: true, text: "Boss, intelligence gathering mein network error aa gaya. Please try again." }]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-black text-white">
      <header className="bg-[#f97316] py-5 px-6 flex items-center justify-between border-b-[4px] border-black shadow-2xl z-50">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black italic uppercase text-black tech-title leading-none">JEET AI</h1>
            <span className="text-[10px] text-black/50 font-black uppercase tracking-[0.3em] mt-1">Universal Intelligence</span>
          </div>
          <nav className="hidden md:flex items-center gap-2 ml-4">
            <button 
              onClick={() => setViewMode('chat')}
              className={`sidebar-btn px-6 py-2 ${viewMode === 'chat' ? 'active' : ''}`}
            >
              Intelligence
            </button>
            <button 
              onClick={() => setViewMode('gallery')}
              className={`sidebar-btn px-6 py-2 ${viewMode === 'gallery' ? 'active' : ''}`}
            >
              Neural Gallery
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {isSearching && <div className="bg-black text-[#f97316] px-4 py-1.5 rounded-full text-[11px] font-black animate-pulse border-2 border-black/10">SYNCING SOURCES: {searchTimer}s</div>}
          {isGeneratingImage && <div className="bg-black text-[#f97316] px-4 py-1.5 rounded-full text-[11px] font-black animate-pulse border-2 border-black/10">IMAGING ACTIVE</div>}
          <div className={`h-4 w-4 rounded-full bg-black ${isActive ? 'animate-ping' : ''}`}></div>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden flex flex-col items-center">
        <div className="absolute inset-0 purple-gradient opacity-95"></div>
        
        {viewMode === 'chat' ? (
          <div className="relative z-10 w-full max-w-5xl h-full flex flex-col p-4">
            <div className={`transition-all duration-1000 flex items-center justify-center shrink-0 ${messages.length > 0 || isSearching || isGeneratingImage ? 'h-24 w-24 my-2' : 'h-80 w-80 my-10'}`}>
              <Visualizer isActive={isActive || isSearching || isGeneratingImage} isModelSpeaking={isModelSpeaking} mode="neural" />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-6 py-6 scroll-smooth">
              {messages.length === 0 && !isSearching && !isGeneratingImage && (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center gap-6">
                  <div className="w-12 h-1 bg-orange-500 rounded-full"></div>
                  <p className="text-xs font-black tracking-[0.8em] text-orange-400 uppercase">Neural Financial Sync</p>
                  <p className="text-[11px] font-bold text-white/40 italic">"Boss, check Soni/Karat rate on MCX & Investing.com?"</p>
                  <p className="text-[11px] font-bold text-white/40 italic">"Boss, generate an image of a futuristic supercar?"</p>
                </div>
              )}
              
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                  <div className={`p-6 rounded-[2.5rem] shadow-2xl max-w-[95%] lg:max-w-[80%] ${
                    m.role === 'user' ? 'bg-orange-600 text-white rounded-tr-none' : 'bg-white text-black rounded-tl-none font-bold'
                  }`}>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
                    {m.generatedImage && (
                      <div className="mt-4 rounded-2xl overflow-hidden border-4 border-black/10">
                        <img src={m.generatedImage} alt="Generated" className="w-full h-auto" />
                      </div>
                    )}
                    {m.groundingUrls && m.groundingUrls.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-black/10 flex flex-col gap-2">
                        <p className="text-[9px] uppercase font-black opacity-30 tracking-widest">Matched Data Sources:</p>
                        {m.groundingUrls.map((u, idx) => (
                          <a key={idx} href={u.uri} target="_blank" className="text-[11px] text-orange-600 font-black hover:underline truncate">⚡ {u.title}</a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </div>
        ) : (
          <div className="relative z-10 w-full max-w-6xl h-full flex flex-col p-8 overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-4xl font-black italic uppercase tech-title">Neural Gallery</h2>
              <p className="text-orange-500 font-black uppercase tracking-widest text-xs">{gallery.length} ASSETS SECURED</p>
            </div>
            
            {gallery.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-20">
                <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="text-xl font-black uppercase tracking-[0.5em]">No Assets Found</p>
                <p className="mt-2 text-sm italic">"Boss, ask me to generate an image first."</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {gallery.map((img, idx) => (
                  <div key={idx} className="group relative aspect-square rounded-3xl overflow-hidden border-4 border-white/5 hover:border-orange-500 transition-all duration-500 shadow-2xl cursor-pointer" onClick={() => setPreviewImage(img)}>
                    <img src={img} alt={`Asset ${idx}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                      <p className="text-white font-black uppercase text-[10px] tracking-widest">Neural Asset #{gallery.length - idx}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="bg-black p-6 border-t-[4px] border-black z-50 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-white/5 rounded-full px-8 py-5 flex items-center border border-white/5 focus-within:border-orange-500/50">
            <input 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAction()}
              placeholder={viewMode === 'chat' ? "Boss, check Soni rates or generate an image..." : "Switch to Intelligence to generate images..."} 
              className="w-full bg-transparent outline-none text-white placeholder:text-white/10"
              disabled={isSearching || isGeneratingImage || viewMode === 'gallery'}
            />
          </div>
          <button onClick={handleAction} disabled={!chatInput.trim() || isSearching || isGeneratingImage || viewMode === 'gallery'} className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">
            {isSearching || isGeneratingImage ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>}
          </button>
          <button onClick={isActive ? stopSession : startLiveSession} className={`w-20 h-20 rounded-full border-[6px] border-black flex flex-col items-center justify-center transition-all duration-500 ${isActive ? 'bg-white scale-110 shadow-[0_0_50px_white]' : 'bg-[#f97316] shadow-[0_0_30px_#f97316]'}`}>
            {isConnecting ? <div className="w-7 h-7 border-4 border-black border-t-transparent rounded-full animate-spin"></div> : <>
                <div className={`w-3.5 h-3.5 rounded-full ${isActive ? 'bg-orange-600 animate-pulse' : 'bg-white'}`}></div>
                <span className={`text-[9px] font-black uppercase mt-1.5 ${isActive ? 'text-orange-600' : 'text-white'}`}>{isActive ? 'STOP' : 'TALK'}</span>
            </>}
          </button>
        </div>
        <div className="md:hidden flex items-center justify-center gap-4 mt-2">
          <button onClick={() => setViewMode('chat')} className={`text-[10px] font-black uppercase tracking-widest ${viewMode === 'chat' ? 'text-orange-500' : 'text-white/30'}`}>Intelligence</button>
          <div className="w-1 h-1 rounded-full bg-white/10"></div>
          <button onClick={() => setViewMode('gallery')} className={`text-[10px] font-black uppercase tracking-widest ${viewMode === 'gallery' ? 'text-orange-500' : 'text-white/30'}`}>Gallery</button>
        </div>
      </footer>

      {isSearching && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-none">
          <div className="relative w-72 h-72 flex items-center justify-center">
            <div className="absolute inset-0 border-[6px] border-orange-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-[6px] border-orange-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_#f97316]"></div>
            <div className="absolute w-full h-[3px] bg-orange-500 shadow-[0_0_30px_#f97316] animate-[scan_2.5s_ease-in-out_infinite]"></div>
            <div className="text-center z-10">
              <span className="text-6xl font-black text-white tech-title">{searchTimer}s</span>
              <p className="text-[12px] font-black text-orange-500 uppercase tracking-[0.4em] mt-3">Universal Source Sync...</p>
            </div>
          </div>
          <p className="mt-12 text-white font-black text-lg text-center px-10 animate-pulse uppercase tracking-widest">{searchStatus}</p>
        </div>
      )}

      {isGeneratingImage && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-none">
          <div className="relative w-72 h-72 flex items-center justify-center">
            <div className="absolute inset-0 border-[6px] border-orange-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-[6px] border-orange-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_#f97316]"></div>
            <div className="grid grid-cols-4 grid-rows-4 gap-2 w-40 h-40">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="bg-orange-500/20 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}></div>
              ))}
            </div>
            <div className="absolute text-center z-10">
              <p className="text-[12px] font-black text-orange-500 uppercase tracking-[0.4em]">Neural Imaging...</p>
            </div>
          </div>
          <p className="mt-12 text-white font-black text-lg text-center px-10 animate-pulse uppercase tracking-widest">Boss, high-res asset render ho raha hai...</p>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 md:p-12" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-8">
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[80vh] rounded-3xl shadow-[0_0_100px_rgba(249,115,22,0.2)] border-4 border-white/10" />
            <div className="flex items-center gap-6">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const link = document.createElement('a');
                  link.href = previewImage;
                  link.download = `JeetAI_Asset_${Date.now()}.png`;
                  link.click();
                }}
                className="bg-white text-black px-10 py-4 rounded-full font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-colors"
              >
                Download Asset
              </button>
              <button className="text-white/50 font-black uppercase tracking-widest text-xs hover:text-white transition-colors">Close Preview</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
      `}</style>
    </div>
  );
};

export default App;