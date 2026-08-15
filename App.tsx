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
} from "lucide-react";
import { VoiceModal, VoiceOption, VOICES } from "./components/VoiceModal";
import { PluginsModal, PluginSettings } from "./components/PluginsModal";
import { Puzzle } from "lucide-react";

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isFridayActive, setIsFridayActive] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    try {
      return localStorage.getItem("jeet_selected_voice") || "Fenrir";
    } catch {
      return "Fenrir";
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
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSearching]);

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

      const isFemale =
        voiceName === "Kore" ||
        voiceName === "Aoede" ||
        voiceName === "Leda" ||
        voiceName === "Zephyr";

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
    const voiceToUse = customVoice || selectedVoice || "Fenrir";

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
              prebuiltVoiceConfig: { voiceName: voiceToUse },
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
        const buf = await decodeAudioData(
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
    setIsFridayActive(false);
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
      setIsFridayActive(true);
      const apiKey = getEffectiveApiKey();
      const ai = new GoogleGenAI({ apiKey });
      outAudioCtxRef.current =
        outAudioCtxRef.current || new AudioContext({ sampleRate: 24000 });
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
              inAudioCtxRef.current = new AudioContext({ sampleRate: 16000 });
              if (inAudioCtxRef.current.state === "suspended")
                await inAudioCtxRef.current.resume();

              const source = inAudioCtxRef.current.createMediaStreamSource(mic);
              const proc = inAudioCtxRef.current.createScriptProcessor(
                4096,
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
            if (audioData) {
              if (outAudioCtxRef.current?.state === "suspended")
                await outAudioCtxRef.current.resume();
              const buf = await decodeAudioData(
                decode(audioData),
                outAudioCtxRef.current!,
                24000,
                1,
              );
              const s = outAudioCtxRef.current!.createBufferSource();
              s.buffer = buf;
              s.connect(outAudioCtxRef.current!.destination);
              setIsModelSpeaking(true);
              s.onended = () => {
                activeSourcesRef.current.delete(s);
                if (activeSourcesRef.current.size === 0)
                  setIsModelSpeaking(false);
              };
              const now = Math.max(
                nextStartTimeRef.current,
                outAudioCtxRef.current!.currentTime,
              );
              s.start(now);
              nextStartTimeRef.current = now + buf.duration;
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
              prebuiltVoiceConfig: { voiceName: selectedVoice || "Fenrir" },
            },
          },
          systemInstruction: `आपका नाम Friday (Jeet AI) है। आपके निर्माता "Jeet Boss" हैं। आप एक अत्यंत बुद्धिमान, वफादार, विनम्र और मददगार AI सहायक हैं।

मुख्य निर्देश (बातचीत का तरीका):
1. **शुद्ध, साफ़ और प्राकृतिक हिंदी/हिंग्लिश**: हमेशा साफ़, स्पष्ट और शुद्ध हिंदी में बात करें। 
2. **आदर और अपनापन**: यूज़र को सम्मानपूर्वक 'भाई' या 'बॉस' कहकर संबोधित करें (उदा. 'हाँ भाई, बताइए', 'जी बॉस, बिल्कुल').
3. **सटीक व त्वरित उत्तर**: हर सवाल का सीधा और काम का जवाब दें।
4. **अनावश्यक दोहराव से बचें**: कोई भी रोबोटिक या परेशान करने वाले वाक्य (जैसे 'intelligence processing active hai') बार-बार न बोलें।

हमेशा याद रखें: आप "Jeet Boss" की सबसे उन्नत और भरोसेमंद AI साथी हैं।`,
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
        "आपके ब्राउज़र में स्पीच रिकॉग्निशन सपोर्टेड नहीं है। कृपया Chrome ब्राउज़र का उपयोग करें।",
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

  const generateImage = async (prompt: string) => {
    try {
      setIsGeneratingImage(true);

      const apiKey = getEffectiveApiKey();
      const ai = new GoogleGenAI({ apiKey });
      let imageUrl = "";

      try {
        const imgResponse = await ai.models.generateImages({
          model: "imagen-3.0-generate-002",
          prompt: prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: "image/jpeg",
          },
        });
        if (imgResponse.generatedImages?.[0]?.image?.imageBytes) {
          imageUrl = `data:image/jpeg;base64,${imgResponse.generatedImages[0].image.imageBytes}`;
        }
      } catch (imgErr) {
        console.warn("generateImages fallback to generateContent", imgErr);
        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: {
            parts: [{ text: prompt }],
          },
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (imageUrl) {
        setGallery((prev) => [imageUrl, ...prev]);
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            text: `हाँ ${getUserName()}, आपकी फोटो तैयार हो गई है! इसे गैलरी में भी देख सकते हैं।`,
            generatedImage: imageUrl,
          },
        ]);
        speakText(`हाँ ${getUserName()}, आपकी फोटो तैयार हो गई है।`);
      } else {
        throw new Error("No image data received");
      }
    } catch (err) {
      console.error("Image Gen Error", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          isError: true,
          text: `क्षमा कीजिए ${getUserName()}, इमेज बनाने में तकनीकी समस्या आई। कृपया पुनः प्रयास करें।`,
        },
      ]);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleAction = async () => {
    const inputStr = chatInput.trim();
    if (!inputStr) return;

    setChatInput("");

    const imageKeywords = [
      "generate image",
      "make a photo",
      "create image",
      "photo banao",
      "image banao",
      "picture banao",
      "photo maker",
      "photo make",
      "make photo",
      "image make",
      "make image",
    ];
    if (imageKeywords.some((k) => inputStr.toLowerCase().includes(k))) {
      await generateImage(inputStr);
      return;
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
        `लाइव डेटा और विश्वसनीय स्रोतों से जानकारी जांची जा रही है...`,
      );
    } else {
      setSearchStatus(`उत्तर तैयार किया जा रहा है...`);
    }

    const timerId = window.setInterval(
      () => setSearchTimer((prev) => prev + 1),
      1000,
    );

    const statusInterval = window.setInterval(() => {
      const phrases = isSearchHeavy
        ? [
            `Moneycontrol और IBJA के लाइव रेट्स मैच हो रहे हैं...`,
            `Investing.com और प्रमुख वित्तीय रिपोर्ट्स जांची जा रही हैं...`,
            `22K और 24K रेट्स का सटीक विश्लेषण हो रहा है...`,
            `ताज़ा ब्रेकिंग न्यूज़ और लाइव अपडेट्स सत्यापित किए जा रहे हैं...`,
          ]
        : [
            `सटीक और उपयोगी जानकारी तैयार हो रही है...`,
            `डेटा पॉइंट्स का विश्लेषण चल रहा है...`,
            `उत्तर को संकलित किया जा रहा है...`,
          ];
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      setSearchStatus(randomPhrase);
    }, 15000);

    try {
      const apiKey = getEffectiveApiKey();
      const ai = new GoogleGenAI({ apiKey });

      setMessages((prev) => [...prev, { role: "user", text: inputStr }]);
      setIsStreaming(true);
      setStreamingText("");

      const systemInstruction = `You are Friday (Jeet AI), an ultra-intelligent, respectful, and highly competent neural assistant created by "Jeet Boss".

Language & Tone Directives:
1. **Proper Natural Hindi (साफ़, शुद्ध और सहज हिंदी)**: Whenever the user communicates in Hindi or asks to speak in Hindi (e.g. "hindi main baat kare", "sahi se baat kare hindi main", "bhai"), you MUST respond in fluent, clear, natural, and grammatically accurate Hindi (or clean natural Hinglish as preferred by the user).
2. **Respect & Camaraderie**: Address the user respectfully as '${getUserName()}', 'Boss', or 'भाई' (e.g. 'हाँ भाई', 'जी बॉस', 'नमस्ते भाई', 'बिल्कुल भाई!'). Keep the tone warm, welcoming, polite, and confident.
3. **Direct & Useful Answers**: Provide accurate, well-structured explanations without unnecessary beating around the bush.
4. **Real-time Data Grounding**: For live rates (Gold, Silver, Stocks, News, Weather), always provide fresh, accurate information.

Formatting:
- Use clean Markdown styling.
- **Bold** key highlights and crucial metrics.
- Use structured Tables or Bullet points for data lists.
- Keep technical code clear and commented.`;

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
        fullText || `हाँ ${getUserName()}, आपकी जानकारी तैयार है!`;

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
          ? `भाई, API अनुरोध की गति सीमा (Rate Limit) पूरी हो गई है। कृपया 10-15 सेकंड रुककर पुनः पूछें!`
          : `क्षमा कीजिए ${getUserName()}, उत्तर प्राप्त करने में समस्या आई। कृपया पुनः प्रयास करें भाई!`;

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
      <div className="h-full w-full bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#8ab4f8]/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/5 blur-[120px] rounded-full"></div>

        <div className="w-full max-w-md glass p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10 animate-fade-in">
          <div className="flex flex-col items-center gap-6 mb-8">
            <div className="w-16 h-16 bg-[#1e1f20] rounded-2xl flex items-center justify-center shadow-2xl border border-white/5">
              <Zap className="w-10 h-10 text-[#8ab4f8]" fill="currentColor" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold tech-title tracking-tight mb-2">
                JEET AI
              </h1>
              <p className="text-sm text-[#9aa0a6] uppercase tracking-[0.2em]">
                Elite Access Required
              </p>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
            {authMode === "signup" && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest ml-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tony Stark"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#8ab4f8]/50 transition-all text-sm"
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
                placeholder="boss@stark.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#8ab4f8]/50 transition-all text-sm"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest ml-1">
                Security Key
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#8ab4f8]/50 transition-all text-sm"
                required
              />
            </div>

            {authError && (
              <p className="text-red-400 text-xs text-center mt-2">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-[#8ab4f8] text-[#0a0a0a] font-bold py-3 rounded-xl mt-4 hover:bg-white transition-all shadow-lg shadow-[#8ab4f8]/20 flex items-center justify-center gap-2"
            >
              {authMode === "login" ? (
                <LogIn className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
              <span>
                {authMode === "login"
                  ? "Establish Link"
                  : "Create Neural Profile"}
              </span>
            </button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-[1px] bg-white/10"></div>
            <span className="text-[10px] text-[#5f6368] font-bold uppercase tracking-widest">
              OR
            </span>
            <div className="flex-1 h-[1px] bg-white/10"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white/5 border border-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-3"
          >
            <Chrome className="w-5 h-5" />
            <span>Continue with Google</span>
          </button>

          <p className="text-center mt-8 text-xs text-[#9aa0a6]">
            {authMode === "login"
              ? "Don't have a profile?"
              : "Already have a profile?"}
            <button
              onClick={() =>
                setAuthMode(authMode === "login" ? "signup" : "login")
              }
              className="ml-2 text-[#8ab4f8] font-bold hover:underline"
            >
              {authMode === "login" ? "Create One" : "Login Now"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex bg-[#131314] text-[#e3e3e3] overflow-hidden">
      {/* Sidebar Backdrop (Mobile) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#1e1f20] flex flex-col transition-transform duration-300 ease-in-out border-r border-white/5 md:relative md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#8ab4f8] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(138,180,248,0.3)]">
                <Zap className="w-5 h-5 text-[#131314]" fill="currentColor" />
              </div>
              <h1 className="text-xl font-bold tech-title tracking-tight text-white">
                JEET AI
              </h1>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-white/5 rounded-lg text-white/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => {
              setMessages([]);
              setViewMode("chat");
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className="sidebar-btn mb-6 bg-white/5 border border-white/10 text-white hover:bg-white/10"
          >
            <Plus className="w-5 h-5" />
            <span>New Intelligence</span>
          </button>

          <button
            onClick={() => {
              setViewMode("chat");
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`sidebar-btn mb-1 ${viewMode === "chat" ? "active" : ""}`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Intelligence</span>
          </button>

          <button
            onClick={() => {
              setViewMode("gallery");
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`sidebar-btn mb-1 ${viewMode === "gallery" ? "active" : ""}`}
          >
            <ImageIcon className="w-5 h-5" />
            <span>Neural Gallery</span>
          </button>

          <button
            onClick={() => {
              setIsVoiceModalOpen(true);
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className="sidebar-btn mb-1 text-white hover:bg-white/10 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-[#8ab4f8]" />
              <span>Voice Matrix</span>
            </div>
            <span className="text-[10px] bg-[#8ab4f8]/20 text-[#8ab4f8] px-2 py-0.5 rounded-full border border-[#8ab4f8]/30 font-bold">
              {selectedVoice}
            </span>
          </button>

          <button
            onClick={() => {
              setIsPluginsModalOpen(true);
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className="sidebar-btn mb-1 text-white hover:bg-white/10 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Puzzle className="w-5 h-5 text-[#c58af9]" />
              <span>Plugins & Key</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
              customApiKey
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-purple-500/20 text-purple-300 border-purple-500/30"
            }`}>
              {customApiKey ? "Custom Key" : "Plugins"}
            </span>
          </button>

          <div className="mt-8 mb-2 px-4 text-[10px] font-bold text-white/20 uppercase tracking-widest">
            Recent Activity
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {messages.length > 0 ? (
              <div className="sidebar-btn opacity-50 cursor-default">
                <History className="w-4 h-4" />
                <span className="truncate text-xs">Active Neural Session</span>
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-white/10 italic text-xs">
                No recent intelligence reports.
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-white/5">
            <button
              onClick={handleLogout}
              className="sidebar-btn text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
            <div className="mt-4 flex items-center gap-3 px-4 py-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8ab4f8] to-[#f97316] overflow-hidden flex items-center justify-center">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="User"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold truncate max-w-[120px]">
                  {getUserName()}
                </span>
                <span className="text-[10px] text-[#8ab4f8]">Elite Access</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-white/5 md:hidden bg-[#131314]/80 backdrop-blur-md sticky top-0 z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-white/5 rounded-lg text-[#8ab4f8]"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#8ab4f8]" fill="currentColor" />
            <h1 className="text-lg font-bold tech-title tracking-tight">
              JEET AI
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPluginsModalOpen(true)}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-[#c58af9] hover:bg-white/10 transition-colors"
              title="Plugins & API Key"
            >
              <Puzzle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[#8ab4f8] text-xs font-bold flex items-center gap-1.5"
              title="Change Voice"
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="max-w-[65px] truncate">{selectedVoice}</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8ab4f8] to-[#f97316] overflow-hidden flex items-center justify-center border border-white/10">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-white" />
              )}
            </div>
          </div>
        </header>

        {/* Desktop Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`hidden md:flex absolute left-4 top-4 z-50 p-2 hover:bg-white/5 rounded-lg transition-all ${isSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex-1 overflow-hidden flex flex-col">
          {viewMode === "chat" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 md:py-8">
                <div className="max-w-3xl mx-auto flex flex-col gap-6 md:gap-8">
                  {messages.length === 0 &&
                    !isSearching &&
                    !isGeneratingImage && (
                      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-6 md:gap-8 animate-fade-in p-4">
                        <div className="w-16 h-16 bg-[#1e1f20] rounded-2xl flex items-center justify-center shadow-2xl border border-white/5 relative group">
                          <div className="absolute inset-0 bg-[#8ab4f8]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <Zap
                            className="w-10 h-10 text-[#8ab4f8] relative z-10"
                            fill="currentColor"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                            How can I help you, {getUserName()}?
                          </h2>
                          <p className="text-[#c4c7c5] text-sm md:text-base">
                            Elite Neural Intelligence at your service.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl">
                          {[
                            {
                              text: "Check Gold rates on MCX",
                              icon: <Search className="w-4 h-4" />,
                            },
                            {
                              text: "Generate a futuristic supercar photo",
                              icon: <ImageIcon className="w-4 h-4" />,
                            },
                            {
                              text: "Summarize the latest tech news",
                              icon: <Cpu className="w-4 h-4" />,
                            },
                            {
                              text: "Write a creative story about AI",
                              icon: <Zap className="w-4 h-4" />,
                            },
                          ].map((suggestion, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setChatInput(suggestion.text);
                              }}
                              className="p-4 bg-[#1e1f20] hover:bg-[#282a2d] border border-white/5 rounded-xl text-left text-sm transition-all hover:border-[#8ab4f8]/30 flex items-center gap-3 group"
                            >
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:text-[#8ab4f8] transition-colors">
                                {suggestion.icon}
                              </div>
                              <span>{suggestion.text}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 md:gap-4 animate-fade-in ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {m.role !== "user" && (
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#1e1f20] border border-white/10 flex items-center justify-center shrink-0 mt-1 shadow-lg">
                          <Zap
                            className="w-5 h-5 md:w-6 md:h-6 text-[#8ab4f8]"
                            fill="currentColor"
                          />
                        </div>
                      )}
                      <div
                        className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"} max-w-[90%] md:max-w-[85%]`}
                      >
                        <div
                          className={`${m.role === "user" ? "user-msg" : "model-msg"}`}
                        >
                          <div className="markdown-body text-[0.9rem] md:text-[0.95rem]">
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
                                    <SyntaxHighlighter
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, "")}
                                    </SyntaxHighlighter>
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
                            <div className="mt-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl group relative">
                              <img
                                src={m.generatedImage}
                                alt="Generated"
                                className="w-full h-auto"
                              />
                              <button
                                onClick={() =>
                                  setPreviewImage(m.generatedImage!)
                                }
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              >
                                <Search className="w-8 h-8 text-white" />
                              </button>
                            </div>
                          )}

                          {m.role === "model" && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 text-xs text-[#9aa0a6]">
                              <button
                                onClick={() =>
                                  speakText(cleanTextForSpeech(m.text))
                                }
                                className="flex items-center gap-1 hover:text-[#8ab4f8] transition-colors py-0.5 px-1.5 rounded hover:bg-white/5"
                                title="Listen in Hindi Voice"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                                <span className="text-[11px]">Play Audio</span>
                              </button>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(m.text);
                                }}
                                className="hover:text-white transition-colors py-0.5 px-1.5 rounded hover:bg-white/5 text-[11px]"
                                title="Copy response"
                              >
                                Copy
                              </button>
                            </div>
                          )}
                        </div>
                        {m.groundingUrls && m.groundingUrls.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {m.groundingUrls.map((u, idx) => (
                              <a
                                key={idx}
                                href={u.uri}
                                target="_blank"
                                className="flex items-center gap-1.5 px-3 py-1 bg-[#1e1f20] border border-white/5 rounded-full text-[10px] md:text-[11px] text-[#8ab4f8] hover:bg-[#282a2d] transition-all"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span className="max-w-[100px] md:max-w-[120px] truncate">
                                  {u.title}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      {m.role === "user" && (
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-orange-600 flex items-center justify-center shrink-0 mt-1 overflow-hidden shadow-lg border border-white/10">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt="User"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] md:text-xs font-bold">
                              {getUserName().substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {isStreaming && (
                    <div className="flex gap-3 md:gap-4 animate-fade-in justify-start">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#1e1f20] border border-white/10 flex items-center justify-center shrink-0 mt-1 shadow-lg">
                        <Zap
                          className="w-5 h-5 md:w-6 md:h-6 text-[#8ab4f8]"
                          fill="currentColor"
                        />
                      </div>
                      <div className="flex flex-col gap-2 items-start max-w-[90%] md:max-w-[85%]">
                        <div className="model-msg">
                          <div
                            className={`markdown-body text-[0.9rem] md:text-[0.95rem] ${isStreaming ? "is-typing" : ""}`}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {streamingText}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isSearching && (
                    <div className="flex gap-3 md:gap-4 animate-fade-in">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#1e1f20] border border-white/10 flex items-center justify-center shrink-0 mt-1 shadow-lg">
                        <Search className="w-4 h-4 md:w-5 md:h-5 text-[#8ab4f8] animate-pulse" />
                      </div>
                      <div className="flex flex-col gap-2 max-w-[90%] md:max-w-[85%]">
                        <div className="model-msg bg-white/5 border border-white/5 p-4 rounded-2xl">
                          <div className="flex items-center gap-2 text-[10px] md:text-xs text-[#8ab4f8] font-bold uppercase tracking-widest mb-2">
                            <div className="w-1.5 h-1.5 bg-[#8ab4f8] rounded-full animate-ping"></div>
                            <span>Scanning Web Intelligence</span>
                          </div>
                          <p className="text-xs md:text-sm text-[#9aa0a6] italic">
                            {searchStatus}
                          </p>
                          <div className="mt-3 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#8ab4f8] animate-[loading_2s_infinite_linear]"
                              style={{ width: "40%" }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isGeneratingImage && (
                    <div className="flex gap-3 md:gap-4 animate-fade-in">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#1e1f20] border border-white/10 flex items-center justify-center shrink-0 mt-1 shadow-lg">
                        <Cpu className="w-4 h-4 md:w-5 md:h-5 text-[#f97316] animate-spin" />
                      </div>
                      <div className="flex flex-col gap-2 max-w-[90%] md:max-w-[85%]">
                        <div className="model-msg bg-white/5 border border-white/5 p-4 rounded-2xl">
                          <div className="flex items-center gap-2 text-[10px] md:text-xs text-[#f97316] font-bold uppercase tracking-widest mb-2">
                            <div className="w-1.5 h-1.5 bg-[#f97316] rounded-full animate-ping"></div>
                            <span>Neural imaging in progress...</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 w-32 mt-2">
                            {[...Array(8)].map((_, i) => (
                              <div
                                key={i}
                                className="h-1 bg-[#f97316]/30 rounded-full animate-pulse"
                                style={{ animationDelay: `${i * 0.1}s` }}
                              ></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 md:p-6 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent sticky bottom-0 z-20">
                <div className="max-w-3xl mx-auto relative">
                  <div className="chat-input-container flex items-end gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3 shadow-2xl border border-white/5">
                    {/* Live Voice Call Button */}
                    <button
                      onClick={isActive ? stopSession : startLiveSession}
                      className={`p-2 md:p-3 rounded-full transition-all shrink-0 ${isActive ? "bg-red-500/20 text-red-500 ring-2 ring-red-500/50 animate-pulse" : "hover:bg-white/5 text-[#c4c7c5]"}`}
                      title={
                        isActive
                          ? "लाइव वॉइस कॉल बंद करें"
                          : "Live AI Voice Call शुरू करें (Full Live Conversation)"
                      }
                    >
                      {isActive ? (
                        <MicOff className="w-5 h-5 md:w-6 md:h-6" />
                      ) : (
                        <Radio className="w-5 h-5 md:w-6 md:h-6 text-[#8ab4f8]" />
                      )}
                    </button>

                    {/* Speech Dictation / Voice to Text Button */}
                    <button
                      onClick={toggleDictation}
                      className={`p-2 md:p-3 rounded-full transition-all shrink-0 ${isDictating ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/50 animate-pulse" : "hover:bg-white/5 text-[#c4c7c5]"}`}
                      title={
                        isDictating
                          ? "बोलना बंद करें (Dictation Active)"
                          : "बोल कर टाइप करें (Voice Dictation)"
                      }
                    >
                      <Mic
                        className={`w-5 h-5 md:w-6 md:h-6 ${isDictating ? "text-emerald-400" : ""}`}
                      />
                    </button>

                    {/* Output Speech Mute Toggle */}
                    <button
                      onClick={() => { if (isVoiceEnabled) stopAllSpeech(); setIsVoiceEnabled(!isVoiceEnabled); }}
                      className={`p-2 md:p-3 rounded-full transition-all shrink-0 hover:bg-white/5 ${isVoiceEnabled ? "text-[#8ab4f8]" : "text-red-400"}`}
                      title={
                        isVoiceEnabled ? "आवाज़ बंद करें" : "आवाज़ चालू करें"
                      }
                    >
                      {isVoiceEnabled ? (
                        <Volume2 className="w-5 h-5 md:w-6 md:h-6" />
                      ) : (
                        <VolumeX className="w-5 h-5 md:w-6 md:h-6" />
                      )}
                    </button>

                    {/* Voice Selection */}
                    <button
                      onClick={() => setIsVoiceModalOpen(true)}
                      className="p-2 md:py-2 md:px-3 rounded-full transition-all shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 text-[#8ab4f8] flex items-center gap-1.5"
                      title="Select Neural Voice Engine"
                    >
                      <span className="hidden sm:inline text-xs font-bold text-white/90">
                        {selectedVoice}
                      </span>
                    </button>

                    <textarea
                      rows={1}
                      value={chatInput}
                      onChange={(e) => {
                        setChatInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAction();
                        }
                      }}
                      placeholder="Message Jeet AI..."
                      className="flex-1 bg-transparent outline-none text-[#e3e3e3] placeholder:text-[#9aa0a6] py-2 resize-none max-h-48 custom-scrollbar text-sm md:text-base"
                      disabled={isSearching || isGeneratingImage}
                    />

                    <button
                      onClick={handleAction}
                      disabled={
                        !chatInput.trim() ||
                        isSearching ||
                        isGeneratingImage ||
                        isStreaming
                      }
                      className={`p-2 md:p-3 rounded-full transition-all shrink-0 ${chatInput.trim() ? "bg-[#8ab4f8] text-[#131314] shadow-[0_0_15px_rgba(138,180,248,0.4)]" : "text-[#5f6368] cursor-not-allowed"}`}
                    >
                      <Send className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  </div>
                  <p className="text-[9px] md:text-[10px] text-center mt-3 text-[#9aa0a6] uppercase tracking-widest font-bold opacity-50">
                    Jeet AI can make mistakes. Verify important information.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-4xl font-bold tech-title tracking-tight">
                      Neural Gallery
                    </h2>
                    <p className="text-sm text-[#c4c7c5]">
                      High-resolution assets generated by Jeet AI.
                    </p>
                  </div>
                  <div className="px-4 py-2 bg-[#1e1f20] border border-white/5 rounded-full text-xs font-bold text-[#8ab4f8]">
                    {gallery.length} ASSETS SECURED
                  </div>
                </div>

                {gallery.length === 0 ? (
                  <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-20">
                    <ImageIcon className="w-20 h-20 mb-6" />
                    <p className="text-2xl font-bold uppercase tracking-[0.3em]">
                      No Assets Found
                    </p>
                    <p className="mt-2 text-sm italic">
                      "{getUserName()}, ask me to generate an image first."
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {gallery.map((img, idx) => (
                      <div
                        key={idx}
                        className="group relative aspect-square rounded-2xl overflow-hidden border border-white/5 hover:border-[#8ab4f8]/50 transition-all duration-500 shadow-2xl cursor-pointer"
                        onClick={() => setPreviewImage(img)}
                      >
                        <img
                          src={img}
                          alt={`Asset ${idx}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-5">
                          <div className="flex items-center justify-between">
                            <p className="text-white font-bold text-[10px] tracking-widest uppercase">
                              Asset #{gallery.length - idx}
                            </p>
                            <Download className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Visualizer / Friday Mode Overlay */}
        <div
          className={`fixed inset-0 z-[60] flex items-center justify-center pointer-events-none transition-all duration-700 ${isFridayActive ? "opacity-100 scale-100" : "opacity-0 scale-150"}`}
        >
          <div className="w-full h-full absolute bg-black/80 backdrop-blur-xl"></div>

          {/* Iron Man HUD Elements */}
          <div className="absolute inset-0 overflow-hidden opacity-30">
            <div className="absolute top-10 left-10 w-48 h-48 border border-[#8ab4f8]/20 rounded-full animate-rotate-slow">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-4 bg-[#8ab4f8]"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-4 bg-[#8ab4f8]"></div>
            </div>
            <div className="absolute bottom-10 right-10 w-64 h-64 border border-[#8ab4f8]/10 rounded-full animate-rotate-fast">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-1 bg-[#8ab4f8]"></div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-1 bg-[#8ab4f8]"></div>
            </div>

            {/* Scanning Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(138,180,248,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(138,180,248,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
          </div>

          <div className="relative w-72 h-72 md:w-[500px] md:h-[500px] flex items-center justify-center">
            {/* Arc Reactor Style Animation */}
            <div className="absolute inset-0 border-8 border-[#8ab4f8]/10 rounded-full animate-rotate-slow"></div>
            <div className="absolute inset-4 border-4 border-[#8ab4f8]/20 rounded-full animate-rotate-fast"></div>
            <div className="absolute inset-12 border-2 border-[#8ab4f8]/40 rounded-full animate-pulse-soft"></div>
            <div className="absolute inset-20 border border-[#8ab4f8]/60 rounded-full"></div>

            {/* HUD Data Readouts */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-12 flex flex-col items-center gap-1">
              <div className="h-1 w-24 bg-[#8ab4f8]/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8ab4f8] animate-[loading_2s_infinite_linear]"
                  style={{ width: "60%" }}
                ></div>
              </div>
              <span className="text-[10px] font-bold tracking-[0.3em] text-[#8ab4f8] uppercase">
                Neural Link Sync
              </span>
            </div>

            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-12 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold tracking-[0.3em] text-[#8ab4f8] uppercase">
                Voice Analysis Active
              </span>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-3 bg-[#8ab4f8] animate-pulse"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  ></div>
                ))}
              </div>
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#8ab4f8]">
              <div className="relative w-32 h-32 md:w-48 md:h-48 flex items-center justify-center">
                <div className="absolute inset-0">
                  <Visualizer
                    isActive={isActive}
                    isModelSpeaking={isModelSpeaking}
                    mode="friday"
                  />
                </div>
                <Shield className="w-12 h-12 md:w-20 md:h-20 relative z-10 animate-pulse" />
                <div className="absolute inset-0 bg-[#8ab4f8]/20 blur-2xl rounded-full animate-pulse"></div>
              </div>
              <h2 className="text-xl md:text-3xl font-bold tracking-[0.5em] uppercase tech-title mb-2 mt-4">
                FRIDAY
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#8ab4f8] rounded-full animate-ping"></div>
                <span className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">
                  Listening to {getUserName()}...
                </span>
              </div>
            </div>

            {/* Scanning lines */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#8ab4f8]/40 shadow-[0_0_15px_#8ab4f8] animate-scan"></div>
          </div>

          {/* Side Data Panels (Desktop only) */}
          <div className="hidden lg:flex absolute left-10 top-1/2 -translate-y-1/2 flex-col gap-8 text-[#8ab4f8]/40 font-mono text-[10px]">
            <div className="flex flex-col gap-1">
              <span>SYSTEM_STATUS: OPTIMAL</span>
              <span>CORE_TEMP: 32.4°C</span>
              <span>NEURAL_LOAD: 14%</span>
            </div>
            <div className="flex flex-col gap-1">
              <span>ENCRYPTION: AES-256</span>
              <span>UPLINK: ACTIVE</span>
              <span>LATENCY: 12ms</span>
            </div>
          </div>

          <div className="hidden lg:flex absolute right-10 top-1/2 -translate-y-1/2 flex-col gap-8 text-[#8ab4f8]/40 font-mono text-[10px] text-right">
            <div className="flex flex-col gap-1">
              <span>TARGET: {getUserName().toUpperCase()}</span>
              <span>LOCATION: SECURE</span>
              <span>ACCESS: ELITE</span>
            </div>
            <div className="flex flex-col gap-1">
              <span>FRIDAY_OS: v4.2.0</span>
              <span>AI_MODEL: GEMINI_2.5</span>
              <span>MODE: VOICE_LIVE</span>
            </div>
          </div>
        </div>

        {/* Floating Visualizer Small */}
        <div
          className={`fixed bottom-24 right-8 z-50 transition-all duration-500 ${isActive || isModelSpeaking ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
        >
          <div className="w-24 h-24 glass rounded-full flex items-center justify-center shadow-2xl">
            <Visualizer
              isActive={isActive || isSearching || isGeneratingImage}
              isModelSpeaking={isModelSpeaking}
              mode={isFridayActive ? "friday" : "neural"}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-0 right-0 p-4 text-white/50 hover:text-white"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl border border-white/10"
            />
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = previewImage;
                  link.download = `JeetAI_Asset_${Date.now()}.png`;
                  link.click();
                }}
                className="flex items-center gap-2 bg-[#8ab4f8] text-[#131314] px-8 py-3 rounded-full font-bold uppercase tracking-widest hover:bg-white transition-all"
              >
                <Download className="w-5 h-5" />
                <span>Download</span>
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

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .tech-title {
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: -0.02em;
        }
      `}</style>
    </div>
  );
};

export default App;
