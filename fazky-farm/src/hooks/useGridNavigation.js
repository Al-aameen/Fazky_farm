import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Custom hook for Excel-style keyboard navigation and multi-cell range selection.
 * 
 * @param {Object} options
 * @param {number} options.numRows - Total number of editable rows
 * @param {number} options.numCols - Total number of editable columns
 * @param {Function} options.getCellValue - (r, c) => string | number
 * @param {Function} options.setCellValue - (r, c, val) => void
 * @param {Function} options.setMultipleCellValues - (updates: Array<{r, c, val}>) => void
 * @param {Function} [options.isCellEditable] - (r, c) => boolean (defaults to true)
 * @param {Function} [options.isDecimalCol] - (c) => boolean
 */
export function useGridNavigation({
  numRows,
  numCols,
  getCellValue,
  setCellValue,
  setMultipleCellValues,
  isCellEditable = () => true,
  isDecimalCol = () => false
}) {
  const [anchorCell, setAnchorCell] = useState(null); // { r, c }
  const [focusCell, setFocusCell] = useState(null);   // { r, c }
  const [isSelecting, setIsSelecting] = useState(false);
  const inputRefs = useRef(new Map()); // Map<`${r},${c}`, HTMLInputElement>

  // Register input element ref
  const registerRef = useCallback((r, c, el) => {
    const key = `${r},${c}`;
    if (el) {
      inputRefs.current.set(key, el);
    } else {
      inputRefs.current.delete(key);
    }
  }, []);

  // Bounding box of selection
  const selectionRange = useMemo(() => {
    if (!anchorCell || !focusCell) return null;
    const minR = Math.max(0, Math.min(anchorCell.r, focusCell.r));
    const maxR = Math.min(numRows - 1, Math.max(anchorCell.r, focusCell.r));
    const minC = Math.max(0, Math.min(anchorCell.c, focusCell.c));
    const maxC = Math.min(numCols - 1, Math.max(anchorCell.c, focusCell.c));
    return { minR, maxR, minC, maxC };
  }, [anchorCell, focusCell, numRows, numCols]);

  // Is a specific cell selected
  const isCellSelected = useCallback((r, c) => {
    if (!selectionRange) return false;
    return (
      r >= selectionRange.minR &&
      r <= selectionRange.maxR &&
      c >= selectionRange.minC &&
      c <= selectionRange.maxC
    );
  }, [selectionRange]);

  // Is a specific cell the active anchor
  const isCellAnchor = useCallback((r, c) => {
    if (!anchorCell) return false;
    return anchorCell.r === r && anchorCell.c === c;
  }, [anchorCell]);

  // Is multiple cells selected
  const hasMultiSelection = useMemo(() => {
    if (!selectionRange) return false;
    return (
      selectionRange.minR !== selectionRange.maxR ||
      selectionRange.minC !== selectionRange.maxC
    );
  }, [selectionRange]);

  // Focus and select input at (r, c)
  const focusInput = useCallback((r, c) => {
    if (r < 0 || r >= numRows || c < 0 || c >= numCols) return;
    if (!isCellEditable(r, c)) return;

    setAnchorCell({ r, c });
    setFocusCell({ r, c });

    const key = `${r},${c}`;
    const el = inputRefs.current.get(key);
    if (el) {
      el.focus();
      // Scroll into view safely respecting sticky headers
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      // Select text for instant overwrite
      try {
        el.select();
      } catch (e) {
        // Ignore unsupported input types
      }
    }
  }, [numRows, numCols, isCellEditable]);

  // Global mouseup to finish drag selection
  useEffect(() => {
    const onMouseUp = () => setIsSelecting(false);
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  // Mouse selection handlers
  const handleCellMouseDown = useCallback((e, r, c) => {
    if (!isCellEditable(r, c)) return;

    if (e.shiftKey && anchorCell) {
      e.preventDefault();
      setFocusCell({ r, c });
    } else {
      setAnchorCell({ r, c });
      setFocusCell({ r, c });
      setIsSelecting(true);
    }
  }, [anchorCell, isCellEditable]);

  const handleCellMouseEnter = useCallback((r, c) => {
    if (isSelecting && isCellEditable(r, c)) {
      setFocusCell({ r, c });
    }
  }, [isSelecting, isCellEditable]);

  // Copy selection as TSV (Excel-compatible)
  const copySelectionToClipboard = useCallback(async () => {
    if (!selectionRange) return;
    const rows = [];
    for (let r = selectionRange.minR; r <= selectionRange.maxR; r++) {
      const rowVals = [];
      for (let c = selectionRange.minC; c <= selectionRange.maxC; c++) {
        if (isCellEditable(r, c)) {
          const val = getCellValue(r, c);
          rowVals.push(val === undefined || val === null ? '' : String(val));
        } else {
          rowVals.push('');
        }
      }
      rows.push(rowVals.join('\t'));
    }
    const tsvData = rows.join('\n');
    try {
      await navigator.clipboard.writeText(tsvData);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [selectionRange, isCellEditable, getCellValue]);

  // Paste TSV starting from anchorCell
  const pasteFromClipboard = useCallback(async () => {
    if (!anchorCell) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      const lines = text.trim().split(/\r?\n/).map(l => l.split('\t'));
      const updates = [];

      lines.forEach((lineCols, rowOffset) => {
        const targetR = anchorCell.r + rowOffset;
        if (targetR >= numRows) return;

        lineCols.forEach((rawVal, colOffset) => {
          const targetC = anchorCell.c + colOffset;
          if (targetC >= numCols) return;
          if (!isCellEditable(targetR, targetC)) return;

          // Sanitize numeric value (strip currency, commas, whitespace)
          const cleanStr = rawVal.replace(/[₦$,\s]/g, '');
          if (cleanStr === '') {
            updates.push({ r: targetR, c: targetC, val: '' });
          } else {
            const isDecimal = isDecimalCol(targetC);
            const num = isDecimal ? parseFloat(cleanStr) : parseInt(cleanStr, 10);
            if (!isNaN(num)) {
              updates.push({ r: targetR, c: targetC, val: num });
            }
          }
        });
      });

      if (updates.length > 0) {
        setMultipleCellValues(updates);
      }
    } catch (err) {
      console.error('Failed to paste from clipboard:', err);
    }
  }, [anchorCell, numRows, numCols, isCellEditable, isDecimalCol, setMultipleCellValues]);

  // Fill down: copy the top row of selection into all rows below it within selection
  const handleFillDown = useCallback(() => {
    if (!selectionRange || selectionRange.minR === selectionRange.maxR) return;
    const updates = [];
    for (let c = selectionRange.minC; c <= selectionRange.maxC; c++) {
      const sourceVal = getCellValue(selectionRange.minR, c);
      for (let r = selectionRange.minR + 1; r <= selectionRange.maxR; r++) {
        if (isCellEditable(r, c)) {
          updates.push({ r, c, val: sourceVal });
        }
      }
    }
    if (updates.length > 0) {
      setMultipleCellValues(updates);
    }
  }, [selectionRange, getCellValue, isCellEditable, setMultipleCellValues]);

  // Clear all selected cells to empty
  const handleClearSelection = useCallback(() => {
    if (!selectionRange) return;
    const updates = [];
    for (let r = selectionRange.minR; r <= selectionRange.maxR; r++) {
      for (let c = selectionRange.minC; c <= selectionRange.maxC; c++) {
        if (isCellEditable(r, c)) {
          updates.push({ r, c, val: '' });
        }
      }
    }
    if (updates.length > 0) {
      setMultipleCellValues(updates);
    }
  }, [selectionRange, isCellEditable, setMultipleCellValues]);

  // Fill entire selection with a given value (Ctrl+Enter)
  const handleFillSelection = useCallback((val) => {
    if (!selectionRange) return;
    const updates = [];
    for (let r = selectionRange.minR; r <= selectionRange.maxR; r++) {
      for (let c = selectionRange.minC; c <= selectionRange.maxC; c++) {
        if (isCellEditable(r, c)) {
          const isDecimal = isDecimalCol(c);
          let parsed = val;
          if (val !== '') {
            parsed = isDecimal ? parseFloat(val) : parseInt(val, 10);
            if (isNaN(parsed)) continue;
          }
          updates.push({ r, c, val: parsed });
        }
      }
    }
    if (updates.length > 0) {
      setMultipleCellValues(updates);
    }
  }, [selectionRange, isCellEditable, isDecimalCol, setMultipleCellValues]);

  // Keyboard navigation event handler
  const handleKeyDown = useCallback((e, r, c) => {
    const isShift = e.shiftKey;
    const isCtrl = e.ctrlKey || e.metaKey;

    // Ctrl+A: Select All editable cells
    if (isCtrl && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setAnchorCell({ r: 0, c: 0 });
      setFocusCell({ r: numRows - 1, c: numCols - 1 });
      return;
    }

    // Ctrl+C: Copy TSV
    if (isCtrl && e.key.toLowerCase() === 'c') {
      if (hasMultiSelection) {
        e.preventDefault();
        copySelectionToClipboard();
      }
      return;
    }

    // Ctrl+V: Paste TSV
    if (isCtrl && e.key.toLowerCase() === 'v') {
      // Allow default input paste if only 1 cell selected and single input focused,
      // but if multi-cell or handling grid paste:
      e.preventDefault();
      pasteFromClipboard();
      return;
    }

    // Ctrl+D: Fill Down
    if (isCtrl && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      handleFillDown();
      return;
    }

    // Ctrl+Enter: Fill entire selection with active value
    if (isCtrl && e.key === 'Enter') {
      e.preventDefault();
      handleFillSelection(e.target.value);
      return;
    }

    // Escape: Clear multi-selection
    if (e.key === 'Escape') {
      e.preventDefault();
      if (anchorCell) {
        setFocusCell(anchorCell);
      }
      return;
    }

    // Delete / Backspace when multi-cells are selected
    if ((e.key === 'Delete' || e.key === 'Backspace') && hasMultiSelection) {
      e.preventDefault();
      handleClearSelection();
      return;
    }

    // Arrow Up
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isShift) {
        setFocusCell(prev => ({
          r: Math.max(0, (prev?.r ?? r) - 1),
          c: prev?.c ?? c
        }));
      } else {
        focusInput(Math.max(0, r - 1), c);
      }
      return;
    }

    // Arrow Down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isShift) {
        setFocusCell(prev => ({
          r: Math.min(numRows - 1, (prev?.r ?? r) + 1),
          c: prev?.c ?? c
        }));
      } else {
        focusInput(Math.min(numRows - 1, r + 1), c);
      }
      return;
    }

    // Arrow Left
    if (e.key === 'ArrowLeft') {
      const isAtStart = e.target.selectionStart === 0 && e.target.selectionEnd === 0;
      const isAllSelected = e.target.selectionStart === 0 && e.target.selectionEnd === e.target.value.length;

      if (isShift) {
        e.preventDefault();
        setFocusCell(prev => ({
          r: prev?.r ?? r,
          c: Math.max(0, (prev?.c ?? c) - 1)
        }));
        return;
      }

      if (isAtStart || isAllSelected || e.target.value === '') {
        e.preventDefault();
        if (c > 0) {
          focusInput(r, c - 1);
        } else if (r > 0) {
          focusInput(r - 1, numCols - 1);
        }
        return;
      }
    }

    // Arrow Right
    if (e.key === 'ArrowRight') {
      const isAtEnd = e.target.selectionStart === e.target.value.length && e.target.selectionEnd === e.target.value.length;
      const isAllSelected = e.target.selectionStart === 0 && e.target.selectionEnd === e.target.value.length;

      if (isShift) {
        e.preventDefault();
        setFocusCell(prev => ({
          r: prev?.r ?? r,
          c: Math.min(numCols - 1, (prev?.c ?? c) + 1)
        }));
        return;
      }

      if (isAtEnd || isAllSelected || e.target.value === '') {
        e.preventDefault();
        if (c < numCols - 1) {
          focusInput(r, c + 1);
        } else if (r < numRows - 1) {
          focusInput(r + 1, 0);
        }
        return;
      }
    }

    // Enter & Shift+Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isShift) {
        focusInput(Math.max(0, r - 1), c);
      } else {
        focusInput(Math.min(numRows - 1, r + 1), c);
      }
      return;
    }

    // Tab & Shift+Tab
    if (e.key === 'Tab') {
      e.preventDefault();
      if (isShift) {
        if (c > 0) {
          focusInput(r, c - 1);
        } else if (r > 0) {
          focusInput(r - 1, numCols - 1);
        }
      } else {
        if (c < numCols - 1) {
          focusInput(r, c + 1);
        } else if (r < numRows - 1) {
          focusInput(r + 1, 0);
        }
      }
      return;
    }

    // Home / End
    if (e.key === 'Home') {
      e.preventDefault();
      if (isCtrl) {
        focusInput(0, 0);
      } else {
        focusInput(r, 0);
      }
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      if (isCtrl) {
        focusInput(numRows - 1, numCols - 1);
      } else {
        focusInput(r, numCols - 1);
      }
      return;
    }
  }, [numRows, numCols, hasMultiSelection, anchorCell, focusInput, copySelectionToClipboard, pasteFromClipboard, handleFillDown, handleFillSelection, handleClearSelection]);

  // Calculate live selection statistics (Part 4)
  const selectionStats = useMemo(() => {
    if (!selectionRange) return null;

    let count = 0;
    let sum = 0;
    let numericCount = 0;

    for (let r = selectionRange.minR; r <= selectionRange.maxR; r++) {
      for (let c = selectionRange.minC; c <= selectionRange.maxC; c++) {
        if (isCellEditable(r, c)) {
          count++;
          const val = getCellValue(r, c);
          const num = typeof val === 'number' ? val : parseFloat(val);
          if (!isNaN(num)) {
            sum += num;
            numericCount++;
          }
        }
      }
    }

    const avg = numericCount > 0 ? (sum / numericCount) : 0;

    return {
      count,
      sum: Number.isInteger(sum) ? sum : parseFloat(sum.toFixed(2)),
      avg: Number.isInteger(avg) ? avg : parseFloat(avg.toFixed(2)),
      hasMultiple: count > 1
    };
  }, [selectionRange, isCellEditable, getCellValue]);

  return {
    anchorCell,
    focusCell,
    selectionRange,
    isCellSelected,
    isCellAnchor,
    hasMultiSelection,
    selectionStats,
    registerRef,
    focusInput,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleKeyDown,
    copySelectionToClipboard,
    pasteFromClipboard,
    handleFillDown,
    handleClearSelection
  };
}
