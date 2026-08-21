/**
 * PDF reading for the JobMatch tool — ported from vaerktoej.php.
 *
 * pdf.js 3.11.174 — SAMME version som POC'en brugte fra cdnjs, så parsingen
 * er uændret — men serveret fra egen origin (public/vendor/pdfjs/, kopieret
 * fra pdfjs-dist i devDependencies). CDN-udgaven fejlede i produktion:
 * next/script med beforeInteractive understøttes ikke på sideniveau, så
 * window.pdfjsLib fandtes aldrig, og hver PDF endte i "kunne ikke læses".
 * Nu hentes scriptet lazy, første gang en PDF skal læses — og fra samme
 * origin, så worker'en kører som rigtig worker i stedet for cross-origin-
 * fallback på main thread.
 */

import { FACTORS, type FactorValues } from './model';

interface PdfTextItem {
  str?: string;
}

interface PdfPage {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
}

interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(source: { data: ArrayBuffer }): { promise: Promise<PdfDocument> };
}

const SCRIPT_SRC = '/vendor/pdfjs/pdf.min.js';
const WORKER_SRC = '/vendor/pdfjs/pdf.worker.min.js';

/** Én igangværende indlæsning ad gangen — to hurtige filvalg deler den. */
let loading: Promise<PdfJsLib> | null = null;

function pdfjs(): Promise<PdfJsLib> {
  const lib = (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib;
  if (lib) return Promise.resolve(lib);

  loading ??= new Promise<PdfJsLib>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.onload = () => {
      const loaded = (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib;
      if (loaded) resolve(loaded);
      else reject(new Error('pdf.min.js indlæst, men window.pdfjsLib mangler'));
    };
    script.onerror = () => {
      // Nulstilles, så et nyt filvalg kan prøve igen efter en netværksfejl.
      loading = null;
      script.remove();
      reject(new Error(`kunne ikke hente ${SCRIPT_SRC}`));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export async function readPdfText(file: File): Promise<string> {
  const lib = await pdfjs();
  lib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
  const buffer = await file.arrayBuffer();
  const document = await lib.getDocument({ data: buffer }).promise;
  let out = '';
  for (let page = 1; page <= document.numPages; page += 1) {
    const content = await (await document.getPage(page)).getTextContent();
    out += `${content.items.map((item) => item.str ?? '').join(' ')}\n`;
  }
  return out;
}

export const OTHER_DISC =
  /(everything\s*disc|extended\s*disc|thomas\s+(?:international|ppa)|insights\s+discovery|garuda|e-?stimate|persolog|discover\s*profile|predictive\s+index)/i;

export function isMasterDisc(text: string): boolean {
  return /master\s*disc/i.test(text);
}

export interface ParsedDisc {
  /** Arbejdsprofilen, graf 1. */
  work: FactorValues | null;
  name: string | null;
}

/**
 * Reads the work profile (graph 1) and the candidate name out of a MasterDISC
 * report.
 *
 * The POC also pulled graph 2 into state.priv, but nothing ever read it (see
 * docs/KORTLAEGNING.md), so that part is gone. The rules that decide `work` are
 * unchanged: first "nn D nn I nn S nn C" match, otherwise the table form
 * "D · Dominans 97 74 +23".
 */
export function parseDisc(text: string): ParsedDisc {
  const flat = text.replace(/\s+/g, ' ');
  const result: ParsedDisc = { work: null, name: null };

  const graphs: FactorValues[] = [];
  const pattern = /(\d{1,3})\s*D\s*(\d{1,3})\s*I\s*(\d{1,3})\s*S\s*(\d{1,3})\s*C/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(flat)) !== null) {
    const graph: FactorValues = {
      D: Number(match[1]),
      I: Number(match[2]),
      S: Number(match[3]),
      C: Number(match[4]),
    };
    if (FACTORS.every((factor) => graph[factor] >= 0 && graph[factor] <= 100)) graphs.push(graph);
  }
  if (graphs[0]) result.work = graphs[0];

  if (!result.work) {
    const table: Partial<Record<string, [number, number]>> = {};
    for (const factor of FACTORS) {
      const rowPattern = new RegExp(`${factor}\\s*·\\s*\\w+\\s+(\\d{1,3})\\s+(\\d{1,3})\\s*[+-]`);
      const row = flat.match(rowPattern);
      if (row?.[1] && row[2]) table[factor] = [Number(row[1]), Number(row[2])];
    }
    if (Object.keys(table).length === 4) {
      result.work = {
        D: table.D?.[0] ?? 50,
        I: table.I?.[0] ?? 50,
        S: table.S?.[0] ?? 50,
        C: table.C?.[0] ?? 50,
      };
    }
  }

  const named = flat.match(
    /MasterDISC\s+([A-ZÆØÅ][\wæøåÆØÅ'-]+(?:\s+[A-ZÆØÅ][\wæøåÆØÅ'-]+){0,2})\s*·/,
  );
  if (named?.[1]) {
    result.name = named[1].trim();
  } else {
    const greeting = flat.match(/Hej\s+([A-ZÆØÅ][\wæøåÆØÅ'-]+)/);
    if (greeting?.[1]) result.name = greeting[1];
  }
  return result;
}
