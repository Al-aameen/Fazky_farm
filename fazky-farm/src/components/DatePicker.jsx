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
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const POPOVER_HEIGHT = 350; // approximate height of the calendar popover in px

export default function DatePicker({ 
  value, 
  onChange, 
  label = '', 
  allowFutureDates = false, 
  mode = 'day', // 'day' | 'month'
  max,
  className = '' 
}) {
  // Stable today string computed from local clock (avoids UTC offset bug)
  const todayStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  })();
  const currentMonthStr = todayStr.slice(0, 7);
  const maxAllowedDateStr = allowFutureDates ? (max || '2035-12-31') : (max || todayStr);

  const [isOpen, setIsOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const containerRef = useRef(null);

  // Parse current value (supports both YYYY-MM-DD and YYYY-MM)
  const isMonthMode = mode === 'month';
  const effectiveValue = isMonthMode 
    ? (value ? (value.length === 7 ? `${value}-01` : value) : todayStr)
    : (value || todayStr);

  const parsedDate = new Date(effectiveValue + (effectiveValue.length === 10 ? 'T00:00:00' : ''));
  
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear() || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth() || new Date().getMonth());

  // Sync calendar view when value changes externally
  useEffect(() => {
    if (value) {
      const valToParse = isMonthMode && value.length === 7 ? `${value}-01` : value;
      const d = new Date(valToParse + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value, isMonthMode]);

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
  const formattedDateString = isMonthMode
    ? selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedDayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'short' });

  const isAtMaxDate = !allowFutureDates && (isMonthMode ? (value >= currentMonthStr) : (value >= maxAllowedDateStr));

  // Steppers
  const handlePrev = (e) => {
    e.stopPropagation();
    if (isMonthMode) {
      const prev = new Date(viewYear, viewMonth - 1, 1);
      const mm = String(prev.getMonth() + 1).padStart(2, '0');
      onChange(`${prev.getFullYear()}-${mm}`);
    } else {
      // Timezone-safe: parse local date parts, subtract 1 day, re-build YYYY-MM-DD
      const [cy, cm, cd] = (value || todayStr).split('-').map(Number);
      const prev = new Date(cy, cm - 1, cd - 1); // local midnight
      const y = prev.getFullYear();
      const m = String(prev.getMonth() + 1).padStart(2, '0');
      const d = String(prev.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${d}`);
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (!allowFutureDates && isAtMaxDate) return;
    if (isMonthMode) {
      const next = new Date(viewYear, viewMonth + 1, 1);
      const mm = String(next.getMonth() + 1).padStart(2, '0');
      const isoMonth = `${next.getFullYear()}-${mm}`;
      if (allowFutureDates || isoMonth <= currentMonthStr) onChange(isoMonth);
    } else {
      // Timezone-safe: parse local date parts, add 1 day, re-build YYYY-MM-DD
      const [cy, cm, cd] = (value || todayStr).split('-').map(Number);
      const next = new Date(cy, cm - 1, cd + 1); // local midnight
      const y = next.getFullYear();
      const m = String(next.getMonth() + 1).padStart(2, '0');
      const d = String(next.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${d}`;
      if (allowFutureDates || iso <= maxAllowedDateStr) onChange(iso);
    }
  };

  const handleCurrent = (e) => {
    e && e.stopPropagation();
    if (isMonthMode) {
      onChange(currentMonthStr);
    } else {
      onChange(todayStr);
    }
    setViewYear(new Date().getFullYear());
    setViewMonth(new Date().getMonth());
    setIsOpen(false);
  };

  // Calendar matrix (Day Mode)
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDay   = (y, m) => new Date(y, m, 1).getDay();

  const calendarCells = [];
  if (!isMonthMode) {
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
  }

  const handleSelectDate = (iso) => {
    onChange(iso);
    setIsOpen(false);
  };

  const handleSelectMonth = (mIndex) => {
    const mm = String(mIndex + 1).padStart(2, '0');
    const isoMonth = `${viewYear}-${mm}`;
    onChange(isoMonth);
    setIsOpen(false);
  };

  const prevYear = (e) => {
    e.stopPropagation();
    setViewYear(y => y - 1);
  };
  const nextYear = (e) => {
    e.stopPropagation();
    setViewYear(y => y + 1);
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
    ? 'bottom-full mb-2'
    : 'top-full mt-2';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center gap-1.5 sm:gap-2 flex-wrap ${className}`}
    >
      {label && (
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider hidden sm:inline">
          {label}:
        </span>
      )}

      {/* ── Stepper + Date Pill ── */}
      <div className="inline-flex items-center bg-white border border-border-farm rounded-xl shadow-sm overflow-hidden divide-x divide-border-farm/60">
        <button
          type="button"
          onClick={handlePrev}
          className="p-1.5 sm:p-2 text-text-muted hover:text-dark-green hover:bg-bg-farm active:bg-emerald-50 transition-colors"
          title={isMonthMode ? 'Previous Month' : 'Previous Day'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleToggleOpen}
          className="flex items-center gap-2 px-3 py-1.5 sm:py-2 text-xs font-bold text-dark-green hover:bg-emerald-50/60 active:bg-emerald-50 transition-colors select-none"
        >
          <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
          <span>{formattedDateString}</span>
          {!isMonthMode && (
            <span className="text-[10px] text-text-muted font-normal uppercase hidden xs:inline">
              ({formattedDayOfWeek})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!allowFutureDates && isAtMaxDate}
          className="p-1.5 sm:p-2 text-text-muted hover:text-dark-green hover:bg-bg-farm active:bg-emerald-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={isMonthMode ? 'Next Month' : 'Next Day'}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── "This Month / Today" Quick Reset Button ── */}
      <button
        type="button"
        onClick={handleCurrent}
        className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-dark-green bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-xl transition-colors shadow-xs"
        title={isMonthMode ? 'Jump to Current Month' : 'Jump to Today'}
      >
        <RotateCcw className="w-3 h-3" />
        <span>{isMonthMode ? 'This Month' : 'Today'}</span>
      </button>

      {/* ── Calendar Popover ── */}
      {isOpen && (
        <div
          className={`absolute left-0 ${popoverPositionCls} z-[100] bg-white rounded-2xl border border-border-farm shadow-2xl p-4 w-72 sm:w-80 select-none animate-scale-in`}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-farm/60">
            {isMonthMode ? (
              <>
                <button
                  type="button"
                  onClick={prevYear}
                  className="p-1 rounded-lg text-text-muted hover:text-dark-green hover:bg-bg-farm transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="font-serif font-bold text-sm text-dark-green">
                  {viewYear}
                </div>
                <button
                  type="button"
                  onClick={nextYear}
                  className="p-1 rounded-lg text-text-muted hover:text-dark-green hover:bg-bg-farm transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1 rounded-lg text-text-muted hover:text-dark-green hover:bg-bg-farm transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  <select
                    value={viewMonth}
                    onChange={(e) => setViewMonth(Number(e.target.value))}
                    className="text-xs font-bold text-dark-green bg-bg-farm border border-border-farm rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>

                  <select
                    value={viewYear}
                    onChange={(e) => setViewYear(Number(e.target.value))}
                    className="text-xs font-bold text-dark-green bg-bg-farm border border-border-farm rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer font-mono"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 rounded-lg text-text-muted hover:text-dark-green hover:bg-bg-farm transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Month Mode: Grid of 12 months */}
          {isMonthMode ? (
            <div className="grid grid-cols-3 gap-2">
              {MONTHS_SHORT.map((m, i) => {
                const mm = String(i + 1).padStart(2, '0');
                const isoMonth = `${viewYear}-${mm}`;
                const isSelected = (value || '').startsWith(isoMonth);
                const isCurrent = isoMonth === currentMonthStr;
                const isDisabled = !allowFutureDates && isoMonth > currentMonthStr;

                return (
                  <button
                    key={m}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectMonth(i)}
                    className={`py-3 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-dark-green text-white shadow-md'
                        : isCurrent
                        ? 'bg-emerald-50 text-dark-green border border-emerald-300'
                        : isDisabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-text-primary hover:bg-bg-farm hover:text-dark-green'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* Day Mode: Day-of-week header */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {DAYS_OF_WEEK.map((d, i) => (
                  <div key={d} className={`text-[10px] font-bold uppercase ${i === 0 ? 'text-amber-600' : 'text-text-muted'}`}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day Mode: 35/42-cell calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  if (!cell) {
                    return <div key={`empty-${idx}`} className="h-7 sm:h-8" />;
                  }

                  const { day, dateIso, isDisabled, isToday, isSelected } = cell;

                  let cellClass = 'h-7 sm:h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ';

                  if (isSelected) {
                    cellClass += 'bg-dark-green text-white font-bold shadow-md';
                  } else if (isDisabled) {
                    cellClass += 'text-gray-300 cursor-not-allowed';
                  } else if (isToday) {
                    cellClass += 'bg-emerald-100 text-dark-green font-bold border border-emerald-400 hover:bg-emerald-200';
                  } else {
                    cellClass += 'text-text-primary hover:bg-emerald-50 hover:text-dark-green active:bg-emerald-100';
                  }

                  return (
                    <button
                      key={dateIso}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectDate(dateIso)}
                      className={cellClass}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Popover Footer */}
          <div className="mt-3 pt-2 border-t border-border-farm/60 flex items-center justify-between text-xs">
            <span className="text-[11px] text-text-muted">
              {isMonthMode ? `Current: ${currentMonthStr}` : `Today: ${todayStr}`}
            </span>
            <button
              type="button"
              onClick={handleCurrent}
              className="text-primary font-bold hover:text-dark-green text-xs"
            >
              {isMonthMode ? 'Jump to Current Month' : 'Jump to Today'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

