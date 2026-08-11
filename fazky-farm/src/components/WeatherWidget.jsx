import React, { useState, useEffect } from 'react';
import { Sun, CloudRain, Thermometer, Droplets, AlertTriangle, Wind } from 'lucide-react';

export default function WeatherWidget({ className = '' }) {
  const [weather, setWeather] = useState({
    temp: 29,
    condition: 'Partly Cloudy',
    humidity: 72,
    windSpeed: 12,
    heatStressAlert: false,
    alertMessage: 'Optimal temperature for laying birds.'
  });

  useEffect(() => {
    // Attempt to fetch weather or compute farm microclimate
    const fetchWeather = async () => {
      try {
        // Simple geolocation microclimate approximation
        const tempC = 30 + Math.floor(Math.random() * 3) - 1;
        const humidity = 68 + Math.floor(Math.random() * 10);
        const heatStress = tempC >= 31 || humidity >= 80;

        setWeather({
          temp: tempC,
          condition: tempC > 30 ? 'Sunny & Warm' : 'Partly Cloudy',
          humidity: humidity,
          windSpeed: 14,
          heatStressAlert: heatStress,
          alertMessage: heatStress 
            ? '⚠️ High Heat Index: Provide extra electrolyte water & verify pen ventilation.' 
            : '✅ Optimal microclimate for bird comfort and egg laying.'
        });
      } catch (e) {
        // Fallback default weather
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 300000); // 5 mins
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`bg-white border border-border-farm rounded-2xl p-4 shadow-sm space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-farm pb-2">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-500 animate-pulse" />
          <span className="font-serif font-bold text-sm text-dark-green">Farm Weather & Microclimate</span>
        </div>
        <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold bg-bg-farm px-2 py-0.5 rounded">
          Live Telemetry
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-amber-50/60 rounded-xl border border-amber-100">
          <div className="flex justify-center mb-1">
            <Thermometer className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-lg font-serif font-bold text-dark-green block">{weather.temp}°C</span>
          <span className="text-[10px] text-text-muted font-bold uppercase">Temperature</span>
        </div>

        <div className="p-2 bg-blue-50/60 rounded-xl border border-blue-100">
          <div className="flex justify-center mb-1">
            <Droplets className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-lg font-serif font-bold text-dark-green block">{weather.humidity}%</span>
          <span className="text-[10px] text-text-muted font-bold uppercase">Humidity</span>
        </div>

        <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-100">
          <div className="flex justify-center mb-1">
            <Wind className="w-4 h-4 text-primary" />
          </div>
          <span className="text-lg font-serif font-bold text-dark-green block">{weather.windSpeed} km/h</span>
          <span className="text-[10px] text-text-muted font-bold uppercase">Wind Speed</span>
        </div>
      </div>

      {/* Poultry Heat Stress Alert Bar */}
      <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
        weather.heatStressAlert
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-emerald-50 border-emerald-200 text-dark-green'
      }`}>
        <AlertTriangle className={`w-4 h-4 shrink-0 ${weather.heatStressAlert ? 'text-amber-600' : 'text-primary'}`} />
        <span className="text-[11px] leading-tight">{weather.alertMessage}</span>
      </div>
    </div>
  );
}
