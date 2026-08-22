import React, { useState, useRef, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw
} from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const POPOVER_HEIGHT = 350; // approximate height of the calendar popover in px

export default function DatePicker({ 
  value, 
  onChange, 
  label = '', 
  allowFutureDates = false, 
  max,
  className = '' 
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const maxAllowedDateStr = allowFutureDates ? (max || '2035-12-31') : (max || todayStr);

  const [isOpen, setIsOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false); // true = open ABOVE the trigger
  const containerRef = useRef(null);

  // Parse current value or fallback to today
  const parsedDate = value ? new Date(value + 'T00:00:00') : new Date();
  
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth());

  // Sync calendar view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // When opening, decide whether to flip above or stay below
  const handleToggleOpen = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setFlipUp(spaceBelow < POPOVER_HEIGHT + 16);
    }
    setIsOpen(prev => !prev);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside, true);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen]);

  const selectedDate = parsedDate;
  const formattedDayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'short' });
  const formattedDateString = selectedDate.toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric' 
  });

  const isAtMaxDate = !allowFutureDates && value >= maxAllowedDateStr;

  // Day steppers
  const handlePrevDay = (e) => {
    e.stopPropagation();
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    onChange(prev.toISOString().split('T')[0]);
  };

  const handleNextDay = (e) => {
    e.stopPropagation();
    if (!allowFutureDates && isAtMaxDate) return;
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    const iso = next.toISOString().split('T')[0];
    if (allowFutureDates || iso <= maxAllowedDateStr) onChange(iso);
  };

  const handleToday = (e) => {
    e && e.stopPropagation();
    onChange(todayStr);
    setViewYear(new Date().getFullYear());
    setViewMonth(new Date().getMonth());
    setIsOpen(false);
  };

  // Calendar matrix
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDay   = (y, m) => new Date(y, m, 1).getDay();

  const calendarCells = [];
  const firstDayIndex = getFirstDay(viewYear, viewMonth);
  const daysInMonth   = getDaysInMonth(viewYear, viewMonth);

  for (let i = 0; i < firstDayIndex; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const iso = `${viewYear}-${mm}-${dd}`;
    calendarCells.push({
      day: d,
      dateIso: iso,
      isDisabled: !allowFutureDates && iso > maxAllowedDateStr,
      isToday: iso === todayStr,
      isSelected: iso === value
    });
  }

  const handleSelectDate = (iso) => {
    onChange(iso);
    setIsOpen(false);
  };

  const prevMonth = (e) => {
    e.stopPropagation();
    setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1; });
  };
  const nextMonth = (e) => {
    e.stopPropagation();
    setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; });
  };

  const years = Array.from({ length: 15 }, (_, i) => 2020 + i);

  // Popover position classes
  const popoverPositionCls = flipUp
    ? 'bottom-full mb-2'    // open ABOVE
    : 'top-full mt-2';      // open BELOW (default)

  const popoverAnimCls = flipUp ? 'animate-slide-up' : 'animate-slide-down';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center gap-2 flex-wrap ${className}`}
    >
      {label && (
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider hidden sm:inline">
          {label}:
        </span>
      )}

      {/* ── Stepper + Date Pill ── */}
      <div className="flex items-center bg-white border border-border-farm rounded-xl shadow-sm overflow-hidden p-0.5">
        <button
          type="button"
          onClick={handlePrevDay}
          className="p-1.5 text-text-muted hover:text-dark-green hover:bg-bg-farm rounded-lg transition-colors"
          title="Previous Day"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleToggleOpen}
          className="flex items-center gap-2 px-3 py-1 bg-bg-farm rounded-lg hover:bg-emerald-50 transition-colors group cursor-pointer"
          title="Open Full Calendar View"
        >
          <CalendarIcon className="w-4 h-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />
          <div className="flex items-baseline gap-1.5 select-none">
            <span className="text-[10px] font-bold text-dark-green uppercase tracking-wide px-1.5 py-0.5 bg-emerald-100 rounded">
              {formattedDayOfWeek}
            </span>
            <span className="text-xs font-bold font-sans text-text-primary whitespace-nowrap">
              {formattedDateString}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleNextDay}
          disabled={!allowFutureDates && isAtMaxDate}
          className={`p-1.5 rounded-lg transition-colors ${
            !allowFutureDates && isAtMaxDate
              ? 'text-border-farm cursor-not-allowed opacity-40'
              : 'text-text-muted hover:text-dark-green hover:bg-bg-farm'
          }`}
          title={!allowFutureDates && isAtMaxDate ? 'Future dates disabled' : 'Next Day'}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Today button */}
      <button
        type="button"
        onClick={handleToday}
        className="px-2.5 py-1.5 text-xs font-bold text-dark-green bg-white hover:bg-emerald-50 border border-border-farm rounded-xl shadow-sm transition-all flex items-center gap-1"
        title="Jump to Today"
      >
        <RotateCcw className="w-3 h-3 text-primary" />
        <span className="hidden md:inline">Today</span>
      </button>

      {/* ─── CALENDAR POPOVER (viewport-aware flip) ─── */}
      {isOpen && (
        <div
          className={`calendar-popover absolute left-0 z-[200] bg-white border border-border-farm rounded-2xl shadow-2xl p-4 w-[300px] font-sans ${popoverPositionCls} ${popoverAnimCls}`}
          style={{ minWidth: 280 }}
        >
          {/* Header: Month & Year selectors + arrows */}
          <div className="flex items-center justify-between border-b border-border-farm pb-3 mb-3">
            <div className="flex items-center gap-1">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value))}
                className="bg-bg-farm border border-border-farm text-xs font-bold rounded-lg px-2 py-1 text-dark-green focus:outline-none"
              >
                {MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value))}
                className="bg-bg-farm border border-border-farm text-xs font-bold rounded-lg px-2 py-1 text-dark-green focus:outline-none font-mono"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 hover:bg-bg-farm rounded-lg text-text-muted hover:text-dark-green transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 hover:bg-bg-farm rounded-lg text-text-muted hover:text-dark-green transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days-of-week header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="text-[10px] font-bold text-text-muted uppercase py-1">{d}</div>
            ))}
          </div>

          {/* Day matrix */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarCells.map((cell, idx) => {
              if (!cell) return <div key={`e-${idx}`} className="h-8" />;
              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  disabled={cell.isDisabled}
                  onClick={() => handleSelectDate(cell.dateIso)}
                  className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center relative
                    ${cell.isSelected  ? 'calendar-day-selected bg-dark-green text-white font-black shadow-sm' : ''}
                    ${cell.isToday && !cell.isSelected ? 'calendar-day-today bg-emerald-100 text-dark-green border border-primary/30' : ''}
                    ${cell.isDisabled  ? 'text-border-farm/60 cursor-not-allowed bg-gray-50' : ''}
                    ${!cell.isSelected && !cell.isToday && !cell.isDisabled ? 'hover:bg-emerald-50 text-text-primary' : ''}
                  `}
                >
                  {cell.day}
                  {cell.isToday && !cell.isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border-farm pt-3 mt-3">
            <button
              type="button"
              onClick={handleToday}
              className="text-primary hover:text-dark-green font-bold text-[11px]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 bg-bg-farm hover:bg-border-farm/40 text-text-muted rounded-lg font-bold text-[11px]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
