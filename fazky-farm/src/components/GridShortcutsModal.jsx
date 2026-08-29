import React from 'react';
import { HelpCircle, X, Keyboard } from 'lucide-react';

export default function GridShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⬆ ⬇ ⬅ ➡', desc: 'Navigate between cells (Left/Right moves cell when at edge of text)' },
    { key: 'Enter / Shift+Enter', desc: 'Move down / up one row' },
    { key: 'Tab / Shift+Tab', desc: 'Move to next / previous cell' },
    { key: 'Home / End', desc: 'Jump to first / last cell in row' },
    { key: 'Ctrl + Home / End', desc: 'Jump to very top-left / bottom-right cell' },
    { key: 'Shift + Arrows', desc: 'Extend rectangular range selection' },
    { key: 'Click + Drag', desc: 'Select a block of cells with the mouse' },
    { key: 'Shift + Click', desc: 'Select range from active cell to clicked cell' },
    { key: 'Ctrl + A', desc: 'Select all cells in the grid' },
    { key: 'Ctrl + Enter', desc: 'Fill all selected cells with the typed value' },
    { key: 'Ctrl + D', desc: 'Fill down: copy top row to all rows in selection' },
    { key: 'Ctrl + C', desc: 'Copy selected cells to clipboard (Excel TSV format)' },
    { key: 'Ctrl + V', desc: 'Paste spreadsheet data into grid' },
    { key: 'Delete / Backspace', desc: 'Clear contents of all selected cells' },
    { key: 'Esc', desc: 'Clear multi-cell selection' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border-farm bg-dark-green text-white">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-accent" />
            <h3 className="font-serif font-bold text-base">Grid Keyboard Shortcuts</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-2 text-xs">
          <div className="grid grid-cols-1 gap-2">
            {shortcuts.map((s, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-bg-farm/50 border border-border-farm/40"
              >
                <kbd className="px-2 py-1 bg-white border border-border-farm rounded shadow-xs font-mono font-bold text-text-primary text-[11px] shrink-0">
                  {s.key}
                </kbd>
                <span className="text-text-muted text-right font-sans pl-3 text-[11px]">
                  {s.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-border-farm bg-bg-farm flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-dark-green transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
