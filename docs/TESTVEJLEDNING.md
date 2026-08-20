# Testvejledning

```bash
cd app-rewrite
pnpm install
pnpm dev
```

Dev-serveren skriver selv porten (3000, eller 3001 hvis 3000 er taget).
Erstat `:3000` nedenfor med den port, der står i terminalen.

## (a) Siderne

| Åbn | Forventet |
|---|---|
| http://localhost:3000/ | Forsiden. Klik **Produktet** i menuen (dropdown åbner), pil/prikker i jobprofil-kortet skifter mellem 5 eksempler, **Køb enkeltprofil** viser "Bestil på pb@coachers.dk"-linjen. |
| http://localhost:3000/privatliv/ | Privatlivspolitikken med "Udkast — skal gennemgås inden brug"-boksen og de gule huller. |
| http://localhost:3000/jobmatch/ | Portalen som **Anna Eksempel · Eksempel Rådgivning ApS**. Fanen **Jobmatchfiler** viser 2 poster (admin ser begge virksomheder). Søgefelt filtrerer, sorteringsknappen cykler Nyeste → Ældste → Kandidat A–Å. **Hent sagen** på "Ida Fiktiv" downloader `jobmatch-ida-fiktiv-2026-08-10.json`. **Åbn** på "Jens Opdigtet" giver 404 med teksten "Filen bag arkivposten … findes ikke længere" — med vilje: eksempeldataene har ingen PDF på disken. |
| http://localhost:3000/jobmatch/login/ | Login-siden som i POC'en. Tryk **Log ind** → besked om at login ikke er sat op (fase 3). Intet sendes, ingen cookie sættes. |
| http://localhost:3000/jobmatch/admin/ | Administration: opret virksomhed, opret bruger (uden adgangskode), brugertabel med Spær/Åbn. Opret en virksomhed → grøn kvitteringsbjælke, og den står i tabellen bagefter (skrives til `data/example/organisationer.json`). |
| http://localhost:3000/jobmatch/vaerktoej/ | JobMatch-værktøjet, trin 00. Se (e). |
| http://localhost:3000/profil/ | Ingen kodegate: kortvarigt "Vi tjekker din kode", derefter redirect til `/opret` (der er ingen kode i URL'en). Se (c). |

Fejlhåndtering, hvis du vil se den: omdøb `data/example/brugere.json` og
genindlæs `/jobmatch/` → rød "Fejl i datalaget"-side med filstien. Ingen tom
liste. Husk at omdøbe tilbage.

## (b) /opret med en **gyldig** konsulentkode

1. Åbn http://localhost:3000/opret/
2. Indtast en kode, du ved er gyldig, og tryk **Gå til profilen**. Knappen skifter
   til "Tjekker koden …" mens den valideres.
3. Forventet: browseren lander på `/profil/?kode=<koden>`, viser kort "Vi tjekker
   din kode" og fortsætter **direkte til info-formularen**
   (Fornavn/Efternavn/Firma/Ansættelse/Køn/E-mail + samtykke). **Du ser aldrig et
   kodefelt i DISC-flowet.**

   Valideringen sker begge steder mod det rigtige `/api/disc/verify-code` på
   `https://www.unicoachers.dk` — koden skal altså være gyldig i produktion.

## (c) /opret med en **ugyldig** kode

1. Åbn http://localhost:3000/opret/, skriv fx `XXXX-1234`, tryk **Gå til profilen**.
2. Forventet: du bliver **ikke** sendt videre. Fejlbeskeden "Koden blev ikke
   godkendt. Tjek, at den er skrevet præcis som du har fået den." står på
   `/opret`, feltet er markeret, og du kan rette og prøve igen.
3. Prøv også tomt felt (→ "Indtast din adgangskode først.") og 3 tegn (→ "Koden
   ser for kort ud. Tjek den igen.") — POC'ens egne lokale tjek, som sparer et
   kald men ikke afgør noget.
4. Er API'et utilgængeligt (slå netværket fra og prøv), vises "Vi kunne ikke få
   kontakt til serveren, så koden kunne ikke tjekkes. Prøv igen om et øjeblik." —
   en serverfejl bliver aldrig vist som en forkert kode.

## (d) /profil/ uden eller med ugyldig kode

| Åbn | Forventet |
|---|---|
| http://localhost:3000/profil/ | Kort "Vi tjekker din kode" → redirect til `/opret/?fejl=mangler` med beskeden "Indtast din adgangskode her, før du starter profilen." Intet kodefelt, ingen adgang til info-formularen. |
| http://localhost:3000/profil/?kode=UGYLDIG | Tavst API-kald → redirect til `/opret/?fejl=ugyldig&kode=UGYLDIG` med "Koden blev ikke godkendt. Tjek den, og prøv igen." Koden er forudfyldt, så den kan rettes. |
| http://localhost:3000/profil/?kode=X (med netværket slået fra) | Redirect til `/opret/?fejl=api&kode=X` med "Vi kunne ikke tjekke koden lige nu. Prøv igen om et øjeblik." Ingen evig loading. |
| http://localhost:3000/profil/survey/&lt;virksomhedsslug&gt; | Virksomhedens profilliste (samme API som før). Klik på en profil → `/profil/?profile=…&company=…` → ingen kode → `/opret`, hvor virksomhedsvalget følger med i URL'en og sendes tilbage til `/profil/` efter godkendt kode (firmanavnet er stadig forudfyldt i info-formularen). |

Brug også tilbage-knappen efter et redirect: du havner på `/opret`, ikke i en
løkke mellem de to sider (`location.replace`).

## (e) DevTools → Network

1. Åbn Network-fanen, og gennemfør (b).
2. Forventet: **ét** `POST verify-code` fra `/opret` (status 200, `{"ok":true,…}`),
   og **ét mere** fra `/profil/` umiddelbart efter — det tavse gentjek. Payloaden
   er identisk begge steder: `{"submitCode":"<kode>"}`.
3. Ingen af kaldene sker, hvis koden er tom eller under 4 tegn (lokale tjek), og
   `/profil/` kalder ikke API'et, når der slet ikke er nogen kode i URL'en.

## (f) DISC-flowet klikkes igennem — **stop før submit**

1. Gå ind via (b).
2. Udfyld info-formularen, sæt begge samtykkeflueben, **Start analysen**.
3. "Gode råd" → **Fortsæt** → besvar de 27 spørgsmål (MEST/MINDST).
4. **STOP på spørgsmål 27 uden at trykke "Afslut".** Submit skriver til
   produktion (`/api/disc/submit`) og kan ikke fortrydes.

## (g) JobMatch-værktøjet (valgfrit, men det er den store portering)

1. `/jobmatch/vaerktoej/` → sæt flueben i **vilkårene** (uden dem kan du ikke
   videre — prøv at klikke "01 Kandidat" først og se advarslen).
2. Trin 01: udfyld kandidat/stilling, evt. upload en MasterDISC-PDF
   (arbejdsprofilens tal indlæses; en ikke-MasterDISC-PDF afvises med den røde
   "Opgaven er afvist"-boks, og du kan ikke gå videre). **Generér sagsnummer**.
3. Trin 02: vælg et preset, træk i sliderne, sæt en faktorvægt til **Høj**.
4. Trin 03: giv scorer, sæt ét punkt til **Kritisk** med score ≤ 5, tilføj et
   eget spørgsmål, og tryk **Opdater Jobmatch**.
5. Trin 04: rapporten bygges og deles i A4-ark. **Gem sag som fil** downloader
   sagen som JSON; **Åbn gemt sag** på trin 00 læser den ind igen (prøv også
   `data/example/bbbb000000000001.json`). **Gem i arkivet** lægger sagen i
   arkivet — den optræder derefter under `/jobmatch/` → Jobmatchfiler.
   **Udskriv eller gem som PDF** åbner printdialogen.

Rapportens indhold er verificeret mod POC'en: for tre scenarier (eksempelsagen,
et kritisk punkt med afvigelser uden for spændet, og en sag uden svar) er den
genererede rapport-HTML **tegn for tegn identisk** med `vaerktoej.php`'s output,
og `assessJob`, `suggestFromText` og DISC-PDF-parsingen giver samme resultater.
