import type {
  FeedbackCategory,
  FeedbackStatus,
  MoscowPriority,
  RoadmapStatus,
} from '../src/types/productpulse.js';

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  'Feature Requests',
  'Bug Reports',
  'Usability Issues',
  'Performance Issues',
  'General Suggestions',
];

export const FEEDBACK_STATUSES: FeedbackStatus[] = [
  'New',
  'Under Review',
  'Planned',
  'Resolved',
  'Archived',
];

export const ROADMAP_STATUSES: RoadmapStatus[] = [
  'Backlog',
  'Planned',
  'In Progress',
  'Testing',
  'Released',
];

export const MOSCOW_PRIORITIES: MoscowPriority[] = [
  'Must Have',
  'Should Have',
  'Could Have',
  "Won't Have",
];

export function isValidEmail(email: unknown): email is string {
  return (
    typeof email === 'string' &&
    email.trim().length >= 5 &&
    email.trim().length <= 180 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

export function nonEmptyString(
  val: unknown,
  minLen = 1,
  maxLen = 2000
): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed.length < minLen || trimmed.length > maxLen) return null;
  return trimmed;
}

export function boundedNumber(
  val: unknown,
  min: number,
  max: number
): number | null {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

export interface ParsedCsvRow {
  title: string;
  content: string;
  customerSegment: string;
  category?: FeedbackCategory;
  rating: number;
}

/**
 * Parses RFC-4180 compliant CSV (with UTF-8 BOM stripping and quoted fields).
 */
export function parseFeedbackCsv(rawCsv: string): {
  rows: ParsedCsvRow[];
  errors: string[];
} {
  const cleaned = rawCsv.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return { rows: [], errors: ['CSV payload is empty.'] };
  }

  const lines: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField.trim());
        lines.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField.trim());
        lines.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    lines.push(currentRow);
  }

  if (lines.length < 2) {
    return {
      rows: [],
      errors: ['CSV must include a header row and at least one data row.'],
    };
  }

  const headers = lines[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const titleIdx = headers.findIndex((h) => h === 'title' || h === 'subject');
  const contentIdx = headers.findIndex(
    (h) => h === 'content' || h === 'feedback' || h === 'description' || h === 'body'
  );
  const segmentIdx = headers.findIndex(
    (h) => h === 'customer_segment' || h === 'segment'
  );
  const categoryIdx = headers.findIndex((h) => h === 'category');
  const ratingIdx = headers.findIndex((h) => h === 'rating' || h === 'score');

  if (titleIdx === -1 || contentIdx === -1) {
    return {
      rows: [],
      errors: ['CSV header must contain "title" and "content" (or "feedback") columns.'],
    };
  }

  const rows: ParsedCsvRow[] = [];
  const errors: string[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r];
    if (cols.every((c) => c === '')) continue;

    const title = cols[titleIdx]?.trim() ?? '';
    const content = cols[contentIdx]?.trim() ?? '';
    if (!title || !content) {
      errors.push(`Row ${r + 1}: missing required title or content.`);
      continue;
    }

    const rawSegment = segmentIdx !== -1 ? cols[segmentIdx]?.trim() : '';
    const rawCat = categoryIdx !== -1 ? cols[categoryIdx]?.trim() : '';
    const matchedCategory = FEEDBACK_CATEGORIES.find(
      (c) => c.toLowerCase() === rawCat.toLowerCase()
    );

    let rating = 3;
    if (ratingIdx !== -1 && cols[ratingIdx]) {
      const parsedRating = Number(cols[ratingIdx]);
      if (Number.isInteger(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
        rating = parsedRating;
      } else {
        errors.push(`Row ${r + 1}: invalid rating "${cols[ratingIdx]}", expected 1-5.`);
        continue;
      }
    }

    rows.push({
      title: title.slice(0, 180),
      content: content.slice(0, 2000),
      customerSegment: rawSegment || 'Mid-Market',
      category: matchedCategory,
      rating,
    });
  }

  return { rows, errors };
}
