# Hosting: to Vercel-projekter, ét domæne

`masterdisc.dk/app-rewrite` findes ikke som rute i denne app. Den opstod som
mappenavn, og fordi rod-repoet er et statisk site uden `package.json`, byggede
Vercel aldrig app'en — den uploadede blot kildefilerne. Derfor 404.

Løsningen er en proxy: app'en kører som sit eget Vercel-projekt og nås gennem
det statiske site.

## Opsætning

**1. Nyt Vercel-projekt på samme repo**

| Indstilling | Værdi |
|---|---|
| Root Directory | `app-rewrite` |
| Framework Preset | Next.js (auto) |
| Build Command | auto (`next build`) |

Noter projektets produktionsdomæne, fx `masterdisc-app-rewrite.vercel.app`.

**2. Indsæt domænet i rodens `vercel.json`**

Begge `destination`-felter indeholder placeholderen
`https://SKIFT-MIG-app-rewrite.vercel.app`. Skift den ud med domænet fra trin 1.
Placeholderen fejler synligt frem for at fejle tavst.

**3. Det eksisterende projekt røres ikke**

Root Directory forbliver repo-roden. `.vercelignore` udelader nu `app-rewrite`,
så kildekoden ikke længere serveres som filer — den blev tidligere hentet
offentligt på fx `/app-rewrite/app/page.tsx`.

## Hvorfor basePath

`basePath: '/app-rewrite'` (se `lib/base-path.ts`) får app'en til at udsende
ruter, `_next/`-assets og alt i `public/` under samme præfiks. Derfor dækker de
to rewrite-regler det hele, og intet slipper ud i rodens navnerum.

Sæt `BASE_PATH` til `''`, hvis app'en en dag skal ligge på et domæne-root — så
skal proxy-reglerne fjernes igen.

## Hvad proxyen koster

- **Server actions.** De afvises, hvis `Origin` ikke matcher værtsnavnet. Bag
  proxyen sender browseren `masterdisc.dk`, mens app'en ser sit eget
  `*.vercel.app`. Derfor er `experimental.serverActions.allowedOrigins` sat i
  `next.config.ts`. Tilføjes et nyt domæne foran proxyen, skal det med på listen.
- **Et ekstra hop.** Hvert request går gennem to Vercel-projekter.
- **Uændret fra fase 2:** filsystemet er read-only på Vercel, så alt der
  skriver gennem `lib/data/json/json-repository.ts` fejler stadig. Se
  `FASE-RAPPORT.md` punkt 3.1 — det er en fase 3-beslutning, ikke noget
  proxyen ændrer.
