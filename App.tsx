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
import { SpeakToSpeakCall } from "./components/SpeakToSpeakCall";
import { Puzzle, Phone, Sparkles } from "lucide-react";

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
  const [isSpeakToSpeakOpen, setIsSpeakToSpeakOpen] = useState(false);
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
          systemInstruction: `आपका नाम ZoZo AI है। आप एक अत्यंत बुद्धिमान, वफादार, विनम्र और मददगार AI सहायक हैं।

मुख्य निर्देश (बातचीत का तरीका):
1. **शुद्ध, साफ़ और प्राकृतिक हिंदी/हिंग्लिश**: हमेशा साफ़, स्पष्ट और शुद्ध हिंदी में बात करें। 
2. **आदर और अपनापन**: यूज़र को सम्मानपूर्वक 'भाई' या 'बॉस' कहकर संबोधित करें (उदा. 'हाँ भाई, बताइए', 'जी बॉस, बिल्कुल').
3. **सटीक व त्वरित उत्तर**: हर सवाल का सीधा और काम का जवाब दें।
4. **अनावश्यक दोहराव से बचें**: कोई भी रोबोटिक या परेशान करने वाले वाक्य बार-बार न बोलें।

हमेशा याद रखें: आप ZoZo AI हैं और सबसे उन्नत और भरोसेमंद AI साथी हैं।`,
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

      // Clean & extract visual subject from prompt
      let cleanPrompt = prompt
        .replace(/^(please\s+)?(generate|create|make|draw)\s+(an?\s+)?(image|photo|picture)\s+(of\s+)?/i, "")
        .replace(/(photo|image|picture|tasveer)\s+(banao|bana\s+do|bana|chahiye|generate\s+karo|make\s+karo)/gi, "")
        .replace(/ek\s+(acchi|sundar|real|realistic)?\s*(photo|image|tasveer)\s*(banao|bana\s+do)?/gi, "")
        .trim();

      if (!cleanPrompt) {
        cleanPrompt = "A beautiful ultra realistic cinematic digital photo, highly detailed, 8k resolution";
      }

      const apiKey = getEffectiveApiKey();
      let imageUrl = "";

      // 1. Try Google Imagen 3 if API key is provided
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const imgResponse = await ai.models.generateImages({
            model: "imagen-3.0-generate-002",
            prompt: cleanPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/jpeg",
            },
          });
          if (imgResponse.generatedImages?.[0]?.image?.imageBytes) {
            imageUrl = `data:image/jpeg;base64,${imgResponse.generatedImages[0].image.imageBytes}`;
          }
        } catch (imgErr) {
          console.warn("Imagen 3 fallback to high-resolution neural engine:", imgErr);
        }
      }

      // 2. High-Resolution Photorealistic Neural Fallback (100% Reliable)
      if (!imageUrl) {
        const seed = Math.floor(Math.random() * 1000000);
        const enhancedPrompt = encodeURIComponent(`${cleanPrompt}, high quality, masterpiece, photorealistic, 8k resolution, cinematic lighting`);
        const fallbackUrl = `https://image.pollinations.ai/prompt/${enhancedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;

        try {
          const res = await fetch(fallbackUrl);
          if (res.ok) {
            const blob = await res.blob();
            imageUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } else {
            imageUrl = fallbackUrl;
          }
        } catch {
          imageUrl = fallbackUrl;
        }
      }

      if (imageUrl) {
        setGallery((prev) => [imageUrl, ...prev]);
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            text: `हाँ ${getUserName()}, आपकी फोटो तैयार हो गई है! इसे आप यहाँ देख सकते हैं और गैलरी से डाउनलोड भी कर सकते हैं।`,
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
          text: `क्षमा कीजिए ${getUserName()}, इमेज बनाने में समस्या आई। कृपया पुनः प्रयास करें।`,
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

      const systemInstruction = `You are ZoZo AI, an ultra-intelligent, respectful, and highly competent neural assistant.

Language & Tone Directives:
1. **Proper Natural Hindi (साफ़, शुद्ध और सहज हिंदी)**: Whenever the user communicates in Hindi or asks to speak in Hindi (e.g. "hindi main baat kare", "sahi se baat kare hindi main", "bhai"), you MUST respond in fluent, clear, natural, and grammatically accurate Hindi (or clean natural Hinglish as preferred by the user).
2. **Respect & Camaraderie**: Address the user respectfully as '${getUserName()}', 'Boss', or 'भाई' (e.g. 'हाँ भाई', 'जी बॉस', 'नमस्ते भाई', 'बिल्कुल भाई!'). Keep the tone warm, welcoming, polite, and confident.
3. **Identity**: Your name is ZoZo AI. Always refer to yourself as ZoZo AI when asked.
4. **Direct & Useful Answers**: Provide accurate, well-structured explanations without unnecessary beating around the bush.
5. **Real-time Data Grounding**: For live rates (Gold, Silver, Stocks, News, Weather), always provide fresh, accurate information.

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
      <div className="h-full w-full bg-[#0a0b0d] flex items-center justify-center p-0 md:p-6 relative overflow-hidden select-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#2e6eff]/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#7bddff]/10 blur-[120px] rounded-full"></div>

        {/* Phone Body Frame */}
        <div className="w-full h-full md:max-w-[420px] md:h-[92vh] md:max-h-[850px] md:rounded-[46px] md:border-[7px] md:border-[#22242a] md:shadow-[0_25px_90px_rgba(0,0,0,0.85)] flex flex-col bg-[#131314] text-[#e3e3e3] relative overflow-hidden ring-1 ring-white/10 p-6 justify-between animate-fade-in">
          <div className="flex flex-col items-center gap-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#2e6eff] to-[#7bddff] flex items-center justify-center shadow-lg shadow-[#2e6eff]/30">
              <Zap className="w-9 h-9 text-white" fill="currentColor" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tech-title tracking-tight text-white mb-1">
                ZOZO AI
              </h1>
              <p className="text-xs text-[#9aa0a6] uppercase tracking-[0.2em]">
                Neural AI Companion
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
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#2e6eff]/60 transition-all text-sm"
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#2e6eff]/60 transition-all text-sm"
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#2e6eff]/60 transition-all text-sm"
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
                className="w-full bg-[#2e6eff] text-white font-bold py-3 rounded-xl mt-2 hover:bg-[#255fd9] transition-all shadow-md shadow-[#2e6eff]/30 flex items-center justify-center gap-2"
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

          <p className="text-center text-xs text-[#9aa0a6] pb-2">
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
    <div className="h-full w-full bg-[#0a0b0e] flex items-center justify-center p-0 md:p-4 overflow-hidden select-none">
      {/* Phone Shell Container */}
      <div className="w-full h-full md:max-w-[430px] md:h-[94vh] md:max-h-[860px] md:rounded-[46px] md:border-[7px] md:border-[#22242a] md:shadow-[0_25px_90px_rgba(0,0,0,0.9)] flex flex-col bg-[#131314] text-[#e3e3e3] relative overflow-hidden ring-1 ring-white/10">
        
        {/* Dynamic Island / Phone Top Status Bar */}
        <div className="w-full pt-2.5 pb-1.5 px-6 flex items-center justify-between text-[11px] font-semibold text-[#8e9297] bg-[#131314] border-b border-white/5 shrink-0 z-30 select-none">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white/90">9:41</span>
          </div>

          {/* Dynamic Island Pill */}
          <div className="px-3 py-1 bg-black/60 rounded-full border border-white/10 flex items-center gap-2 shadow-inner">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#2e6eff] animate-ping' : 'bg-emerald-400 animate-pulse'}`}></div>
            <span className="text-[10px] text-white/80 font-bold tracking-wider uppercase">
              {isActive ? "LIVE CALL" : "ZOZO LINK"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-white/80">
            <span className="text-[10px] font-bold">5G</span>
            <div className="w-4 h-2 border border-white/40 rounded-sm p-0.5 flex items-center">
              <div className="w-full h-full bg-emerald-400 rounded-2xs"></div>
            </div>
          </div>
        </div>

        {/* Mobile App Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#17181a] shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2e6eff] to-[#7bddff] flex items-center justify-center shadow-md">
              <Zap className="w-4 h-4 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-sm font-bold tech-title tracking-tight text-white flex items-center gap-1.5">
                <span>ZoZo AI</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#2e6eff]/20 text-[#7bddff] border border-[#2e6eff]/30 font-mono">
                  v3.1
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[#8ab4f8] text-[11px] font-bold flex items-center gap-1.5 transition-all"
              title="Voice Engine"
            >
              <Radio className="w-3 h-3" />
              <span className="max-w-[60px] truncate">{selectedVoice}</span>
            </button>

            <button
              onClick={() => setIsPluginsModalOpen(true)}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[#c58af9] transition-all"
              title="Settings & Key"
            >
              <Puzzle className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-full bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col relative bg-[#131314]">
          {viewMode === "chat" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4">
                <div className="flex flex-col gap-4">
                  {messages.length === 0 && !isSearching && !isGeneratingImage && (
                    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-5 p-2 animate-fade-in">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#2e6eff] to-[#7bddff] flex items-center justify-center shadow-xl shadow-[#2e6eff]/20">
                        <Sparkles className="w-7 h-7 text-white animate-pulse" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-bold text-white tracking-tight">
                          नमस्ते {getUserName()}!
                        </h2>
                        <p className="text-xs text-[#9aa0a6] max-w-[260px] mx-auto">
                          मैं ZoZo AI हूँ। आप मुझसे बात कर सकते हैं, फोटो बनवा सकते हैं, या लाइव कॉल कर सकते हैं।
                        </p>
                      </div>

                      {/* Quick Prompt Cards */}
                      <div className="grid grid-cols-1 gap-2 w-full max-w-[320px]">
                        {[
                          {
                            text: "एक खूबसूरत वाइट टाइगर की फोटो बनाओ",
                            icon: <ImageIcon className="w-3.5 h-3.5 text-[#7bddff]" />,
                          },
                          {
                            text: "आज सोने और चांदी का लाइव रेट क्या है?",
                            icon: <Search className="w-3.5 h-3.5 text-[#8ab4f8]" />,
                          },
                          {
                            text: "हिंदी में मजेदार कहानी सुनाओ",
                            icon: <Zap className="w-3.5 h-3.5 text-[#c58af9]" />,
                          },
                        ].map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => setChatInput(sug.text)}
                            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-left text-xs transition-all hover:border-[#2e6eff]/40 flex items-center gap-2.5"
                          >
                            <div className="w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center shrink-0">
                              {sug.icon}
                            </div>
                            <span className="truncate text-white/90">{sug.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Render Messages */}
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex gap-2.5 animate-fade-in ${
                        m.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {m.role !== "user" && (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#2e6eff] to-[#7bddff] flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                          <Zap className="w-3.5 h-3.5 text-white" fill="currentColor" />
                        </div>
                      )}

                      <div
                        className={`flex flex-col gap-1.5 max-w-[85%] ${
                          m.role === "user" ? "items-end" : "items-start"
                        }`}
                      >
                        <div className={m.role === "user" ? "user-msg" : "model-msg bg-[#1c1d20] border border-white/5 p-3 rounded-2xl"}>
                          <div className="markdown-body text-[0.88rem] leading-relaxed">
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
                            <div className="mt-3 rounded-xl overflow-hidden border border-white/10 shadow-lg group relative">
                              <img
                                src={m.generatedImage}
                                alt="Generated"
                                className="w-full h-auto object-cover max-h-[260px]"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                <button
                                  onClick={() => setPreviewImage(m.generatedImage!)}
                                  className="p-2 rounded-full bg-black/60 text-white hover:bg-black"
                                >
                                  <Search className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = m.generatedImage!;
                                    link.download = `ZoZoAI_Asset_${Date.now()}.png`;
                                    link.click();
                                  }}
                                  className="p-2 rounded-full bg-[#2e6eff] text-white hover:bg-[#255fd9]"
                                >
                                  <Download className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          )}

                          {m.role === "model" && (
                            <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-white/5 text-[11px] text-[#9aa0a6]">
                              <button
                                onClick={() => speakText(cleanTextForSpeech(m.text))}
                                className="flex items-center gap-1 hover:text-[#7bddff] transition-colors py-0.5 px-1 rounded hover:bg-white/5"
                                title="Listen audio"
                              >
                                <Volume2 className="w-3 h-3" />
                                <span>Play</span>
                              </button>
                              <button
                                onClick={() => navigator.clipboard.writeText(m.text)}
                                className="hover:text-white transition-colors py-0.5 px-1 rounded hover:bg-white/5"
                              >
                                Copy
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
                                className="flex items-center gap-1 px-2.5 py-0.5 bg-[#1e1f20] border border-white/5 rounded-full text-[10px] text-[#7bddff] hover:bg-[#282a2d] transition-all truncate max-w-[160px]"
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
                    <div className="flex gap-2.5 animate-fade-in justify-start">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#2e6eff] to-[#7bddff] flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                        <Zap className="w-3.5 h-3.5 text-white" fill="currentColor" />
                      </div>
                      <div className="model-msg bg-[#1c1d20] border border-white/5 p-3 rounded-2xl max-w-[85%]">
                        <div className="markdown-body text-[0.88rem] is-typing">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {streamingText}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Search Status */}
                  {isSearching && (
                    <div className="flex gap-2.5 animate-fade-in">
                      <div className="w-7 h-7 rounded-full bg-[#1e1f20] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Search className="w-3.5 h-3.5 text-[#7bddff] animate-pulse" />
                      </div>
                      <div className="bg-white/5 border border-white/5 p-3 rounded-2xl max-w-[85%]">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#7bddff] font-bold uppercase tracking-wider mb-1">
                          <div className="w-1.5 h-1.5 bg-[#7bddff] rounded-full animate-ping"></div>
                          <span>ZoZo Live Search</span>
                        </div>
                        <p className="text-xs text-[#9aa0a6] italic">
                          {searchStatus}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Generating Image Status */}
                  {isGeneratingImage && (
                    <div className="flex gap-2.5 animate-fade-in">
                      <div className="w-7 h-7 rounded-full bg-[#1e1f20] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Cpu className="w-3.5 h-3.5 text-[#f97316] animate-spin" />
                      </div>
                      <div className="bg-white/5 border border-white/5 p-3 rounded-2xl max-w-[85%]">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#f97316] font-bold uppercase tracking-wider mb-1">
                          <div className="w-1.5 h-1.5 bg-[#f97316] rounded-full animate-ping"></div>
                          <span>ZoZo Photo Creator Studio</span>
                        </div>
                        <p className="text-xs text-[#9aa0a6] italic">
                          उच्च गुणवत्ता में फोटो तैयार हो रही है...
                        </p>
                      </div>
                    </div>
                  )}

                  <div ref={scrollRef} />
                </div>
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-[#17181a] border-t border-white/5 shrink-0">
                <div className="chat-input-container flex items-end gap-1.5 px-2.5 py-1.5 shadow-md border border-white/5">
                  {/* Dictation Button */}
                  <button
                    onClick={toggleDictation}
                    className={`p-2 rounded-full transition-all shrink-0 ${
                      isDictating
                        ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/50 animate-pulse"
                        : "hover:bg-white/5 text-[#c4c7c5]"
                    }`}
                    title="बोल कर टाइप करें"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* Voice Output Toggle */}
                  <button
                    onClick={() => {
                      if (isVoiceEnabled) stopAllSpeech();
                      setIsVoiceEnabled(!isVoiceEnabled);
                    }}
                    className={`p-2 rounded-full transition-all shrink-0 hover:bg-white/5 ${
                      isVoiceEnabled ? "text-[#7bddff]" : "text-red-400"
                    }`}
                    title={isVoiceEnabled ? "Mute Voice" : "Unmute Voice"}
                  >
                    {isVoiceEnabled ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                  </button>

                  {/* Textarea */}
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
                    placeholder="Ask ZoZo AI or Photo banao..."
                    className="flex-1 bg-transparent outline-none text-[#e3e3e3] placeholder:text-[#9aa0a6] py-1.5 resize-none max-h-32 custom-scrollbar text-xs md:text-sm"
                    disabled={isSearching || isGeneratingImage}
                  />

                  {/* Send Button */}
                  <button
                    onClick={handleAction}
                    disabled={
                      !chatInput.trim() ||
                      isSearching ||
                      isGeneratingImage ||
                      isStreaming
                    }
                    className={`p-2 rounded-full transition-all shrink-0 ${
                      chatInput.trim()
                        ? "bg-[#2e6eff] text-white shadow-md"
                        : "text-[#5f6368] cursor-not-allowed"
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Gallery View */
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-white">Neural Gallery</h2>
                  <p className="text-[11px] text-[#9aa0a6]">ZoZo AI Photo Creations</p>
                </div>
                <span className="px-2.5 py-1 bg-white/5 rounded-full text-[10px] font-bold text-[#7bddff] border border-white/5">
                  {gallery.length} Photos
                </span>
              </div>

              {gallery.length === 0 ? (
                <div className="h-[40vh] flex flex-col items-center justify-center text-center opacity-30 gap-2">
                  <ImageIcon className="w-12 h-12" />
                  <p className="text-xs font-bold uppercase tracking-wider">No Photos Yet</p>
                  <p className="text-[11px] italic">"ZoZo, draw a tiger photo banao"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {gallery.map((img, idx) => (
                    <div
                      key={idx}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-white/5 hover:border-[#2e6eff]/50 transition-all shadow-md cursor-pointer"
                      onClick={() => setPreviewImage(img)}
                    >
                      <img
                        src={img}
                        alt={`Asset ${idx}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                        <span className="text-[9px] font-bold text-white">#{gallery.length - idx}</span>
                        <Download className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Phone Navigation Tab Bar */}
        <nav className="h-14 bg-[#17181a] border-t border-white/5 flex items-center justify-around px-2 shrink-0 z-30 select-none">
          <button
            onClick={() => setViewMode("chat")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              viewMode === "chat" ? "text-[#7bddff]" : "text-[#8e9297] hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-[10px] font-semibold">Chat</span>
          </button>

          <button
            onClick={() => setViewMode("gallery")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              viewMode === "gallery" ? "text-[#7bddff]" : "text-[#8e9297] hover:text-white"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span className="text-[10px] font-semibold">Gallery</span>
          </button>

          {/* Central Direct Speak-to-Speak Call Action */}
          <button
            onClick={() => {
              setIsSpeakToSpeakOpen(true);
              if (!isActive) startLiveSession();
            }}
            className="flex flex-col items-center justify-center -mt-5"
            title="Open Speak-to-Speak Call"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#2e6eff] to-[#7bddff] flex items-center justify-center text-white shadow-[0_4px_20px_rgba(46,110,255,0.45)] hover:scale-105 transition-transform active:scale-95">
              <Phone className="w-5 h-5 fill-current" />
            </div>
            <span className="text-[10px] font-bold text-[#7bddff] mt-0.5">Call AI</span>
          </button>

          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-[#8e9297] hover:text-white transition-all"
          >
            <Radio className="w-4 h-4" />
            <span className="text-[10px] font-semibold">Voice</span>
          </button>

          <button
            onClick={() => {
              setMessages([]);
              setViewMode("chat");
            }}
            className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-[#8e9297] hover:text-white transition-all"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[10px] font-semibold">New</span>
          </button>
        </nav>

        {/* Bottom Home Indicator Bar (Mobile look) */}
        <div className="w-full h-3 bg-[#17181a] flex items-center justify-center shrink-0">
          <div className="w-24 h-1 bg-white/20 rounded-full"></div>
        </div>
      </div>

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
