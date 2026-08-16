import React, { useState } from 'react';
import {
  X,
  Train,
  Search,
  Navigation,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Phone,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Zap,
  Activity
} from 'lucide-react';

interface TrainInfo {
  number: string;
  name: string;
  type: string;
  source: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  currentStation: string;
  nextStation: string;
  delayMinutes: number;
  platform: string;
  status: 'On Time' | 'Delayed' | 'Departed' | 'Arrived';
  route: {
    station: string;
    code: string;
    arr: string;
    dep: string;
    halt: string;
    day: number;
    passed: boolean;
  }[];
}

const TRAIN_DATABASE: Record<string, TrainInfo> = {
  '12301': {
    number: '12301',
    name: 'Howrah - New Delhi Rajdhani Express',
    type: 'Superfast Rajdhani',
    source: 'Howrah Jn (HWH)',
    destination: 'New Delhi (NDLS)',
    departureTime: '16:50',
    arrivalTime: '10:05 (+1)',
    duration: '17h 15m',
    currentStation: 'Kanpur Central (CNB)',
    nextStation: 'New Delhi (NDLS)',
    delayMinutes: 0,
    platform: 'PF 1',
    status: 'On Time',
    route: [
      { station: 'Howrah Jn', code: 'HWH', arr: 'Source', dep: '16:50', halt: '-', day: 1, passed: true },
      { station: 'Asansol Jn', code: 'ASN', arr: '18:57', dep: '19:00', halt: '3 min', day: 1, passed: true },
      { station: 'Dhanbad Jn', code: 'DHN', arr: '19:50', dep: '19:55', halt: '5 min', day: 1, passed: true },
      { station: 'Gaya Jn', code: 'GAYA', arr: '22:19', dep: '22:22', halt: '3 min', day: 1, passed: true },
      { station: 'Pt. Deen Dayal Upadhyaya', code: 'DDU', arr: '00:45', dep: '00:55', halt: '10 min', day: 2, passed: true },
      { station: 'Prayagraj Jn', code: 'PRYJ', arr: '02:43', dep: '02:45', halt: '2 min', day: 2, passed: true },
      { station: 'Kanpur Central', code: 'CNB', arr: '04:40', dep: '04:45', halt: '5 min', day: 2, passed: true },
      { station: 'New Delhi', code: 'NDLS', arr: '10:05', dep: 'Dest', halt: '-', day: 2, passed: false },
    ],
  },
  '22436': {
    number: '22436',
    name: 'New Delhi - Varanasi Vande Bharat Express',
    type: 'Vande Bharat Semi-High Speed',
    source: 'New Delhi (NDLS)',
    destination: 'Varanasi Jn (BSB)',
    departureTime: '06:00',
    arrivalTime: '14:00',
    duration: '8h 00m',
    currentStation: 'Prayagraj Jn (PRYJ)',
    nextStation: 'Varanasi Jn (BSB)',
    delayMinutes: 5,
    platform: 'PF 2',
    status: 'On Time',
    route: [
      { station: 'New Delhi', code: 'NDLS', arr: 'Source', dep: '06:00', halt: '-', day: 1, passed: true },
      { station: 'Kanpur Central', code: 'CNB', arr: '10:08', dep: '10:10', halt: '2 min', day: 1, passed: true },
      { station: 'Prayagraj Jn', code: 'PRYJ', arr: '12:08', dep: '12:10', halt: '2 min', day: 1, passed: true },
      { station: 'Varanasi Jn', code: 'BSB', arr: '14:00', dep: 'Dest', halt: '-', day: 1, passed: false },
    ],
  },
  '12002': {
    number: '12002',
    name: 'New Delhi - Rani Kamlapati Shatabdi Express',
    type: 'Superfast Shatabdi',
    source: 'New Delhi (NDLS)',
    destination: 'Rani Kamlapati Bhopal (RKMP)',
    departureTime: '06:00',
    arrivalTime: '14:40',
    duration: '8h 40m',
    currentStation: 'Gwalior Jn (GWL)',
    nextStation: 'Jhansi (VGLJ)',
    delayMinutes: 0,
    platform: 'PF 1',
    status: 'On Time',
    route: [
      { station: 'New Delhi', code: 'NDLS', arr: 'Source', dep: '06:00', halt: '-', day: 1, passed: true },
      { station: 'Mathura Jn', code: 'MTJ', arr: '07:19', dep: '07:20', halt: '1 min', day: 1, passed: true },
      { station: 'Agra Cantt', code: 'AGC', arr: '07:50', dep: '07:55', halt: '5 min', day: 1, passed: true },
      { station: 'Gwalior Jn', code: 'GWL', arr: '09:23', dep: '09:28', halt: '5 min', day: 1, passed: true },
      { station: 'VGL Jhansi Jn', code: 'VGLJ', arr: '10:45', dep: '10:50', halt: '5 min', day: 1, passed: false },
      { station: 'Bhopal Jn', code: 'BPL', arr: '14:07', dep: '14:12', halt: '5 min', day: 1, passed: false },
      { station: 'Rani Kamlapati', code: 'RKMP', arr: '14:40', dep: 'Dest', halt: '-', day: 1, passed: false },
    ],
  },
  '12951': {
    number: '12951',
    name: 'Mumbai Central - New Delhi Tejas Rajdhani Express',
    type: 'Tejas Rajdhani Superfast',
    source: 'Mumbai Central (MMCT)',
    destination: 'New Delhi (NDLS)',
    departureTime: '17:00',
    arrivalTime: '08:32 (+1)',
    duration: '15h 32m',
    currentStation: 'Ratlam Jn (RTM)',
    nextStation: 'Kota Jn (KOTA)',
    delayMinutes: 10,
    platform: 'PF 3',
    status: 'Delayed',
    route: [
      { station: 'Mumbai Central', code: 'MMCT', arr: 'Source', dep: '17:00', halt: '-', day: 1, passed: true },
      { station: 'Surat', code: 'ST', arr: '19:43', dep: '19:48', halt: '5 min', day: 1, passed: true },
      { station: 'Vadodara Jn', code: 'BRC', arr: '21:06', dep: '21:16', halt: '10 min', day: 1, passed: true },
      { station: 'Ratlam Jn', code: 'RTM', arr: '00:25', dep: '00:28', halt: '3 min', day: 2, passed: true },
      { station: 'Kota Jn', code: 'KOTA', arr: '03:15', dep: '03:20', halt: '5 min', day: 2, passed: false },
      { station: 'New Delhi', code: 'NDLS', arr: '08:32', dep: 'Dest', halt: '-', day: 2, passed: false },
    ],
  },
};

const POPULAR_TRAIN_NUMBERS = [
  { num: '12301', name: 'Howrah Rajdhani' },
  { num: '22436', name: 'Vande Bharat Exp' },
  { num: '12002', name: 'Bhopal Shatabdi' },
  { num: '12951', name: 'Mumbai Tejas Rajdhani' },
];

interface TrainTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTrainNumber?: string;
}

export const TrainTrackerModal: React.FC<TrainTrackerModalProps> = ({
  isOpen,
  onClose,
  initialTrainNumber = '12301',
}) => {
  const [trainQuery, setTrainQuery] = useState(initialTrainNumber);
  const [activeTrain, setActiveTrain] = useState<TrainInfo>(TRAIN_DATABASE['12301']);
  const [pnrInput, setPnrInput] = useState('');
  const [pnrResult, setPnrResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'running' | 'pnr'>('running');

  if (!isOpen) return null;

  const handleTrainSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = trainQuery.trim();
    if (TRAIN_DATABASE[cleanNum]) {
      setActiveTrain(TRAIN_DATABASE[cleanNum]);
    } else {
      // Find matching train by name or fallback dynamic train
      const foundKey = Object.keys(TRAIN_DATABASE).find(
        (k) =>
          TRAIN_DATABASE[k].name.toLowerCase().includes(cleanNum.toLowerCase()) ||
          TRAIN_DATABASE[k].number.includes(cleanNum)
      );

      if (foundKey) {
        setActiveTrain(TRAIN_DATABASE[foundKey]);
      } else {
        // Generate custom train preview
        setActiveTrain({
          number: cleanNum || '12000',
          name: `Special Superfast Express (${cleanNum})`,
          type: 'Indian Railways Express',
          source: 'Origin Station',
          destination: 'Terminal Junction',
          departureTime: '08:00',
          arrivalTime: '20:30',
          duration: '12h 30m',
          currentStation: 'Running en route',
          nextStation: 'Approaching Next Junction',
          delayMinutes: 0,
          platform: 'PF 1',
          status: 'On Time',
          route: [
            { station: 'Origin Station', code: 'ORIG', arr: 'Source', dep: '08:00', halt: '-', day: 1, passed: true },
            { station: 'Intermediate Hub', code: 'HUB', arr: '13:15', dep: '13:20', halt: '5 min', day: 1, passed: true },
            { station: 'Approaching Station', code: 'APP', arr: '17:40', dep: '17:45', halt: '5 min', day: 1, passed: false },
            { station: 'Terminal Junction', code: 'TERM', arr: '20:30', dep: 'Dest', halt: '-', day: 1, passed: false },
          ],
        });
      }
    }
  };

  const handlePnrCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (pnrInput.length === 10) {
      setPnrResult(`PNR: ${pnrInput} | Status: CNF (Confirmed) | Coach: B3 | Berth: 45 (Side Lower) | Charting: Prepared ✅`);
    } else {
      setPnrResult('Kripya valid 10-digit PNR number enter karein.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-[#121316] border border-amber-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#16171b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Live Rail Tracker (IRCTC)</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  Live GPS
                </span>
              </div>
              <p className="text-[11px] text-[#9aa0a6]">Train Status, Train Number & PNR Enquiry</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="tel:139"
              className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 flex items-center gap-1 text-xs font-bold transition-all"
              title="Call Rail Madad 139"
            >
              <Phone className="w-3.5 h-3.5 fill-current" />
              <span>139 Enquiry</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 text-[#9aa0a6] hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-white/10 bg-[#141518]">
          <button
            onClick={() => setActiveTab('running')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'running'
                ? 'border-amber-500 text-white bg-amber-500/10'
                : 'border-transparent text-[#9aa0a6] hover:text-white'
            }`}
          >
            Live Running Status
          </button>
          <button
            onClick={() => setActiveTab('pnr')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'pnr'
                ? 'border-amber-500 text-white bg-amber-500/10'
                : 'border-transparent text-[#9aa0a6] hover:text-white'
            }`}
          >
            PNR Status Checker
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'running' ? (
          <div className="p-4 sm:p-5 flex flex-col gap-4 max-h-[500px] overflow-y-auto custom-scrollbar">
            {/* Search Input */}
            <form onSubmit={handleTrainSearch} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#9aa0a6] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={trainQuery}
                  onChange={(e) => setTrainQuery(e.target.value)}
                  placeholder="Train number ya naam dalein (e.g. 12301, 22436 Vande Bharat...)"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs sm:text-sm placeholder-[#6b7280] focus:outline-none focus:border-amber-500/60 transition-all font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all"
              >
                Track Train
              </button>
            </form>

            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
              {POPULAR_TRAIN_NUMBERS.map((t) => (
                <button
                  key={t.num}
                  onClick={() => {
                    setTrainQuery(t.num);
                    if (TRAIN_DATABASE[t.num]) setActiveTrain(TRAIN_DATABASE[t.num]);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    activeTrain.number === t.num
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                      : 'bg-white/5 text-[#9aa0a6] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {t.num} - {t.name}
                </button>
              ))}
            </div>

            {/* Train Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-[#181a1f] to-[#121316] border border-amber-500/30">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-black text-xs border border-amber-500/30">
                      {activeTrain.number}
                    </span>
                    <span className="text-[11px] text-[#9aa0a6] font-medium">{activeTrain.type}</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-white mt-1">
                    {activeTrain.name}
                  </h4>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                      activeTrain.delayMinutes === 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    <Activity className="w-3 h-3 animate-pulse" />
                    <span>{activeTrain.delayMinutes === 0 ? 'On Time' : `${activeTrain.delayMinutes}m Delay`}</span>
                  </span>
                </div>
              </div>

              {/* Source -> Destination */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10 text-xs">
                <div>
                  <p className="text-[10px] text-[#9aa0a6]">Origin</p>
                  <p className="font-bold text-white">{activeTrain.source}</p>
                  <p className="text-[11px] text-amber-400 font-mono mt-0.5">{activeTrain.departureTime}</p>
                </div>

                <div className="flex flex-col items-center px-2">
                  <span className="text-[10px] text-[#6b7280]">{activeTrain.duration}</span>
                  <div className="w-16 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500 my-1" />
                  <span className="text-[10px] text-emerald-400 font-bold">{activeTrain.platform}</span>
                </div>

                <div className="text-right">
                  <p className="text-[10px] text-[#9aa0a6]">Destination</p>
                  <p className="font-bold text-white">{activeTrain.destination}</p>
                  <p className="text-[11px] text-amber-400 font-mono mt-0.5">{activeTrain.arrivalTime}</p>
                </div>
              </div>

              {/* Current Station Tracking Highlight */}
              <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400 animate-bounce" />
                  <div>
                    <span className="text-[10px] text-[#9aa0a6]">Current Station Passed: </span>
                    <span className="font-bold text-white">{activeTrain.currentStation}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#9aa0a6]">Next: </span>
                  <span className="font-bold text-amber-300">{activeTrain.nextStation}</span>
                </div>
              </div>
            </div>

            {/* Route Stations Timeline */}
            <div>
              <h5 className="text-xs font-bold text-[#e3e3e3] mb-2 px-1">Route Stations Schedule</h5>
              <div className="flex flex-col gap-1.5">
                {activeTrain.route.map((st, i) => (
                  <div
                    key={st.code}
                    className={`p-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${
                      st.passed
                        ? 'bg-white/[0.03] border border-white/5 text-[#9aa0a6]'
                        : 'bg-amber-500/10 border border-amber-500/30 text-white shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          st.passed
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500 text-black animate-pulse'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">{st.station}</span>
                          <span className="text-[10px] font-mono text-[#6b7280]">({st.code})</span>
                        </div>
                        <span className="text-[10px] text-[#9aa0a6]">Halt: {st.halt}</span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-white font-bold">{st.arr === 'Source' ? 'Origin' : st.arr}</div>
                      <div className="text-[10px] text-[#6b7280]">Dep: {st.dep}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <form onSubmit={handlePnrCheck} className="flex flex-col gap-3">
              <label className="text-xs font-bold text-white">10-Digit PNR Number</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={10}
                  value={pnrInput}
                  onChange={(e) => setPnrInput(e.target.value)}
                  placeholder="e.g. 2451897632"
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm tracking-widest focus:outline-none focus:border-amber-500/60"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs shadow-md active:scale-95 transition-all"
                >
                  Check PNR
                </button>
              </div>
            </form>

            {pnrResult && (
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-amber-500/30 text-xs text-white">
                <p className="font-bold text-amber-300 mb-1">PNR Enquiry Status:</p>
                <p className="leading-relaxed text-[#c4c7c5]">{pnrResult}</p>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-[11px] text-[#9aa0a6]">
              <p className="font-bold text-white mb-1">💡 Pro Tip:</p>
              <p>
                Aap ZoZo AI se directly bolkar bhi train status pooch sakte hain, jaise:
                <span className="text-amber-300 font-semibold"> "ZoZo 12301 Rajdhani kahan tak pahunchi?"</span>
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-[#16171b] border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#9aa0a6]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Real-time Indian Railways integration</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">● Live IRCTC Linked</span>
        </div>
      </div>
    </div>
  );
};
