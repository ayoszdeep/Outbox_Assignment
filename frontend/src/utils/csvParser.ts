export interface LeadFileStats {
  /** Unique, valid addresses - this is the number of emails that will actually be scheduled. */
  valid: number;
  /** Non-empty rows that contained no address at all (a header row is not counted). */
  invalid: number;
  duplicates: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Counts the addresses in a lead file, using the same rules as the backend parser in
 * `src/services/campaign.service.ts`, so the count shown in Compose is the count that gets
 * scheduled: BOM stripped, any of comma / semicolon / tab as a separator, every cell tested
 * so extra columns and an optional header row look after themselves, duplicates collapsed.
 */
export const parseLeadText = (text: string): LeadFileStats => {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const unique = new Set<string>();
  let duplicates = 0;
  let invalid = 0;
  let isFirstContentLine = true;

  for (const line of lines) {
    if (!line.trim()) continue;

    let foundOnThisLine = 0;

    for (const cell of line.split(/[,;\t]/)) {
      const candidate = cell.trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (!EMAIL_REGEX.test(candidate)) continue;

      foundOnThisLine += 1;
      if (unique.has(candidate)) {
        duplicates += 1;
      } else {
        unique.add(candidate);
      }
    }

    // A first line with no address is a header, not a bad row.
    if (foundOnThisLine === 0 && !isFirstContentLine) invalid += 1;
    isFirstContentLine = false;
  }

  return { valid: unique.size, invalid, duplicates };
};

export const parseEmailsFromFile = (file: File): Promise<LeadFileStats> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        resolve(parseLeadText(String(event.target?.result ?? '')));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
