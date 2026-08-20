# Eksempeldata (anonyme)

**Disse filer er kilden til `pnpm seed`**, som lægger dem ind i Supabase
(schemaet `portal` + bucketen `portal-arkiv`). Se `docs/SUPABASE.md`. Selve
appen læser dem ikke længere direkte.

Fiktive records i **samme struktur og med samme felttyper** som POC'ens
`jobmatch-filer/`. De ligger i git, fordi de skal kunne bruges til udvikling
uden at nogen kommer i nærheden af rigtige personoplysninger.

| Fil | Svarer til |
|---|---|
| `brugere.json` | POC'ens `brugere.json` — dog **uden** `hash`-feltet (ingen credentials i fase 1) |
| `organisationer.json` | POC'ens `organisationer.json` |
| `data.json` | POC'ens `data.json` (arkivets indeks) |
| `bbbb000000000001.json` | Den gemte sag bag arkivposten med samme id — samme format som værktøjets "Gem sag som fil" |

Rigtige data lægges **uden for repoet**, og datamappen udpeges med:

```
JOBMATCH_DATA_DIR=C:\et\sted\uden\for\repoet
```

`.gitignore` spærrer i forvejen for `jobmatch-filer/`, `data/local/`, uploadede
PDF'er og de rigtige JSON-db-filnavne.

Arkivposten `bbbb000000000002` har ingen fil på disken. Det er med vilje: det
viser, at datalaget siger det højt (`DataMissingError` → "Filen bag arkivposten
findes ikke længere") i stedet for at levere et tomt svar.
