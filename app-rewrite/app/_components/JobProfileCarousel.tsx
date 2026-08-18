'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Row {
  title: string;
  text: string;
  /** 1-6, which box is marked. */
  box: number;
  mark: 'sel-high' | 'sel-low';
}

interface Slide {
  title: string;
  sub: string;
  rows: Row[];
}

/** The five job profile examples from public_html/index.html, unchanged. */
const SLIDES: Slide[] = [
  {
    title: 'Ejendomsmægler',
    sub: 'Bygget til en erfaren ejendomsmægler',
    rows: [
      {
        title: 'Fremvisninger',
        text: 'Skaber levende og personlige fremvisninger, der får køberne til at se sig selv i boligen.',
        box: 5,
        mark: 'sel-high',
      },
      {
        title: 'Opfølgning på køberkartotek',
        text: 'Følger systematisk op på emnerne i køberkartoteket og matcher aktivt købere med nye boliger.',
        box: 1,
        mark: 'sel-low',
      },
      {
        title: 'Forhandling af salæret',
        text: 'Står fast på værdien af egen indsats og forhandler salæret hjem uden unødige rabatter.',
        box: 4,
        mark: 'sel-high',
      },
    ],
  },
  {
    title: 'Professionel fodboldspiller · Anfører',
    sub: 'Bygget til en professionel fodboldspiller med anførerrollen',
    rows: [
      {
        title: 'Kommunikation på banen',
        text: 'Organiserer holdet og sætter medspillere op med klare, direkte beskeder under kampen.',
        box: 5,
        mark: 'sel-high',
      },
      {
        title: 'Ro i pressede situationer',
        text: 'Bevarer overblikket, når kampen spidser til, og træffer beslutninger med lav puls.',
        box: 4,
        mark: 'sel-high',
      },
      {
        title: 'Tålmodighed med unge spillere',
        text: 'Giver plads til udvikling og fejl hos holdets yngste – også når tempoet falder.',
        box: 2,
        mark: 'sel-low',
      },
    ],
  },
  {
    title: 'Butikskonsulent i tøjbutik',
    sub: 'Bygget til en butikskonsulent i en tøjbutik',
    rows: [
      {
        title: 'Kundekontakt på gulvet',
        text: 'Åbner naturligt samtaler med kunderne og skaber en personlig og imødekommende oplevelse.',
        box: 5,
        mark: 'sel-high',
      },
      {
        title: 'Mersalg ved kassen',
        text: 'Tilbyder relevante tilføjelser, der løfter kurven uden at presse kunden.',
        box: 4,
        mark: 'sel-high',
      },
      {
        title: 'Standarder og ryddelighed',
        text: 'Holder udstillinger og lager på butikkens standard – også i travle perioder.',
        box: 2,
        mark: 'sel-low',
      },
    ],
  },
  {
    title: 'B2B-sælger · Outdoor markedsføring',
    sub: 'Bygget til en B2B-sælger af outdoor markedsføring',
    rows: [
      {
        title: 'Kold kanvas',
        text: 'Tager telefonen og booker møder hos nye annoncører uden tøven.',
        box: 5,
        mark: 'sel-high',
      },
      {
        title: 'Løsningspræsentation',
        text: 'Omsætter kundens behov til konkrete kampagneforslag med tydelig effekt.',
        box: 4,
        mark: 'sel-high',
      },
      {
        title: 'Pipeline-disciplin i CRM',
        text: 'Registrerer og opdaterer aktiviteter systematisk, så pipelinen altid er retvisende.',
        box: 1,
        mark: 'sel-low',
      },
    ],
  },
  {
    title: 'Erhvervsrådgiver i bank',
    sub: 'Bygget til en erhvervsrådgiver i en bank',
    rows: [
      {
        title: 'Kreditindstillinger',
        text: 'Udarbejder grundige og veldokumenterede kreditindstillinger med styr på detaljen.',
        box: 5,
        mark: 'sel-high',
      },
      {
        title: 'Langsigtede kunderelationer',
        text: 'Bygger tillid over tid og bliver kundens naturlige sparringspartner.',
        box: 4,
        mark: 'sel-high',
      },
      {
        title: 'Opsøgende salg',
        text: 'Opsøger proaktivt nye erhvervskunder og udvider porteføljen.',
        box: 2,
        mark: 'sel-low',
      },
    ],
  },
];

const BOXES = [1, 2, 3, 4, 5, 6] as const;

export function JobProfileCarousel() {
  const [current, setCurrent] = useState(0);
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);

  const go = (index: number) => setCurrent((index + SLIDES.length) % SLIDES.length);

  /**
   * Same purpose as equalize() in the POC: all slides get the height of the
   * tallest one, so the card does not jump when you page through it.
   */
  const equalize = useCallback(() => {
    let tallest = 0;
    for (const slide of slideRefs.current) {
      if (!slide) continue;
      const wasOn = slide.classList.contains('on');
      slide.style.minHeight = '';
      slide.style.display = 'block';
      slide.style.visibility = 'hidden';
      tallest = Math.max(tallest, slide.offsetHeight);
      slide.style.display = '';
      slide.style.visibility = '';
      if (wasOn) slide.classList.add('on');
    }
    if (tallest > 0) setMinHeight(tallest);
  }, []);

  useEffect(() => {
    equalize();
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(equalize, 150);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('load', equalize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', equalize);
    };
  }, [equalize]);

  return (
    <div className="jpcard" id="jp">
      <button
        className="jp-arrow prev"
        type="button"
        aria-label="Forrige jobprofil"
        onClick={() => go(current - 1)}
      >
        &#8249;
      </button>
      <button
        className="jp-arrow next"
        type="button"
        aria-label="Næste jobprofil"
        onClick={() => go(current + 1)}
      >
        &#8250;
      </button>
      <div className="grad" />

      {SLIDES.map((slide, index) => (
        <div
          key={slide.title}
          className={index === current ? 'jp-slide on' : 'jp-slide'}
          style={minHeight ? { minHeight } : undefined}
          ref={(node) => {
            slideRefs.current[index] = node;
          }}
        >
          <div className="jp-title">{slide.title}</div>
          <div className="jp-sub">{slide.sub}</div>
          <div className="jp-scalehead">
            <span />
            <div>
              <span className="lav">LAV</span>
              <span className="mel">MELLEM</span>
              <span className="hoj">HØJ</span>
            </div>
          </div>
          {slide.rows.map((row) => (
            <div className="jp-row" key={row.title}>
              <div>
                <h4>{row.title}</h4>
                <p>{row.text}</p>
              </div>
              <div className="jp-boxes">
                {BOXES.map((box) => (
                  <span
                    key={box}
                    className={`jp-box b${box}${box === row.box ? ` ${row.mark}` : ''}`}
                  >
                    {box}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="jp-dots" role="tablist" aria-label="Skift jobprofil-eksempel">
        {SLIDES.map((slide, index) => (
          <button
            key={slide.title}
            className={index === current ? 'jp-dot on' : 'jp-dot'}
            aria-label={`Eksempel ${index + 1}`}
            onClick={() => go(index)}
          />
        ))}
      </div>
      <p className="jp-legend">
        I fællesskab med dig opbygger vi præcist de kompetenceområder, du ønsker vurderet. Ratingen
        viser personens naturlige energi på hver kompetence — ikke en kompetencevurdering, men et
        billede af hvor motivationen kommer af sig selv, og hvor den kræver bevidst indsats.
      </p>
    </div>
  );
}
