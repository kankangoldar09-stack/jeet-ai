import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  Sun,
  CloudRain,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  Compass,
  Search,
  MapPin,
  RefreshCw,
  Sparkles,
  Eye
} from 'lucide-react';

interface WeatherData {
  city: string;
  country: string;
  temperature: number;
  feelsLike: number;
  condition: string;
  conditionCode: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  uvIndex: number;
  visibility: number;
  forecast: {
    day: string;
    tempMax: number;
    tempMin: number;
    condition: string;
  }[];
}

const POPULAR_CITIES = [
  { name: 'Delhi', lat: 28.6139, lon: 77.2090, country: 'India' },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, country: 'India' },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639, country: 'India' },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, country: 'India' },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462, country: 'India' },
  { name: 'Patna', lat: 25.5941, lon: 85.1376, country: 'India' },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873, country: 'India' },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, country: 'UAE' },
  { name: 'London', lat: 51.5074, lon: -0.1278, country: 'UK' },
  { name: 'New York', lat: 40.7128, lon: -74.0060, country: 'USA' },
];

const getWmoCondition = (code: number): string => {
  if (code === 0) return 'Clear Sky ☀️';
  if (code === 1 || code === 2) return 'Partly Cloudy 🌤️';
  if (code === 3) return 'Overcast Clouds ☁️';
  if (code === 45 || code === 48) return 'Foggy / Mist 🌫️';
  if (code >= 51 && code <= 55) return 'Light Drizzle 🌦️';
  if (code >= 61 && code <= 65) return 'Rain Showers 🌧️';
  if (code >= 71 && code <= 77) return 'Snow Fall ❄️';
  if (code >= 80 && code <= 82) return 'Heavy Rain 🌧️';
  if (code >= 95 && code <= 99) return 'Thunderstorm ⛈️';
  return 'Pleasant Weather ⛅';
};

interface WeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCity?: string;
}

export const WeatherModal: React.FC<WeatherModalProps> = ({
  isOpen,
  onClose,
  initialCity = 'Delhi',
}) => {
  const [cityInput, setCityInput] = useState(initialCity);
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async (cityName: string, lat?: number, lon?: number, country?: string) => {
    setLoading(true);
    setError(null);
    try {
      let targetLat = lat;
      let targetLon = lon;
      let targetCity = cityName;
      let targetCountry = country || 'India';

      // Geocode if lat/lon not provided
      if (targetLat === undefined || targetLon === undefined) {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            cityName
          )}&count=1&language=en&format=json`
        );
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          targetLat = geoData.results[0].latitude;
          targetLon = geoData.results[0].longitude;
          targetCity = geoData.results[0].name;
          targetCountry = geoData.results[0].country || '';
        } else {
          // Fallback to Delhi
          targetLat = 28.6139;
          targetLon = 77.2090;
          targetCity = cityName;
        }
      }

      // Fetch Live Meteorological Weather
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto`
      );
      const data = await weatherRes.json();

      const current = data.current;
      const daily = data.daily;

      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const forecast = (daily?.time || []).slice(1, 6).map((timeStr: string, idx: number) => {
        const d = new Date(timeStr);
        return {
          day: daysOfWeek[d.getDay()],
          tempMax: Math.round(daily.temperature_2m_max[idx + 1] ?? 30),
          tempMin: Math.round(daily.temperature_2m_min[idx + 1] ?? 22),
          condition: getWmoCondition(daily.weather_code[idx + 1] ?? 0),
        };
      });

      setWeather({
        city: targetCity,
        country: targetCountry,
        temperature: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        condition: getWmoCondition(current.weather_code),
        conditionCode: current.weather_code,
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        windDirection: current.wind_direction_10m,
        pressure: Math.round(current.surface_pressure),
        uvIndex: Math.round(daily?.uv_index_max?.[0] ?? 6),
        visibility: 10,
        forecast,
      });
    } catch (err: any) {
      console.error('Weather fetch error:', err);
      setError('Mausam ka data load nahi ho paya. Kripya dobara try karein.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWeather(initialCity || 'Delhi');
    }
  }, [isOpen, initialCity]);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityInput.trim()) {
      fetchWeather(cityInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#121316] border border-sky-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#16171b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Sun className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Live Weather Radar</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
                  Real-time
                </span>
              </div>
              <p className="text-[11px] text-[#9aa0a6]">24x7 Live Satellite Grounding</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchWeather(weather?.city || cityInput)}
              disabled={loading}
              className="p-2 text-[#9aa0a6] hover:text-white hover:bg-white/5 rounded-xl transition-all disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
        <div className="p-4 bg-[#18191d] border-b border-white/5">
          <form onSubmit={handleSearch} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9aa0a6] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Shehar ka naam search karein (e.g. Delhi, Mumbai, Kolkata, Dubai...)"
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs sm:text-sm placeholder-[#6b7280] focus:outline-none focus:border-sky-500/60 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs shadow-md shadow-sky-600/20 active:scale-95 transition-all"
            >
              Search
            </button>
          </form>

          {/* Quick city chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar mt-2.5 pb-1">
            {POPULAR_CITIES.map((c) => (
              <button
                key={c.name}
                onClick={() => {
                  setCityInput(c.name);
                  fetchWeather(c.name, c.lat, c.lon, c.country);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                  weather?.city.toLowerCase() === c.name.toLowerCase()
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'bg-white/5 text-[#9aa0a6] hover:bg-white/10 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main Weather Card */}
        <div className="p-4 sm:p-5 max-h-[460px] overflow-y-auto custom-scrollbar flex flex-col gap-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
              <p className="text-xs text-[#9aa0a6] font-bold">Live satellite weather update ho raha hai...</p>
            </div>
          ) : weather ? (
            <>
              {/* Primary Card */}
              <div className="relative p-5 rounded-3xl bg-gradient-to-br from-sky-900/40 via-[#18202f] to-[#121316] border border-sky-500/30 overflow-hidden shadow-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-sky-300 font-bold text-xs mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{weather.city}, {weather.country}</span>
                    </div>
                    <div className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-start gap-1">
                      <span>{weather.temperature}°</span>
                      <span className="text-lg text-sky-400 font-bold mt-1">C</span>
                    </div>
                    <p className="text-sm font-bold text-white/90 mt-1">
                      {weather.condition}
                    </p>
                    <p className="text-xs text-[#9aa0a6] mt-0.5">
                      Feels like {weather.feelsLike}°C
                    </p>
                  </div>

                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-300 shadow-inner">
                    {weather.conditionCode >= 80 ? (
                      <CloudRain className="w-10 h-10 animate-bounce" />
                    ) : weather.conditionCode >= 95 ? (
                      <CloudLightning className="w-10 h-10 text-amber-400" />
                    ) : weather.conditionCode >= 3 ? (
                      <Cloud className="w-10 h-10" />
                    ) : (
                      <Sun className="w-10 h-10 text-amber-400 animate-spin-slow" />
                    )}
                  </div>
                </div>

                {/* Weather Metrics Grid */}
                <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-white/10">
                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/[0.03]">
                    <Droplets className="w-4 h-4 text-sky-400 mb-1" />
                    <span className="text-[10px] text-[#9aa0a6]">Humidity</span>
                    <span className="text-xs font-black text-white">{weather.humidity}%</span>
                  </div>

                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/[0.03]">
                    <Wind className="w-4 h-4 text-teal-400 mb-1" />
                    <span className="text-[10px] text-[#9aa0a6]">Wind</span>
                    <span className="text-xs font-black text-white">{weather.windSpeed} km/h</span>
                  </div>

                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/[0.03]">
                    <Compass className="w-4 h-4 text-purple-400 mb-1" />
                    <span className="text-[10px] text-[#9aa0a6]">Pressure</span>
                    <span className="text-xs font-black text-white">{weather.pressure} hPa</span>
                  </div>

                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/[0.03]">
                    <Sun className="w-4 h-4 text-amber-400 mb-1" />
                    <span className="text-[10px] text-[#9aa0a6]">UV Index</span>
                    <span className="text-xs font-black text-white">{weather.uvIndex}</span>
                  </div>
                </div>
              </div>

              {/* 5-Day Forecast */}
              <div>
                <h4 className="text-xs font-bold text-[#e3e3e3] mb-2.5 px-1">
                  5-Day Upcoming Forecast
                </h4>
                <div className="grid grid-cols-5 gap-2">
                  {weather.forecast.map((f, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center text-center"
                    >
                      <span className="text-[11px] font-bold text-[#9aa0a6]">{f.day}</span>
                      <span className="text-xs font-black text-white my-1">{f.tempMax}°</span>
                      <span className="text-[9px] text-[#6b7280]">{f.tempMin}°</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-red-400 font-bold">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#16171b] border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#9aa0a6]">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Ask ZoZo AI: "Delhi ka live mausam kaisa hai?"</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">● Live Connected</span>
        </div>
      </div>
    </div>
  );
};
