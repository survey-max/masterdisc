import './forside.css';

import { BuyButton } from './_components/BuyButton';
import { JobProfileCarousel } from './_components/JobProfileCarousel';
import { ProductMenu } from './_components/ProductMenu';

/** Ported 1:1 from public_html/index.html. Same texts, same structure. */
export default function Forside() {
  return (
    <>
      <header className="top">
        <div className="shell">
          <div className="toprow">
            <a className="logo" href="#top">
              <span className="dots">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="wordmark">Master DISC</span>
            </a>
            <nav className="menu">
              <ProductMenu />
              <a href="#vaerktoejet" className="hide-sm">
                Sådan virker det
              </a>
              <a href="#priser">Priser</a>
              <a className="btn ghost sm" href="#adgang">
                Log ind
              </a>
            </nav>
          </div>
        </div>
        <div className="grad" />
      </header>

      {/* ===== HERO ===== */}
      <section className="hero" id="top">
        <div className="shell herogrid">
          <div>
            <p className="eyebrow dark xl">Ny generation af DISC</p>
            <h1>Bedre jobperformance og større træfsikkerhed i rekruttering</h1>
            <p className="lead">
              Hver rapport genereres individuelt og skræddersys 100&nbsp;% til virksomheden og til
              personens job. Resultatet er en skarpere profil, du kan handle på med det samme — til
              at udvikle performance, løfte samarbejdet og få hver enkelt til at lykkes i sin rolle.
            </p>
            <div className="cta">
              <a className="btn gold" href="#adgang">
                Opret en profil
              </a>
              <a className="btn ghost" href="#familien">
                Se hele universet
              </a>
            </div>
            <p className="fine">
              Performanceudvikling · 1:1-samtaler · Teams · Rekruttering · 100&nbsp;% på dansk
            </p>
          </div>

          <JobProfileCarousel />
        </div>
      </section>

      {/* ===== DISC-STRIP ===== */}
      <div className="shell stripwrap">
        <div className="strip">
          <div className="fx d">
            <div className="ltr">D</div>
            <h3>Dominans</h3>
            <p>Går efter resultatet. Beslutter hurtigt og tåler modstand undervejs.</p>
          </div>
          <div className="fx i">
            <div className="ltr">I</div>
            <h3>Indflydelse</h3>
            <p>Skaber kontakt og begejstring. Overbeviser gennem relationer.</p>
          </div>
          <div className="fx s">
            <div className="ltr">S</div>
            <h3>Stabilitet</h3>
            <p>Holder tempoet og løftet. Bygger tillid over tid.</p>
          </div>
          <div className="fx c">
            <div className="ltr">C</div>
            <h3>Competence</h3>
            <p>Vil have det rigtigt. Kvalitet og dokumentation frem for fart.</p>
          </div>
        </div>
      </div>

      {/* ===== VÆRKTØJET ===== */}
      <section className="sec first" id="vaerktoejet">
        <div className="shell split">
          <div>
            <p className="eyebrow">Hvad er MasterDISC?</p>
            <h2 style={{ fontSize: 33 }}>
              Ikke en skabelon.
              <br />
              En rapport skrevet til rollen.
            </h2>
            <p style={{ fontSize: 17, marginTop: 18 }}>
              De fleste DISC-værktøjer sender en standardrapport ud fra en jobtype. MasterDISC bygger
              videre på det bedste fra klassisk DISC — og genererer en fuldt individualiseret rapport
              med udgangspunkt i personens konkrete jobrolle og hverdag.
            </p>
            <ul className="feats">
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>27 spørgsmål i forced choice.</b> Du vælger MEST og MINDST, så profilen bliver
                  skarp og differentieret i stedet for flad.
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>17 siders individuel rapport.</b> Styrker, udviklingsområder,
                  kommunikationsstil og konkrete råd til netop din rolle.
                </span>
              </li>
              <li>
                <span className="tick">✓</span>
                <span>
                  <b>Handlingsanvisende for lederen.</b> Rapporten kan bruges direkte i
                  1:1-samtaler, udvikling og teamsamarbejde.
                </span>
              </li>
            </ul>
          </div>
          <div className="stack">
            <div className="tr">
              <div className="n">01</div>
              <div>
                <h3>Besvar profilen</h3>
                <p>27 forced choice-spørgsmål på omkring 15 minutter — online på masterdisc.dk.</p>
              </div>
            </div>
            <div className="tr">
              <div className="n">02</div>
              <div>
                <h3>Rapporten skrives til din rolle</h3>
                <p>Din rapport genereres individuelt ud fra din besvarelse og dit konkrete job.</p>
              </div>
            </div>
            <div className="tr">
              <div className="n">03</div>
              <div>
                <h3>Tilbagemelding og handling</h3>
                <p>
                  Gennemgang med certificeret MasterDISC-konsulent og en klar udviklingsplan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DE TO GRAFER ===== */}
      <section className="sec paper" id="grafer">
        <div className="shell">
          <div className="sechead">
            <p className="eyebrow">Det andet særkende</p>
            <h2>Én besvarelse. To grafer.</h2>
            <p>
              Ét billede kan ikke skelne mellem, hvem du er, og hvem du gør dig til på arbejdet.
              MasterDISC måler begge dele hver for sig — og forskellen mellem dem fortæller, hvor
              meget energi rollen koster dig.
            </p>
          </div>
          <div className="duo">
            <article>
              <span className="kicker k-work">Graf 1</span>
              <h3>Arbejdsprofilen</h3>
              <p>
                Din tilpassede, bevidste adfærd. Sådan møder du verden i din nuværende jobsituation
                — og den kan flytte sig fra periode til periode, alt efter hvad rollen kræver af dig.
              </p>
              <div className="rule" />
              <dl>
                <dt>Bruges til</dt>
                <dd>Ledersamtaler, feedback, samarbejde og kommunikation.</dd>
                <dt>Ændrer sig</dt>
                <dd>Ja. Ny rolle, ny chef eller ny opgave kan flytte den mærkbart.</dd>
              </dl>
            </article>
            <article>
              <span className="kicker k-priv">Graf 2</span>
              <h3>Privatprofilen</h3>
              <p>
                Din naturlige, ubevidste adfærd. Sådan er du, når du er tryg og ikke skal præstere —
                det er dit adfærdsmæssige udgangspunkt og det, du falder tilbage til, når du ikke
                tænker over det.
              </p>
              <div className="rule" />
              <dl>
                <dt>Bruges til</dt>
                <dd>At forstå energiforbrug, stresstegn og langsigtet trivsel.</dd>
                <dt>Ændrer sig</dt>
                <dd>Sjældent. Den er stabil over år.</dd>
              </dl>
            </article>
          </div>
        </div>
      </section>

      {/* ===== FAMILIEN ===== */}
      <section className="sec" id="familien">
        <div className="shell">
          <div className="sechead">
            <p className="eyebrow">MasterDISC-universet</p>
            <h2>Fire værktøjer, ét fælles sprog</h2>
            <p>
              Alle bygger på den samme besvarelse. Har man først lavet sin profil, kan den bruges
              videre — i teamet, i udviklingssamtalen og i ansættelsen.
            </p>
          </div>

          <div className="fam">
            <div className="prod" id="basisprofilen">
              <div className="tag">Individuel · 17 sider</div>
              <h3>Basisprofilen</h3>
              <p>
                Den fulde personlige rapport med begge grafer, kommunikationsstil, salgsprofil og en
                udviklingsplan, du kan arbejde videre med.
              </p>
              <ul>
                <li>Arbejdsprofilen og Privatprofilen side om side</li>
                <li>Hvordan du bliver mødt — og hvordan du selv møder andre</li>
                <li>Personlige råd til hver af de fire DISC-typer</li>
                <li>Validitetsmåling på besvarelsen</li>
              </ul>
              <div className="cardfoot">
                <a className="btn" href="#adgang">
                  Opret en profil
                </a>
                <p className="kontakt">
                  <a href="mailto:pb@coachers.dk">pb@coachers.dk</a> ·{' '}
                  <a href="tel:+4520845503">+4520845503</a>
                </p>
              </div>
            </div>

            <div className="prod" id="jobprofilen">
              <div className="tag">Rolle · Kompetenceområder</div>
              <h3>Jobprofilen</h3>
              <p>
                Vi opbygger sammen med jer de kompetenceområder, rollen faktisk kræver — og
                rapporten viser, hvor personens energi kommer af sig selv, og hvor den skal findes
                bevidst.
              </p>
              <ul>
                <li>Jeres egne kompetenceområder, ikke standardkategorier</li>
                <li>Rating fra 1 til 6 på hvert område</li>
                <li>Fælles sprog mellem leder, HR og medarbejder</li>
                <li>Kan genbruges næste gang rollen skal besættes</li>
              </ul>
              <div className="cardfoot">
                <a className="btn" href="mailto:pb@coachers.dk">
                  Book en snak
                </a>
                <p className="kontakt">
                  <a href="mailto:pb@coachers.dk">pb@coachers.dk</a> ·{' '}
                  <a href="tel:+4520845503">+4520845503</a>
                </p>
              </div>
            </div>

            <div className="prod" id="teamprofilen">
              <div className="tag">Team · 7 sider</div>
              <h3>Teamprofilen</h3>
              <p>
                Hele afdelingen i ét billede. Hvor ligner I hinanden for meget, hvor mangler I nogen
                — og hvad går galt, når to bestemte typer skal blive enige?
              </p>
              <ul>
                <li>Samlet DISC-fordeling for teamet</li>
                <li>Styrker og blinde vinkler, sat i ord</li>
                <li>Farveskala med guide til intern kommunikation</li>
                <li>Bruges direkte som materiale på en teamdag</li>
              </ul>
              <div className="cardfoot">
                <a className="btn" href="mailto:pb@coachers.dk">
                  Book en snak
                </a>
                <p className="kontakt">
                  <a href="mailto:pb@coachers.dk">pb@coachers.dk</a> ·{' '}
                  <a href="tel:+4520845503">+4520845503</a>
                </p>
              </div>
            </div>

            <div className="prod" id="jobmatch">
              <div className="tag">Rekruttering · Adgang købes</div>
              <h3>JobMatch</h3>
              <p>
                Hold kandidatens adfærdsprofil op mod kravprofilen, læg din egen vurdering af kemi,
                faglighed og motivation oveni — og få én samlet matchscore.
              </p>
              <ul>
                <li>Automatisk indlæsning af kandidatens arbejdsprofil</li>
                <li>Din vurdering af alt det, en test ikke måler</li>
                <li>Begrundet anbefaling og spørgsmål til næste samtale</li>
                <li>Eget arkiv over gennemførte jobmatch</li>
              </ul>
              <div className="cardfoot solo">
                <a className="btn" href="/jobmatch/">
                  Log ind på JobMatch
                </a>
              </div>
            </div>
          </div>

          <div className="notice">
            <b>Forbehold</b>
            <p>
              MasterDISC måler adfærdspræferencer — ikke evner, værdier, faglighed eller integritet.
              En profil er et afsæt for dialog, aldrig en dom over et menneske og aldrig eneste
              grundlag for en ansættelse. Beslutningen er altid din egen.
            </p>
          </div>
        </div>
      </section>

      {/* ===== PRISER ===== */}
      <section className="sec paper" id="priser">
        <div className="shell">
          <div className="sechead">
            <p className="eyebrow">Priser</p>
            <h2>Køb én profil, et klippekort — eller bliv certificeret</h2>
            <p>
              Alle profiler indeholder den fulde individualiserede rapport med begge grafer. Klip kan
              bruges frit til basisprofiler og til rekruttering. Vil du selv designe jobprofiler og
              give feedback, er certificeringen vejen ind.
            </p>
          </div>
          <div className="priser">
            <div className="pk">
              <h3>Enkeltprofil</h3>
              <p className="pdesc">
                Til dig, der vil opleve MasterDISC — eller har brug for én profil her og nu.
              </p>
              <div className="kr">DKK 1.500</div>
              <p className="per">pr. profil</p>
              <ul>
                <li>17 siders individualiseret rapport</li>
                <li>Arbejds- og privatprofil</li>
                <li>Skrevet til din konkrete jobrolle</li>
              </ul>
              <BuyButton label="Køb enkeltprofil" variant="line" />
            </div>

            <div className="pk hero-pk">
              <span className="badge">Mest valgte</span>
              <h3>Klippekort · 10 klip</h3>
              <p className="pdesc">
                Til lederen, der vil profilere sit team — brug klippene, når det passer dig.
              </p>
              <div className="kr">DKK 12.000</div>
              <p className="per">DKK 1.200 pr. profil · spar 20&nbsp;%</p>
              <ul>
                <li>10 profiler — gyldige i 24 måneder</li>
                <li>Kan bruges til profiler og rekruttering</li>
                <li>Teamprofil-rapport inkluderet</li>
              </ul>
              <BuyButton label="Køb klippekort" variant="gold" />
            </div>

            <div className="pk" id="certificering">
              <h3>Certificering · 1 dag</h3>
              <p className="pdesc">
                Til dig, der selv vil designe jobprofiler og give feedback på MasterDISC.
              </p>
              <div className="kr">DKK 6.000</div>
              <p className="per">1 undervisningsdag + onlineeksamen</p>
              <ul>
                <li>En hel undervisningsdag inkl. forplejning</li>
                <li>4 stk. MasterDISC-profiler — værdi DKK 6.000</li>
                <li>Onlineeksamen efter kursusdagen</li>
                <li>Adgang til selv at designe jobprofiler</li>
                <li>Ret til selv at give feedback på profiler</li>
              </ul>
              <div className="naeste">
                <b>Næste hold</b>
                <span>18. september 2026</span>
                <span>kl. 8.30–15.00 · Horsens</span>
              </div>
              <BuyButton label="Book certificering" variant="line" />
            </div>
          </div>
          <p className="moms">Alle priser er ekskl. moms.</p>
        </div>
      </section>

      {/* ===== ADGANG ===== */}
      <section className="hero" id="adgang" style={{ padding: '68px 0' }}>
        <div className="shell" style={{ position: 'relative', zIndex: 1 }}>
          <p className="eyebrow dark">Adgang</p>
          <h2 style={{ color: '#fff', fontSize: 31, marginBottom: 26 }}>Hvad skal du bruge?</h2>
          <div className="doors">
            <div className="door">
              <h3>Jeg skal lave min profil</h3>
              <p>
                Du har fået en adgangskode af din leder, konsulent eller underviser. Den bruges én
                gang og giver dig din egen rapport.
              </p>
              <a className="btn gold" href="/opret/">
                Opret profil med kode
              </a>
            </div>
            <div className="door">
              <h3>Jeg har købt adgang til JobMatch</h3>
              <p>
                Log ind og se jeres egne jobmatch. Kun din virksomhed har adgang til jeres
                rapporter. Du kan opsætte opgaver selv og gemme dem.
              </p>
              <a className="btn ghost goldborder" href="/jobmatch/">
                Log ind på JobMatch
              </a>
            </div>
          </div>
          <p style={{ margin: '28px 0 0', fontSize: 14.5, color: '#B9C2D4' }}>
            Skal I i gang som virksomhed? Skriv til{' '}
            <a href="mailto:pb@coachers.dk" style={{ color: 'var(--gold-light)' }}>
              pb@coachers.dk
            </a>
            , så finder vi ud af, hvad der passer til jer.
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="foot">
        <div className="shell">
          <div className="footgrid">
            <div>
              <a className="logo" href="#top">
                <span className="dots">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span className="wordmark">Master DISC</span>
              </a>
              <p className="blurb">
                Dansk udviklet adfærdsanalyse til performanceudvikling, samarbejde og rekruttering.
              </p>
            </div>
            <div>
              <h4>Værktøjer</h4>
              <ul>
                <li>
                  <a href="#familien">Basisprofilen</a>
                </li>
                <li>
                  <a href="#familien">Jobprofilen</a>
                </li>
                <li>
                  <a href="#familien">Teamprofilen</a>
                </li>
                <li>
                  <a href="#familien">JobMatch</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Kontakt</h4>
              <address>
                <span className="firma">Coachers</span>
                Jespersvej 37
                <br />
                8700 Horsens
                <br />
                Tlf. <a href="tel:+4520845503">+4520845503</a>
                <br />
                Mail: <a href="mailto:pb@coachers.dk">pb@coachers.dk</a>
              </address>
              <ul className="footlinks">
                <li>
                  <a href="#priser">Priser</a>
                </li>
                <li>
                  <a href="#adgang">Log ind</a>
                </li>
                <li>
                  <a href="/privatliv/">Privatlivspolitik</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footbar">
            <span>MasterDISC</span>
          </div>
        </div>
      </footer>
    </>
  );
}
