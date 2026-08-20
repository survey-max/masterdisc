import {
  BASE_QUESTIONS,
  FACTORS,
  emptyAnswer,
  initialState,
  type Answer,
  type CustomQuestionDef,
  type FactorValues,
  type ToolState,
} from './model';

/**
 * "Gem sag som fil" / "Åbn gemt sag" from vaerktoej.php.
 *
 * The file format is the tool's state object, same as the POC wrote it. Two
 * notes:
 *   - Cases saved by the POC carry a `priv` field (graf 2). It is ignored here,
 *     because nothing ever read it — old files still load.
 *   - New files therefore no longer contain `priv`.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function factorValues(value: unknown, fallback: FactorValues): FactorValues {
  if (!isRecord(value)) return fallback;
  const out: FactorValues = { ...fallback };
  for (const factor of FACTORS) {
    const raw = value[factor];
    if (typeof raw === 'number' && Number.isFinite(raw)) out[factor] = raw;
  }
  return out;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function answer(value: unknown): Answer {
  if (!isRecord(value)) return emptyAnswer();
  const score = value['score'];
  const weight = value['weight'];
  return {
    score: typeof score === 'number' && Number.isFinite(score) ? score : null,
    na: value['na'] === true,
    weight: typeof weight === 'number' && Number.isFinite(weight) ? weight : 1,
    note: text(value['note']),
  };
}

export function serializeCase(state: ToolState): string {
  return JSON.stringify(state, null, 2);
}

/** Throws when the file is not a JobMatch case. */
export function parseCase(fileText: string): ToolState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText) as unknown;
  } catch (cause) {
    throw new Error('Filen kunne ikke læses som en gemt sag.', { cause });
  }
  if (!isRecord(parsed) || !isRecord(parsed['meta'])) {
    throw new Error('Filen kunne ikke læses som en gemt sag.');
  }

  const base = initialState('');
  const meta = parsed['meta'];
  const customRaw = parsed['customQ'];
  const customQ: CustomQuestionDef[] = Array.isArray(customRaw)
    ? customRaw.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const id = text(entry['id']);
        const title = text(entry['t']);
        if (!id || !title) return [];
        const description = text(entry['d']);
        return [description ? { id, t: title, d: description } : { id, t: title }];
      })
    : [];

  const answersRaw = parsed['answers'];
  const answers: Record<string, Answer> = {};
  if (isRecord(answersRaw)) {
    for (const [id, value] of Object.entries(answersRaw)) answers[id] = answer(value);
  }
  // Every known question must have an answer object, as the POC ensured on load.
  for (const question of BASE_QUESTIONS) answers[question.id] ??= emptyAnswer();
  for (const custom of customQ) answers[custom.id] ??= emptyAnswer();

  const terms = parsed['terms'];
  const mix = parsed['mix'];
  const tol = parsed['tol'];

  return {
    meta: {
      cand: text(meta['cand']),
      role: text(meta['role']),
      comp: text(meta['comp']),
      lead: text(meta['lead']),
      round: text(meta['round'], base.meta.round),
      date: text(meta['date']),
      case: text(meta['case']),
    },
    work: factorValues(parsed['work'], base.work),
    req: factorValues(parsed['req'], base.req),
    fw: factorValues(parsed['fw'], base.fw),
    preset: text(parsed['preset'], base.preset),
    tol: typeof tol === 'number' && Number.isFinite(tol) ? tol : base.tol,
    answers,
    jobText: text(parsed['jobText']),
    jobExtra: text(parsed['jobExtra']),
    discFile: text(parsed['discFile']),
    jobFile: text(parsed['jobFile']),
    discRejected: parsed['discRejected'] === true,
    customQ,
    mix: typeof mix === 'number' && Number.isFinite(mix) ? mix : base.mix,
    terms: isRecord(terms)
      ? { accepted: terms['accepted'] === true, when: text(terms['when']) }
      : { accepted: false, when: '' },
  };
}
