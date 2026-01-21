import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { createBlob, decode, decodeAudioData } from './utils/audio-helpers';
import Visualizer from './components/Visualizer';

// Firebase Configuration provided by User
const firebaseConfig = {
  apiKey: "AIzaSyCaIP3vdUxuNemn9eJsvU-tTUJqq835Zp0",
  authDomain: "jeet-ai-d34b4.firebaseapp.com",
  projectId: "jeet-ai-d34b4",
  storageBucket: "jeet-ai-d34b4.firebasestorage.app",
  messagingSenderId: "781777412725",
  appId: "1:781777412725:web:ea705b9223fff3716ace3c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<'neural' | 'ocr' | 'power' | 'news' | 'social'>('neural');
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

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setErrorMsg(null);
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      setErrorMsg("Authentication Failed: " + e.message);
    }
  };

  const handleLogout = async () => {
    stopConversation();
    await signOut(auth);
  };

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
    setHasStarted(true);
    setTranscriptions([]);

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        setErrorMsg("Critical: API Key Missing from Environment.");
        return;
    }

    try {
      setIsConnecting(true);
      if (!outAudioCtxRef.current) {
          outAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (outAudioCtxRef.current.state === 'suspended') await outAudioCtxRef.current.resume();

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey });

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
                    if (s && s.sendRealtimeInput) s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
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
                            if (s && s.sendRealtimeInput) s.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } });
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
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: `आपका नाम Jeet AI है। निर्माता: Jeet Boss। यूज़र का नाम: ${user?.displayName || 'Boss'}। आप एक मज़ेदार और स्मार्ट असिस्टेंट हैं। हमेशा 'आप' का प्रयोग करें।`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e: any) { 
        setIsConnecting(false); 
        setErrorMsg("Boot Error: Check API Key/Network.");
    }
  };

  const handleOcrExtraction = async () => {
    if (!ocrImage || isExtractingOcr) return;
    setIsExtractingOcr(true); setOcrResult('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ inlineData: { data: ocrImage.data, mimeType: ocrImage.mimeType } }, { text: "Extract text Boss." }] }
      });
      setOcrResult(res.text || 'No text found.');
    } catch (e) {} finally { setIsExtractingOcr(false); }
  };

  if (authLoading) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <div className="text-white font-black tracking-[0.5em] animate-pulse uppercase text-xs">Initializing Secure Link...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center p-8 fade-in relative overflow-hidden">
        <div className="scanline"></div>
        <div className="fixed inset-0 neural-glow opacity-30 z-0"></div>
        <div className="z-10 text-center max-w-sm">
          <div className="w-24 h-24 bg-white/10 rounded-full border border-white/20 flex items-center justify-center mx-auto mb-10 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
            <span className="text-4xl font-black italic text-indigo-500">J</span>
          </div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-4">JEET SYSTEM</h1>
          <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] mb-12">Neural Interface Access Restricted</p>
          
          <button 
            onClick={handleLogin}
            className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
          
          {errorMsg && (
            <p className="mt-6 text-red-500 text-[10px] font-black uppercase tracking-widest">{errorMsg}</p>
          )}
        </div>
        <footer className="absolute bottom-10 text-[9px] text-white/20 font-black uppercase tracking-[0.5em]">
          Jeet AI Neural Lab © 2025
        </footer>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black text-white flex flex-col relative overflow-hidden fade-in max-w-md mx-auto shadow-2xl border-x border-white/5">
      <div className="fixed inset-0 neural-glow pointer-events-none opacity-20 z-0" />
      
      <header className="relative z-50 py-4 px-6 border-b border-white/10 flex justify-between items-center bg-black/80 backdrop-blur-xl">
        <div className="flex flex-col">
          <h1 className="text-xl font-black italic uppercase tracking-tighter">JEET SYSTEM</h1>
          <div className="text-[8px] font-black opacity-40 uppercase tracking-widest">User: {user.displayName}</div>
        </div>
        <div className="flex gap-2">
            <button onClick={toggleCamera} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${isCameraOn ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_10px_#6366f1]' : 'bg-white/10 border-white/20'}`}>CAM {isCameraOn ? 'ON' : 'OFF'}</button>
            <button onClick={handleLogout} className="px-3 py-1.5 bg-red-600/20 text-white text-[9px] font-black rounded-lg uppercase border border-white/20">LOGOUT</button>
        </div>
      </header>

      {errorMsg && (
          <div className="relative z-50 bg-red-600/80 text-white text-[10px] font-black uppercase px-4 py-2 text-center animate-pulse border-b border-red-500/50">
              {errorMsg}
          </div>
      )}

      <nav className="relative z-50 flex gap-1 p-2 bg-white/[0.08] border-b border-white/10 overflow-x-auto no-scrollbar">
          {(['neural', 'ocr', 'power', 'news', 'social'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[90px] py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 transform ${activeTab === tab ? 'bg-white text-black shadow-lg scale-105' : 'text-white hover:bg-white/20'}`}>
                  {tab === 'neural' ? 'Voice' : tab === 'ocr' ? 'JEET OCR' : tab === 'power' ? 'Vision' : tab === 'news' ? 'Intel' : 'Owner'}
              </button>
          ))}
      </nav>

      <main className="flex-1 relative z-10 p-5 flex flex-col overflow-y-auto custom-scrollbar">
        {activeTab === 'neural' && (
          <div className="min-h-full flex flex-col items-center justify-center fade-in pb-20">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-6 text-center">NEURAL LINK</h2>
            
            <div className="relative w-full aspect-square max-w-[280px] mb-6 bg-white/5 rounded-[3.5rem] overflow-hidden border border-white/10 shadow-3xl">
              <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isCameraOn ? 'opacity-80' : 'opacity-0'}`} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <Visualizer isActive={isActive} isModelSpeaking={isModelSpeaking} mode="happy" />
              </div>
              <div className="absolute inset-0 border-[20px] border-black/40 pointer-events-none z-10" />
            </div>

            {isActive && (
                <div className="w-full mb-6 max-h-32 overflow-y-auto custom-scrollbar bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 backdrop-blur-md">
                    {transcriptions.map((t, i) => (
                        <div key={i} className="flex flex-col gap-1 fade-in">
                            {t.user && <p className="text-[11px] text-indigo-400 font-bold">Boss: {t.user}</p>}
                            {t.model && <p className="text-[11px] text-white font-medium italic">Jeet: {t.model}</p>}
                        </div>
                    ))}
                </div>
            )}

            <div className="w-full flex flex-col gap-5">
               {isConnecting ? ( 
                 <p className="text-indigo-400 font-black tracking-[0.5em] text-[11px] animate-pulse text-center uppercase">SYNCHRONIZING...</p> 
               ) : isActive ? (
                 <button onClick={stopConversation} className="w-full py-7 bg-red-600/20 border border-red-500/50 text-white font-black uppercase text-base rounded-[2rem] shadow-2xl transition-all">DISCONNECT</button>
               ) : (
                 <button onClick={startConversation} className="w-full py-7 bg-white text-black font-black uppercase text-base rounded-[2rem] shadow-2xl transition-all">START JEET AI</button>
               )}
            </div>
          </div>
        )}

        {activeTab === 'ocr' && (
          <div className="flex flex-col gap-6 fade-in pb-24">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">JEET OCR PRO</h2>
            <div className="bg-white/10 border border-white/20 rounded-3xl p-6 flex flex-col items-center gap-4 relative">
                {ocrImage ? (
                    <div className="w-full rounded-xl overflow-hidden border border-white/20 aspect-video"><img src={`data:${ocrImage.mimeType};base64,${ocrImage.data}`} className="w-full h-full object-cover" /></div>
                ) : (
                    <div className="w-full aspect-video bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[11px] uppercase font-black">Upload Image</div>
                )}
                <div className="flex gap-2 w-full">
                    <button onClick={() => ocrFileInputRef.current?.click()} className="flex-1 py-3.5 bg-white/20 rounded-xl font-black uppercase text-[11px]">Select</button>
                    <button onClick={handleOcrExtraction} disabled={!ocrImage || isExtractingOcr} className="flex-[2] py-3.5 bg-white text-black rounded-xl font-black uppercase text-[11px] shadow-lg disabled:opacity-50">EXTRACT</button>
                </div>
                <input type="file" accept="image/*" className="hidden" ref={ocrFileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setOcrImage({ data: (r.result as string).split(',')[1], mimeType: f.type }); r.readAsDataURL(f); } }} />
            </div>
            {ocrResult && <div className="bg-white/10 border border-white/20 rounded-2xl p-5"><pre className="text-[13px] leading-relaxed whitespace-pre-wrap font-sans">{ocrResult}</pre></div>}
          </div>
        )}

        {activeTab === 'social' && (
          <div className="flex flex-col items-center justify-center gap-6 fade-in pb-32 pt-10">
            <div className="bg-white/[0.1] border border-white/30 rounded-[3.5rem] p-12 flex flex-col items-center text-center shadow-3xl w-full max-w-[320px]">
              <div className="w-28 h-28 bg-white text-black rounded-full border-8 border-white/20 flex items-center justify-center mb-10 text-4xl font-black italic shadow-2xl">J</div>
              <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 italic">JEET BOSS</h3>
              <p className="text-[10px] opacity-40 uppercase font-black tracking-widest mb-10">System Architect</p>
              <a href="https://ffjeetgamer1234.blogspot.com/2025/11/jeet.html" target="_blank" className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[11px] text-center shadow-xl">BOSS PHOTO</a>
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-50 py-4 px-6 border-t border-white/10 bg-black/90 backdrop-blur-2xl flex justify-between items-center text-[11px] font-black tracking-widest uppercase">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />JEET SYSTEM v20.0</div>
        <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`} />
            <span>{isActive ? "ACTIVE" : "STANDBY"}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;