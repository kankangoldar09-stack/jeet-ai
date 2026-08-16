import React, { useState } from 'react';
import {
  X,
  Play,
  Search,
  Music,
  ExternalLink,
  Volume2,
  ListMusic,
  Sparkles,
  Maximize2,
  Minimize2,
  Flame,
  Radio
} from 'lucide-react';

interface YouTubeSong {
  title: string;
  artist: string;
  videoId: string;
  category: string;
  thumbnail?: string;
}

const POPULAR_SONGS: YouTubeSong[] = [
  {
    title: 'Kesariya (Brahmāstra)',
    artist: 'Arijit Singh, Pritam',
    videoId: 'BddP6PYo2gs',
    category: 'Bollywood Romance',
  },
  {
    title: 'Tauba Tauba (Bad Newz)',
    artist: 'Karan Aujla',
    videoId: 'LK7-_dgAVQE',
    category: 'Trending Punjabi',
  },
  {
    title: 'Chaleya (Jawan)',
    artist: 'Arijit Singh, Shilpa Rao',
    videoId: 'VAdGW7QDJUI',
    category: 'Bollywood Dance',
  },
  {
    title: 'Apna Bana Le (Bhediya)',
    artist: 'Arijit Singh, Sachin-Jigar',
    videoId: 'ElZfdU54Cp8',
    category: 'Romantic Melodies',
  },
  {
    title: 'Softly',
    artist: 'Karan Aujla, Ikky',
    videoId: 'cWMxCE2HTag',
    category: 'Punjabi Hits',
  },
  {
    title: 'Pehle Bhi Main (Animal)',
    artist: 'Vishal Mishra, Raj Shekhar',
    videoId: '0mHsmW3i6iE',
    category: 'Soulful Bollywood',
  },
  {
    title: 'Hindi Lofi Chill Beats 24/7',
    artist: 'Lofi Records Live',
    videoId: 'turbg7WcEwM',
    category: 'Lofi & Study',
  },
  {
    title: 'Illuminati (Aavesham)',
    artist: 'Sushin Shyam, Dabzee',
    videoId: 'tOM-nWPcR4U',
    category: 'South Viral Hit',
  },
];

interface YouTubePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  defaultQuery?: string;
  autoPlayVideoId?: string;
}

export const YouTubePlayerModal: React.FC<YouTubePlayerModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  defaultQuery = '',
  autoPlayVideoId = '',
}) => {
  const queryToUse = defaultQuery || initialQuery;
  const [searchQuery, setSearchQuery] = useState(queryToUse);
  const [currentVideoId, setCurrentVideoId] = useState<string>(
    autoPlayVideoId || POPULAR_SONGS[0].videoId
  );
  const [currentTitle, setCurrentTitle] = useState<string>(POPULAR_SONGS[0].title);
  const [currentArtist, setCurrentArtist] = useState<string>(POPULAR_SONGS[0].artist);
  const [isExpanded, setIsExpanded] = useState(false);
  const [customSearchId, setCustomSearchId] = useState<string | null>(null);

  React.useEffect(() => {
    if (queryToUse) {
      setSearchQuery(queryToUse);
      const matched = POPULAR_SONGS.find((s) =>
        s.title.toLowerCase().includes(queryToUse.toLowerCase()) ||
        s.artist.toLowerCase().includes(queryToUse.toLowerCase())
      );
      if (matched) {
        setCurrentVideoId(matched.videoId);
        setCurrentTitle(matched.title);
        setCurrentArtist(matched.artist);
      }
    }
  }, [queryToUse]);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check if user pasted a direct YouTube link
    const ytMatch = searchQuery.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      setCurrentVideoId(ytMatch[1]);
      setCurrentTitle(`Custom YouTube Video`);
      setCurrentArtist(`Playing from URL`);
      setCustomSearchId(ytMatch[1]);
      return;
    }

    // Match with popular song or use fallback YouTube search embed
    const matched = POPULAR_SONGS.find((s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matched) {
      setCurrentVideoId(matched.videoId);
      setCurrentTitle(matched.title);
      setCurrentArtist(matched.artist);
    } else {
      // Direct YouTube search keyword embed URL query
      setCurrentTitle(`Search: "${searchQuery}"`);
      setCurrentArtist(`YouTube Live Stream`);
      // We will embed with search
      setCustomSearchId(encodeURIComponent(searchQuery));
    }
  };

  const selectSong = (song: YouTubeSong) => {
    setCurrentVideoId(song.videoId);
    setCurrentTitle(song.title);
    setCurrentArtist(song.artist);
    setCustomSearchId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div
        className={`relative w-full ${
          isExpanded ? 'max-w-5xl h-[92vh]' : 'max-w-3xl max-h-[90vh]'
        } bg-[#121316] border border-red-500/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10 animate-scale-up`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#16171b]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-400 flex items-center justify-center text-white shadow-md shadow-red-600/30">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-black text-white">ZoZo YouTube Music</h3>
                <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wider">
                  Live Player
                </span>
              </div>
              <p className="text-xs text-[#9aa0a6] truncate max-w-xs">
                {currentTitle} · {currentArtist}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-[#9aa0a6] hover:text-white hover:bg-white/5 rounded-xl transition-all hidden sm:block"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#9aa0a6] hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 md:px-5 bg-[#18191d] border-b border-white/5">
          <form onSubmit={handleSearch} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9aa0a6] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Gaana ya artist ka naam likho (e.g. Arijit Singh, Kesariya, Punjabi hits...)"
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs md:text-sm placeholder-[#6b7280] focus:outline-none focus:border-red-500/60 focus:bg-white/[0.08] transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-600/25 hover:scale-105 active:scale-95 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play Song</span>
            </button>
          </form>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col gap-4 custom-scrollbar">
          {/* Active YouTube Video IFrame */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black shadow-2xl">
            <iframe
              className="w-full h-full"
              src={
                customSearchId && isNaN(Number(customSearchId)) && !customSearchId.includes('-')
                  ? `https://www.youtube.com/embed?listType=search&list=${customSearchId}&autoplay=1`
                  : `https://www.youtube-nocookie.com/embed/${currentVideoId}?autoplay=1&rel=0&modestbranding=1`
              }
              title={currentTitle}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* Quick Playlist & Trending Songs */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#e3e3e3]">
                <Flame className="w-4 h-4 text-orange-400" />
                <span>Trending Indian Hits & Playlists</span>
              </div>
              <span className="text-[11px] text-[#9aa0a6]">Click to Play Instant</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {POPULAR_SONGS.map((song) => {
                const isPlaying = currentVideoId === song.videoId;
                return (
                  <button
                    key={song.videoId}
                    onClick={() => selectSong(song)}
                    className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all group ${
                      isPlaying
                        ? 'bg-red-600/15 border-red-500/40 text-white shadow-md shadow-red-600/10 ring-1 ring-red-500/30'
                        : 'bg-white/[0.03] border-white/5 text-[#c4c7c5] hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isPlaying
                            ? 'bg-red-600 text-white shadow-md'
                            : 'bg-white/5 text-[#9aa0a6] group-hover:text-white group-hover:bg-red-600/20'
                        }`}
                      >
                        {isPlaying ? (
                          <Volume2 className="w-4 h-4 animate-bounce" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-red-300 transition-colors">
                          {song.title}
                        </h4>
                        <p className="text-[11px] text-[#9aa0a6] truncate">{song.artist}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[#9aa0a6] font-medium shrink-0 ml-2">
                      {song.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#16171b] border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#9aa0a6]">
            <Sparkles className="w-4 h-4 text-red-400" />
            <span>ZoZo AI can play any YouTube song or playlist on voice command</span>
          </div>
          <a
            href={`https://www.youtube.com/watch?v=${currentVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <span>Open on YouTube</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
