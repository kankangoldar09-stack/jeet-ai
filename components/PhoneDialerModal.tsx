import React, { useState } from 'react';
import {
  X,
  Phone,
  PhoneCall,
  Delete,
  User,
  ShieldAlert,
  Flame,
  Search,
  Clock,
  Check,
  Sparkles,
  PhoneOff
} from 'lucide-react';

interface Contact {
  name: string;
  number: string;
  label: string;
  category: 'emergency' | 'utility' | 'personal';
  avatarBg?: string;
}

const DEFAULT_CONTACTS: Contact[] = [
  { name: 'National Emergency', number: '112', label: 'All-in-One Helpline', category: 'emergency', avatarBg: 'bg-red-500' },
  { name: 'Police Control Room', number: '100', label: 'Police Assistance', category: 'emergency', avatarBg: 'bg-blue-600' },
  { name: 'Ambulance Medical', number: '108', label: 'Emergency Health', category: 'emergency', avatarBg: 'bg-emerald-600' },
  { name: 'Indian Railway Enquiry', number: '139', label: 'Rail Madad / Info', category: 'utility', avatarBg: 'bg-amber-600' },
  { name: 'Women Safety Helpline', number: '1091', label: '24x7 Safety', category: 'emergency', avatarBg: 'bg-pink-600' },
  { name: 'Jeet Boss (Creator)', number: '+91 98765 43210', label: 'VIP Creator Contact', category: 'personal', avatarBg: 'bg-purple-600' },
];

interface PhoneDialerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartAiCall?: () => void;
  initialNumber?: string;
}

export const PhoneDialerModal: React.FC<PhoneDialerModalProps> = ({
  isOpen,
  onClose,
  onStartAiCall,
  initialNumber = '',
}) => {
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);
  const [activeTab, setActiveTab] = useState<'keypad' | 'contacts'>('keypad');
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (phoneNumber.length < 15) {
      setPhoneNumber((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber('');
  };

  const triggerRealCall = (num: string) => {
    const cleanNum = num.replace(/\s+/g, '');
    if (!cleanNum) return;
    // Launch device dialer
    window.location.href = `tel:${cleanNum}`;
  };

  const keypadButtons = [
    { num: '1', sub: '' },
    { num: '2', sub: 'ABC' },
    { num: '3', sub: 'DEF' },
    { num: '4', sub: 'GHI' },
    { num: '5', sub: 'JKL' },
    { num: '6', sub: 'MNO' },
    { num: '7', sub: 'PQRS' },
    { num: '8', sub: 'TUV' },
    { num: '9', sub: 'WXYZ' },
    { num: '*', sub: '' },
    { num: '0', sub: '+' },
    { num: '#', sub: '' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-[#121316] border border-[#2e6eff]/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#16171b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Phone className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">ZoZo Smart Dialer</h3>
              <p className="text-[11px] text-[#9aa0a6]">Direct Call & Emergency Dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#9aa0a6] hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-white/10 bg-[#141518]">
          <button
            onClick={() => setActiveTab('keypad')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'keypad'
                ? 'border-[#2e6eff] text-white bg-[#2e6eff]/10'
                : 'border-transparent text-[#9aa0a6] hover:text-white'
            }`}
          >
            Keypad
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'contacts'
                ? 'border-[#2e6eff] text-white bg-[#2e6eff]/10'
                : 'border-transparent text-[#9aa0a6] hover:text-white'
            }`}
          >
            Directory & SOS ({DEFAULT_CONTACTS.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'keypad' ? (
          <div className="p-5 flex flex-col items-center">
            {/* Number Display */}
            <div className="w-full h-14 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-between px-4 mb-4">
              <div className="text-xl sm:text-2xl font-black tracking-wider text-white truncate font-mono">
                {phoneNumber || <span className="text-[#6b7280] font-sans text-sm">Number dial karein...</span>}
              </div>
              {phoneNumber && (
                <button
                  onClick={handleDelete}
                  className="p-2 text-[#9aa0a6] hover:text-red-400 transition-colors"
                >
                  <Delete className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
              {keypadButtons.map((btn) => (
                <button
                  key={btn.num}
                  onClick={() => handleDigit(btn.num)}
                  className="h-14 rounded-2xl bg-white/[0.04] hover:bg-white/[0.1] active:bg-[#2e6eff]/30 border border-white/5 active:scale-95 flex flex-col items-center justify-center transition-all group"
                >
                  <span className="text-xl font-bold text-white group-hover:text-[#7bddff]">
                    {btn.num}
                  </span>
                  {btn.sub && (
                    <span className="text-[9px] font-semibold text-[#6b7280] tracking-widest uppercase">
                      {btn.sub}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full max-w-[280px] mt-4">
              {/* Call button */}
              <button
                onClick={() => triggerRealCall(phoneNumber)}
                disabled={!phoneNumber}
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 hover:scale-[1.02] active:scale-95 transition-all text-sm"
              >
                <PhoneCall className="w-5 h-5 fill-current" />
                <span>Call Now</span>
              </button>

              {/* AI Voice Call */}
              {onStartAiCall && (
                <button
                  onClick={() => {
                    onClose();
                    onStartAiCall();
                  }}
                  className="p-3.5 bg-[#2e6eff]/20 hover:bg-[#2e6eff]/30 text-[#7bddff] border border-[#2e6eff]/40 rounded-2xl flex items-center justify-center transition-all hover:scale-105"
                  title="ZoZo AI Direct Voice Call"
                >
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 max-h-[380px] overflow-y-auto custom-scrollbar flex flex-col gap-2">
            <div className="text-[11px] font-bold text-[#9aa0a6] uppercase tracking-wider mb-1 px-1">
              Quick Speed Dials & Safety Numbers
            </div>

            {DEFAULT_CONTACTS.map((c) => (
              <div
                key={c.number}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl ${c.avatarBg} text-white flex items-center justify-center font-black text-xs shadow-md shrink-0`}
                  >
                    {c.category === 'emergency' ? <ShieldAlert className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-[#7bddff] transition-colors">
                      {c.name}
                    </h4>
                    <p className="text-[11px] text-[#9aa0a6]">{c.label}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setPhoneNumber(c.number);
                      setActiveTab('keypad');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-mono"
                  >
                    {c.number}
                  </button>
                  <button
                    onClick={() => triggerRealCall(c.number)}
                    className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 hover:scale-105 active:scale-95 transition-all"
                  >
                    <PhoneCall className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#16171b] border-t border-white/10 text-center">
          <p className="text-[10px] text-[#9aa0a6]">
            Supports one-click direct dialing and mobile native phone launch
          </p>
        </div>
      </div>
    </div>
  );
};
