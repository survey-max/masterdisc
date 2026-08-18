# Masterdisc indlejret under /profil/

`masterdisc/` er kopieret uændret til `public/profil/`, så DISC-flowet serveres
statisk på `/profil/`. Originalen i `../masterdisc/` er **ikke** rørt
(`git status` i den mappe er ren).

Ikke kopieret med: `.git/`, `.claude/`, `test.txt`, `CNAME` (stod allerede i
masterdisc' `.vercelignore`) og `vercel.json` (dens rewrite er flyttet til
`next.config.ts`, og filen skal ikke serveres offentligt).

## Sådan virker URL'erne

| URL | Fil | Hvordan |
|---|---|---|
| `/profil/` | `public/profil/index.html` | rewrite i `next.config.ts` |
| `/profil/survey/` | `public/profil/survey/index.html` | rewrite |
| `/profil/survey/<virksomhed>` | `public/profil/survey/index.html` | rewrite — erstatter `masterdisc/vercel.json` |
| `/profil/locales/da.json`, `/profil/disc_udsagn_da_3.0.csv`, `/profil/assets/…` | direkte fra `public/` | statisk |

To ting er nødvendige for, at det virker:

1. **`trailingSlash: true`** i `next.config.ts`. Masterdisc henter alt relativt
   (`assets/…`, `locales/${lang}.json`, `disc_udsagn_${lang}_3.0.csv`). På
   `/profil/` peger de på `/profil/…`; på `/profil` (uden skråstreg) ville de
   pege på `/profil/../…` = sitets rod og give 404. Trailing slash svarer
   samtidig til POC'ens URL'er (`/opret/`, `/jobmatch/`).
2. **Eksplicitte rewrites.** Next.js laver ikke directory-index-opslag for filer
   i `public/`, så `/profil/` ville ellers være 404.

## Ændringer i kopien

`survey/index.html` (to rettelser, begge fra flytningen under `/profil/`):

1. **Slug-læsningen.** Siden læste virksomheds-slug som *segment nr. 2* i stien
   (`pathParts[1]`), hvilket passede til `/survey/<slug>`. Under
   `/profil/survey/<slug>` ville den have læst `"survey"` som slug. Den læser nu
   segmentet **efter** `"survey"`, hvilket virker på begge placeringer.
2. **Videresendelsen.** `window.location.href = '/?profile=…'` pegede på sitets
   rod; den peger nu på `/profil/?profile=…`.

`index.html` (kodegaten — se afsnittet nedenfor):

3. Kodegatens `<section id="stepCode">` med felt, knap og fejllinje er erstattet
   af `<section id="stepVerify">`: en kort ventetilstand ("Vi tjekker din kode").
4. `verifyCode()` tager nu koden som parameter og returnerer udfaldet i stedet
   for at læse et felt og skrive i gatens UI. **Selve valideringen er uændret:**
   samme POST, samme headers, samme svartjek, samme `state.submitMeta`.
5. Klik-handleren på den fjernede knap og de to `applyLanguage()`-linjer, der
   oversatte gatens overskrift og knap, er væk.
6. Init-blokken starter i ventetilstanden og kalder kodegate-scriptet; hele
   opstarten ligger i en `try/catch`, så en fejlet opstart sender brugeren til
   `/opret` i stedet for at efterlade ham i evig loading.
7. Nyt `<script>` nederst: kodegaten uden kodefelt.

Ingen andre rettelser: scoring, spørgsmål, payload-struktur, submit-flow,
sprogvalg og API-kald er urørte — submit sender fortsat
`{submitCode: state.submitMeta.submitCode, payload}` præcis som før.
`window.DISC_API_BASE` virker som hidtil (default `https://www.unicoachers.dk`).
`diff masterdisc/index.html app-rewrite/public/profil/index.html` viser præcis
disse ændringer og intet andet.

## Kodevalidering: på /opret, og tavst igen i /profil

Koden indtastes **kun** på `/opret`. DISC-flowet viser aldrig et kodefelt.

**På `/opret`** (`app/opret/KodeForm.tsx` + `lib/disc/verify-code.ts`):

- POST til `<DISC_API_BASE>/api/disc/verify-code`, `Content-Type:
  application/json`, body `{"submitCode":"<kode>"}` — nøjagtig samme kald som
  masterdisc' `verifyCode()` laver, og en kode er kun gyldig, hvis svaret er ok
  **og** `ok: true` står i svaret.
- Mens der tjekkes: knappen viser "Tjekker koden …" og er deaktiveret.
- Afvist kode → dansk fejlbesked på `/opret`, ingen redirect.
- API nede eller 5xx → "Vi kunne ikke få kontakt til serveren …", og man kan
  prøve igen med det samme. **Serverfejl bliver aldrig vist som "forkert kode".**
- Godkendt kode → `/profil/?kode=<kode>`.

**I `/profil/`** (kodegate-scriptet i den kopierede `index.html`):

| Situation | Hvad sker der |
|---|---|
| Gyldig `?kode=` | Valideres tavst, derefter direkte til info-/intro-trinnet |
| Ugyldig kode | Redirect til `/opret/?fejl=ugyldig&kode=<kode>` — koden følger med, så den kan rettes |
| Ingen kode | Redirect til `/opret/?fejl=mangler` |
| API/netværksfejl | Redirect til `/opret/?fejl=api&kode=<kode>` |
| Opstartsfejl (locales, CSV) | Redirect til `/opret/?fejl=start` |

`/opret` oversætter `?fejl=` til en dansk besked. Redirects bruger
`location.replace()`, så der ikke opstår en frem-og-tilbage-løkke, og
`profile`/`company` fra `/profil/survey/<virksomhed>` sendes med begge veje, så
firmanavnet stadig bliver forudfyldt.

Adgangskontrollen er ikke svækket, men flyttet: `setStep('intro')` kaldes kun
efter et `true` fra `verifyCode()`, og submit kan kun bruge den `submitCode`,
valideringen selv har sat. `/profil/` uden godkendt kode når hverken
info-formularen eller spørgsmålene.

## Kræver opfølgning (ikke fikset her)

| Emne | Hvad |
|---|---|
| `/profil/survey/index.html` linker til `disclinedb.web.app` | Footeren krediterer DISCline med et link til det gamle Firebase-domæne. Uændret fra masterdisc og ikke en del af flowet, men skal med i beslutningen om domæne. Det var også her, adminværktøjets otte hardkodede survey-links pegede hen — de forsvandt med panelet (commit 3196bbb). |
| `/profil/survey/index.html` direkte | Læser slug'en som `"index.html"`. Samme adfærd som i POC'en (`/survey/index.html` gav samme resultat) — ikke en regression, men en skarp kant. |
| Kodegaten er nu kun klientside | Det var den også før (statisk side + API-kald), men nu ligger både indtastning og validering på to sider, der begge er statiske/klientrenderede. Skal adgangen håndhæves stærkere, hører det sammen med fase 3: fx en server-side session efter godkendt kode, eller at flowet leveres bag et kald, der selv kræver koden. |
| Sproget i ventetilstanden | "Vi tjekker din kode" er dansk uanset sprogvalg. Kodegatens tekster var oversat i `locales/*.json` (`codeGate.*`); nøglerne står urørte, men bruges ikke længere til gaten. Skal flowet kunne starte på et andet sprog, hører beskeden — og `/opret` som helhed — med i den beslutning. |
| `config.json` serveres | Kopieret med for ikke at ændre kopien, men ingen af siderne læser den. Kan slettes, når nogen bekræfter det. |
| pdf.js og Font Awesome fra CDN | Uændret fra POC/masterdisc. Bør pakkes lokalt inden fase 2, hvis der skal være styr på tredjepartskald. |
| Fase 2: `/profil/` skal måske være sitets rod | Slutmålet er masterdisc.dk. Skal DISC-flowet ligge på `/` i stedet for `/profil/`, er det én rewrite-ændring — men så skal portalens forside flyttes et andet sted hen. Beslutning, ikke kodearbejde. |
