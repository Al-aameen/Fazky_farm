// Heuristic validation engine for handwritten ledger extraction
// Implements Arithmetic Checksums, Fraction Modulo checks, and Levenshtein Worker Matching

/**
 * Calculates Levenshtein Distance between two strings.
 */
export function levenshteinDistance(a = '', b = '') {
  const strA = String(a).toLowerCase().trim();
  const strB = String(b).toLowerCase().trim();
  
  if (strA === strB) return 0;
  if (!strA.length) return strB.length;
  if (!strB.length) return strA.length;

  const matrix = Array.from({ length: strA.length + 1 }, () => 
    new Array(strB.length + 1).fill(0)
  );

  for (let i = 0; i <= strA.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= strB.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= strA.length; i++) {
    for (let j = 1; j <= strB.length; j++) {
      const cost = strA[i - 1] === strB[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // deletion
        matrix[i][j - 1] + 1,       // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[strA.length][strB.length];
}

/**
 * Finds the best matching worker from known active workers.
 */
export function matchWorker(extractedName = '', workersList = []) {
  if (!extractedName || !workersList.length) return { match: null, distance: 99, status: 'unmatched' };
  
  const cleanExt = extractedName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  let bestWorker = null;
  let minDistance = 99;

  for (const worker of workersList) {
    const workerClean = (worker.name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const dist = levenshteinDistance(cleanExt, workerClean);
    
    // Direct substring match bonus
    if (cleanExt.includes(workerClean) || workerClean.includes(cleanExt)) {
      if (dist < minDistance) {
        minDistance = Math.min(dist, 1);
        bestWorker = worker;
      }
    } else if (dist < minDistance) {
      minDistance = dist;
      bestWorker = worker;
    }
  }

  let status = 'exact';
  if (minDistance > 2) status = 'mismatch';
  else if (minDistance > 0) status = 'fuzzy';

  return {
    match: bestWorker,
    distance: minDistance,
    status
  };
}

/**
 * Programmatic Confidence Scoring via Logical Heuristics
 * Validates extracted matrix rows against mathematical & relational ground truths.
 */
export function validateExtractedRow(row, dbWorkers = [], dbPens = []) {
  const flags = [];
  let hasErrors = false;

  const mEggs = row.eggs_morning !== null && row.eggs_morning !== '' ? Number(row.eggs_morning) : null;
  const eEggs = row.eggs_evening !== null && row.eggs_evening !== '' ? Number(row.eggs_evening) : null;
  const tEggs = row.eggs_total !== null && row.eggs_total !== '' ? Number(row.eggs_total) : null;

  const mFeed = row.feeds_morning !== null && row.feeds_morning !== '' ? Number(row.feeds_morning) : null;
  const eFeed = row.feeds_evening !== null && row.feeds_evening !== '' ? Number(row.feeds_evening) : null;
  const tFeed = row.feeds_total !== null && row.feeds_total !== '' ? Number(row.feeds_total) : null;

  // 1. Arithmetic Checksum Validation: Eggs (Morning + Evening == Total)
  if (mEggs !== null && eEggs !== null && tEggs !== null) {
    if (mEggs + eEggs !== tEggs) {
      flags.push({
        field: 'eggs_total',
        type: 'arithmetic_checksum',
        severity: 'high',
        message: `Egg checksum mismatch: ${mEggs} (M) + ${eEggs} (E) = ${mEggs + eEggs}, but ledger states ${tEggs}.`,
        expected: mEggs + eEggs,
        actual: tEggs
      });
      hasErrors = true;
    }
  } else if (tEggs !== null && (mEggs === null || eEggs === null)) {
    flags.push({
      field: 'eggs',
      type: 'missing_component',
      severity: 'medium',
      message: 'Total eggs provided without complete Morning/Evening breakdown.'
    });
  }

  // 2. Arithmetic Checksum Validation: Feeds (Morning + Evening == Total)
  if (mFeed !== null && eFeed !== null && tFeed !== null) {
    const sumFeed = Math.round((mFeed + eFeed) * 100) / 100;
    const roundedTotal = Math.round(tFeed * 100) / 100;
    if (Math.abs(sumFeed - roundedTotal) > 0.001) {
      flags.push({
        field: 'feeds_total',
        type: 'arithmetic_checksum',
        severity: 'high',
        message: `Feed checksum mismatch: ${mFeed} + ${eFeed} = ${sumFeed} bags, but ledger states ${tFeed}.`,
        expected: sumFeed,
        actual: tFeed
      });
      hasErrors = true;
    }
  }

  // 3. Fraction Modulo Validation (Feed bags are either whole integers or exact halves e.g. 0.5, 1.5, 2.5)
  [
    { name: 'feeds_morning', val: mFeed },
    { name: 'feeds_evening', val: eFeed },
    { name: 'feeds_total', val: tFeed }
  ].forEach(feedItem => {
    if (feedItem.val !== null) {
      // Check if value is multiple of 0.5
      const remainder = (feedItem.val * 10) % 5;
      if (remainder !== 0) {
        flags.push({
          field: feedItem.name,
          type: 'fraction_modulo',
          severity: 'critical',
          message: `Suspicious feed fraction: ${feedItem.val}. Farm records only standard 0.5 (half bag) increments.`
        });
        hasErrors = true;
      }
    }
  });

  // 4. Worker & Pen Relational Cross-Referencing
  const workerMatch = matchWorker(row.worker_name, dbWorkers);
  if (workerMatch.status === 'mismatch') {
    flags.push({
      field: 'worker_name',
      type: 'relational_worker',
      severity: 'medium',
      message: `Unknown worker "${row.worker_name}". Verify identity and pen mapping.`
    });
  }

  // Find linked pen if possible
  let matchedPen = null;
  if (workerMatch.match) {
    matchedPen = dbPens.find(p => p.worker_id === workerMatch.match.id);
  }

  return {
    ...row,
    clean_eggs_morning: mEggs ?? 0,
    clean_eggs_evening: eEggs ?? 0,
    clean_eggs_total: tEggs ?? ((mEggs ?? 0) + (eEggs ?? 0)),
    clean_feeds_morning: mFeed ?? 0,
    clean_feeds_evening: eFeed ?? 0,
    clean_feeds_total: tFeed ?? ((mFeed ?? 0) + (eFeed ?? 0)),
    matched_worker: workerMatch.match,
    worker_match_status: workerMatch.status,
    matched_pen: matchedPen,
    flags,
    hasErrors,
    verified: flags.length === 0
  };
}

/**
 * System prompt JSON schema definition for Anthropic Native Structured Outputs
 */
export const FAZKY_LEDGER_SCHEMA = {
  name: "fazky_farm_ledger_extraction",
  description: "Extracts structured grid data and separates unstructured marginalia from handwritten agricultural ledgers.",
  type: "object",
  properties: {
    ledger_date: {
      type: "string",
      description: "The date written on the ledger page, formatted as YYYY-MM-DD. If missing, output null."
    },
    matrix_data: {
      type: "array",
      description: "Structured tabular data containing egg production counts and feed consumption.",
      items: {
        type: "object",
        properties: {
          pen_block: {
            type: "string",
            description: "The current section or grouping header, e.g., 'Pen A', 'Pen B', 'New Layers', 'Main'."
          },
          worker_name: {
            type: "string",
            description: "The name or ID found in the first column of the row, e.g., 'Amos', 'Iya Sunday', 'Muslimat'."
          },
          eggs_morning: { type: ["number", "null"] },
          eggs_evening: { type: ["number", "null"] },
          eggs_total: { type: ["number", "null"] },
          feeds_morning: { type: ["number", "null"] },
          feeds_evening: { type: ["number", "null"] },
          feeds_total: { type: ["number", "null"] }
        },
        required: ["pen_block", "worker_name", "eggs_morning", "eggs_evening", "eggs_total", "feeds_morning", "feeds_evening", "feeds_total"],
        additionalProperties: false
      }
    },
    unstructured_marginalia: {
      type: "array",
      description: "Any text, notes, financials, or mortality counts written outside the main grid matrices.",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["Mortality", "Financial", "General Note", "Inventory"]
          },
          entity: {
            type: ["string", "null"],
            description: "The person, animal, or object associated with the note (e.g., 'Amos', 'Baba', 'Big chicken')."
          },
          numerical_value: {
            type: ["number", "null"],
            description: "Any monetary amount or mortality count associated with the note."
          },
          raw_text: {
            type: "string",
            description: "The exact verbatim text of the scrawled note."
          }
        },
        required: ["category", "raw_text"],
        additionalProperties: false
      }
    }
  },
  required: ["ledger_date", "matrix_data", "unstructured_marginalia"],
  additionalProperties: false
};
