import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Save, 
  ArrowRight,
  Eye,
  Check,
  RefreshCw,
  FileSpreadsheet,
  Skull,
  DollarSign,
  HelpCircle,
  Wand2
} from 'lucide-react';
import { validateExtractedRow, FAZKY_LEDGER_SCHEMA } from '../lib/ledgerValidation';

export default function LedgerDigitizerModal({ isOpen, onClose, onCommitSuccess, data, insertRecord, updateRecord, bulkInsertRecords }) {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('fazky_anthropic_api_key') || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractError, setExtractError] = useState(null);

  // Extracted and validated state
  const [ledgerDate, setLedgerDate] = useState('');
  const [extractedRows, setExtractedRows] = useState([]);
  const [marginalia, setMarginalia] = useState([]);
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState(null);

  // Image viewer controls
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setImageFile(null);
      setImagePreview(null);
      setExtractedRows([]);
      setMarginalia([]);
      setExtractError(null);
      setCommitMessage(null);
      setZoomLevel(1);
      setRotation(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const dbWorkers = data.workers || [];
  const dbPens = data.pens || [];

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Run Claude 3.5 Sonnet Vision extraction via Anthropic API (or local simulation if no API key)
  const handleProcessImage = async () => {
    if (!imagePreview) return;
    setIsProcessing(true);
    setExtractError(null);

    try {
      let rawResult = null;

      if (apiKey.trim()) {
        localStorage.setItem('fazky_anthropic_api_key', apiKey.trim());
        
        // Extract base64 without data URI prefix
        const base64Data = imagePreview.split(',')[1];
        const mediaType = imagePreview.split(';')[0].split(':')[1] || 'image/jpeg';

        const systemPrompt = `You are an expert Data Extraction AI and Computer Vision Specialist. Your task is to accurately transcribe and structure a highly complex, handwritten agricultural ledger from an image into a strict JSON payload.
The image contains a mixture of structured matrices (grids) and unstructured marginalia. You must adhere to the following strict operational rules:
1. SPATIAL GRID ASSOCIATION: Carry 'pen_block' down to every worker row until a new block appears.
2. MATHEMATICAL RESOLUTION: Evaluate any inline equations (e.g. 14+3=17 -> 17).
3. FRACTION CONVERSION: Evaluate visual fractions (e.g. 1 1/2 -> 1.5, 1/2 -> 0.5, 7 1/2 -> 7.5). Never output fraction strings.
4. MARGINALIA: Isolate all scrawled notes, mortality counts, or sales into 'unstructured_marginalia'.
5. OUTPUT JSON: Match the exact schema provided.`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'dangerously-allow-browser': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mediaType,
                      data: base64Data
                    }
                  },
                  {
                    type: 'text',
                    text: 'Please extract the handwritten ledger using the required structured JSON format.'
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Anthropic API error: HTTP ${response.status}`);
        }

        const apiData = await response.json();
        const contentBlock = apiData.content?.find(c => c.type === 'text');
        const jsonMatch = contentBlock?.text?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          rawResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse valid JSON from the AI response.');
        }
      } else {
        // High-fidelity fallback / interactive testing parser
        await new Promise(r => setTimeout(r, 1200)); // Simulate VLM reasoning
        
        // Generate realistic extraction based on active farm workers & pens
        const simulatedDate = new Date().toISOString().split('T')[0];
        const sampleWorkers = dbWorkers.slice(0, 10);
        
        const matrix_data = sampleWorkers.map((w, idx) => {
          const mEggs = Math.floor(10 + Math.random() * 18);
          const eEggs = Math.floor(2 + Math.random() * 4);
          const mFeed = 2.5;
          const eFeed = 0.5;
          
          // Introduce a simulated heuristic error in row 3 to demonstrate the HITL red-flag engine
          const tEggs = idx === 2 ? mEggs + eEggs + 1 : mEggs + eEggs;
          
          return {
            pen_block: idx < 4 ? 'Main Block A' : (idx < 8 ? 'Main Block B' : 'New Layers'),
            worker_name: w.name,
            eggs_morning: mEggs,
            eggs_evening: eEggs,
            eggs_total: tEggs,
            feeds_morning: mFeed,
            feeds_evening: eFeed,
            feeds_total: mFeed + eFeed
          };
        });

        rawResult = {
          ledger_date: simulatedDate,
          matrix_data,
          unstructured_marginalia: [
            {
              category: 'Mortality',
              entity: sampleWorkers[0]?.name || 'Amos',
              numerical_value: 1,
              raw_text: `Mortality: ${sampleWorkers[0]?.name || 'Amos'} - 1 bird dead in pen.`
            },
            {
              category: 'Financial',
              entity: 'Iya Aisha',
              numerical_value: 2500,
              raw_text: 'Iya Aisha bought 1 spent layer for 2500 cash.'
            }
          ]
        };
      }

      // Apply programmatic heuristic validation engine
      setLedgerDate(rawResult.ledger_date || new Date().toISOString().split('T')[0]);
      
      const validatedRows = (rawResult.matrix_data || []).map((row, index) => ({
        id: `row-${index}`,
        ...validateExtractedRow(row, dbWorkers, dbPens)
      }));

      setExtractedRows(validatedRows);
      setMarginalia(rawResult.unstructured_marginalia || []);
    } catch (err) {
      console.error('Ledger digitization failed:', err);
      setExtractError(err.message || 'Failed to process ledger image.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Modify individual cell value
  const handleCellEdit = (rowId, field, value) => {
    setExtractedRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      const numVal = value === '' ? null : (field.includes('feeds') ? parseFloat(value) : parseInt(value, 10));
      const updatedRaw = {
        ...row,
        [field]: isNaN(numVal) ? value : numVal
      };

      // Re-run validation heuristics on edited row
      return {
        id: row.id,
        ...validateExtractedRow(updatedRaw, dbWorkers, dbPens)
      };
    }));
  };

  // One-click Auto-Fix for arithmetic checksums
  const handleAutoFixRow = (rowId) => {
    setExtractedRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const mEggs = Number(row.eggs_morning) || 0;
      const eEggs = Number(row.eggs_evening) || 0;
      const mFeed = Number(row.feeds_morning) || 0;
      const eFeed = Number(row.feeds_evening) || 0;

      const fixed = {
        ...row,
        eggs_total: mEggs + eEggs,
        feeds_total: Math.round((mFeed + eFeed) * 100) / 100
      };

      return {
        id: row.id,
        ...validateExtractedRow(fixed, dbWorkers, dbPens),
        verified: true
      };
    }));
  };

  // Manual verify override
  const handleToggleVerify = (rowId) => {
    setExtractedRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return { ...row, verified: !row.verified };
    }));
  };

  // Assign Pen for row
  const handlePenChange = (rowId, penId) => {
    const pen = dbPens.find(p => p.id === penId);
    setExtractedRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        matched_pen: pen,
        verified: true
      };
    }));
  };

  // Commit all validated rows to Supabase production_log
  const handleCommitToDatabase = async () => {
    setCommitting(true);
    setCommitMessage(null);
    try {
      const recordsToInsert = [];
      const dayOfWeekStr = new Date(ledgerDate).toLocaleDateString('en-US', { weekday: 'long' });

      for (const row of extractedRows) {
        // Find pen: either matched_pen or look up by pen block / name
        let targetPenId = row.matched_pen?.id;
        if (!targetPenId) {
          // Fallback to first pen or pen matching worker
          const fallbackPen = dbPens.find(p => p.name?.toLowerCase().includes(row.pen_block?.toLowerCase()));
          targetPenId = fallbackPen?.id || dbPens[0]?.id;
        }

        if (!targetPenId) continue;

        recordsToInsert.push({
          pen_id: targetPenId,
          date: ledgerDate,
          day_of_week: dayOfWeekStr,
          morning_eggs: row.clean_eggs_morning,
          evening_eggs: row.clean_eggs_evening,
          morning_feed: row.clean_feeds_morning,
          evening_feed: row.clean_feeds_evening,
          mortality: 0 // mortality from marginalia can be logged separately
        });
      }

      if (bulkInsertRecords) {
        await bulkInsertRecords('production_log', recordsToInsert);
      } else if (insertRecord) {
        for (const rec of recordsToInsert) {
          await insertRecord('production_log', rec);
        }
      }

      setCommitMessage(`Successfully committed ${recordsToInsert.length} ledger rows to Supabase!`);
      if (onCommitSuccess) onCommitSuccess(ledgerDate);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to commit digitized ledger:', err);
      setCommitMessage(`Error: ${err.message}`);
    } finally {
      setCommitting(false);
    }
  };

  const unverifiedCount = extractedRows.filter(r => !r.verified && r.hasErrors).length;
  const totalEggsExtracted = extractedRows.reduce((s, r) => s + (Number(r.eggs_total) || 0), 0);
  const totalFeedsExtracted = extractedRows.reduce((s, r) => s + (Number(r.feeds_total) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#1a2e1d] rounded-2xl w-full max-w-7xl h-[94vh] flex flex-col shadow-2xl border border-border-farm overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="p-4 bg-dark-green text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700/60 rounded-xl text-accent">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base sm:text-lg flex items-center gap-2">
                Enterprise AI Ledger Digitizer
                <span className="text-[10px] bg-accent text-dark-green font-mono px-2 py-0.5 rounded-full font-bold uppercase">
                  Claude 3.5 VLM + HITL
                </span>
              </h2>
              <p className="text-xs text-light-green/80 font-sans">
                Transcribe complex handwritten farm ledgers, evaluate physical fractions & verify arithmetic checksums
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two-Pane Split Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden bg-bg-farm dark:bg-[#142417]">
          
          {/* ── LEFT PANE: Ledger Photograph Viewer (Cols 5) ── */}
          <div className="lg:col-span-5 border-r border-border-farm flex flex-col bg-slate-900 overflow-hidden relative">
            
            {/* Image Toolbar */}
            <div className="p-2.5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 bg-primary hover:bg-emerald-600 px-3 py-1.5 rounded-lg font-bold text-white transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {imagePreview ? 'Change Photo' : 'Upload Ledger Photo'}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {imagePreview && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.2))} 
                    className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-400 px-1">{Math.round(zoomLevel * 100)}%</span>
                  <button 
                    onClick={() => setZoomLevel(z => Math.min(3.0, z + 0.2))} 
                    className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setRotation(r => (r + 90) % 360)} 
                    className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                    title="Rotate 90°"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Image Display Area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 relative bg-[#0b1118]">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Handwritten Ledger Sheet"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: 'transform 0.15s ease-out'
                  }}
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-sm border border-slate-700"
                />
              ) : (
                <div className="text-center p-8 border-2 border-dashed border-slate-700 rounded-2xl max-w-sm">
                  <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3 animate-bounce" />
                  <p className="text-sm font-bold text-slate-200">Upload or Photograph Ledger</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports high-resolution camera photos of physical farm notebooks (.jpg, .png)
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg transition-all"
                  >
                    <Upload className="w-4 h-4" /> Select Image File
                  </button>
                </div>
              )}
            </div>

            {/* Extraction Trigger Bar */}
            {imagePreview && extractedRows.length === 0 && (
              <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3 shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Anthropic API Key (Optional: Leave blank for demo mode)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <button
                  onClick={handleProcessImage}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl text-sm shadow-xl transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing Handwritten Matrix with Claude 3.5 Sonnet...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 text-accent" />
                      Extract & Verify Ledger (VLM + Heuristics)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT PANE: Human-in-the-Loop Review Grid (Cols 7) ── */}
          <div className="lg:col-span-7 flex flex-col bg-white dark:bg-[#1a2e1d] overflow-hidden">
            
            {/* Status & Summary Ribbon */}
            <div className="p-3 bg-light-green/40 dark:bg-emerald-950/40 border-b border-border-farm flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-dark-green dark:text-emerald-300">Ledger Date:</span>
                  <input
                    type="date"
                    value={ledgerDate}
                    onChange={e => setLedgerDate(e.target.value)}
                    className="bg-white dark:bg-[#142417] border border-border-farm rounded-lg px-2 py-1 text-xs font-bold font-mono text-dark-green dark:text-white"
                  />
                </div>

                {extractedRows.length > 0 && (
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="bg-emerald-100 text-dark-green px-2 py-0.5 rounded-md font-bold">
                      🥚 {totalEggsExtracted.toLocaleString()} eggs
                    </span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold">
                      🌾 {totalFeedsExtracted.toFixed(1)} bags
                    </span>
                  </div>
                )}
              </div>

              {extractedRows.length > 0 && (
                <div className="flex items-center gap-2">
                  {unverifiedCount > 0 ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {unverifiedCount} row(s) require review
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      All Checks Passed
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Error Banner */}
            {extractError && (
              <div className="m-3 p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{extractError}</span>
              </div>
            )}

            {/* Main Interactive Table View */}
            <div className="flex-1 overflow-auto p-3 space-y-4">
              {extractedRows.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-text-muted">
                  <FileSpreadsheet className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-3" />
                  <h3 className="font-serif text-lg font-bold text-dark-green dark:text-emerald-200">
                    Awaiting Ledger Transcription
                  </h3>
                  <p className="text-xs max-w-md mt-1">
                    Upload a photograph of the physical notebook on the left and click "Extract & Verify". The system will execute Claude 3.5 Sonnet Vision extraction, arithmetic checksum verification, and fraction conversions.
                  </p>
                </div>
              ) : (
                <>
                  <div className="border border-border-farm rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-dark-green text-white font-serif text-[11px] uppercase tracking-wider">
                          <th className="p-2.5 border-r border-white/10">Block &amp; Worker</th>
                          <th className="p-2.5 border-r border-white/10 text-center w-16">Morn Crates</th>
                          <th className="p-2.5 border-r border-white/10 text-center w-16">Eve Crates</th>
                          <th className="p-2.5 border-r border-white/10 text-center w-20 bg-[#1e421a]/80">Total Crates</th>
                          <th className="p-2.5 border-r border-white/10 text-center w-16">Morn Feed</th>
                          <th className="p-2.5 border-r border-white/10 text-center w-16">Eve Feed</th>
                          <th className="p-2.5 border-r border-white/10 text-center w-20 bg-[#1e421a]/80">Total Feed</th>
                          <th className="p-2.5 border-r border-white/10">Assigned Pen</th>
                          <th className="p-2.5 text-center w-12">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-farm dark:divide-emerald-900/50">
                        {extractedRows.map((row) => {
                          const eggChecksumError = row.flags.find(f => f.field === 'eggs_total');
                          const feedChecksumError = row.flags.find(f => f.field === 'feeds_total');
                          const fractionError = row.flags.find(f => f.type === 'fraction_modulo');

                          return (
                            <tr 
                              key={row.id} 
                              className={`transition-colors ${
                                row.hasErrors && !row.verified 
                                  ? 'bg-amber-50/50 dark:bg-amber-950/20' 
                                  : 'hover:bg-bg-farm/50 dark:hover:bg-emerald-950/20'
                              }`}
                            >
                              {/* Block & Worker */}
                              <td className="p-2 border-r border-border-farm font-sans">
                                <div className="font-bold text-dark-green dark:text-emerald-200">
                                  {row.worker_name}
                                </div>
                                <div className="text-[10px] text-text-muted flex items-center gap-1">
                                  <span>{row.pen_block}</span>
                                  {row.worker_match_status === 'fuzzy' && (
                                    <span className="text-amber-600 bg-amber-100 px-1 rounded text-[9px] font-bold">
                                      Fuzzy
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Morning Eggs */}
                              <td className="p-1 border-r border-border-farm">
                                <input
                                  type="number"
                                  value={row.eggs_morning ?? ''}
                                  onChange={e => handleCellEdit(row.id, 'eggs_morning', e.target.value)}
                                  className="w-full text-center py-1 font-mono font-bold bg-white dark:bg-[#142417] border border-border-farm rounded focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </td>

                              {/* Evening Eggs */}
                              <td className="p-1 border-r border-border-farm">
                                <input
                                  type="number"
                                  value={row.eggs_evening ?? ''}
                                  onChange={e => handleCellEdit(row.id, 'eggs_evening', e.target.value)}
                                  className="w-full text-center py-1 font-mono font-bold bg-white dark:bg-[#142417] border border-border-farm rounded focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </td>

                              {/* Total Eggs with Arithmetic Checksum Red Flag */}
                              <td className={`p-1 border-r border-border-farm relative ${eggChecksumError && !row.verified ? 'bg-red-100/70 dark:bg-red-950/60' : 'bg-emerald-50/40 dark:bg-emerald-950/30'}`}>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={row.eggs_total ?? ''}
                                    onChange={e => handleCellEdit(row.id, 'eggs_total', e.target.value)}
                                    className={`w-full text-center py-1 font-mono font-bold border rounded focus:ring-1 focus:outline-none ${
                                      eggChecksumError && !row.verified 
                                        ? 'bg-red-50 text-red-700 border-red-400 font-black' 
                                        : 'bg-white dark:bg-[#142417] text-dark-green dark:text-emerald-300 border-border-farm'
                                    }`}
                                  />
                                  {eggChecksumError && !row.verified && (
                                    <button
                                      onClick={() => handleAutoFixRow(row.id)}
                                      title={`Checksum failed! Click to auto-fix total to ${eggChecksumError.expected}`}
                                      className="p-1 text-red-600 hover:text-white hover:bg-red-600 rounded text-[10px] font-bold border border-red-400"
                                    >
                                      Fix
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Morning Feed */}
                              <td className="p-1 border-r border-border-farm">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={row.feeds_morning ?? ''}
                                  onChange={e => handleCellEdit(row.id, 'feeds_morning', e.target.value)}
                                  className="w-full text-center py-1 font-mono bg-white dark:bg-[#142417] border border-border-farm rounded focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </td>

                              {/* Evening Feed */}
                              <td className="p-1 border-r border-border-farm">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={row.feeds_evening ?? ''}
                                  onChange={e => handleCellEdit(row.id, 'feeds_evening', e.target.value)}
                                  className="w-full text-center py-1 font-mono bg-white dark:bg-[#142417] border border-border-farm rounded focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </td>

                              {/* Total Feed */}
                              <td className={`p-1 border-r border-border-farm ${feedChecksumError && !row.verified ? 'bg-red-100/70' : 'bg-blue-50/30'}`}>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={row.feeds_total ?? ''}
                                    onChange={e => handleCellEdit(row.id, 'feeds_total', e.target.value)}
                                    className={`w-full text-center py-1 font-mono font-bold border rounded focus:ring-1 focus:outline-none ${
                                      (feedChecksumError || fractionError) && !row.verified 
                                        ? 'bg-red-50 text-red-700 border-red-400' 
                                        : 'bg-white dark:bg-[#142417] text-blue-900 dark:text-blue-300 border-border-farm'
                                    }`}
                                  />
                                </div>
                              </td>

                              {/* Assigned Pen Dropdown */}
                              <td className="p-1 border-r border-border-farm">
                                <select
                                  value={row.matched_pen?.id || ''}
                                  onChange={e => handlePenChange(row.id, e.target.value)}
                                  className="w-full py-1 px-1 bg-white dark:bg-[#142417] border border-border-farm rounded text-[11px] font-sans focus:outline-none focus:border-primary text-text-primary"
                                >
                                  <option value="">-- Select Pen --</option>
                                  {dbPens.map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Status / Verify Toggle Button */}
                              <td className="p-1 text-center">
                                <button
                                  onClick={() => handleToggleVerify(row.id)}
                                  className={`p-1.5 rounded-lg text-xs transition-colors ${
                                    row.verified 
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                  }`}
                                  title={row.verified ? 'Verified' : 'Click to mark as verified'}
                                >
                                  {row.verified ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Unstructured Marginalia Section ── */}
                  {marginalia.length > 0 && (
                    <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2 font-serif font-bold text-xs text-amber-900 dark:text-amber-200">
                        <Info className="w-4 h-4 text-amber-700" />
                        Extracted Marginalia & Notebook Margin Notes ({marginalia.length})
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {marginalia.map((m, idx) => (
                          <div key={idx} className="bg-white dark:bg-[#142417] p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/40 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded">
                                {m.category}
                              </span>
                              {m.numerical_value !== null && (
                                <span className="font-mono font-bold text-dark-green dark:text-emerald-300">
                                  {m.category === 'Financial' ? `₦${m.numerical_value.toLocaleString()}` : `${m.numerical_value} birds`}
                                </span>
                              )}
                            </div>
                            <p className="text-text-primary text-[11px] italic">"{m.raw_text}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Commit Footer with Verification Gate */}
            {extractedRows.length > 0 && (
              <div className="p-4 bg-white dark:bg-[#1a2e1d] border-t border-border-farm flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-text-muted">
                  {unverifiedCount > 0 ? (
                    <span className="text-amber-700 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Please review or click auto-fix on flagged cells before committing.
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      All {extractedRows.length} rows ready for safe insertion into Supabase.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {commitMessage && (
                    <span className="text-xs font-bold text-emerald-700">{commitMessage}</span>
                  )}
                  <button
                    onClick={handleCommitToDatabase}
                    disabled={committing || unverifiedCount > 0}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-primary hover:bg-dark-green text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {committing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Writing to Supabase...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Commit to Production Log ({extractedRows.length} Records)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
