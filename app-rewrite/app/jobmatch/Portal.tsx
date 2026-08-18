'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ArchiveEntryWithOrg } from '@/lib/data';

import { deleteEntryAction, listEntriesAction, uploadRapportAction } from './actions';

type SortMode = 'ny' | 'gl' | 'navn';

const SORT_LABEL: Record<SortMode, string> = {
  ny: 'Nyeste først',
  gl: 'Ældste først',
  navn: 'Kandidat A–Å',
};
const SORT_NEXT: Record<SortMode, SortMode> = { ny: 'gl', gl: 'navn', navn: 'ny' };

const MAX_BYTES = 25 * 1024 * 1024;

/** POC: kb() */
function kb(bytes: number): string {
  const n = Number(bytes) || 0;
  return n < 1048576
    ? `${Math.round(n / 1024)} KB`
    : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`;
}

/** POC: dk() — 'YYYY-MM-DD' shown as 'DD.MM.YYYY' */
function dk(iso: string): string {
  const parts = String(iso ?? '').split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : (iso ?? '');
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PortalProps {
  bruger: { navn: string; orgNavn: string; admin: boolean };
  initialFiler: ArchiveEntryWithOrg[];
  initialVisOrg: boolean;
}

/**
 * The logged-in JobMatch portal from public_html/jobmatch/index.php:
 * the Oversigt tab and the Jobmatchfiler tab, with the same texts and the same
 * behaviour. The archive calls server actions instead of arkiv.php.
 */
export function Portal({ bruger, initialFiler, initialVisOrg }: PortalProps) {
  const [view, setView] = useState<'hjem' | 'arkiv'>('hjem');

  // ---- archive list ----
  const [filer, setFiler] = useState<ArchiveEntryWithOrg[]>(initialFiler);
  const [visOrg, setVisOrg] = useState(initialVisOrg);
  const [listFejl, setListFejl] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('ny');
  const [query, setQuery] = useState('');

  // ---- upload form ----
  const [queue, setQueue] = useState<File[]>([]);
  const [status, setStatus] = useState<{ text: string; kind: '' | 'ok' | 'bad'; spin?: boolean }>({
    text: '',
    kind: '',
  });
  const [navn, setNavn] = useState('');
  const [stilling, setStilling] = useState('');
  const [dato, setDato] = useState(todayIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [hot, setHot] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Tabs are addressable through the hash, exactly as in the POC.
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.slice(1);
      setView(hash === 'arkiv' ? 'arkiv' : 'hjem');
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const go = (name: 'hjem' | 'arkiv') => {
    setView(name);
    if (window.location.hash.slice(1) !== name) {
      window.history.replaceState(null, '', `#${name}`);
    }
    window.scrollTo(0, 0);
  };

  const hent = useCallback(async () => {
    const result = await listEntriesAction();
    if (!result.ok) {
      setListFejl(result.fejl);
      return;
    }
    setFiler(result.data.filer);
    setVisOrg(result.data.visOrg);
    setListFejl(null);
  }, []);

  function take(list: FileList | File[]) {
    const files = Array.from(list);
    const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!pdfs.length) {
      setStatus({ text: 'Det var ikke en PDF. Prøv igen.', kind: 'bad' });
      return;
    }
    if (pdfs.some((f) => f.size > MAX_BYTES)) {
      setStatus({ text: 'Filen er større end 25 MB.', kind: 'bad' });
      return;
    }
    setQueue(pdfs);
    const first = pdfs[0];
    const sum = pdfs.reduce((acc, f) => acc + f.size, 0);
    setStatus({
      text:
        pdfs.length === 1 && first
          ? `Klar: ${first.name} · ${kb(first.size)}`
          : `Klar: ${pdfs.length} filer · ${kb(sum)}`,
      kind: 'ok',
    });
    if (pdfs.length === 1 && first && !navn) {
      const guess = first.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
      setNavn(guess.charAt(0).toUpperCase() + guess.slice(1));
    }
  }

  async function gem() {
    if (!queue.length) return;
    setSaving(true);
    setStatus({ text: 'Sender til serveren …', kind: '', spin: true });

    let fejlet = 0;
    for (const file of queue) {
      const formData = new FormData();
      formData.append('fil', file);
      formData.append('navn', navn.trim() || file.name.replace(/\.pdf$/i, ''));
      formData.append('stilling', stilling.trim());
      formData.append('dato', dato || todayIso());
      formData.append('note', note.trim());

      const result = await uploadRapportAction(formData);
      if (!result.ok) {
        fejlet += 1;
        setStatus({ text: `Kunne ikke gemme ${file.name}: ${result.fejl}`, kind: 'bad' });
      }
    }

    const total = queue.length;
    setStatus({
      text: fejlet
        ? `${total - fejlet} gemt · ${fejlet} fejlede`
        : `${total}${total === 1 ? ' rapport gemt' : ' rapporter gemt'}`,
      kind: fejlet ? 'bad' : 'ok',
    });
    setQueue([]);
    if (fileInput.current) fileInput.current.value = '';
    setNavn('');
    setStilling('');
    setNote('');
    setDato(todayIso());
    setSaving(false);
    await hent();
    if (!fejlet) setTimeout(() => setStatus({ text: '', kind: '' }), 3200);
  }

  async function slet(entry: ArchiveEntryWithOrg) {
    const label = entry.navn || 'denne kandidat';
    if (
      !window.confirm(
        `Slet rapporten for ${label}?\n\nFilen fjernes permanent fra serveren.`,
      )
    ) {
      return;
    }
    const result = await deleteEntryAction(entry.id);
    if (!result.ok) {
      window.alert(`Kunne ikke slette: ${result.fejl}`);
      return;
    }
    await hent();
  }

  const sorted = useMemo(() => {
    const list = [...filer];
    list.sort((a, b) => {
      if (sort === 'navn') return a.navn.localeCompare(b.navn, 'da');
      if (sort === 'gl') return a.dato.localeCompare(b.dato) || a.tilfojet - b.tilfojet;
      return b.dato.localeCompare(a.dato) || b.tilfojet - a.tilfojet;
    });
    return list;
  }, [filer, sort]);

  const term = query.trim().toLowerCase();
  const vist = term
    ? sorted.filter((r) =>
        `${r.navn} ${r.stilling} ${r.note} ${r.orgNavn}`.toLowerCase().includes(term),
      )
    : sorted;

  const samlet = filer.reduce((acc, r) => acc + (Number(r.storrelse) || 0), 0);
  const statLine = listFejl
    ? 'Ingen forbindelse til serveren'
    : !filer.length
      ? 'Ingen filer i arkivet'
      : `${filer.length}${filer.length === 1 ? ' rapport' : ' rapporter'} · ${kb(samlet)}${
          term ? ` · ${vist.length} vist` : ''
        }`;

  return (
    <>
      <header className="top">
        <div className="shell">
          <div className="toprow">
            <Link className="logo" href="/">
              <span className="dots">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="wordmark">Master DISC</span>
              <span className="prod">JobMatch</span>
            </Link>
            <div className="who">
              <span>
                {bruger.navn} · {bruger.orgNavn}
              </span>
              {bruger.admin ? <Link href="/jobmatch/admin/">Administration</Link> : null}
              <Link href="/">Forsiden</Link>
              <Link href="/jobmatch/login/">Log ud</Link>
            </div>
          </div>
        </div>
        <nav className="tabs">
          <div className="shell">
            <div className="tabrow">
              <button
                type="button"
                className={view === 'hjem' ? 'on' : undefined}
                onClick={() => go('hjem')}
              >
                Oversigt
              </button>
              <button
                type="button"
                className={view === 'arkiv' ? 'on' : undefined}
                onClick={() => go('arkiv')}
              >
                Jobmatchfiler <span className="n">{listFejl ? '–' : filer.length}</span>
              </button>
            </div>
          </div>
        </nav>
        <div className="grad" />
      </header>

      <main className="shell">
        <section className={view === 'hjem' ? 'view on' : 'view'} id="v-hjem">
          <div className="card">
            <p className="eyebrow">MasterDISC-familien</p>
            <h1>JobMatch</h1>
            <p className="lede">
              JobMatch holder kandidatens adfærdsprofil op mod den kravprofil, du sætter for
              stillingen — og kombinerer det med din egen vurdering af alt det, en test aldrig måler:
              kemi, faglighed, referencer og motivation. Resultatet er én samlet matchscore og en
              rapport, der er klar til dialog med kandidaten og resten af ansættelsesudvalget.
            </p>

            <div className="acts">
              <div className="act">
                <div className="meta">Nyt forløb</div>
                <h3>Start et jobmatch</h3>
                <p>
                  Åbn værktøjet, indlæs kandidatens MasterDISC-profil, fastlæg kravprofilen og giv
                  din vurdering. Du ender med en færdig rapport, du kan printe til PDF.
                </p>
                <Link className="btn gold" href="/jobmatch/vaerktoej/">
                  Start et jobmatch
                </Link>
              </div>
              <div className="act">
                <div className="meta">
                  <span>
                    {listFejl
                      ? 'Kunne ikke hentes'
                      : `${filer.length === 0 ? 'Ingen' : filer.length} gemte rapporter`}
                  </span>
                </div>
                <h3>Jobmatchfiler</h3>
                <p>
                  Jeres arkiv over gennemførte jobmatch. Rapporterne ligger på serveren og kan
                  tilgås fra alle jeres enheder — til opfølgning, onboarding eller næste runde.
                </p>
                <button type="button" className="btn line" onClick={() => go('arkiv')}>
                  Åbn jobmatchfiler
                </button>
              </div>
            </div>

            <p className="sub">Sådan arbejder du med værktøjet</p>
            <div className="steps">
              <div className="step">
                <div className="n">01</div>
                <div className="tx">
                  <b>Kandidat og stilling.</b> Indlæs kandidatens MasterDISC-profil og
                  stillingsbeskrivelsen — arbejdsprofilens tal læses automatisk.
                </div>
              </div>
              <div className="step">
                <div className="n">02</div>
                <div className="tx">
                  <b>Kravprofil.</b> Fastlæg hvilken adfærd rollen kalder på, sæt spændet — og vægt
                  de DISC-faktorer, der er vigtigst at ramme.
                </div>
              </div>
              <div className="step">
                <div className="n">03</div>
                <div className="tx">
                  <b>Din vurdering.</b> Scor kemi, faglighed, motivation og andre områder fra 1 til
                  10. Sæt &quot;ikke relevant&quot;, hvor spørgsmålet ikke giver mening.
                </div>
              </div>
              <div className="step">
                <div className="n">04</div>
                <div className="tx">
                  <b>Rapport.</b> Få den samlede matchscore med intervalguide, en begrundet
                  anbefaling og spørgsmål til næste samtale.
                </div>
              </div>
            </div>

            <div className="notice">
              <b>Forbehold</b>
              <p>
                JobMatch-rapporten er et afsæt for dialog og et støtteværktøj i din beslutning. Den
                måler ikke værdier, kompetencer og integritet, så den må aldrig stå alene og
                garanterer aldrig et sikkert match. Beslutningen er altid din egen.
              </p>
            </div>
          </div>
        </section>

        <section className={view === 'arkiv' ? 'view on' : 'view'} id="v-arkiv">
          <div className="card">
            <p className="eyebrow">Arkiv</p>
            <h2>Jobmatchfiler</h2>
            <p className="lede">
              Arkivet rummer to slags: <b>gemte sager</b>, som værktøjet lægger ind med ét klik og
              som kan åbnes og redigeres igen — og <b>PDF-rapporter</b>, som du lægger ind herunder.
              Alt ligger på serveren i en mappe uden for websitet og kan kun hentes herfra.
            </p>

            <p className="sub">Læg en rapport i arkivet</p>
            <div className="addgrid">
              <div>
                <button
                  className={hot ? 'drop hot' : 'drop'}
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setHot(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setHot(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setHot(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setHot(false);
                    if (event.dataTransfer.files.length) take(event.dataTransfer.files);
                  }}
                >
                  <b>Træk PDF-rapporten hertil</b>
                  <small>eller klik for at vælge en fil · kun PDF · maks. 25 MB</small>
                  <span className={status.kind ? `status ${status.kind}` : 'status'}>
                    {status.spin ? <span className="spin" /> : null}
                    {status.text}
                  </span>
                </button>
                <input
                  type="file"
                  ref={fileInput}
                  accept="application/pdf"
                  multiple
                  hidden
                  onChange={(event) => {
                    if (event.target.files?.length) take(event.target.files);
                  }}
                />
              </div>
              <div>
                <label className="f">
                  <span>Kandidat</span>
                  <input
                    type="text"
                    placeholder="Fx Mette Hansen"
                    autoComplete="off"
                    value={navn}
                    onChange={(event) => setNavn(event.target.value)}
                  />
                </label>
                <div className="f2">
                  <label className="f">
                    <span>Stilling</span>
                    <input
                      type="text"
                      placeholder="Fx Key Account Manager"
                      autoComplete="off"
                      value={stilling}
                      onChange={(event) => setStilling(event.target.value)}
                    />
                  </label>
                  <label className="f">
                    <span>Dato</span>
                    <input
                      type="date"
                      value={dato}
                      onChange={(event) => setDato(event.target.value)}
                    />
                  </label>
                </div>
                <label className="f">
                  <span>Note</span>
                  <textarea
                    placeholder="Fx matchscore 78 · anbefalet til 2. samtale"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn"
                  disabled={!queue.length || saving}
                  onClick={gem}
                >
                  Gem i arkivet
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="toolbar">
              <div className="grow">
                <input
                  type="search"
                  placeholder="Søg på kandidat, stilling eller note"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn line sm"
                onClick={() => setSort(SORT_NEXT[sort])}
              >
                {SORT_LABEL[sort]}
              </button>
            </div>
            <div className="rows">
              {listFejl ? (
                <div className="empty">
                  <b>Arkivet kunne ikke hentes</b>
                  <p>{listFejl}</p>
                </div>
              ) : !filer.length ? (
                <div className="empty">
                  <b>Arkivet er tomt</b>
                  <p>
                    Når du har kørt et jobmatch, printer du rapporten til PDF og lægger den herind.
                    Så kan du finde den frem igen, næste gang kandidaten er på bordet.
                  </p>
                </div>
              ) : !vist.length ? (
                <div className="empty">
                  <b>Ingen træffere</b>
                  <p>Ryd søgefeltet for at se alle {filer.length} rapporter i arkivet.</p>
                </div>
              ) : (
                vist.map((r) => {
                  const sag = r.art === 'sag';
                  const href = `/jobmatch/filer/${encodeURIComponent(r.id)}/`;
                  return (
                    <div className="row" key={r.id}>
                      <div>
                        <b>
                          {r.navn}
                          {sag ? (
                            <span className="art sag">Gemt sag</span>
                          ) : (
                            <span className="art rapport">PDF</span>
                          )}
                        </b>
                        {r.stilling ? <div className="role">{r.stilling}</div> : null}
                        <div className="fine">
                          {dk(r.dato)} · {kb(r.storrelse)}
                          {visOrg && r.orgNavn ? ` · ${r.orgNavn}` : ''}
                        </div>
                        {r.note ? <div className="memo">{r.note}</div> : null}
                      </div>
                      <div className="ops">
                        {sag ? (
                          <a className="btn line sm" href={href}>
                            Hent sagen
                          </a>
                        ) : (
                          <>
                            <a
                              className="btn line sm"
                              href={href}
                              target="_blank"
                              rel="noopener"
                            >
                              Åbn
                            </a>
                            <a className="btn line sm" href={`${href}?mode=hent`}>
                              Hent
                            </a>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn danger sm"
                          onClick={() => void slet(r)}
                        >
                          Slet
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="bar">
              <span>{statLine}</span>
              <button type="button" className="linkish" onClick={() => void hent()}>
                Opdatér listen
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="shell">
          <div className="footrow">
            <span>MasterDISC JobMatch · Et Finsx-koncept</span>
            <a href="mailto:pb@coachers.dk">pb@coachers.dk</a>
            <span>Fortroligt · Må ikke videregives</span>
          </div>
        </div>
        <div className="grad" />
      </footer>
    </>
  );
}
