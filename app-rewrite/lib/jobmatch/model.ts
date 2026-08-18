/**
 * JobMatch — model, beregning og rapport.
 *
 * Ported from the JavaScript in public_html/jobmatch/vaerktoej.php (l. 739-1868).
 * The maths, the thresholds, the weights and every piece of report text are
 * unchanged; only the types and the "state as a parameter instead of a global"
 * are new.
 *
 * Not ported, because nothing ever called them in the POC (see
 * docs/KORTLAEGNING.md): strengthList(), riskList() and the OVER/UNDER/MATCH
 * text tables they used. The report has always been built from the short
 * variants, strengthShort()/riskShort().
 */

export const FACTORS = ['D', 'I', 'S', 'C'] as const;
export type Factor = (typeof FACTORS)[number];
export type FactorValues = Record<Factor, number>;

export const FACTOR_NAME: Record<Factor, string> = {
  D: 'Dominans',
  I: 'Indflydelse',
  S: 'Stabilitet',
  C: 'Competence',
};

export const FACTOR_COLOR: Record<Factor, string> = {
  D: 'var(--D)',
  I: 'var(--I)',
  S: 'var(--S)',
  C: 'var(--C)',
};

export interface Preset {
  id: string;
  name: string;
  req: FactorValues | null;
}

export const PRESETS: Preset[] = [
  { id: 'opsog', name: 'Opsøgende salg / Client Manager', req: { D: 76, I: 78, S: 35, C: 48 } },
  { id: 'kam', name: 'Key Account / rådgivende salg', req: { D: 62, I: 66, S: 52, C: 62 } },
  { id: 'leder', name: 'Salgsleder', req: { D: 82, I: 70, S: 40, C: 52 } },
  { id: 'service', name: 'Kundeservice', req: { D: 34, I: 58, S: 76, C: 56 } },
  { id: 'adm', name: 'Administration / økonomi', req: { D: 28, I: 30, S: 66, C: 86 } },
  { id: 'proj', name: 'Projektleder', req: { D: 64, I: 54, S: 50, C: 72 } },
  { id: 'spec', name: 'Specialist / teknisk', req: { D: 40, I: 34, S: 56, C: 84 } },
  { id: 'trainee', name: 'Trainee / generalist', req: { D: 52, I: 56, S: 54, C: 56 } },
  { id: 'egen', name: 'Tilpas selv', req: null },
];

export interface Question {
  id: string;
  /** Short label, used in the report's match balance. */
  s: string;
  /** Full title. */
  t: string;
  /** Description. */
  d: string;
  /** Anchor texts for 1, 5 and 10. */
  g: { 1: string; 5: string; 10: string };
  /** Follow-up questions when the score is low. */
  lowQ: string[];
  custom?: boolean;
}

export const BASE_QUESTIONS: Question[] = [
  {
    id: 'kemi',
    s: 'Kemi',
    t: 'Personlig kemi',
    d: 'Hvor godt svinger du med personen? Din mavefornemmelse efter mødet — ikke om personen er dygtig, men om kontakten fungerer.',
    g: {
      1: 'Kontakten var anstrengt — samtalen løb aldrig frit.',
      5: 'Fin, professionel kontakt, men uden egentlig forbindelse.',
      10: 'Samtalen løb af sig selv — I fandt hinanden fra første minut.',
    },
    lowQ: [
      'Hvad var det konkret, der skurrede i mødet — form, tempo eller indhold?',
      'Hvordan ville personen virke på din bedste kunde?',
    ],
  },
  {
    id: 'teori',
    s: 'Teori',
    t: 'Teoretisk ballast',
    d: 'Uddannelse og faglig, vidensbaseret baggrund: matcher kandidatens uddannelsesmæssige niveau det, jobbet kræver?',
    g: {
      1: 'Uddannelsesniveauet ligger klart under det, jobbet kræver.',
      5: 'Niveauet er tæt på — enkelte huller, der kan lukkes med oplæring.',
      10: 'Uddannelse og faglig viden matcher jobbets krav fuldt ud fra dag ét.',
    },
    lowQ: [
      'Hvilken viden mangler konkret, og kan den bygges op inden for prøvetiden?',
      'Hvordan har du holdt din faglige viden ved lige de seneste to år?',
    ],
  },
  {
    id: 'erf',
    s: 'Erfaring',
    t: 'Erfaring med branche og job',
    d: 'Praktisk erfaring fra branchen og fra tilsvarende job — dokumenteret gennem det, kandidaten faktisk har lavet.',
    g: {
      1: 'Ingen erfaring fra hverken branchen eller lignende job.',
      5: 'Erfaring fra beslægtet branche eller lignende opgaver — men ikke begge dele.',
      10: 'Solid erfaring fra både branchen og et tilsvarende job, med dokumenterede resultater.',
    },
    lowQ: [
      'Hvilke af rollens kerneopgaver har kandidaten aldrig prøvet i praksis?',
      'Beskriv den opgave fra dit nuværende job, der ligner denne rolle mest.',
    ],
  },
  {
    id: 'ref',
    s: 'Referencer',
    t: 'Referencer',
    d: 'Hvor stærke er de referencer, du har indhentet — indhold, kilde og hvor konkrete de er.',
    g: {
      1: 'Referencerne var advarende — eller kandidaten kunne ikke oplyse referencer.',
      5: 'Pæne men generelle referencer uden konkrete eksempler.',
      10: 'Stærke, konkrete referencer fra relevante kilder — de ville ansætte igen uden tøven.',
    },
    lowQ: [
      'Hvad blev der ikke sagt i referencen, som du gerne ville have hørt?',
      'Hvem hos din nuværende arbejdsgiver kender dine resultater bedst?',
    ],
  },
  {
    id: 'flex',
    s: 'Fleksibilitet',
    t: 'Fleksibilitet',
    d: 'Hvor omstillingsparat er personen i forhold til opgaver, tempo, rejsedage og forandringer i rollen.',
    g: {
      1: 'Låst på opgaver, tid og form — jobbet skal passe til personen.',
      5: 'Fleksibel på nogle punkter, klare forbehold på andre.',
      10: 'Møder forandringer åbent og har vist omstilling i praksis.',
    },
    lowQ: [
      'Hvilke dele af jobbet vil kandidaten helst slippe for — og kan I leve med det?',
      'Fortæl om en gang, jobbet ændrede sig markant. Hvad gjorde du de første to uger?',
    ],
  },
  {
    id: 'mot',
    s: 'Motivation',
    t: 'Motivation for netop dette job',
    d: 'Hvor troværdigt er det, at personen vil dette job hos jer — og ikke bare et job.',
    g: {
      1: 'Søger et job — kunne være hvor som helst.',
      5: 'Reel interesse, men begrundelsen er generisk.',
      10: 'Vil netop dette job hos jer — begrunder det konkret og har gjort sit hjemmearbejde.',
    },
    lowQ: [
      'Hvad ved kandidaten om jer, som kun én der har gjort sig umage kunne vide?',
      'Hvis du fik to tilbud i morgen, hvad ville afgøre valget?',
    ],
  },
];

export interface Answer {
  score: number | null;
  na: boolean;
  weight: number;
  note: string;
}

export interface CustomQuestionDef {
  id: string;
  /** Title, as typed by the user. */
  t: string;
  d?: string;
}

export interface CaseMeta {
  cand: string;
  role: string;
  comp: string;
  lead: string;
  round: string;
  date: string;
  case: string;
}

/**
 * The tool's full state — the same object the POC serialised in "Gem sag som
 * fil" and "Gem i arkivet", minus the dead `priv` field. Old case files that
 * still carry `priv` load fine; the field is simply ignored.
 */
export interface ToolState {
  meta: CaseMeta;
  work: FactorValues;
  req: FactorValues;
  fw: FactorValues;
  preset: string;
  tol: number;
  answers: Record<string, Answer>;
  jobText: string;
  jobExtra: string;
  discFile: string;
  jobFile: string;
  discRejected: boolean;
  customQ: CustomQuestionDef[];
  mix: number;
  terms: { accepted: boolean; when: string };
}

export function emptyAnswer(): Answer {
  return { score: null, na: false, weight: 1, note: '' };
}

export function initialState(dateLabel: string): ToolState {
  const answers: Record<string, Answer> = {};
  for (const question of BASE_QUESTIONS) answers[question.id] = emptyAnswer();
  return {
    meta: { cand: '', role: '', comp: '', lead: '', round: '1. samtale', date: dateLabel, case: '' },
    work: { D: 50, I: 50, S: 50, C: 50 },
    req: { D: 60, I: 60, S: 50, C: 55 },
    fw: { D: 1, I: 1, S: 1, C: 1 },
    preset: 'egen',
    tol: 12,
    answers,
    jobText: '',
    jobExtra: '',
    discFile: '',
    jobFile: '',
    discRejected: false,
    customQ: [],
    mix: 60,
    terms: { accepted: false, when: '' },
  };
}

/** A custom question gets the same generic guide texts as in the POC. */
export function customQuestion(def: CustomQuestionDef): Question {
  return {
    id: def.id,
    s: def.t,
    t: def.t,
    custom: true,
    d: def.d ?? 'Eget vurderingspunkt for denne stilling.',
    g: {
      1: 'Langt under det, stillingen kræver.',
      5: 'På niveau med kravet — hverken styrke eller svaghed.',
      10: 'En markant styrke, dokumenteret med konkrete eksempler.',
    },
    lowQ: [
      `Hvad har du konkret set eller hørt, der underbygger vurderingen af ${def.t.toLowerCase()}?`,
    ],
  };
}

export function questionsFor(state: ToolState): Question[] {
  return [...BASE_QUESTIONS, ...state.customQ.map(customQuestion)];
}

export function answerFor(state: ToolState, id: string): Answer {
  return state.answers[id] ?? emptyAnswer();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function esc(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/[&<>"]/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      default:
        return '&quot;';
    }
  });
}

// ============================================================================
// Vurdering af stillingsbeskrivelsen
// ============================================================================

export interface JobCheck {
  id: string;
  re: RegExp;
  ok: string;
  miss: string;
}

export const JOB_CHECKS: JobCheck[] = [
  {
    id: 'formaal',
    re: /(formål|mission|hvorfor findes)/i,
    ok: 'Formålet med stillingen er beskrevet',
    miss: 'Formål: Hvorfor findes stillingen — hvad skal den flytte for forretningen?',
  },
  {
    id: 'opgaver',
    re: /(arbejdsopgaver|dine opgaver|ansvarsområder|ansvarlig for)/i,
    ok: 'Arbejdsopgaver og ansvar er beskrevet',
    miss: 'Arbejdsopgaver: Hvad fylder en typisk uge? Konkrete opgaver gør kravprofilen skarpere.',
  },
  {
    id: 'faglig',
    re: /(kvalifikation|erfaring|uddannelse|faglig)/i,
    ok: 'Faglige kvalifikationer er beskrevet',
    miss: 'Faglige krav: Hvilken erfaring og viden skal kandidaten have med fra dag ét?',
  },
  {
    id: 'personlig',
    re: /(personlige|egenskaber|som person|personprofil)/i,
    ok: 'Personlige kvalifikationer er beskrevet',
    miss: 'Personlige egenskaber: Hvilken adfærd lykkes i rollen? Det styrker DISC-kravprofilen direkte.',
  },
  {
    id: 'succes',
    re: /(succeskriteri|kpi|målepunkt|resultatkrav|targets)/i,
    ok: "Succeskriterier og KPI'er er beskrevet",
    miss: 'Succeskriterier: Hvordan ser succes ud efter 12 måneder? Uden mål bliver vurderingen synsning.',
  },
  {
    id: 'org',
    re: /(refererer til|organisat|afdeling|teamet|nærmeste leder)/i,
    ok: 'Organisation og team er nævnt',
    miss: 'Organisering: Hvem refererer stillingen til, og hvilket team indgår den i?',
  },
  {
    id: 'vilkaar',
    re: /(løn|arbejdstid|vilkår|lokation|hjemmearbejde|rejsedage|rejseaktivitet)/i,
    ok: 'Vilkår (løn, tid eller sted) er nævnt',
    miss: 'Vilkår: Løn, arbejdstid, lokation og rejseaktivitet — det påvirker fleksibilitetsspørgsmålet.',
  },
  {
    id: 'virk',
    re: /(om os|om virksomheden|virksomheden (har|er|blev)|vi er |vi tilbyder|etableret|grundlagt|stiftet|medarbejdere|ansatte|afdelinger|lokationer|kontorer|datterselskab|omsætning på|markedsleder|(ligger|placeret) .{0,20}(i|på))/i,
    ok: 'Virksomheden præsenterer sig selv',
    miss: 'Om virksomheden: Oplysninger om virksomhedens historie, størrelse og andre facts ville gøre beskrivelsen stærkere.',
  },
  {
    id: 'udvikling',
    re: /(udvikling|karriere|oplæring|onboarding)/i,
    ok: 'Udvikling og oplæring er nævnt',
    miss: 'Udvikling: Hvad kan kandidaten blive her? Vigtigt for motivations-vurderingen.',
  },
];

export const SIGNAL_WORDS: Record<Factor, string[]> = {
  D: [
    'resultat',
    'mål',
    'kpi',
    'omsætning',
    'vækst',
    'lukke',
    'forhandle',
    'opsøgende',
    'ambitiøs',
    'proaktiv',
    'drive',
    'konkurrence',
    'sælge',
    'salg',
    'targets',
    'beslutning',
    'ansvarlig',
    'indfri',
    'selvledelse',
  ],
  I: [
    'relation',
    'netværk',
    'præsentere',
    'præsentation',
    'kunde',
    'kommunikation',
    'møder',
    'oplæg',
    'samarbejdspartner',
    'positiv',
    'entusias',
    'kultur',
    'formidle',
    'linkedin',
    'synlighed',
    'tillid',
  ],
  S: [
    'servicering',
    'service',
    'vedligeholde',
    'loyal',
    'langvarig',
    'opfølgning',
    'følge op',
    'support',
    'stabil',
    'team',
    'samarbejde',
    'trygge',
    'tålmodig',
    'portefølje',
  ],
  C: [
    'analytisk',
    'struktureret',
    'proces',
    'procedurer',
    'dokumentation',
    'kvalitet',
    'detalje',
    'rapportering',
    'data',
    'systematisk',
    'korrekt',
    'faglig',
    'juridisk',
    'kontrakt',
    'måle',
  ],
};

export interface JobAssessment {
  level: string;
  col: string;
  head: string;
  disc: string;
  found: JobCheck[];
  missing: JobCheck[];
}

export function assessJob(text: string): JobAssessment {
  const wordCount = text.trim().split(/\s+/).length;
  const found: JobCheck[] = [];
  const missing: JobCheck[] = [];
  for (const check of JOB_CHECKS) (check.re.test(text) ? found : missing).push(check);

  const hits: FactorValues = { D: 0, I: 0, S: 0, C: 0 };
  const lower = text.toLowerCase();
  for (const factor of FACTORS) {
    for (const word of SIGNAL_WORDS[factor]) if (lower.includes(word)) hits[factor] += 1;
  }
  const totalHits = FACTORS.reduce((sum, factor) => sum + hits[factor], 0);
  const topFactor = [...FACTORS].sort((a, b) => hits[b] - hits[a])[0] as Factor;

  let level: string;
  let col: string;
  let head: string;
  if (found.length >= 7 && wordCount >= 150) {
    level = 'God';
    col = 'var(--ok)';
    head = `Beskrivelsen er grundig (${wordCount} ord) og dækker ${found.length} af ${JOB_CHECKS.length} kerneelementer. Kravprofilen kan sættes på et solidt grundlag.`;
  } else if (found.length >= 4) {
    level = 'Brugbar';
    col = 'var(--warn)';
    head = `Beskrivelsen dækker ${found.length} af ${JOB_CHECKS.length} kerneelementer (${wordCount} ord). Den kan bruges, men punkterne til højre vil gøre både kravprofil og samtale skarpere.`;
  } else {
    level = 'Tynd';
    col = 'var(--stop)';
    head = `Beskrivelsen dækker kun ${found.length} af ${JOB_CHECKS.length} kerneelementer (${wordCount} ord). Suppler den, før du sætter kravprofilen — ellers vurderer du på fornemmelse.`;
  }

  let disc: string;
  if (totalHits < 5) {
    disc =
      'Adfærdskravene er svære at aflæse i teksten — beskriv hvordan der skal arbejdes, ikke kun hvad der skal laves.';
  } else if (hits[topFactor] / totalHits > 0.55) {
    disc = `Sprogbrugen peger entydigt mod ${topFactor} (${FACTOR_NAME[topFactor]}) — tjek på næste trin, om det matcher rollens virkelighed.`;
  } else {
    disc =
      'Sprogbrugen giver et brugbart adfærdssignal — brug "Foreslå kravprofil" på næste trin som udgangspunkt.';
  }

  return { level, col, head, disc, found, missing };
}

export function jobFullText(state: ToolState): string {
  return `${state.jobText || ''}\n${state.jobExtra || ''}`.trim();
}

export interface Suggestion {
  req: FactorValues;
  raw: FactorValues;
}

export function suggestFromText(text: string): Suggestion | null {
  const lower = (text || '').toLowerCase();
  if (lower.length < 60) return null;
  const raw: FactorValues = { D: 0, I: 0, S: 0, C: 0 };
  let total = 0;
  for (const factor of FACTORS) {
    raw[factor] = SIGNAL_WORDS[factor].reduce(
      (count, word) => count + (lower.split(word).length - 1),
      0,
    );
    total += raw[factor];
  }
  if (total < 4) return null;
  let squareRootSum = 0;
  for (const factor of FACTORS) squareRootSum += Math.sqrt(raw[factor]);
  const req: FactorValues = { D: 0, I: 0, S: 0, C: 0 };
  for (const factor of FACTORS) {
    // dæmpet andel, 0..1
    const share = Math.sqrt(raw[factor]) / squareRootSum;
    req[factor] = Math.round(clamp(55 + (share - 0.25) * 160, 30, 85));
  }
  return { req, raw };
}

// ============================================================================
// Beregning
// ============================================================================

export function fitScore(gap: number, tol: number): number {
  if (gap <= tol) return 100;
  return Math.max(0, 100 - (gap - tol) * 2.2);
}

export interface Computed {
  tol: number;
  gapsW: FactorValues;
  roleFit: number;
  inSpan: number;
  worst: Factor;
  recruiter: number | null;
  total: number;
  answered: number;
  criticals: Question[];
  highLow: Question[];
}

export function compute(state: ToolState, questions: Question[]): Computed {
  const tol = state.tol;
  const gapsW: FactorValues = { D: 0, I: 0, S: 0, C: 0 };
  for (const factor of FACTORS) gapsW[factor] = state.work[factor] - state.req[factor];
  const factorWeight = (factor: Factor) => state.fw[factor] || 1;

  let scoreSum = 0;
  let weightSum = 0;
  for (const factor of FACTORS) {
    scoreSum += fitScore(Math.abs(gapsW[factor]), tol) * factorWeight(factor);
    weightSum += factorWeight(factor);
  }
  const roleFit = scoreSum / weightSum;
  const inSpan = FACTORS.filter((factor) => Math.abs(gapsW[factor]) <= tol).length;

  let worst: Factor = FACTORS[0];
  for (const factor of FACTORS) {
    const cost = Math.max(0, Math.abs(gapsW[factor]) - tol) * factorWeight(factor);
    const worstCost = Math.max(0, Math.abs(gapsW[worst]) - tol) * factorWeight(worst);
    if (cost > worstCost) worst = factor;
  }

  let numerator = 0;
  let denominator = 0;
  let answered = 0;
  for (const question of questions) {
    const answer = answerFor(state, question.id);
    if (answer.na || answer.score === null) continue;
    numerator += answer.score * answer.weight;
    denominator += 10 * answer.weight;
    answered += 1;
  }
  const recruiter = denominator ? (numerator / denominator) * 100 : null;

  const mix = (typeof state.mix === 'number' ? clamp(state.mix, 0, 100) : 60) / 100;
  const total = Math.round(recruiter === null ? roleFit : recruiter * mix + roleFit * (1 - mix));

  const criticals = questions.filter((question) => {
    const answer = answerFor(state, question.id);
    return !answer.na && answer.score !== null && answer.weight >= 2.4 && answer.score <= 5;
  });
  const highLow = questions.filter((question) => {
    const answer = answerFor(state, question.id);
    return (
      !answer.na &&
      answer.score !== null &&
      answer.weight >= 1.6 &&
      answer.weight < 2.4 &&
      answer.score <= 4
    );
  });

  return {
    tol,
    gapsW,
    roleFit: Math.round(roleFit),
    inSpan,
    worst,
    recruiter: recruiter === null ? null : Math.round(recruiter),
    total,
    answered,
    criticals,
    highLow,
  };
}

export interface Verdict {
  key: 'stop' | 'go' | 'go2' | 'wait' | 'no';
  color: string;
  label: string;
  text: string;
}

export function verdictOf(c: Computed): Verdict {
  if (c.criticals.length) {
    if (c.total < 50) {
      return {
        key: 'stop',
        color: 'var(--stop)',
        label: 'Frarådes — kritisk punkt og svagt match',
        text: 'Både den samlede score og et kritisk punkt taler imod ansættelse. Skal der alligevel ansættes, kræver det særlige forhold, som rapporten ikke har fanget — og de skal kunne formuleres konkret, før du går videre.',
      };
    }
    return {
      key: 'stop',
      color: 'var(--stop)',
      label: 'Forbehold på et kritisk punkt',
      text: 'Lav score på et punkt, du selv har markeret som kritisk. Der bør ikke ansættes, før punktet er afklaret — og kan det ikke afklares, er svaret nej, uanset totalen.',
    };
  }
  if (c.total >= 80) {
    return {
      key: 'go',
      color: 'var(--ok)',
      label: 'Stærkt match — gå videre',
      text: 'Adfærd og din vurdering peger samme vej. Brug rapportens svage punkter aktivt i onboardingen.',
    };
  }
  if (c.total >= 65) {
    return {
      key: 'go2',
      color: 'var(--ok)',
      label: 'Godt match — med forbehold',
      text: 'Grundlaget er solidt, men rapportens svage punkter skal håndteres bevidst, ikke overses.',
    };
  }
  if (c.total >= 50) {
    return {
      key: 'wait',
      color: 'var(--warn)',
      label: 'Muligt match — afklar før beslutning',
      text: 'Nok til at fortsætte, ikke nok til at beslutte. Brug rapportens spørgsmål i næste samtale, før du giver et tilbud.',
    };
  }
  return {
    key: 'no',
    color: 'var(--stop)',
    label: 'Svagt match — ansættelse frarådes',
    text: 'Jobmatchet er dårligt: afstanden mellem jobbets krav og kandidaten er for stor. En ansættelse kræver særlige øvrige forhold, som rapporten ikke måler — kan de ikke formuleres konkret og efterprøves, så søg videre.',
  };
}

export interface Zone {
  from: number;
  to: number;
  name: string;
  col: string;
  cell: string;
  txt: string;
}

/** skalaens intervaller — bruges i intervalguiden */
export const ZONES: Zone[] = [
  {
    from: 0,
    to: 49,
    name: 'Svagt match',
    col: 'var(--stop)',
    cell: 'var(--sc1)',
    txt: 'Afstanden er for stor. Søg videre, eller overvej kandidaten til en anden rolle.',
  },
  {
    from: 50,
    to: 64,
    name: 'Muligt match',
    col: 'var(--warn)',
    cell: 'var(--sc2)',
    txt: 'Nok til at fortsætte dialogen — ikke nok til at beslutte. Afklar de svage punkter først.',
  },
  {
    from: 65,
    to: 79,
    name: 'Godt match',
    col: '#5A9E60',
    cell: 'var(--sc5)',
    txt: 'Solidt grundlag. Ansæt med en plan for de svage punkter.',
  },
  {
    from: 80,
    to: 100,
    name: 'Stærkt match',
    col: 'var(--ok)',
    cell: 'var(--sc6)',
    txt: 'Adfærd og vurdering peger samme vej. Gå videre til tilbud.',
  },
];

function zoneOf(value: number): Zone {
  return ZONES.find((zone) => value >= zone.from && value <= zone.to) ?? (ZONES[0] as Zone);
}

interface ConcludePoint {
  k: string;
  v: string;
  p: string;
  col: string;
}

/** tre skarpe begrundelser for konklusionen */
function concludePoints(state: ToolState, questions: Question[], c: Computed): ConcludePoint[] {
  const points: ConcludePoint[] = [];
  let biggest: Factor = FACTORS[0];
  for (const factor of FACTORS) {
    if (Math.abs(c.gapsW[factor]) > Math.abs(c.gapsW[biggest])) biggest = factor;
  }
  const gap = c.gapsW[biggest];
  const biggestWeight = state.fw[biggest] || 1;
  points.push({
    k: 'DISC versus jobprofil',
    v: `${c.roleFit}/100`,
    p:
      Math.abs(gap) <= c.tol
        ? 'Alle fire faktorer ligger inden for rollens spænd. Adfærden bærer jobbet af sig selv.'
        : `Største afvigelse er ${biggest} (${gap > 0 ? '+' : ''}${gap} mod krav${
            biggestWeight === 2 ? ', vægtet høj' : ''
          }). Det er dét, de svage punkter handler om.`,
    col: c.roleFit >= 75 ? 'var(--ok)' : c.roleFit >= 55 ? 'var(--warn)' : 'var(--stop)',
  });

  if (c.recruiter === null) {
    points.push({
      k: 'Din vurdering',
      v: '—',
      p: 'Ingen svar afgivet. Totalen hviler alene på adfærdsdata — et tyndt grundlag at ansætte på.',
      col: 'var(--ink-45)',
    });
  } else {
    let lowId: string | null = null;
    let highId: string | null = null;
    for (const question of questions) {
      const answer = answerFor(state, question.id);
      if (answer.na || answer.score === null) continue;
      if (lowId === null || answer.score < (answerFor(state, lowId).score ?? 0)) lowId = question.id;
      if (highId === null || answer.score > (answerFor(state, highId).score ?? 0)) {
        highId = question.id;
      }
    }
    const lowQuestion = questions.find((q) => q.id === lowId);
    const highQuestion = questions.find((q) => q.id === highId);
    points.push({
      k: 'Din vurdering',
      v: `${c.recruiter}/100`,
      p: `Stærkest: ${highQuestion?.t.toLowerCase() ?? '—'} (${
        highId ? answerFor(state, highId).score : '—'
      }/10). Svagest: ${lowQuestion?.t.toLowerCase() ?? '—'} (${
        lowId ? answerFor(state, lowId).score : '—'
      }/10) — dét punkt afgør, om totalen holder.`,
      col: c.recruiter >= 75 ? 'var(--ok)' : c.recruiter >= 55 ? 'var(--warn)' : 'var(--stop)',
    });
  }

  if (c.criticals.length) {
    points.push({
      k: 'Kritisk punkt',
      v: `${c.criticals.length}${c.criticals.length === 1 ? ' punkt' : ' punkter'}`,
      p: `Lav score på: ${c.criticals
        .map((q) => q.t.toLowerCase())
        .join(', ')}. Markeret kritisk af dig selv — afklar før tilbud.`,
      col: 'var(--stop)',
    });
  } else {
    const outside = FACTORS.filter((factor) => Math.abs(c.gapsW[factor]) > c.tol);
    points.push({
      k: 'Inden for kravspænd',
      v: `${c.inSpan} af 4`,
      p: outside.length
        ? `Uden for spænd: ${outside
            .map((factor) => {
              const weight = state.fw[factor] || 1;
              return `${factor}${weight === 2 ? ' (vægt høj)' : weight === 0.5 ? ' (vægt lav)' : ''}`;
            })
            .join(', ')}. Faktorvægten afgør, hvor hårdt det trækker.`
        : 'Alle fire faktorer rammer det spænd, du har accepteret. Adfærdsmæssigt er rollen hjemme.',
      col: c.inSpan === 4 ? 'var(--ok)' : c.inSpan >= 2 ? 'var(--warn)' : 'var(--stop)',
    });
  }
  return points;
}

function interviewQuestions(state: ToolState, questions: Question[], c: Computed): string[] {
  const out: string[] = [];
  for (const question of questions) {
    const answer = answerFor(state, question.id);
    if (!answer.na && answer.score !== null && answer.score <= 6) out.push(...question.lowQ);
    if (!answer.na && answer.score === null) {
      const second = question.lowQ[1];
      if (second !== undefined) out.push(second);
    }
  }
  for (const factor of FACTORS) {
    const gap = c.gapsW[factor];
    if (gap > c.tol) {
      const over: Record<Factor, string> = {
        D: 'Fortæl om en gang, du fik ret men tabte rummet. Hvad gjorde du bagefter?',
        I: 'Hvordan sikrer du, at et godt møde faktisk ender med en aftale på skrift?',
        S: 'Hvad gør du, når prioriteterne skifter midt i en uge, du havde planlagt?',
        C: 'Hvornår har du sidst sagt "det her er godt nok" og sendt det af sted?',
      };
      out.push(over[factor]);
    }
    if (gap < -c.tol) {
      const under: Record<Factor, string> = {
        D: 'Beskriv den sidste aftale, du selv lukkede. Hvad gjorde du, da kunden tøvede?',
        I: 'Hvordan får du hul igennem til en kunde, der ikke svarer på hverken mail eller telefon?',
        S: 'Hvordan holder du styr på opfølgning på 40 kunder samtidig?',
        C: 'Hvad gør du for at undgå fejl i det materiale, der går ud til kunden?',
      };
      out.push(under[factor]);
    }
  }
  /* ved faa svage punkter: udfordr styrkerne — enhver styrke har en bagside */
  if (out.length < 4) {
    const top = [...FACTORS].sort((a, b) => state.work[b] - state.work[a])[0] as Factor;
    const strength: Record<Factor, string> = {
      D: 'Din drivkraft er en styrke — hvornår har den senest kostet dig en relation eller en kollega?',
      I: 'Du bygger hurtigt relationer — fortæl om en aftale, der døde, fordi begejstringen løb fra detaljerne.',
      S: 'Din stabilitet er en styrke — hvornår har du sidst holdt fast i noget, du burde have sluppet?',
      C: 'Din grundighed er en styrke — fortæl om en gang, hvor jagten på det perfekte kostede en deadline.',
    };
    out.push(strength[top]);
    out.push('Hvad i dette job vil kræve mest af dig — og hvordan ved vi det om tre måneder?');
    out.push('Hvad skal være anderledes om et år, for at du selv vil kalde ansættelsen en succes?');
  }
  return [...new Set(out)].slice(0, 10);
}

interface LeadAdvice {
  hi: { t: string; p: string };
  loTxt: string;
  hiF: Factor;
  loF: Factor;
}

function leadAdvice(state: ToolState): LeadAdvice {
  const high = [...FACTORS].sort((a, b) => state.work[b] - state.work[a])[0] as Factor;
  const low = [...FACTORS].sort((a, b) => state.work[a] - state.work[b])[0] as Factor;
  const first: Record<Factor, { t: string; p: string }> = {
    D: {
      t: 'Giv mål og lad vejen være fri',
      p: 'Detailstyring er den hurtigste vej til at miste personen. Sæt målet, aftal hvornår I mødes om det, og bland dig ikke imellem. Direkte og ærlig feedback lander bedre end diplomatiske omveje.',
    },
    I: {
      t: 'Anerkend højt og skriv aftaler ned',
      p: 'Personen kører på anerkendelse og kontakt. Ros konkret og offentligt. Til gengæld: afslut hvert møde med en skriftlig konklusion, ellers fordamper aftalerne i begejstringen.',
    },
    S: {
      t: 'Varsl forandringer i god tid',
      p: 'Personen leverer, når rammerne er stabile og forventningerne kendte. Kom med ændringer tidligt, forklar hvorfor, og giv tid til at lande dem, før du forventer et ja.',
    },
    C: {
      t: 'Giv rammer og fakta, ikke pep talk',
      p: 'Personen har brug for at vide, hvad "godt" ser ud som. Vær konkret om kvalitetskrav, giv adgang til data, og undgå at presse en beslutning igennem, før grundlaget er der.',
    },
  };
  const second: Record<Factor, string> = {
    D: 'Fremdrift kommer ikke af sig selv. Aftal et fast ugentligt tjek på pipeline og næste skridt — ikke som kontrol, men som rytme.',
    I: 'Den opsøgende del skal sættes i system. Book faste blokke til kold kontakt, og gør antallet synligt, ellers bliver det den opgave, der udskydes.',
    S: 'Opfølgning og vedholdenhed skal understøttes af værktøj frem for hukommelse. Sæt CRM-rytmen op sammen den første uge.',
    C: 'Struktur og dokumentation skal have en skabelon. Byg den for personen i stedet for at forvente, at den opstår af sig selv.',
  };
  return { hi: first[high], loTxt: second[low], hiF: high, loF: low };
}

/* kompakte lister — maks. én linje pr. punkt */
function strengthShort(state: ToolState, questions: Question[], c: Computed): string[] {
  const out: string[] = [];
  for (const factor of FACTORS) {
    if (Math.abs(c.gapsW[factor]) <= c.tol) {
      out.push(
        `${factor} i rollens spænd — ${state.work[factor]} mod krav ${state.req[factor]}`,
      );
    }
  }
  const top = [...FACTORS].sort((a, b) => state.work[b] - state.work[a])[0] as Factor;
  const topText: Record<Factor, string> = {
    D: 'Høj D — sætter retning, lukker og giver ikke op',
    I: 'Høj I — åbner døre og bygger relationer hurtigt',
    S: 'Høj S — vedholdende og bygger tillid over tid',
    C: 'Høj C — præcis, systematisk og få fejl',
  };
  out.push(topText[top]);
  for (const question of questions) {
    const answer = answerFor(state, question.id);
    if (!answer.na && answer.score !== null && answer.score >= 8) {
      out.push(`${question.t} ${answer.score}/10 — reel styrke i sagen`);
    }
  }
  return out.slice(0, 5);
}

function riskShort(state: ToolState, questions: Question[], c: Computed): string[] {
  const out: string[] = [];
  const over: Record<Factor, string> = {
    D: 'risiko for at køre processer og kolleger over',
    I: 'energien kan gå til det sociale frem for opgaven',
    S: 'søger mere ro, end rollen tilbyder',
    C: 'detaljefokus kan bremse tempoet',
  };
  const under: Record<Factor, string> = {
    D: 'fremdrift kræver tydelige mål og fast opfølgning',
    I: 'opsøgende kontakt kommer ikke af sig selv',
    S: 'vedholdenhed og opfølgning skal understøttes',
    C: 'struktur og dokumentation skal have rammer',
  };
  for (const factor of FACTORS) {
    const gap = c.gapsW[factor];
    if (gap > c.tol) out.push(`${factor} +${gap} over krav — ${over[factor]}`);
    else if (gap < -c.tol) out.push(`${factor} ${gap} under krav — ${under[factor]}`);
  }
  for (const question of questions) {
    const answer = answerFor(state, question.id);
    if (!answer.na && answer.score !== null && answer.score <= 5) {
      out.push(
        `${question.t} kun ${answer.score}/10${answer.weight >= 2.4 ? ' — kritisk punkt' : ''}`,
      );
    }
  }
  const unanswered = questions.filter((question) => {
    const answer = answerFor(state, question.id);
    return answer.score === null && !answer.na;
  });
  if (unanswered.length) {
    out.push(`Ubesvaret: ${unanswered.map((q) => q.t.toLowerCase()).join(', ')}`);
  }
  if (!out.length) {
    out.push('Ingen væsentlige afvigelser — tjek, at kravprofilen er sat skarpt nok');
  }
  return out.slice(0, 5);
}

// ============================================================================
// Rapport
// ============================================================================

/**
 * Builds the report as an HTML string, exactly as buildReport() did.
 *
 * It stays a string because the report is A4-paginated afterwards by measuring
 * the rendered blocks and moving them onto sheets — the same DOM work the POC
 * did in packReport(). The class names and the markup are unchanged, so the
 * print stylesheet still applies.
 */
export function buildReportHtml(
  state: ToolState,
  questions: Question[],
  pageNumber: number,
): string {
  const c = compute(state, questions);
  const v = verdictOf(c);
  const m = state.meta;
  const la = leadAdvice(state);

  /* Matchbalancen: én række pr. element, prik på fælles 0-100-skala */
  const scoreColor = (score: number) =>
    score <= 3
      ? 'var(--stop)'
      : score <= 5
        ? 'var(--warn)'
        : score <= 7
          ? '#7CB342'
          : 'var(--ok)';

  interface BalanceItem {
    label: string;
    sub: string;
    subCol: string;
    x: number;
    val: string;
    col: string;
  }
  const items: BalanceItem[] = [];
  for (const question of questions) {
    const answer = answerFor(state, question.id);
    if (answer.na || answer.score === null) continue;
    const weightLabel =
      answer.weight >= 2.4
        ? 'Kritisk'
        : answer.weight >= 1.6
          ? 'Høj vægt'
          : answer.weight <= 0.5
            ? 'Lav vægt'
            : '';
    items.push({
      label: question.s,
      sub: weightLabel,
      subCol: answer.weight >= 2.4 ? 'var(--stop)' : 'var(--ink-45)',
      x: answer.score * 10,
      val: `${answer.score}/10`,
      col: scoreColor(answer.score),
    });
  }
  items.push({
    label: 'Rollematch',
    sub: 'DISC vs. jobprofil',
    subCol: 'var(--ink-45)',
    x: c.roleFit,
    val: String(c.roleFit),
    col: zoneOf(c.roleFit).col,
  });

  const balanceRows = items
    .map(
      (item) =>
        `<div class="mbrow"><div class="mbl">${esc(item.label)}${
          item.sub ? `<em style="color:${item.subCol}">${item.sub}</em>` : ''
        }</div>` +
        `<div class="mbtrack"><i class="mbdot" style="left:${item.x}%;background:${item.col}"></i></div>` +
        `<div class="mbv" style="color:${item.col}">${item.val}</div></div>`,
    )
    .join('');
  const balanceGuides = [50, 65, 80].map((x) => `<i class="mbguide" style="left:${x}%"></i>`).join('');
  const balanceZones =
    '<span style="left:0;width:50%">Svagt</span><span style="left:50%;width:15%">Afklar</span>' +
    '<span style="left:65%;width:15%">Godt</span><span style="left:80%;width:20%">Stærkt</span>';
  const balanceHtml =
    '<div class="mb">' +
    `<div class="mbzhead"><i></i><div class="zin">${balanceZones}</div><i></i></div>` +
    '<div class="mbplot">' +
    balanceRows +
    `<div class="mbov"><i></i><div class="mbovin">${balanceGuides}` +
    `<div class="mbtotal"><b style="background:${v.color}">Samlet ${c.total}</b></div>` +
    '</div><i></i></div>' +
    '</div></div>';

  /* DISC-sammenligning */
  let discCompare = '';
  for (const factor of FACTORS) {
    const work = state.work[factor];
    const req = state.req[factor];
    const tol = c.tol;
    const weight = state.fw[factor] || 1;
    const bandLeft = clamp(req - tol, 0, 100);
    const bandRight = clamp(req + tol, 0, 100);
    const bandWidth = bandRight - bandLeft;
    const gap = work - req;
    const hit = Math.abs(gap) <= tol;
    const midPercent = bandWidth > 0 ? clamp(((req - bandLeft) / bandWidth) * 100, 0, 100) : 50;
    const tipPosition = clamp(work, 4, 96);
    const tag =
      `${hit ? 'i spænd' : gap > 0 ? `+${gap} over spænd` : `${gap} under spænd`}` +
      ` · krav ${req} (${bandLeft}–${bandRight})` +
      (weight === 2 ? ' · vægt høj' : weight === 0.5 ? ' · vægt lav' : '');
    discCompare +=
      '<div class="drow">' +
      `<div class="dname"><i style="background:${FACTOR_COLOR[factor]}"></i><div>${factor} · ${FACTOR_NAME[factor]}<br><span style="font-size:10px;font-weight:600;color:${
        hit ? 'var(--ink-45)' : 'var(--stop)'
      }">${tag}</span></div></div>` +
      '<div class="dwrap"><div class="dtrack">' +
      `<div class="dbar" style="width:${work}%;background:${FACTOR_COLOR[factor]}"></div>` +
      `<div class="dbox" style="left:${bandLeft}%;width:${bandWidth}%"><div class="dmid" style="left:${midPercent}%"></div></div>` +
      `<div class="ddev" style="left:${tipPosition}%;color:${hit ? 'var(--ok)' : 'var(--stop)'}">${
        hit ? '✓ i spænd' : gap > 0 ? `+${gap}` : gap
      }</div>` +
      `<div class="dtip${hit ? ' in' : ''}" style="left:${tipPosition}%;background:${FACTOR_COLOR[factor]}">${work}</div>` +
      '</div></div></div>';
  }

  const mixPercent = typeof state.mix === 'number' ? clamp(state.mix, 0, 100) : 60;
  const lowestQuestionName = (() => {
    let lowId: string | null = null;
    for (const question of questions) {
      const answer = answerFor(state, question.id);
      if (answer.na || answer.score === null) continue;
      if (lowId === null || answer.score < (answerFor(state, lowId).score ?? 0)) lowId = question.id;
    }
    return lowId ? (questions.find((q) => q.id === lowId)?.t.toLowerCase() ?? null) : null;
  })();
  const badCase = v.key === 'no' || (c.criticals.length > 0 && c.total < 50);

  const nextSteps = badCase
    ? [
        'Brug ikke mere tid på sagen: giv et ærligt og hurtigt afslag — respekten ligger i tempoet og begrundelsen.',
        'Skal der alligevel ansættes, så skriv de særlige forhold ned, der berettiger det — kan de ikke formuleres konkret, findes de ikke.',
        'Gem sagen: jobprofil, vægte og spørgsmål kan genbruges direkte på den næste kandidat.',
      ]
    : c.criticals.length
      ? [
          `Afklar det kritiske punkt før alt andet: ${c.criticals
            .map((q) => q.t.toLowerCase())
            .join(', ')}. Ingen total er gyldig, før det er lukket.`,
          'Book en kort, målrettet opfølgning — samtale eller referencetjek — alene om dét punkt.',
          'Genkør jobmatchet bagefter med "Opdater Jobmatch", og se om forbeholdet forsvinder.',
        ]
      : v.key === 'go' || v.key === 'go2'
        ? [
            'Gå videre: indhent de sidste referencer, eller giv tilbuddet nu — tempoet signalerer, at I vil kandidaten.',
            'Planlæg onboarding direkte ud fra rapportens svage punkter — de forsvinder ikke af sig selv.',
            'Book 90-dages samtalen allerede i dag med afsæt i rapportens ledelsesråd.',
          ]
        : v.key === 'wait'
          ? [
              'Stil spørgsmålene fra rapporten i næste samtale, og kræv konkrete eksempler — ikke holdninger.',
              `Efterprøv især det svageste punkt${
                lowestQuestionName ? `: ${lowestQuestionName}` : ''
              } — det afgør, om totalen holder.`,
              'Genkør jobmatchet efter samtalen med "Opdater Jobmatch", og se om billedet flytter sig.',
            ]
          : [
              'Giv et ærligt og hurtigt afslag — respekten ligger i tempoet og begrundelsen.',
              'Overvej, om kandidaten passer bedre i en anden rolle hos jer, før døren lukkes helt.',
              'Gem sagen: kravprofil, vægte og spørgsmål kan genbruges direkte på den næste kandidat.',
            ];

  const roleZone = zoneOf(c.roleFit);

  /* afvigelsesliste til nøgletallene: alle fire, tungest øverst */
  const weightOf = (factor: Factor) => state.fw[factor] || 1;
  const deviationSorted = [...FACTORS].sort(
    (a, b) =>
      Math.max(0, Math.abs(c.gapsW[b]) - c.tol) * weightOf(b) -
        Math.max(0, Math.abs(c.gapsW[a]) - c.tol) * weightOf(a) ||
      Math.abs(c.gapsW[b]) - Math.abs(c.gapsW[a]),
  );
  const deviationList = deviationSorted
    .map((factor) => {
      const gap = c.gapsW[factor];
      const hit = Math.abs(gap) <= c.tol;
      const text = hit ? 'rammer jobkravet' : gap > 0 ? 'mere end jobkravet' : 'mindre end jobkravet';
      return (
        `<span class="devrow"><b style="color:${FACTOR_COLOR[factor]}">${factor}</b>` +
        `<i style="color:${hit ? 'var(--ok)' : 'var(--stop)'}">${gap > 0 ? '+' : ''}${gap}</i>` +
        `<em>${text}${
          weightOf(factor) === 2 ? ' · vægt høj' : weightOf(factor) === 0.5 ? ' · vægt lav' : ''
        }</em></span>`
      );
    })
    .join('');

  /* bemærkninger og ubesvarede punkter vises sammen med matchbalancen */
  const noteRows = questions
    .filter((question) => {
      const answer = answerFor(state, question.id);
      return answer.note && !answer.na;
    })
    .map(
      (question) =>
        `<div class="nrow"><b>${esc(question.t)}</b><span>${esc(
          answerFor(state, question.id).note,
        )}</span></div>`,
    )
    .join('');
  const unanswered = questions
    .filter((question) => {
      const answer = answerFor(state, question.id);
      return !answer.na && answer.score === null;
    })
    .map((question) => question.t.toLowerCase());

  const strengths = strengthShort(state, questions, c)
    .map((s) => `<li><i style="background:var(--ok)"></i><span>${esc(s)}</span></li>`)
    .join('');
  const risks = riskShort(state, questions, c)
    .map((s) => `<li><i style="background:var(--stop)"></i><span>${esc(s)}</span></li>`)
    .join('');
  const interview = interviewQuestions(state, questions, c)
    .slice(0, 6)
    .map(
      (s, i) =>
        `<article><div class="qn">${String(i + 1).padStart(2, '0')}</div><span>${esc(s)}</span></article>`,
    )
    .join('');

  const keyPoints = concludePoints(state, questions, c)
    .map(
      (point) =>
        `<article style="border-left-color:${point.col}"><div class="kk">${point.k}</div><div class="kv" style="color:${point.col}">${point.v}</div><p>${esc(point.p)}</p></article>`,
    )
    .join('');

  const activeZone = zoneOf(c.total);
  const scaleBar = ZONES.map(
    (zone) =>
      `<i style="width:${zone.to - zone.from + 1}%;background:${zone.cell};opacity:${
        zone === activeZone ? 1 : 0.45
      }"></i>`,
  ).join('');
  const scaleCells = ZONES.map(
    (zone) =>
      `<div class="sg-cell${zone === activeZone ? ' on' : ''}">` +
      `<b>${zone.from}–${zone.to}</b><h5 style="color:${zone.col}">${zone.name}</h5><p>${zone.txt}</p></div>`,
  ).join('');
  const scaleGuide =
    '<div class="scaleguide"><p class="eyebrow" style="margin:0 0 4px">Intervalguide</p><h3>Sådan læser du tallet</h3>' +
    `<p class="sgsub">${esc(m.cand || 'Kandidaten')} lander på ${c.total} point — intervallet <strong style="color:${activeZone.col}">${activeZone.name.toLowerCase()}</strong> (${activeZone.from}–${activeZone.to}).</p>` +
    `<div class="sg-bar"><div class="sg-mark" style="left:${c.total}%"><b>${c.total}</b></div>${scaleBar}</div>` +
    `<div class="sg-cells">${scaleCells}</div></div>`;

  return (
    '<div class="rep-head" style="display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;align-items:flex-start">' +
    '<div>' +
    '<p class="eyebrow">MasterDISC Jobmatch</p>' +
    `<h2>${esc(m.cand || 'Kandidat')} · ${esc(m.role || 'Stilling')}</h2>` +
    '<div class="meta">' +
    `<div>Virksomhed<b>${esc(m.comp || '—')}</b></div>` +
    `<div>Ansættende leder<b>${esc(m.lead || '—')}</b></div>` +
    `<div>Grundlag<b>${esc(m.round)}</b></div>` +
    `<div>Sagsnummer<b>${esc(m.case || '—')}</b></div>` +
    `<div>Dato<b>${esc(m.date)}</b></div>` +
    '</div></div>' +
    '<div class="logo sm"><span class="dots"><i></i><i></i><i></i><i></i></span><span class="wordmark">Master DISC</span></div>' +
    '</div>' +
    '<div class="md-gradient"></div>' +
    '<div class="verdict">' +
    `<div><div class="bignum">${c.total}<small>/100</small></div>` +
    `<div class="md-meter"><i style="width:${c.total}%"></i></div></div>` +
    '<div><span class="pill" style="color:var(--ink-45)">Samlet matchscore</span>' +
    `<div class="vlabel">${c.total} af 100 point</div>` +
    `<p>Din vurdering vejer ${mixPercent} %, og rollematch — arbejdsprofilen mod kravprofilen — vejer ${
      100 - mixPercent
    } %. Vægtningen kan justeres på vurderingssiden. Intervalguiden nedenfor viser, hvordan tallet skal læses, før anbefalingen dømmer.</p></div>` +
    '</div>' +
    scaleGuide +
    '<section class="rsec" style="padding-bottom:26px">' +
    `<span class="pill" style="color:${v.color}">Anbefaling</span>` +
    `<div class="vlabel" style="color:${v.color}">${v.label}</div>` +
    `<p class="intro" style="margin:2px 0 18px">${v.text}</p>` +
    `<div class="konkgrid">${keyPoints}</div>` +
    '</section>' +
    '<div class="rail-scale">' +
    '<h3>Matchbalancen</h3>' +
    `<p class="intro" style="margin-bottom:0">${
      c.recruiter === null
        ? 'Der er ikke afgivet vurderinger — totalen er derfor lig rollematch alene.'
        : `Vægtet gennemsnit af dine svar: <strong>${c.recruiter}/100</strong> på tværs af ${c.answered} punkter (vurdering ${mixPercent} %, rollematch ${100 - mixPercent} %).`
    } Spredningen fortæller mere end totalen: ligger prikkerne spredt, dækker gennemsnittet over en beslutning, du skal tage bevidst.${
      unanswered.length ? ` Ikke besvaret og uden for beregningen: ${unanswered.join(', ')}.` : ''
    }</p>` +
    balanceHtml +
    (noteRows
      ? `<div class="mbnotes"><p class="eyebrow" style="margin:22px 0 4px">Bemærkninger fra vurderingen</p>${noteRows}</div>`
      : '') +
    '</div>' +
    '<section class="rsec">' +
    '<h3>DISC versus jobprofil</h3>' +
    `<p class="intro">Den fyldte bjælke er kandidatens arbejdsprofil, og boksen er kravspændet (±${c.tol}) — bjælkens spids skal ende inde i boksen. Den stiplede streg i boksens midte er selve kravet. Cirklen på spidsen viser kandidatens tal og dømmer med ringen: grøn i spænd, rød udenfor. Faktorer med høj vægt trækker hårdest i rollematchet.</p>` +
    `<div class="dcmp">${discCompare}</div>` +
    '<div class="legend">' +
    '<span><i class="lg-bar"></i>Arbejdsprofil</span><span><i class="lg-box"></i>Kravspænd</span><span><i class="lg-mid"></i>Krav (midte)</span><span><i class="lg-in"></i>I spænd</span><span><i class="lg-out"></i>Uden for spænd</span>' +
    '</div>' +
    '<div class="readout">' +
    `<div><div class="k">DISC versus jobprofil</div><div class="v">${c.roleFit}</div>` +
    `<div style="height:8px;border-radius:99px;background:var(--rule);overflow:hidden;margin:8px 0 9px;padding:0"><span style="display:block;height:8px;border-radius:99px;width:${c.roleFit}%;background:${roleZone.col}"></span></div>` +
    `<div class="d">Arbejdsprofil mod jobprofilens krav, vægtet med dine faktorvægte. På skalaen svarer det til <strong style="color:${roleZone.col}">${roleZone.name.toLowerCase()}</strong> (${roleZone.from}–${roleZone.to}).</div></div>` +
    `<div><div class="k">Inden for kravspænd</div><div class="v">${c.inSpan} af 4</div><div class="d">Antal DISC-faktorer, der rammer det spænd, du har sat.</div></div>` +
    `<div><div class="k">Afvigelser</div><div class="v" style="font-size:15px;line-height:1.9">${deviationList}</div><div class="d">Alle fire faktorers afstand til kravet — tungeste øverst, vægt medregnet.</div></div>` +
    '</div>' +
    '</section>' +
    '<section class="rsec"><h3>Plus og minus i matchet</h3>' +
    '<div class="twocol" style="margin-top:16px">' +
    `<div><div class="colh"><i style="background:var(--ok)"></i>Det taler for</div><ul class="shortlist">${strengths}</ul></div>` +
    `<div><div class="colh"><i style="background:var(--stop)"></i>Vær opmærksom på</div><ul class="shortlist">${risks}</ul></div>` +
    '</div></section>' +
    (badCase
      ? ''
      : '<section class="rsec"><h3>Spørgsmål til næste samtale</h3>' +
        '<p class="intro">Spørgsmålene udfordrer profilen dér, hvor billedet er tyndest — stil dem åbent, og bed om konkrete eksempler, ikke holdninger.</p>' +
        `<div class="qgrid">${interview}</div></section>`) +
    (badCase
      ? ''
      : '<section class="rsec"><h3>Sådan leder du personen</h3>' +
        '<p class="intro">Anbefalinger ud fra adfærdsprofilen. Tag dem med i onboardingen — det er der, forskellen mellem en god ansættelse og en dyr ansættelse bliver afgjort.</p>' +
        '<div class="advice">' +
        `<article><div class="when">Første 30 dage</div><h4>${la.hi.t}</h4><p>${la.hi.p}</p></article>` +
        `<article><div class="when">Dag 30–90</div><h4>Understøt den svageste faktor</h4><p>${la.loTxt}</p></article>` +
        '<article><div class="when">Efter 90 dage</div><h4>Tal om energien, ikke kun tallene</h4><p>Hold en samtale om, hvad der giver og dræner energi i rollen — særligt på de faktorer, hvor profilen ligger uden for kravspændet. Profilen er et afsæt for den dialog, ikke en konklusion.</p></article>' +
        '</div>' +
        '</section>') +
    '<section class="rsec">' +
    '<p class="eyebrow" style="margin:0 0 4px">Afslutning</p>' +
    '<h3>Konklusion & næste skridt</h3>' +
    '<div class="finalgrid">' +
    '<div class="finalcard">' +
    `<div class="fnum">${c.total}<small> /100</small></div>` +
    `<span class="fverdict" style="background:${v.color}">${v.label}</span>` +
    `<p>${v.text}</p>` +
    '</div>' +
    `<div class="finsteps">${nextSteps
      .map(
        (step, i) =>
          `<div class="fstep"><div class="fn">${String(i + 1).padStart(2, '0')}</div><span>${step}</span></div>`,
      )
      .join('')}</div>` +
    '</div>' +
    '</section>' +
    '<div class="disclaim"><b>MasterDISC-perspektiv</b>' +
    'JobMatch-rapporten er et afsæt for dialog samt et støtteværktøj i din beslutning. Den måler ikke værdier, kompetencer og integritet, så den må aldrig stå alene og garanterer aldrig et sikkert match. Husk, at beslutningen altid er din egen.' +
    '</div>' +
    '<div class="signrow">' +
    `<div class="issued">Udstedt · <b>${esc(m.date)}</b><br>Sag · <b>${esc(m.case || '—')}</b> · Fortroligt dokument${
      state.terms?.accepted ? `<br>Vilkår accepteret · <b>${esc(state.terms.when)}</b>` : ''
    }</div>` +
    '</div>' +
    `<div class="repfoot"><span>MasterDISC · Jobmatch · Fortroligt</span><span class="pgnum">${pageNumber}</span></div>`
  );
}
