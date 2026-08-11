import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

/**
 * Enhanced DatePicker Component
 * Shows day of the week, formatted date (e.g. Wednesday, Aug 5, 2026),
 * fast day-by-day navigation (< and >), native date picker,
 * AND prevents forward picking of future dates beyond today.
 */
export default function DatePicker({ value, onChange, label = 'Select Date', max, className = '' }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const maxAllowedDateStr = max || todayStr;

  const currentDate = value ? new Date(value + 'T00:00:00') : new Date();

  // Format date nicely (e.g. Wednesday, Aug 5, 2026)
  const formattedDayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
  const formattedDateString = currentDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Check if current value is today or in the future
  const isAtMaxDate = value >= maxAllowedDateStr;

  // Navigate to previous day
  const handlePrevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    const isoString = prev.toISOString().split('T')[0];
    onChange(isoString);
  };

  // Navigate to next day (blocked if at max allowed date)
  const handleNextDay = () => {
    if (isAtMaxDate) return;
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    const isoString = next.toISOString().split('T')[0];
    if (isoString <= maxAllowedDateStr) {
      onChange(isoString);
    }
  };

  // Handle direct input change with max date validation
  const handleInputChange = (e) => {
    const newVal = e.target.value;
    if (newVal > maxAllowedDateStr) {
      onChange(maxAllowedDateStr);
    } else {
      onChange(newVal);
    }
  };

  // Reset to today
  const handleToday = () => {
    onChange(maxAllowedDateStr);
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {label && (
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider hidden sm:inline">
          {label}:
        </span>
      )}

      <div className="flex items-center bg-white border border-border-farm rounded-xl shadow-sm overflow-hidden p-0.5">
        {/* Previous Day Button */}
        <button
          type="button"
          onClick={handlePrevDay}
          className="p-1.5 text-text-muted hover:text-dark-green hover:bg-bg-farm rounded-lg transition-colors"
          title="Previous Day"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Formatted Date Display & Hidden/Styled Native Input */}
        <label className="relative flex items-center gap-2 px-3 py-1 bg-bg-farm rounded-lg cursor-pointer hover:bg-emerald-50/50 transition-colors group">
          <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
          
          <div className="flex items-baseline gap-1.5 select-none">
            <span className="text-xs font-bold text-dark-green uppercase tracking-wide px-1.5 py-0.5 bg-emerald-100/80 rounded text-[10px]">
              {formattedDayOfWeek}
            </span>
            <span className="text-xs font-bold font-sans text-text-primary whitespace-nowrap">
              {formattedDateString}
            </span>
          </div>

          <input
            type="date"
            value={value || ''}
            max={maxAllowedDateStr}
            onChange={handleInputChange}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </label>

        {/* Next Day Button (Disabled if at max date) */}
        <button
          type="button"
          onClick={handleNextDay}
          disabled={isAtMaxDate}
          className={`p-1.5 rounded-lg transition-colors ${
            isAtMaxDate 
              ? 'text-border-farm cursor-not-allowed opacity-40' 
              : 'text-text-muted hover:text-dark-green hover:bg-bg-farm'
          }`}
          title={isAtMaxDate ? 'Future dates are disabled' : 'Next Day'}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Today Shortcut Button */}
      <button
        type="button"
        onClick={handleToday}
        className="px-2.5 py-1 text-xs font-bold text-dark-green bg-white hover:bg-emerald-50 border border-border-farm rounded-lg shadow-sm transition-all flex items-center gap-1"
        title="Jump to Today"
      >
        <RotateCcw className="w-3 h-3 text-primary" />
        <span className="hidden md:inline">Today</span>
      </button>
    </div>
  );
}
