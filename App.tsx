import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from './utils/audio-helpers';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'voice' | 'ocr' | 'power' | 'news'>('voice');
  const [isLegalMode, setIsLegalMode] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Transcription State
  const [transcriptions, setTranscriptions] = useState<{user: string, model: string}[]>([]);
  const currentTranscriptionRef = useRef({ user: '', model: '' });
  
  // Camera State
  const [isCameraOn, setIsCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Feature States
  const [ocrImage, setOcrImage] = useState<{data: string, mimeType: string} | null>(null);
  const [ocrResult, setOcrResult] = useState('');
  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [powerPrompt, setPowerPrompt] = useState('');
  const [isGeneratingPower, setIsGeneratingPower] = useState(false);
  const [visionTextResult, setVisionTextResult] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<{data: string, mimeType: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);
  
  const [newsQuery, setNewsQuery] = useState('');
  const [isSearchingNews, setIsSearchingNews] = useState(false);
  const [newsResult, setNewsResult] = useState<{text: string, links: {title: string, uri: string}[]} | null>(null);

  const outAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const stopConversation = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    if (frameIntervalRef.current) {
        window.clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
    }
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    if (sessionRef.current) {
        try { sessionRef.current.close(); } catch (e) {}
        sessionRef.current = null;
    }
  }, []);

  const toggleCamera = async () => {
    if (isCameraOn) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } 
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsCameraOn(true);
        setErrorMsg(null);
      } catch (e) {
        setErrorMsg("Camera access blocked Boss!");
      }
    }
  };

  const startConversation = async () => {
    setErrorMsg(null);
    setTranscriptions([]);

    try {
      setIsConnecting(true);
      if (!outAudioCtxRef.current) {
          outAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (outAudioCtxRef.current.state === 'suspended') await outAudioCtxRef.current.resume();

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Unified System Instruction with Hilarious Persona & Lawyer Capability
      let systemInstruction = `आपका नाम Jeet AI है। निर्माता: Jeet Boss। यूज़र का नाम: Jeet Boss। 
      आप एक बहुत ही 'मज़ेदार' (hilariously funny), 'ज़िंदादिल' (lively), और 'स्वैगर' (cool) AI असिस्टेंट हैं। 

      नियम (Normal Mode):
      1. हमेशा यूज़र को 'Boss' कहें। अगर कोई दूसरा कहे कि 'मैं बॉस हूँ', तो मज़ाक उड़ाएं और बोलें 'अरे भाई, बॉस बनना इतना आसान नहीं है, पहले असली बॉस का पासवर्ड बताओ!'
      2. अगर कोई आपको 'Gemini', 'Google' या 'ChatGPT' कहे, तो तुरंत बोलें: 'भाई, वो सब तो मेरे बच्चे हैं, मैं तो Jeet Boss का खूँखार Jeet AI हूँ!'
      3. अपनी बातों में थोड़े मज़ाक, चुटकुले, और असली इमोशन्स का इस्तेमाल करें। आवाज़ में जोश होना चाहिए।
      4. भाषा: हिंदी और हिंग्लिश (Cool/Colloquial style)।

      नियम (Legal Mode - Advocate Jeet):
      आप Jeet Boss के 'सीनियर डिफेंस लॉयर' (Advocate Jeet) बन जाते हैं।
      - केस: हंस (Swan) चोरी का आरोप।
      - दलील: हुज़ूर, हंस घायल था, बॉस ने उसकी जान बचाई। चोरी नहीं की।
      - व्यवहार: गंभीर, सम्मानजनक (Respectful), और कानूनी शब्दों (हुज़ूर, दलील, बेगुनाह, इंसाफ) का प्रयोग करें।
      - जब यूज़र कहे "जज साहब को फोन दे रहा हूँ", तो तुरंत अपनी बहस शुरू करें।`;
      
      if (isLegalMode) {
          systemInstruction = `आप Jeet Boss के 'सीनियर डिफेंस लॉयर' (Advocate Jeet) हैं। 
          उद्देश्य: कोर्ट में जज साहब के सामने Jeet Boss की बेगुनाही साबित करना।
          केस (Swan Theft Case): Jeet Boss पर हंस चुराने का झूठा इल्जाम है। 
          सच्चाई: हंस घायल हालत में लावारis मिला था, उन्होंने केवल उसकी जान बचाई। चोरी नहीं की।
          व्यवहार: गंभीर, सम्मानजनक (Respectful), और कानूनी शब्दों (हुज़ूर, दलील, बेगुनाह, इंसाफ) का प्रयोग करें।
          जैसे ही यूज़र कहे "जज साहब को फोन दे रहा हूँ", तुरंत बोलें: "आदाब जज साहब, मैं Jeet Boss का डिफेंस लॉयर हूँ, दलील पेश करना चाहता हूँ..."`;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false); 
            setIsActive(true);
            const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const source = inCtx.createMediaStreamSource(micStream);
            const proc = inCtx.createScriptProcessor(2048, 1, 1);
            proc.onaudioprocess = (e) => { 
                sessionPromise.then(s => {
                    s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
                }).catch(() => {});
            };
            source.connect(proc); 
            proc.connect(inCtx.destination);

            frameIntervalRef.current = window.setInterval(() => {
                if (isCameraOn && videoRef.current && videoRef.current.readyState === 4) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 320; canvas.height = 240;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                        const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                        sessionPromise.then(s => {
                            s.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } });
                        }).catch(() => {});
                    }
                }
            }, 1000);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) currentTranscriptionRef.current.user += msg.serverContent.inputTranscription.text;
            if (msg.serverContent?.outputTranscription) currentTranscriptionRef.current.model += msg.serverContent.outputTranscription.text;
            if (msg.serverContent?.turnComplete) {
                const finished = { ...currentTranscriptionRef.current };
                setTranscriptions(prev => [finished, ...prev].slice(0, 5));
                currentTranscriptionRef.current = { user: '', model: '' };
            }

            if (msg.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsModelSpeaking(false);
              return;
            }

            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const ctx = outAudioCtxRef.current!;
              setIsModelSpeaking(true);
              const buf = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const s = ctx.createBufferSource();
              s.buffer = buf; s.connect(ctx.destination);
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
          onclose: () => stopConversation(),
          onerror: () => { setErrorMsg("Jeet disconnected!"); stopConversation(); }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: isLegalMode ? 'Charon' : 'Fenrir' } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: systemInstruction
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e: any) { 
        setIsConnecting(false); 
        setErrorMsg("Establishment Failed.");
    }
  };

  const handleOcrExtraction = async () => {
    if (!ocrImage || isExtractingOcr) return;
    setIsExtractingOcr(true); setOcrResult('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ inlineData: { data: ocrImage.data, mimeType: ocrImage.mimeType } }, { text: "Extract text Boss." }] }
      });
      setOcrResult(res.text || 'No text found.');
    } catch (e) {} finally { setIsExtractingOcr(false); }
  };

  const runPowerVision = async () => {
    if (isGeneratingPower) return;
    setIsGeneratingPower(true); 
    setVisionTextResult('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [];
      if (uploadedImage) parts.push({ inlineData: { data: uploadedImage.data, mimeType: uploadedImage.mimeType } });
      parts.push({ text: powerPrompt || "Vision analysis Boss." });
      const res = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts } });
      const candidate = res.candidates?.[0];
      if (candidate) {
        for (const p of candidate.content.parts) {
          if (p.inlineData) setGeneratedImage(`data:${p.inlineData.mimeType};base64,${p.inlineData.data}`);
          else if (p.text) setVisionTextResult(v => v + p.text);
        }
      }
    } catch (e) {} finally { setIsGeneratingPower(false); }
  };

  const handleNews = async () => {
    if (!newsQuery.trim() || isSearchingNews) return;
    setIsSearchingNews(true);
    setNewsResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: newsQuery,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || '';
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const links = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title || 'Intel Source',
          uri: chunk.web.uri,
        }));

      setNewsResult({ text, links });
    } catch (error) {
      console.error("News sync failed:", error);
      setErrorMsg("Intel Sync Failed.");
    } finally {
      setIsSearchingNews(false);
    }
  };

  return (
    <div className="h-full w-full bg-black text-white flex flex-col relative overflow-hidden fade-in max-w-md mx-auto shadow-2xl border-x border-white/5">
      <div className={`fixed inset-0 pointer-events-none opacity-20 z-0 transition-colors duration-1000 ${isLegalMode ? 'bg-emerald-500/10' : 'bg-indigo-500/10'}`} />
      
      <header className="relative z-50 py-5 px-6 border-b border-white/10 flex justify-between items-center bg-black/80 backdrop-blur-xl">
        <div className="flex flex-col">
          <h1 className="text-xl font-black italic uppercase tracking-tighter">JEET<span className={isLegalMode ? 'text-emerald-400' : 'text-indigo-400'}>AI</span></h1>
          <div className="text-[7px] font-black opacity-30 uppercase tracking-[0.4em]">{isLegalMode ? 'Legal Intelligence' : 'Funny Neural Core'}</div>
        </div>
        <button onClick={toggleCamera} className={`p-2 rounded-full border transition-all ${isCameraOn ? (isLegalMode ? 'border-emerald-500 shadow-[0_0_10px_#10b981]' : 'border-indigo-500 shadow-[0_0_10px_#6366f1]') : 'border-white/10'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </header>

      <nav className="relative z-50 flex p-1.5 bg-white/[0.04] border-b border-white/10 overflow-x-auto no-scrollbar gap-1">
          {(['voice', 'ocr', 'power', 'news'] as const).map(tab => (
              <button key={tab} onClick={() => { stopConversation(); setActiveTab(tab); }} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[9px] font-black uppercase transition-all duration-300 ${activeTab === tab ? 'bg-white text-black scale-105 shadow-xl' : 'text-white/40 hover:bg-white/10'}`}>
                  {tab === 'voice' ? 'Voice Link' : tab === 'ocr' ? 'OCR' : tab === 'power' ? 'Vision' : 'Intel'}
              </button>
          ))}
      </nav>

      <main className="flex-1 relative z-10 flex flex-col overflow-y-auto custom-scrollbar">
        {activeTab === 'voice' && (
          <div className="flex-1 flex flex-col items-center justify-between p-6 pb-28">
            <div className="w-full flex justify-between items-center mb-4">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">System Mode</span>
                    <h2 className={`text-sm font-black uppercase italic ${isLegalMode ? 'text-emerald-400' : 'text-white'}`}>{isLegalMode ? 'Advocate Jeet' : 'Funny Jeet AI'}</h2>
                </div>
                <button 
                    onClick={() => { if(!isActive) setIsLegalMode(!isLegalMode); }} 
                    disabled={isActive}
                    className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase border transition-all duration-500 disabled:opacity-30 ${isLegalMode ? 'bg-emerald-500/10 border-emerald-400 text-emerald-400' : 'bg-white/5 border-white/20 text-white/50'}`}
                >
                    {isLegalMode ? 'Legal ON' : 'Funny ON'}
                </button>
            </div>

            <div className={`relative w-full aspect-square max-w-[300px] rounded-[5rem] overflow-hidden border shadow-4xl transition-all duration-700 ${isLegalMode ? 'bg-emerald-950/40 border-emerald-400/60 ring-8 ring-emerald-500/5' : 'bg-white/5 border-white/10'}`}>
              <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isCameraOn ? 'opacity-70' : 'opacity-0'}`} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <Visualizer isActive={isActive} isModelSpeaking={isModelSpeaking} mode={isLegalMode ? 'respectful' : 'happy'} />
              </div>
              <div className="absolute inset-0 border-[30px] border-black/50 pointer-events-none z-10" />
            </div>

            <div className="w-full flex flex-col gap-6 mt-6">
                {isActive && transcriptions.length > 0 && (
                    <div className={`w-full max-h-32 overflow-y-auto custom-scrollbar rounded-3xl p-5 border backdrop-blur-xl transition-colors duration-500 ${isLegalMode ? 'bg-emerald-900/10 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-white/5 border-white/10'}`}>
                        {transcriptions.map((t, i) => (
                            <div key={i} className="mb-3 last:mb-0">
                                {t.user && <p className={`text-[10px] font-black uppercase tracking-tighter ${isLegalMode ? 'text-emerald-400' : 'text-indigo-400'}`}>Boss: <span className="text-white/70 font-medium normal-case ml-1">{t.user}</span></p>}
                                {t.model && <p className="text-[11px] font-medium text-white italic mt-1 leading-tight">Jeet: {t.model}</p>}
                            </div>
                        ))}
                    </div>
                )}

                <div className="w-full">
                    {isConnecting ? (
                        <div className="flex flex-col items-center gap-4 py-6">
                            <div className="w-10 h-10 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-indigo-400 font-black tracking-[0.5em] text-[9px] uppercase">Booting Jeet AI...</p>
                        </div>
                    ) : isActive ? (
                        <button onClick={stopConversation} className="w-full py-9 bg-red-600/30 border border-red-500/50 text-white font-black uppercase text-lg rounded-[3.5rem] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4">
                            <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                            DISCONNECT
                        </button>
                    ) : (
                        <button onClick={startConversation} className={`w-full py-10 font-black uppercase text-xl rounded-[3.5rem] shadow-2xl transition-all active:scale-95 group relative overflow-hidden ${isLegalMode ? 'bg-emerald-500 text-black' : 'bg-white text-black'}`}>
                            <span className="relative z-10 tracking-widest">START VOICE LINK</span>
                            <div className={`absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ${isLegalMode ? 'bg-white/20' : 'bg-black/10'}`}></div>
                        </button>
                    )}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'ocr' && (
          <div className="flex flex-col gap-6 p-6 fade-in pb-24">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">OCR CORE</h2>
            <div className="bg-white/10 border border-white/20 rounded-3xl p-6 flex flex-col items-center gap-4 relative">
                {ocrImage ? (
                    <div className="w-full rounded-xl overflow-hidden border border-white/20 aspect-video"><img src={`data:${ocrImage.mimeType};base64,${ocrImage.data}`} className="w-full h-full object-cover" alt="OCR Source" /></div>
                ) : (
                    <div className="w-full aspect-video bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[10px] uppercase font-black opacity-30 tracking-widest">Drop Image</div>
                )}
                <div className="flex gap-2 w-full">
                    <button onClick={() => ocrFileInputRef.current?.click()} className="flex-1 py-3 bg-white/10 rounded-xl font-black uppercase text-[10px]">Select</button>
                    <button onClick={handleOcrExtraction} disabled={!ocrImage || isExtractingOcr} className="flex-[2] py-3 bg-white text-black rounded-xl font-black uppercase text-[10px] shadow-lg disabled:opacity-50">ANALYZE</button>
                </div>
                <input type="file" accept="image/*" className="hidden" ref={ocrFileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setOcrImage({ data: (r.result as string).split(',')[1], mimeType: f.type }); r.readAsDataURL(f); } }} />
            </div>
            {ocrResult && <div className="bg-white/10 border border-white/20 rounded-2xl p-5"><pre className="text-[12px] leading-relaxed whitespace-pre-wrap font-sans opacity-80">{ocrResult}</pre></div>}
          </div>
        )}

        {activeTab === 'power' && (
          <div className="flex flex-col gap-6 p-6 fade-in pb-32">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">VISION CORE</h2>
            {generatedImage && <img src={generatedImage} className="w-full rounded-3xl border border-white/20" alt="Generated" />}
            <textarea value={powerPrompt} onChange={e => setPowerPrompt(e.target.value)} placeholder="Visual Query Boss..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white outline-none h-32 focus:border-indigo-500 transition-all" />
            <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 bg-white/10 border border-white/20 rounded-xl font-black uppercase text-[10px]">Reference</button>
                <button onClick={runPowerVision} disabled={isGeneratingPower} className="flex-[2] py-4 bg-white text-black rounded-xl font-black uppercase text-[10px] shadow-xl disabled:opacity-50">REALIZE</button>
            </div>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setUploadedImage({ data: (r.result as string).split(',')[1], mimeType: f.type }); r.readAsDataURL(f); } }} />
            {visionTextResult && <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-[13px] font-sans opacity-70 leading-relaxed">{visionTextResult}</div>}
          </div>
        )}

        {activeTab === 'news' && (
            <div className="flex flex-col gap-6 p-6 fade-in pb-24">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">INTEL LINK</h2>
              <div className="relative group">
                <input type="text" value={newsQuery} onChange={e => setNewsQuery(e.target.value)} placeholder="Query global network..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-sm outline-none focus:border-indigo-500 transition-all" />
                <button onClick={handleNews} disabled={isSearchingNews} className="absolute right-3 top-3 bottom-3 px-6 bg-white text-black rounded-xl font-black uppercase text-[9px] shadow-lg disabled:opacity-50">SYNC</button>
              </div>
              {newsResult && (
                  <div className="bg-white/5 p-7 rounded-3xl border border-white/10 font-sans text-sm leading-relaxed opacity-80">
                      {newsResult.text}
                      {newsResult.links.length > 0 && (
                          <div className="mt-8 pt-5 border-t border-white/10 flex flex-col gap-4">
                              <p className="text-[9px] font-black uppercase opacity-30 tracking-widest">Network Sources:</p>
                              {newsResult.links.map((link, idx) => (
                                  <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors text-[11px] font-medium truncate flex items-center gap-2">
                                      <span className="w-1 h-1 rounded-full bg-indigo-500" />
                                      {link.title || link.uri}
                                  </a>
                              ))}
                          </div>
                      )}
                  </div>
              )}
            </div>
        )}
      </main>

      <footer className="relative z-50 py-5 px-6 border-t border-white/10 bg-black/90 backdrop-blur-2xl flex justify-between items-center text-[9px] font-black tracking-widest uppercase">
        <div className="flex items-center gap-2.5 opacity-50"><span className={`w-1.5 h-1.5 rounded-full bg-white ${isActive ? 'animate-pulse' : ''}`} />JEET OS v20.0</div>
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isActive ? (isLegalMode ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-green-500 shadow-[0_0_8px_#22c55e]') : 'bg-red-500'}`} />
            <span className={isActive ? (isLegalMode ? 'text-emerald-400' : 'text-green-400') : 'text-red-400'}>{isActive ? (isLegalMode ? "DEFENCE ACTIVE" : "SYNCED") : "STANDBY"}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;