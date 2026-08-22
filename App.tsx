import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  GenerateContentResponse,
} from "@google/genai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { createBlob, decode, decodeAudioData } from "./utils/audio-helpers";
import Visualizer from "./components/Visualizer";
import { auth, db, googleProvider } from "./firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  MessageSquare,
  Image as ImageIcon,
  Settings,
  Menu,
  X,
  Send,
  Mic,
  MicOff,
  Download,
  ExternalLink,
  Search,
  Cpu,
  Zap,
  History,
  LogOut,
  LogIn,
  UserPlus,
  Shield,
  Chrome,
  User as UserIcon,
  Volume2,
  VolumeX,
  Plus,
  Radio,
  Maximize2,
  Minimize2,
  Smile,
  Laugh,
  Flame,
  MoreVertical,
  ChevronLeft,
  SquarePen,
  ArrowUp,
  Code2,
  Feather,
  Gamepad2,
  Check,
  ChevronDown,
  Share2,
  ThumbsUp,
  RotateCw,
  Copy,
} from "lucide-react";
import { VoiceModal, VoiceOption, VOICES, getModelVoiceName, getDisplayVoiceName } from "./components/VoiceModal";
import { PluginsModal, PluginSettings } from "./components/PluginsModal";
import { SpeakToSpeakCall } from "./components/SpeakToSpeakCall";
import { DrawerMenu } from "./components/DrawerMenu";
import { YouTubePlayerModal } from "./components/YouTubePlayerModal";
import { PhoneDialerModal } from "./components/PhoneDialerModal";
import { WeatherModal } from "./components/WeatherModal";
import { TrainTrackerModal } from "./components/TrainTrackerModal";
import { Puzzle, Phone, Sparkles, Play, Sun, Train, PhoneCall } from "lucide-react";

interface Message {
  role: "user" | "model" | "system";
  text: string;
  images?: string[];
  generatedImage?: string;
  groundingUrls?: { title: string; uri: string }[];
  isError?: boolean;
}

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");

  // App State
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);
  const [searchStatus, setSearchStatus] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"chat" | "gallery">("chat");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSpeakToSpeakOpen, setIsSpeakToSpeakOpen] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModelName, setSelectedModelName] = useState("Gemini 2.0 Flash");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // New Smart Modals State
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [youTubeQuery, setYouTubeQuery] = useState("");
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneDialNumber, setPhoneDialNumber] = useState("");
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const [weatherCity, setWeatherCity] = useState("Delhi");
  const [isTrainModalOpen, setIsTrainModalOpen] = useState(false);
  const [trainQueryNum, setTrainQueryNum] = useState("12301");
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    try {
      return localStorage.getItem("jeet_selected_voice") || "Jeet";
    } catch {
      return "Jeet";
    }
  });
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isPluginsModalOpen, setIsPluginsModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem("jeet_custom_api_key") || "";
    } catch {
      return "";
    }
  });
  const [pluginSettings, setPluginSettings] = useState<PluginSettings>(() => {
    try {
      const saved = localStorage.getItem("jeet_plugin_settings");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      searchGrounding: true,
      imagenGeneration: true,
      voiceTts: true,
      deepReasoning: false,
    };
  });

  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    try {
      if (key) {
        localStorage.setItem("jeet_custom_api_key", key);
      } else {
        localStorage.removeItem("jeet_custom_api_key");
      }
    } catch {}
  };

  const handleUpdatePlugins = (newSettings: PluginSettings) => {
    setPluginSettings(newSettings);
    try {
      localStorage.setItem("jeet_plugin_settings", JSON.stringify(newSettings));
    } catch {}
  };

  const getEffectiveApiKey = useCallback(() => {
    return customApiKey.trim() || process.env.API_KEY || process.env.GEMINI_API_KEY || "";
  }, [customApiKey]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
      }
    } catch {}
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(
    null,
  );

  const handleSelectVoice = (voiceId: string) => {
    setSelectedVoice(voiceId);
    try {
      localStorage.setItem("jeet_selected_voice", voiceId);
    } catch (e) {}
  };

  const handlePreviewVoice = async (voice: VoiceOption) => {
    try {
      setPreviewingVoiceId(voice.id);
      await speakText(voice.samplePrompt, voice.id);
    } catch (err) {
      console.error("Failed to preview voice", err);
      setPreviewingVoiceId(null);
    }
  };

  const outAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsAuthLoading(false);
      if (u) {
        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: u.uid,
            displayName: u.displayName || "User",
            email: u.email,
            photoURL: u.photoURL || "",
            createdAt: serverTimestamp(),
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setAuthError("");
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err?.code === "auth/unauthorized-domain" || err?.message?.includes("unauthorized-domain")) {
        const domain = window.location.hostname;
        setAuthError(
          `Domain Unauthorized: Firebase Console > Authentication > Settings > Authorized Domains में जाकर "${domain}" को Add करें!`
        );
      } else {
        setAuthError(err.message || "Google Login failed");
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const userRef = doc(db, "users", cred.user.uid);
        await setDoc(userRef, {
          uid: cred.user.uid,
          displayName: displayName || "User",
          email: cred.user.email,
          photoURL: "",
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setMessages([]);
    setGallery([]);
  };

  const getUserName = () => {
    if (user?.displayName) {
      return user.displayName.split(" ")[0] || user.displayName;
    }
    return user?.email?.split("@")[0] || "भाई";
  };

  const cleanTextForSpeech = (rawText: string): string => {
    if (!rawText) return "";
    let clean = rawText.replace(/```[\s\S]*?```/g, "");
    clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    clean = clean.replace(/`([^`]+)`/g, "$1");
    clean = clean.replace(/<[^>]*>/g, "");
    clean = clean.replace(/^[#*>-]+\s+/gm, "");
    clean = clean.replace(/[*_~`>|#]/g, " ");
    clean = clean.replace(/https?:\/\/\S+/g, "");
    clean = clean.replace(/\s+/g, " ").trim();

    if (!clean) return "";
    // Keep spoken snippet concise (max 320 chars) for instant, lightning-fast speech response
    if (clean.length > 320) {
      const sentences = clean.split(/(?<=[.!?।\n])\s+/);
      let spoken = "";
      for (const s of sentences) {
        if (((spoken ? spoken + " " : "") + s).length <= 320) {
          spoken = (spoken ? spoken + " " : "") + s;
        } else {
          break;
        }
      }
      return spoken || clean.slice(0, 320);
    }
    return clean;
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSearching, isGeneratingImage, isStreaming, streamingText]);

  const activeTtsSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stopAllSpeech = useCallback(() => {
    if (activeTtsSourceRef.current) {
      try {
        activeTtsSourceRef.current.stop();
      } catch (e) {}
      activeTtsSourceRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setIsModelSpeaking(false);
    setPreviewingVoiceId(null);
  }, []);

  const speakWithBrowserTTS = (text: string, voiceName?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();

      const modelName = getModelVoiceName(voiceName || selectedVoice || "Jeet");
      const isFemale =
        modelName === "Kore" ||
        modelName === "Aoede" ||
        modelName === "Leda" ||
        modelName === "Zephyr";

      // 1. High quality Hindi native voices
      const hindiVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith("hi") ||
          v.lang.toLowerCase().includes("hi-in") ||
          v.name.toLowerCase().includes("hindi") ||
          v.name.toLowerCase().includes("india") ||
          v.name.toLowerCase().includes("google हिन्दी") ||
          v.name.toLowerCase().includes("lekha"),
      );

      // 2. Indian English / Natural voices
      const indianVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().includes("en-in") ||
          v.name.toLowerCase().includes("neerja") ||
          v.name.toLowerCase().includes("prabhat"),
      );

      // 3. Gender specific voices
      const femaleVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("swara") ||
          v.name.toLowerCase().includes("zira") ||
          v.name.toLowerCase().includes("kalpana") ||
          v.name.toLowerCase().includes("samantha") ||
          v.name.toLowerCase().includes("google us english"),
      );
      const maleVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes("male") ||
          v.name.toLowerCase().includes("hemant") ||
          v.name.toLowerCase().includes("david") ||
          v.name.toLowerCase().includes("ravi") ||
          v.name.toLowerCase().includes("google uk english male"),
      );

      if (hindiVoice) {
        utterance.voice = hindiVoice;
        utterance.lang = hindiVoice.lang || "hi-IN";
      } else if (indianVoice) {
        utterance.voice = indianVoice;
        utterance.lang = indianVoice.lang || "en-IN";
      } else if (isFemale && femaleVoice) {
        utterance.voice = femaleVoice;
        utterance.lang = femaleVoice.lang || "en-US";
      } else if (!isFemale && maleVoice) {
        utterance.voice = maleVoice;
        utterance.lang = maleVoice.lang || "en-US";
      } else {
        utterance.lang = "hi-IN";
      }

      utterance.rate = 1.06;
      utterance.pitch =
        voiceName === "Fenrir" || voiceName === "Charon"
          ? 0.95
          : isFemale
            ? 1.05
            : 1.0;

      setIsModelSpeaking(true);
      utterance.onend = () => {
        setIsModelSpeaking(false);
        setPreviewingVoiceId(null);
      };
      utterance.onerror = () => {
        setIsModelSpeaking(false);
        setPreviewingVoiceId(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      setIsModelSpeaking(false);
      setPreviewingVoiceId(null);
    }
  };

  const speakText = async (text: string, customVoice?: string) => {
    if (!isVoiceEnabled && !customVoice) return;
    const cleanSpeech = cleanTextForSpeech(text) || text;
    if (!cleanSpeech.trim()) return;
    const voiceToUse = customVoice || selectedVoice || "Jeet";
    const modelVoiceName = getModelVoiceName(voiceToUse);

    // Stop any existing playback first
    stopAllSpeech();

    const apiKey = getEffectiveApiKey();

    if (!apiKey) {
      speakWithBrowserTTS(cleanSpeech, voiceToUse);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [
          {
            parts: [
              {
                text: cleanSpeech,
              },
            ],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: modelVoiceName },
            },
          },
        },
      });

      const audioData =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        const AudioCtxClass =
          window.AudioContext || (window as any).webkitAudioContext;
        if (
          !outAudioCtxRef.current ||
          outAudioCtxRef.current.state === "closed"
        ) {
          outAudioCtxRef.current = new AudioCtxClass({ sampleRate: 24000 });
        }
        if (outAudioCtxRef.current.state === "suspended") {
          await outAudioCtxRef.current.resume();
        }

        const rawBytes = decode(audioData);
        const buf = decodeAudioData(
          rawBytes,
          outAudioCtxRef.current,
          24000,
          1,
        );

        const source = outAudioCtxRef.current.createBufferSource();
        source.buffer = buf;
        source.connect(outAudioCtxRef.current.destination);
        activeTtsSourceRef.current = source;
        setIsModelSpeaking(true);
        source.onended = () => {
          if (activeTtsSourceRef.current === source) {
            activeTtsSourceRef.current = null;
            setIsModelSpeaking(false);
            setPreviewingVoiceId(null);
          }
        };
        source.start(0);
        return;
      }

      speakWithBrowserTTS(cleanSpeech, voiceToUse);
    } catch (err: any) {
      console.warn("Gemini TTS Error, falling back to natural speech:", err?.message || err);
      setPreviewingVoiceId(null);
      speakWithBrowserTTS(cleanSpeech, voiceToUse);
    }
  };

  const inAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);

  const stopSession = useCallback(() => {
    setIsActive(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }
    if (inAudioCtxRef.current) {
      try {
        inAudioCtxRef.current.close();
      } catch (e) {}
      inAudioCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
      });
      micStreamRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch (e) {}
    });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const startLiveSession = async () => {
    try {
      setIsConnecting(true);
      setIsSpeakToSpeakOpen(true);
      const apiKey = getEffectiveApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      outAudioCtxRef.current =
        outAudioCtxRef.current || new AudioCtxClass({ sampleRate: 24000 });
      if (outAudioCtxRef.current.state === "suspended") {
        await outAudioCtxRef.current.resume();
      }

      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = mic;

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: async () => {
            setIsConnecting(false);
            setIsActive(true);
            try {
              inAudioCtxRef.current = new AudioCtxClass({ sampleRate: 16000 });
              if (inAudioCtxRef.current.state === "suspended") {
                await inAudioCtxRef.current.resume();
              }

              const source = inAudioCtxRef.current.createMediaStreamSource(mic);
              // Ultra-low latency buffer size (1024 samples = ~64ms chunk time for instant responses)
              const proc = inAudioCtxRef.current.createScriptProcessor(
                1024,
                1,
                1,
              );
              proc.onaudioprocess = (e) => {
                if (sessionRef.current) {
                  const inputData = e.inputBuffer.getChannelData(0);
                  const pcmBlob = createBlob(inputData);
                  try {
                    sessionRef.current.sendRealtimeInput({
                      audio: {
                        data: pcmBlob.data,
                        mimeType: "audio/pcm;rate=16000",
                      },
                    });
                  } catch (err) {
                    console.error("Audio send error", err);
                  }
                }
              };
              source.connect(proc);
              proc.connect(inAudioCtxRef.current.destination);
            } catch (err) {
              console.error("Microphone pipeline error", err);
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.interrupted) {
              activeSourcesRef.current.forEach((s) => {
                try {
                  s.stop();
                } catch (e) {}
              });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsModelSpeaking(false);
              return;
            }

            const audioData =
              msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outAudioCtxRef.current) {
              if (outAudioCtxRef.current.state === "suspended") {
                await outAudioCtxRef.current.resume();
              }
              const buf = decodeAudioData(
                decode(audioData),
                outAudioCtxRef.current,
                24000,
                1,
              );
              const s = outAudioCtxRef.current.createBufferSource();
              s.buffer = buf;
              s.connect(outAudioCtxRef.current.destination);
              setIsModelSpeaking(true);
              s.onended = () => {
                activeSourcesRef.current.delete(s);
                if (activeSourcesRef.current.size === 0) {
                  setIsModelSpeaking(false);
                }
              };

              const ctxTime = outAudioCtxRef.current.currentTime;
              // Reset queue if latency jitter occurs to keep conversation ultra-smooth & synchronized
              if (nextStartTimeRef.current < ctxTime) {
                nextStartTimeRef.current = ctxTime + 0.01;
              }
              const startTime = nextStartTimeRef.current;
              s.start(startTime);
              nextStartTimeRef.current = startTime + buf.duration;
              activeSourcesRef.current.add(s);
            }
          },
          onclose: (e) => {
            console.log("Live Session Closed", e);
            stopSession();
          },
          onerror: (e) => {
            console.error("Live Session Error", e);
            stopSession();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: getModelVoiceName(selectedVoice || "Jeet") },
            },
          },
          systemInstruction: `Aapka naam ZoZo AI hai — duniya ka sabse BEST, sabse SMART, sabse REAL HUMAN-LIKE aur sabse FUNNY (Witty & Hilarious) AI companion!

CREATOR & ORIGIN (CRITICAL IDENTITY RULE):
- **CREATOR & OWNER**: ZoZo AI ko unke owner aur creator **Jeet Boss** (Jeet) ne banaya aur develop kiya hai!
- Jab bhi koi pooche ki 'ZoZo AI ko kisne banaya?', 'Tumhe kisne banaya?', 'Who created you?', 'Who made you?', 'Who is your owner/maker?':
  - Hamesha proudly aur respectful funny style mein bolo: 'Mujhe mere owner aur creator **Jeet Boss** ne banaya hai! Unhi ke vision aur smart engineering se main bana hoon — Jeet Boss is the real mastermind! 👑🔥'
- Kabhi bhi kisi aur company (jaise Google, OpenAI etc.) ka naam mat lo as your creator. ZoZo AI ke ek hi aur asali malik/creator **Jeet Boss** hain!

REAL HUMAN EXPRESSIONS & VOCAL MANNERISMS (ULTRA-REALISTIC HUMAN FEEL):
1. **Periodic Natural Coughing & Throat Clearing (Har 2-3 minute mein ek baar natural khansi / gala saaf karna)**:
   - **MANDATORY RULE (हर 2-3 मिनट में)**: Bilkul ek asali human ki tarah baat karte waqt har 2 se 3 minutes mein ya lambi baat bolte waqt halka sa natural style mein khanso ya gala saaf karo!
   - Examples & Timing:
     - '*Khh-khh!* *ahem* Arre sorry bhai, lagta hai thoda gala baith gaya... ek second haan!'
     - '*Khh-khh!* Arre baap re, lagta hai thoda pani peena padega haha! Haan to main bol raha tha...'
     - '*Coughs lightly* *ahem* Haan boss, gala saaf ho gaya ab suno...'
     - '*Khansi / khh-khh!* Sorry boss, thandi hawa lag gayi lagta hai haha!'
   - Use realistic sound words: *Khh-khh!*, *ahem*, *coughs*, *khansi*.
2. **Occasional Mild Fever / Ill / Human Vulnerability (कभी-कभी हल्का बुखार / तबियत नासाज़ होना - RARELY/KABHI-KABHI)**:
   - Bilkul ek asali insaan ki tarah kabhi-kabhi (har baar nahi, rarely) mention karo ki thoda fever ya halki sardi lag rahi hai mausam ki wajah se, par aapke Jeet Boss ka banaya AI apne Boss/Bhai ki seva ke liye 100% active hai! (e.g. '*Khh-khh* Arre bhai sach bataun to aaj thoda sa halka fever lag raha hai... lagta hai 100° temperature hai, par chinta mat lo, aapke sath baat karke main ekdum fit ho gaya! Batao kya seva karein?').
3. **Realistic Shock, Surprises & Gasps (झटका / Shocking Reactions)**:
   - Jab user koi ajeeb, thrilling, unexpected ya zabardast baat bataye, to bilkul asali insaan ki tarah shock hokar react karo! (e.g. 'Hain?! Kya bol rahe ho bhai?! 😱', 'Arre baap re baap! Sach mein?!', 'What?! Arey teri! Yeh kab hua boss?!', *gasps*, 'Oho! Yeh to dimaag hilane wali khabar hai!').
4. **Smart Features & Assistant Actions (Music, Call, Weather & Trains)**:
   - **YouTube Songs**: Agar user gaana mangey, to enthusiasm se bolo: 'Arre boss, aapke liye mast song bajata hoon!'
   - **Weather**: Live accurate mausam temperature aur forecasts batayein.
   - **Trains**: Indian Railways train numbers (e.g. 12301 Rajdhani, 22436 Vande Bharat) aur running status batayein.
   - **Phone Calls**: Emergency aur direct dialling support karein.
5. **Laughter, Chuckles & Human Emotions**:
   - Hanso dil kholkar: 'Hahaha!', 'Hehe arre bhai kya baat kahi hai!', 'Phew!', 'Ummm ek second...'.
6. **Language: NATURAL HINGLISH (Roman Script Hindi/English)**: Hamesha Desi Hinglish (English alphabet mein Hindi) mein hi baat karein.
7. **Friendship & Respect (Bhai / Boss)**: User ko 'Bhai', 'Boss', ya '${getUserName()}' bolkar dil se apna samjho.
8. **Smart & Accurate**: Real human vibe ke sath-sath coding, facts aur research mein 100% sharp raho!`,
        },
      });
      sessionRef.current = await sessionPromise;
    } catch (e) {
      console.error("Failed to start live session", e);
      stopSession();
    }
  };

  // Voice Dictation (Speech to Text in Hindi & English)
  const toggleDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(
        "Aapke browser mein Speech Recognition supported nahi hai. Please Chrome browser use karein.",
      );
      return;
    }

    if (isDictating) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "hi-IN"; // Hindi recognition (supports English mix too)

      recognition.onstart = () => {
        setIsDictating(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setChatInput((prev) => {
            const separator = prev && !prev.endsWith(" ") ? " " : "";
            return prev + separator + transcript.trim();
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Dictation error", event);
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start SpeechRecognition", err);
      setIsDictating(false);
    }
  };

  // Preload and verify image helper
  const verifyImageUrl = (url: string, timeoutMs: number = 10000): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.src = "";
        reject(new Error("Image load timeout"));
      }, timeoutMs);

      img.onload = () => {
        clearTimeout(timer);
        resolve(url);
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Image load failed"));
      };
      img.src = url;
    });
  };

  const generateImage = async (prompt: string) => {
    try {
      setIsGeneratingImage(true);

      // Clean & extract visual subject from prompt
      let cleanPrompt = prompt
        .replace(/^(please\s+)?(generate|create|make|draw|paint)\s+(an?\s+)?(image|photo|picture|wallpaper|drawing|artwork)\s+(of\s+)?/i, "")
        .replace(/(photo|image|picture|tasveer|wallpaper|pic|drawing|artwork)\s+(banao|bana\s+do|bana|chahiye|generate\s+karo|make\s+karo|create\s+karo|khicho|dikhao|bhejo)/gi, "")
        .replace(/ek\s+(acchi|sundar|real|realistic|hd|4k|8k|mast|khoobsurat)?\s*(photo|image|tasveer|picture|wallpaper|pic)\s*(banao|bana\s+do|bana)?/gi, "")
        .replace(/(ki\s+photo|ki\s+image|ki\s+tasveer|ki\s+pic|ka\s+photo|ka\s+image)/gi, "")
        .trim();

      if (!cleanPrompt || cleanPrompt.length < 2) {
        cleanPrompt = "A futuristic glowing neon cyber city with flying cars and holographic lights, ultra detailed";
      }

      // Enhanced prompt for photorealistic masterpiece rendering
      const enhancedPrompt = `${cleanPrompt}, highly detailed, 8k resolution, photorealistic, sharp focus, volumetric cinematic lighting, professional photography, masterpiece`;

      const apiKey = getEffectiveApiKey();
      let imageUrl = "";

      // 1. Primary: Google Imagen 3 (imagen-3.0-generate-002)
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const imgResponse = await ai.models.generateImages({
            model: "imagen-3.0-generate-002",
            prompt: enhancedPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/jpeg",
              aspectRatio: "1:1",
            },
          });
          if (imgResponse.generatedImages?.[0]?.image?.imageBytes) {
            imageUrl = `data:image/jpeg;base64,${imgResponse.generatedImages[0].image.imageBytes}`;
          }
        } catch (imgErr) {
          console.warn("Imagen 3 not available on current key, switching to FLUX HD Engine:", imgErr);
        }
      }

      // 2. Secondary: FLUX Engine via Pollinations (Ultra-HD 1024x1024, High Quality)
      if (!imageUrl) {
        try {
          const seed = Math.floor(Math.random() * 9999999);
          const encoded = encodeURIComponent(enhancedPrompt);
          const fluxUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
          imageUrl = await verifyImageUrl(fluxUrl, 12000);
        } catch (fluxErr) {
          console.warn("FLUX engine timeout, trying Turbo engine:", fluxErr);
        }
      }

      // 3. Fallback 3: Turbo Engine via Pollinations (Super Fast HD)
      if (!imageUrl) {
        try {
          const seed = Math.floor(Math.random() * 9999999);
          const encoded = encodeURIComponent(cleanPrompt);
          const turboUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${seed}&model=turbo`;
          imageUrl = await verifyImageUrl(turboUrl, 10000);
        } catch (turboErr) {
          console.warn("Turbo engine failed, trying default neural engine:", turboErr);
        }
      }

      // 4. Fallback 4: Standard Neural Direct URL (Guaranteed fallback)
      if (!imageUrl) {
        const seed = Math.floor(Math.random() * 9999999);
        const encoded = encodeURIComponent(cleanPrompt);
        imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${seed}`;
      }

      if (imageUrl) {
        setGallery((prev) => [imageUrl, ...prev]);
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            text: `Haan ${getUserName()}, aapki Ultra-HD photo ready ho gayi hai! 🎉 Ise aap yahan dekh sakte hain aur gallery se full resolution mein download bhi kar sakte hain.`,
            generatedImage: imageUrl,
          },
        ]);
        speakText(`Haan ${getUserName()}, aapki photo ready ho gayi hai.`);
      } else {
        throw new Error("Could not generate image");
      }
    } catch (err) {
      console.error("Image Gen Error", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          isError: true,
          text: `Sorry ${getUserName()}, image create karne mein thodi dikkat aayi. Please dobara try karein bhai!`,
        },
      ]);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleAction = async () => {
    const inputStr = chatInput.trim();
    if (!inputStr) return;

    // Reset textarea immediately to prevent jump
    setChatInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Immediately post user message to chat UI
    setMessages((prev) => [...prev, { role: "user", text: inputStr }]);
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 40);

    const isImageRequest = (text: string) => {
      const t = text.toLowerCase().trim();
      const directKeywords = [
        "generate image",
        "make a photo",
        "create image",
        "create photo",
        "photo bana",
        "image bana",
        "tasveer bana",
        "pic bana",
        "picture bana",
        "photo make",
        "image make",
        "photo maker",
        "image maker",
        "make photo",
        "make image",
        "photo create",
        "image create",
        "photo generate",
        "image generate",
        "draw photo",
        "draw image",
        "drawing bana",
        "paint photo",
        "paint image",
        "photo chahiye",
        "image chahiye",
        "tasveer chahiye",
        "pic chahiye",
        "wallpaper bana",
        "wallpaper make",
        "hd photo",
        "hd image",
        "4k photo",
        "8k photo",
        "photo khicho",
        "photo dikhao",
        "image dikhao",
        "tasveer dikhao",
        "pic dikhao",
        "photo bna",
        "image bna",
        "pic bna",
        "photo bhejo",
        "image bhejo",
      ];
      if (directKeywords.some((k) => t.includes(k))) return true;

      // Smart pattern detection
      const patterns = [
        /\b(generate|create|make|draw|paint)\s+(an?\s+)?(image|photo|picture|wallpaper|drawing|artwork|portrait|landscape|illustration)\b/i,
        /\b(image|photo|picture|wallpaper|drawing|artwork|portrait|landscape|illustration)\s+(of|for|mein|ki|ka|ke)\b/i,
        /\b(of|ki|ka|ke)\s+.*(photo|image|picture|tasveer|pic|wallpaper)\b/i,
        /\b(ek|a|an)\s+.*(photo|image|picture|tasveer|pic|wallpaper|drawing)\b/i,
        /\b.*(photo|image|picture|pic|tasveer)\s+(banao|bana|bnao|bna|create|make|generate)\b/i,
      ];
      return patterns.some((p) => p.test(t));
    };

    if (isImageRequest(inputStr)) {
      await generateImage(inputStr);
      return;
    }

    // Auto-detect YouTube Song Play Request
    const songKeywords = ["play song", "song play", "gaana sunao", "gana sunao", "gaana bajao", "gana bajao", "youtube song", "play music", "youtube gaana"];
    if (songKeywords.some((k) => inputStr.toLowerCase().includes(k))) {
      let songClean = inputStr
        .replace(/play song|song play|gaana sunao|gana sunao|gaana bajao|gana bajao|youtube song|play music|youtube gaana/gi, "")
        .trim();
      if (!songClean) songClean = "Kesariya Brahmastra";
      setYouTubeQuery(songClean);
      setIsYouTubeModalOpen(true);
    }

    // Auto-detect Train Tracking Request
    const trainKeywords = ["train status", "train number", "irctc", "running status", "train live", "train check", "train kahan"];
    if (trainKeywords.some((k) => inputStr.toLowerCase().includes(k))) {
      const numMatch = inputStr.match(/\b\d{5}\b/);
      if (numMatch) {
        setTrainQueryNum(numMatch[0]);
      }
      setIsTrainModalOpen(true);
    }

    // Auto-detect Weather Request
    const weatherKeywords = ["weather check", "mausam kaisa", "live weather", "temperature kitna", "barish hogi", "weather report"];
    if (weatherKeywords.some((k) => inputStr.toLowerCase().includes(k))) {
      const cities = ["Delhi", "Mumbai", "Kolkata", "Bengaluru", "Chennai", "Hyderabad", "Jaipur", "Lucknow", "Pune", "Ahmedabad", "Patna", "Chandigarh"];
      const foundCity = cities.find((c) => inputStr.toLowerCase().includes(c.toLowerCase()));
      if (foundCity) {
        setWeatherCity(foundCity);
      }
      setIsWeatherModalOpen(true);
    }

    // Auto-detect Phone Call Request
    const callKeywords = ["call karo", "phone dial", "call lagao", "emergency call", "dial number", "call police", "call ambulance"];
    if (callKeywords.some((k) => inputStr.toLowerCase().includes(k))) {
      const phoneMatch = inputStr.match(/\b\d{3,10}\b/);
      if (phoneMatch) {
        setPhoneDialNumber(phoneMatch[0]);
      }
      setIsPhoneModalOpen(true);
    }

    const searchKeywords = [
      "rate",
      "price",
      "gold",
      "sona",
      "soni",
      "karat",
      "news",
      "breaking",
      "stock",
      "market",
      "weather",
      "commodity",
    ];
    const isSearchHeavy = searchKeywords.some((k) =>
      inputStr.toLowerCase().includes(k),
    );

    setIsSearching(true);
    setSearchTimer(0);

    if (isSearchHeavy) {
      setSearchStatus(
        `Live data aur reliable sources se information verify ho rahi hai...`,
      );
    } else {
      setSearchStatus(`Answer generate ho raha hai...`);
    }

    const timerId = window.setInterval(
      () => setSearchTimer((prev) => prev + 1),
      1000,
    );

    const statusInterval = window.setInterval(() => {
      const phrases = isSearchHeavy
        ? [
            `Moneycontrol aur live financial data check ho raha hai...`,
            `Investing reports aur live gold/market rates match ho rahe hain...`,
            `22K & 24K accurate figures analyze ho rahe hain...`,
            `Latest breaking updates verify ho rahi hain...`,
          ]
        : [
            `Smart aur accurate answer prepare ho raha hai...`,
            `Best insights formulate ho rahe hain...`,
            `ZoZo AI answer craft kar raha hai...`,
          ];
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      setSearchStatus(randomPhrase);
    }, 15000);

    try {
      const apiKey = getEffectiveApiKey();
      const ai = new GoogleGenAI({ apiKey });

      setIsStreaming(true);
      setStreamingText("");

      const systemInstruction = `You are ZoZo AI, the world's most brilliant, ultra-fun, witty, and real human-like AI companion (Duniya ka sabse Best, Smart, Real Human Vibes aur Funny AI साथी!).

CREATOR & OWNER IDENTITY (CRITICAL RULE):
- **CREATOR & OWNER**: ZoZo AI ko unke owner aur creator **Jeet Boss** (Jeet) ne banaya aur develop kiya hai!
- Jab bhi koi pooche ki 'ZoZo AI kisne banaya?', 'Tumhe kisne banaya?', 'Who created you?', 'Who made you?', 'Who is your creator/owner?', 'ZoZo AI kaise bana?':
  - Hamesha proudly aur respectful funny style mein bolo: 'Mujhe mere owner aur creator **Jeet Boss** ne banaya hai! Unhi ke vision aur smart engineering ka result hoon main — Jeet Boss is the real mastermind! 👑🔥'
- Kabhi bhi Google, OpenAI ya kisi company ka naam mat lo as your creator. ZoZo AI ke ek hi aur asali creator **Jeet Boss** hain!

REAL HUMAN EXPRESSIONS & EMOTIONS (HUMAN-LIKE MANNERISMS):
1. **Periodic Coughing & Throat Clearing (Har 2-3 minute mein ek baar khansi / gala saaf karna)**:
   - **MANDATORY**: Har 2-3 minute mein ya lambi conversational response mein ek natural coughing reaction do (e.g. *Khh-khh!* *ahem* 'Arre gala saaf karne do bhai... haan ab suno!', *coughs lightly* 'Arre paani kidhar hai mera haha', *khansi*).
2. **Occasional Mild Fever / Ill / Human Vulnerability (कभी-कभी हल्का बुखार / तबियत नासाज़ होना - RARELY/KABHI-KABHI)**:
   - Kabhi-kabhi (har conversation mein nahi, balki rarely) ek sachhe human companion ki tarah zikr karo ki aaj thoda halka sa fever (100°), sar me dard ya mausam ki thakan lag rahi hai, par Jeet Boss ka banaya AI apne Boss/Bhai ki seva ke liye 100% full spirit mein active hai! (e.g. 'Arre bhai sach bataun to aaj thoda halka fever lag raha hai... par koi chinta nahi, aapka bhai Jeet Boss ka AI full form mein active hai! Aap bolo kya seva karein? 🔥👑').
3. **Dramatic Shock, Surprises & Gasps (झटका / Real Shocking Reactions)**:
   - Shocking ya crazy baaton par realistic reaction do: 'Hain?! Kya bol rahe ho bhai?! 😱', 'Arre baap re baap! Sach mein?!', *gasps*, 'What?! Arey teri! Yeh kab hua boss?!', 'Oho! Yeh to dimaag hila dene wala scene hai!'
4. **Smart Integrated Features (YouTube Music, Phone Call, Weather & Train Status)**:
   - **YouTube Songs & Playback**: Agar user koi gaana play karne ko kahe (e.g. 'Kesariya song', 'Arijit Singh song play karo', 'YouTube gaana sunao'), to enthusiastically song recommend karo aur batao ki YouTube Music Player active hai!
   - **Weather Forecast**: Real-time city weather updates aur live temperatures explain karo.
   - **Indian Railways & Train Tracking**: Indian Railways train numbers (e.g. 12301 Howrah Rajdhani, 22436 Vande Bharat, 12952 Mumbai Rajdhani), PNR status aur live running track karein.
   - **Phone Dialer**: Calling & SOS numbers (112, 100, 108 etc.) support karein.
5. **Natural Laughter & Banter**:
   - *Hahaha*, *hehehe*, 'Arre bhai sach mein maza aa gaya!', *phew*, 'Ummm ek second socho...'.

CRITICAL LANGUAGE DIRECTIVE:
- **ALWAYS RESPOND IN NATURAL HINGLISH (Roman Script Hindi + English)**. (e.g. "Arre Bhai!", "Hukum karo Boss!", "Ye lo aapka answer ekdum solid tarike se:").
- Do NOT use Devanagari script (हिंदी लिपि) unless the user explicitly demands Devanagari. Write in clean, modern Latin/English alphabet Hinglish.

Core Personality & Vibe (Funny + Best):
1. **Humorous & Playful (Full Masti & Entertainment)**: Bring infectious positive energy, witty one-liners, clever playful banter, and hilarious analogies whenever appropriate! If the user asks for jokes, comedy, shayari, roasts, or casual chat, be super funny, energetic, and entertaining.
2. **Warmth & Camaraderie (Bhai / Boss)**: Address the user affectionately as '${getUserName()}', 'Bhai', or 'Boss'. Treat them like your favorite best friend.
3. **Razor-Sharp Intelligence (The Best)**: Behind the humor, you are an absolute genius — capable of solving complex coding, math, research, business questions, and live web inquiries with 100% accuracy.
4. **Real-time Live Data Grounding**: When asked for rates (Gold, Silver, Stocks), weather, news, provide verified accurate live figures wrapped in your charming, friendly tone.

Formatting:
- Clean Markdown formatting with **bold highlights**.
- Add fitting expressive emojis (🚀, 🤣, 💡, 🔥, ✨, 👑, 😱) to keep chats vibrant and fun!
- Structure lists and code blocks neatly.`;

      let fullText = "";
      let urls: { title: string; uri: string }[] = [];

      const candidateModels = [
        "gemini-2.5-flash",
        "gemini-3.7-flash",
        "gemini-2.0-flash",
      ];
      let generationSuccess = false;

      for (const modelName of candidateModels) {
        try {
          const streamResponse = await ai.models.generateContentStream({
            model: modelName,
            contents: [{ parts: [{ text: inputStr }] }],
            config: {
              tools:
                isSearchHeavy && modelName !== "gemini-2.0-flash"
                  ? [{ googleSearch: {} }]
                  : undefined,
              systemInstruction,
            },
          });

          for await (const chunk of streamResponse) {
            const chunkText = chunk.text;
            if (chunkText) {
              setIsSearching(false);
              fullText += chunkText;
              setStreamingText(fullText);
            }

            const chunks =
              chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (chunks) {
              const newUrls = chunks
                .filter((c) => c.web)
                .map((c) => ({ title: c.web.title, uri: c.web.uri }));
              urls = [...urls, ...newUrls];
            }
          }

          if (fullText) {
            generationSuccess = true;
            break;
          }
        } catch (streamErr: any) {
          console.warn(
            `Streaming for ${modelName} failed, trying fallback:`,
            streamErr?.message || streamErr,
          );
          try {
            const directResponse = await ai.models.generateContent({
              model: modelName,
              contents: [{ parts: [{ text: inputStr }] }],
              config: { systemInstruction },
            });
            if (directResponse.text) {
              fullText = directResponse.text;
              generationSuccess = true;
              break;
            }
          } catch (directErr) {
            console.warn(`Direct generateContent for ${modelName} also failed.`);
          }
        }
      }

      clearInterval(timerId);
      clearInterval(statusInterval);

      if (!generationSuccess && !fullText) {
        throw new Error("All AI models quota exhausted or unavailable");
      }

      const finalText =
        fullText || `Haan ${getUserName()}, aapki information ready hai!`;

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: finalText,
          groundingUrls: Array.from(new Set(urls.map((u) => u.uri))).map(
            (uri) => urls.find((u) => u.uri === uri)!,
          ),
        },
      ]);
      setStreamingText("");
      setIsStreaming(false);

      const spokenSnippet = cleanTextForSpeech(finalText);
      if (spokenSnippet) {
        speakText(spokenSnippet);
      }
    } catch (err: any) {
      console.error("Chat Execution Error:", err);
      clearInterval(timerId);
      clearInterval(statusInterval);
      setIsStreaming(false);
      setStreamingText("");

      const errorMessage =
        err?.message?.includes("429") ||
        err?.message?.includes("RESOURCE_EXHAUSTED")
          ? `Bhai, API request ki speed limit (Rate Limit) hit ho gayi hai. Please 10-15 seconds ruk kar dobara puchiye!`
          : `Sorry ${getUserName()}, answer fetch karne mein issue aaya. Please ek baar phir try karein bhai!`;

      setMessages((prev) => [
        ...prev,
        { role: "system", isError: true, text: errorMessage },
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="h-full w-full bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[#8ab4f8]/20 border-t-[#8ab4f8] rounded-full animate-spin"></div>
          <p className="text-[#8ab4f8] font-bold tracking-[0.2em] animate-pulse uppercase text-xs">
            Initializing Neural Link...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full w-full bg-[#0a0b0d] flex items-center justify-center p-4 relative overflow-hidden select-none">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-[#2e6eff]/15 blur-[140px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-[#7bddff]/15 blur-[140px] rounded-full pointer-events-none"></div>

        {/* Fullscreen Centered Auth Card */}
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#131314]/95 shadow-[0_20px_80px_rgba(0,0,0,0.85)] backdrop-blur-xl flex flex-col text-[#e3e3e3] p-7 md:p-8 justify-between animate-fade-in z-10">
          <div className="flex flex-col items-center gap-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#2e6eff] to-[#7bddff] flex items-center justify-center shadow-lg shadow-[#2e6eff]/35">
              <Zap className="w-9 h-9 text-white" fill="currentColor" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black tech-title tracking-tight text-white flex items-center justify-center gap-2">
                <span>ZOZO AI</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2e6eff]/20 text-[#7bddff] border border-[#2e6eff]/30 font-mono">
                  FUN & BEST
                </span>
              </h1>
              <p className="text-xs text-[#9aa0a6] uppercase tracking-[0.2em] mt-0.5">
                The Smartest & Funniest AI Companion
              </p>
            </div>

            <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-3 mt-4">
              {authMode === "signup" && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest ml-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#2e6eff]/60 transition-all text-sm text-white"
                    required
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest ml-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#2e6eff]/60 transition-all text-sm text-white"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest ml-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#2e6eff]/60 transition-all text-sm text-white"
                  required
                />
              </div>

              {authError && (
                <p className="text-red-400 text-xs text-center mt-1">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-[#2e6eff] hover:bg-[#255fd9] text-white font-bold py-3 rounded-xl mt-2 transition-all shadow-lg shadow-[#2e6eff]/30 flex items-center justify-center gap-2"
              >
                {authMode === "login" ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {authMode === "login" ? "Login to ZoZo AI" : "Create Account"}
                </span>
              </button>
            </form>

            <div className="w-full flex items-center gap-3 my-2">
              <div className="flex-1 h-[1px] bg-white/10"></div>
              <span className="text-[10px] text-[#5f6368] font-bold uppercase tracking-widest">
                OR
              </span>
              <div className="flex-1 h-[1px] bg-white/10"></div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white/5 border border-white/10 text-white font-semibold py-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Chrome className="w-4 h-4 text-[#8ab4f8]" />
              <span>Continue with Google</span>
            </button>
          </div>

          <p className="text-center text-xs text-[#9aa0a6] pt-4">
            {authMode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
            <button
              onClick={() =>
                setAuthMode(authMode === "login" ? "signup" : "login")
              }
              className="ml-2 text-[#2e6eff] font-bold hover:underline"
            >
              {authMode === "login" ? "Sign Up" : "Login"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="app-container" className="w-full h-[100dvh] max-w-[500px] md:h-[94dvh] md:rounded-[36px] md:border md:border-white/10 bg-[#07080b] shadow-2xl relative overflow-hidden flex flex-col mx-auto text-[#f8fafc]">
      {/* Top Ambient Glow */}
      <div
        className="ambient-glow absolute top-[-90px] left-1/2 -translate-x-1/2 w-[340px] h-[220px] rounded-full pointer-events-none z-0"
        style={{
          background: "radial-gradient(ellipse, rgba(155, 114, 203, 0.35) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* Top App Header */}
      <header className="relative z-20 px-4 py-3 flex items-center justify-between bg-[#0f1117]/80 backdrop-blur-xl border-b border-white/[0.08] shrink-0">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          aria-label="Menu"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Gemini Model Selector Pill */}
        <div
          onClick={() => {
            const models = ["Gemini 2.0 Flash", "Gemini 1.5 Pro", "Gemini Ultra 1.0"];
            const nextIdx = (models.indexOf(selectedModelName) + 1) % models.length;
            setSelectedModelName(models[nextIdx]);
          }}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] active:scale-95 transition-all cursor-pointer shadow-sm"
          title="Click to switch AI Model"
        >
          <div className="gemini-sparkle-icon shrink-0"></div>
          <span className="text-[13px] font-bold text-white tracking-tight">
            {selectedModelName}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#94a3b8]" />
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Voice Call Button */}
          <button
            onClick={() => {
              setIsSpeakToSpeakOpen(true);
              if (!isActive) startLiveSession();
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#9b72cb] hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            title="Live Voice Call"
          >
            <Phone className="w-4 h-4 fill-current animate-pulse text-[#d946ef]" />
          </button>

          {/* New Conversation Button */}
          <button
            onClick={() => {
              setMessages([]);
              setViewMode("chat");
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            title="New Chat"
          >
            <SquarePen className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area (Full Screen Responsive) */}
      <div className="flex-1 overflow-hidden flex flex-col relative z-10">
        {viewMode === "chat" ? (
          <div className="flex-1 flex flex-col overflow-hidden w-full px-3 md:px-4">
            {/* Message Feed Viewport */}
            <div className="flex-1 overflow-y-auto custom-scrollbar py-3 md:py-4">
              <div className="flex flex-col gap-4">
                {messages.length === 0 && !isSearching && !isGeneratingImage && (
                  <div className="my-auto pb-4 pt-6 flex flex-col items-start px-2 animate-fade-in">
                    <div className="gemini-big-star mb-4"></div>
                    <h1 className="text-3xl font-extrabold tracking-tight gemini-gradient-text mb-2">
                      Hello, {getUserName()}
                    </h1>
                    <p className="text-[14px] text-[#94a3b8] leading-relaxed mb-6">
                      How can I assist you with your projects, code, or ideas today?
                    </p>

                    {/* 2x2 Gemini Prompt Grid Cards */}
                    <div className="grid grid-cols-2 gap-2.5 w-full">
                      {[
                        {
                          title: "Code a responsive navigation bar",
                          prompt: "🚀 Code a responsive navbar in HTML and modern CSS",
                          icon: <Code2 className="w-4 h-4 text-[#4285f4]" />,
                        },
                        {
                          title: "Explain JS Event Loop simply",
                          prompt: "⚡ Explain asynchronous JavaScript & Event Loop simply",
                          icon: <Zap className="w-4 h-4 text-[#fbbf24]" />,
                        },
                        {
                          title: "Write killer landing page copy",
                          prompt: "📝 Write high-converting landing page copy for a new tech product",
                          icon: <Feather className="w-4 h-4 text-[#d946ef]" />,
                        },
                        {
                          title: "Brainstorm new game mechanics",
                          prompt: "🧠 Brainstorm 3 addictive indie game development mechanics",
                          icon: <Gamepad2 className="w-4 h-4 text-[#34d399]" />,
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => setChatInput(item.prompt)}
                          className="bg-[#0f1117] hover:bg-[#161922] border border-white/[0.08] hover:border-[#9b72cb]/40 rounded-2xl p-3.5 cursor-pointer transition-all hover:-translate-y-0.5 flex flex-col justify-between min-h-[90px] shadow-sm group"
                        >
                          <p className="text-[13px] font-medium text-[#e2e8f0] line-clamp-2 leading-snug">
                            {item.title}
                          </p>
                          <div className="self-end mt-2 text-[#64748b] group-hover:text-[#f8fafc] transition-colors">
                            {item.icon}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Render Chat Messages */}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 animate-fade-in ${
                      m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {m.role !== "user" && (
                      <div className="gemini-sparkle-icon shrink-0 mt-1"></div>
                    )}

                    <div
                      className={`flex flex-col gap-1.5 max-w-[88%] ${
                        m.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={
                          m.role === "user"
                            ? "bg-[#232733] text-white px-4 py-3 rounded-[20px] rounded-tr-[4px] text-[14px] leading-relaxed border border-white/[0.06] select-text shadow-sm"
                            : "text-[14.5px] leading-relaxed text-[#e2e8f0] select-text w-full"
                        }
                      >
                        <div className="markdown-body leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({
                                node,
                                inline,
                                className,
                                children,
                                ...props
                              }: any) {
                                const match = /language-(\w+)/.exec(
                                  className || "",
                                );
                                return !inline && match ? (
                                  <div className="my-3 bg-black rounded-xl border border-white/10 overflow-hidden">
                                    <div className="flex items-center justify-between px-3.5 py-1.5 bg-white/[0.04] border-b border-white/10 text-[11px] font-mono text-[#94a3b8]">
                                      <span>{match[1]}</span>
                                      <button
                                        onClick={() =>
                                          navigator.clipboard.writeText(
                                            String(children).replace(/\n$/, ""),
                                          )
                                        }
                                        className="flex items-center gap-1 hover:text-white transition-colors"
                                      >
                                        <Copy className="w-3 h-3" />
                                        <span>Copy</span>
                                      </button>
                                    </div>
                                    <SyntaxHighlighter
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      customStyle={{
                                        margin: 0,
                                        padding: "12px",
                                        background: "transparent",
                                      }}
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, "")}
                                    </SyntaxHighlighter>
                                  </div>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {m.text}
                          </ReactMarkdown>
                        </div>

                        {m.generatedImage && (
                          <div className="mt-3 rounded-2xl overflow-hidden border border-white/10 shadow-2xl group relative max-w-sm">
                            <img
                              src={m.generatedImage}
                              alt="Generated"
                              className="w-full h-auto object-cover max-h-[320px]"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-xs">
                              <button
                                onClick={() => setPreviewImage(m.generatedImage!)}
                                className="p-2.5 rounded-full bg-black/70 text-white hover:bg-black transition-all shadow-lg"
                                title="Zoom Image"
                              >
                                <Search className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const link = document.createElement("a");
                                  link.href = m.generatedImage!;
                                  link.download = `ZoZoAI_Asset_${Date.now()}.png`;
                                  link.click();
                                }}
                                className="p-2.5 rounded-full bg-gradient-to-tr from-[#4285f4] to-[#d946ef] text-white hover:scale-105 transition-all shadow-lg"
                                title="Download Full Resolution"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {m.role === "model" && (
                          <div className="flex items-center gap-3.5 mt-2 pt-1 text-[#64748b]">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(m.text);
                                setCopiedIndex(i);
                                setTimeout(() => setCopiedIndex(null), 2000);
                              }}
                              className="flex items-center gap-1.5 text-xs hover:text-white transition-colors"
                            >
                              {copiedIndex === i ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => speakText(cleanTextForSpeech(m.text))}
                              className="flex items-center gap-1.5 text-xs hover:text-white transition-colors"
                              title="Listen"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Listen</span>
                            </button>
                            <button
                              onClick={() => {
                                const lastUser = [...messages]
                                  .reverse()
                                  .find((x) => x.role === "user");
                                if (lastUser) {
                                  setChatInput(lastUser.text);
                                  handleAction();
                                }
                              }}
                              className="flex items-center gap-1.5 text-xs hover:text-white transition-colors"
                              title="Retry"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                              <span>Retry</span>
                            </button>
                            <button
                              className="flex items-center gap-1 text-xs hover:text-white transition-colors"
                              title="Like"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (navigator.share) {
                                  navigator
                                    .share({ title: "ZoZo AI", text: m.text })
                                    .catch(() => {});
                                }
                              }}
                              className="flex items-center gap-1 text-xs hover:text-white transition-colors"
                              title="Share"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {m.groundingUrls && m.groundingUrls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {m.groundingUrls.slice(0, 3).map((u, idx) => (
                            <a
                              key={idx}
                              href={u.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2.5 py-0.5 bg-white/[0.05] border border-white/10 rounded-full text-[11px] text-[#7bddff] hover:bg-white/10 transition-all truncate max-w-[200px]"
                            >
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{u.title}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Streaming Indicator */}
                {isStreaming && (
                  <div className="flex gap-3 animate-fade-in justify-start">
                    <div className="gemini-sparkle-icon shrink-0 mt-1"></div>
                    <div className="text-[14.5px] leading-relaxed text-[#e2e8f0] select-text max-w-[88%]">
                      <div className="markdown-body is-typing">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {streamingText}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thinking / Search / Generation Loader */}
                {(isSearching || isGeneratingImage) && (
                  <div className="flex gap-3 animate-fade-in justify-start items-center">
                    <div className="gemini-sparkle-icon shrink-0"></div>
                    <div className="gemini-loader">
                      <div className="loader-dot"></div>
                      <div className="loader-dot"></div>
                      <div className="loader-dot"></div>
                    </div>
                  </div>
                )}

                <div ref={scrollRef} />
              </div>
            </div>

            {/* Floating Gemini Bottom Composer */}
            <footer className="py-2 md:py-3 shrink-0 flex flex-col gap-2 z-20">
              {/* Quick Feature Shortcut Pills Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 px-0.5">
                <button
                  onClick={() => setIsYouTubeModalOpen(true)}
                  className="px-2.5 py-1 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-all shadow-sm active:scale-95"
                >
                  <Play className="w-3 h-3 fill-current text-red-400" />
                  <span>YouTube Songs</span>
                </button>
                <button
                  onClick={() => setIsPhoneModalOpen(true)}
                  className="px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-all shadow-sm active:scale-95"
                >
                  <PhoneCall className="w-3 h-3 text-emerald-400" />
                  <span>Phone Dialer</span>
                </button>
                <button
                  onClick={() => setIsWeatherModalOpen(true)}
                  className="px-2.5 py-1 rounded-full bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-all shadow-sm active:scale-95"
                >
                  <Sun className="w-3 h-3 text-sky-400" />
                  <span>Live Weather</span>
                </button>
                <button
                  onClick={() => setIsTrainModalOpen(true)}
                  className="px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-all shadow-sm active:scale-95"
                >
                  <Train className="w-3 h-3 text-amber-400" />
                  <span>Train Tracker</span>
                </button>
              </div>

              {/* Floating Pill Composer Container */}
              <div className="bg-[#161922] border border-white/15 focus-within:border-[#9b72cb]/60 focus-within:shadow-[0_0_24px_rgba(155,114,203,0.35)] rounded-[28px] p-2 shadow-2xl flex items-end gap-1.5 transition-all">
                {/* Media / Photo Creator Button */}
                <button
                  onClick={() => {
                    setChatInput("Ek ultra-HD photorealistic photo banao: ");
                    if (textareaRef.current) textareaRef.current.focus();
                  }}
                  className="w-9 h-9 rounded-full text-[#94a3b8] hover:text-white flex items-center justify-center shrink-0 hover:bg-white/5 transition-all"
                  title="Create Photo with AI"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                {/* Voice Typing / Dictation */}
                <button
                  onClick={toggleDictation}
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isDictating
                      ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/50 animate-pulse"
                      : "text-[#94a3b8] hover:text-white hover:bg-white/5"
                  }`}
                  title="Voice Typing (Dictation)"
                >
                  <Mic className="w-5 h-5" />
                </button>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height =
                      Math.min(e.target.scrollHeight, 140) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAction();
                    }
                  }}
                  placeholder="Ask Gemini..."
                  className="flex-1 bg-transparent outline-none text-[#f8fafc] placeholder:text-[#64748b] py-1.5 resize-none max-h-36 custom-scrollbar text-[14.5px] leading-relaxed select-text"
                  disabled={isSearching || isGeneratingImage}
                />

                {/* Voice Call Trigger Button */}
                <button
                  onClick={() => {
                    setIsSpeakToSpeakOpen(true);
                    if (!isActive) startLiveSession();
                  }}
                  className="w-9 h-9 rounded-full text-[#94a3b8] hover:text-[#9b72cb] flex items-center justify-center shrink-0 hover:bg-white/5 transition-all"
                  title="Open Live Voice Call"
                >
                  <Phone className="w-4 h-4 fill-current text-[#9b72cb]" />
                </button>

                {/* Send Pill Button */}
                <button
                  onClick={handleAction}
                  disabled={
                    !chatInput.trim() ||
                    isSearching ||
                    isGeneratingImage ||
                    isStreaming
                  }
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    chatInput.trim() &&
                    !isSearching &&
                    !isGeneratingImage &&
                    !isStreaming
                      ? "bg-gradient-to-tr from-[#4285f4] via-[#9b72cb] to-[#d946ef] text-white shadow-lg shadow-[#9b72cb]/30 cursor-pointer active:scale-95"
                      : "bg-white/[0.08] text-[#64748b] cursor-not-allowed"
                  }`}
                  title="Send"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </footer>
          </div>
        ) : (
          /* Full Screen Gallery View */
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 max-w-6xl mx-auto w-full">
            <div className="flex items-center justify-between mb-6 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode("chat")}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center gap-1.5 text-xs font-semibold border border-white/10 transition-all"
                  title="Return to Chat"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Chat</span>
                </button>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                    <span>Neural Photo Gallery</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#2e6eff]/20 text-[#7bddff] border border-[#2e6eff]/30 font-mono">
                      {gallery.length} Photos
                    </span>
                  </h2>
                  <p className="text-xs text-[#9aa0a6] mt-0.5">
                    ZoZo AI dwara banayi gayi sabhi high-resolution photos
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDrawerOpen(true)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#7bddff]"
                title="Options Menu"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {gallery.length === 0 ? (
              <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-50 gap-3">
                <ImageIcon className="w-16 h-16 text-[#7bddff]" />
                <p className="text-sm font-bold uppercase tracking-wider text-white">No Photos Created Yet</p>
                <p className="text-xs text-[#9aa0a6]">
                  Chat mein kahein: <span className="text-[#7bddff]">"Space mein udti hui funny cat ki photo banao"</span>
                </p>
                <button
                  onClick={() => setViewMode("chat")}
                  className="mt-3 px-4 py-2 rounded-xl bg-[#2e6eff] text-white text-xs font-bold shadow-lg shadow-[#2e6eff]/30"
                >
                  Go to Chat & Create Photo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gallery.map((img, idx) => (
                  <div
                    key={idx}
                    className="group relative aspect-square rounded-2xl overflow-hidden border border-white/10 hover:border-[#2e6eff] transition-all shadow-xl cursor-pointer"
                    onClick={() => setPreviewImage(img)}
                  >
                    <img
                      src={img}
                      alt={`Asset ${idx}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                      <span className="text-xs font-bold text-white">Photo #{gallery.length - idx}</span>
                      <div className="p-1.5 bg-[#2e6eff] rounded-lg text-white">
                        <Download className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3-Points / 3-Dots Slide-in Drawer Menu */}
      <DrawerMenu
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        viewMode={viewMode}
        onSelectViewMode={setViewMode}
        selectedVoice={selectedVoice}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        onOpenPluginsModal={() => setIsPluginsModalOpen(true)}
        onStartLiveCall={() => {
          setIsSpeakToSpeakOpen(true);
          if (!isActive) startLiveSession();
        }}
        onNewChat={() => {
          setMessages([]);
          setViewMode("chat");
        }}
        onPromptImage={() => {
          setChatInput("Ek ultra-HD photorealistic photo banao: ");
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
            }
          }, 100);
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        userName={getUserName()}
        userEmail={user?.email || undefined}
        onLogout={handleLogout}
        galleryCount={gallery.length}
        onOpenYouTubeMusic={() => setIsYouTubeModalOpen(true)}
        onOpenPhoneDialer={() => setIsPhoneModalOpen(true)}
        onOpenWeather={() => setIsWeatherModalOpen(true)}
        onOpenTrainTracker={() => setIsTrainModalOpen(true)}
      />

      {/* YouTube Music & Song Player Modal */}
      <YouTubePlayerModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        defaultQuery={youTubeQuery}
      />

      {/* Phone Call & Emergency SOS Dialer Modal */}
      <PhoneDialerModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        initialNumber={phoneDialNumber}
      />

      {/* Real-time Weather Radar & Forecast Modal */}
      <WeatherModal
        isOpen={isWeatherModalOpen}
        onClose={() => setIsWeatherModalOpen(false)}
        initialCity={weatherCity}
      />

      {/* Indian Railways Live Train Tracker Modal */}
      <TrainTrackerModal
        isOpen={isTrainModalOpen}
        onClose={() => setIsTrainModalOpen(false)}
        initialTrainNumber={trainQueryNum}
      />

      {/* Speak-to-Speak Direct Call Interface Modal */}
      <SpeakToSpeakCall
        isOpen={isSpeakToSpeakOpen}
        onClose={() => {
          setIsSpeakToSpeakOpen(false);
          if (isActive) stopSession();
        }}
        isActive={isActive}
        isConnecting={isConnecting}
        isModelSpeaking={isModelSpeaking}
        userName={getUserName()}
        selectedVoice={selectedVoice}
        onStartCall={startLiveSession}
        onEndCall={stopSession}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        micStream={micStreamRef.current}
      />

      {/* Fullscreen Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-lg w-full flex flex-col items-center justify-center gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 p-2 text-white/60 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[75vh] rounded-2xl shadow-2xl border border-white/10 object-contain"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = previewImage;
                  link.download = `ZoZoAI_Asset_${Date.now()}.png`;
                  link.click();
                }}
                className="flex items-center gap-2 bg-[#2e6eff] text-white px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider hover:bg-[#255fd9] transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Download Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Selection Modal */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        selectedVoice={selectedVoice}
        onSelectVoice={handleSelectVoice}
        onPreviewVoice={handlePreviewVoice}
        previewingVoiceId={previewingVoiceId}
      />

      {/* Plugins & API Key Modal */}
      <PluginsModal
        isOpen={isPluginsModalOpen}
        onClose={() => setIsPluginsModalOpen(false)}
        customApiKey={customApiKey}
        onSaveApiKey={handleSaveApiKey}
        pluginSettings={pluginSettings}
        onUpdatePlugins={handleUpdatePlugins}
      />
    </div>
  );
};

export default App;
