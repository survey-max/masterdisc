# Migrations til hovedrepoet

Disse SQL-filer hører **ikke** hjemme i dette repo på længere sigt. De skal
afleveres til hovedplatformens repo i `supabase/migrations/`, som er den
kanoniske skemakilde. De ligger her, fordi portalarbejdet foregår her.

**Ingen af dem er kørt.** De køres manuelt af jer i Supabase' SQL-editor (eller
via `supabase db push` fra hovedrepoet).

## Rækkefølge

| # | Fil | Indhold |
|---|---|---|
| 1 | `20260818120000_portal_schema_init.sql` | schemaet `portal`, rettigheder (kun `service_role`), `portal.set_updated_at()` |
| 2 | `20260818120100_portal_tables.sql` | `organisations`, `users`, `archive_entries` + constraints, indekser, triggers, kommentarer |
| 3 | `20260818120200_portal_enable_rls.sql` | RLS slået til på alle tre tabeller, bevidst uden policies |

Alle tre er idempotente og kan køres igen uden effekt.

## Navnekonvention — verificér mod hovedrepoet

Antaget konvention er Supabase CLI's standard:

```
supabase/migrations/<YYYYMMDDHHMMSS>_<snake_case_beskrivelse>.sql
```

14-cifret UTC-timestamp, kun fremad (ingen down-migrations). **Timestampene skal
være højere end hovedrepoets nyeste migration** — omdøb filerne hvis
`20260818…` ikke er senere end den nyeste dér. Afviger hovedrepoet fra
konventionen (fx nummerserie i stedet for timestamp), så omdøb tilsvarende;
indholdet er uafhængigt af filnavnene.

## To trin der IKKE er SQL

Begge rører det delte projekt og skal gøres af jer, ikke af en migration:

1. **Exposed schemas.** Settings → API → Exposed schemas: tilføj `portal` ved
   siden af de eksisterende. Uden det afviser PostgREST
   `db.schema = 'portal'`-kaldene fra appen. Additivt — eksisterende schemas
   ændres ikke.
2. **Storage-bucket.** Opret bucketen `portal-arkiv` manuelt:
   - Public: **nej** (privat)
   - File size limit: `26214400` (25 MB, samme grænse som `arkiv.php`)
   - Allowed MIME types: `application/pdf`, `application/json`

   Den oprettes ikke af en migration, fordi det ville betyde skrivning til
   `storage.buckets` — en eksisterende tabel uden for `portal`.

Ingen storage-policies er nødvendige nu: bucketen er privat, og al adgang går
gennem serveren med secret-nøglen. Policies hører til skive 2 sammen med RLS.

## Hvad migrationerne bevidst ikke gør

- Rører ingen eksisterende tabeller, schemas eller buckets.
- Opretter ingen kolonne til hovedplatformens `companies` (kun en fremtidsnote i
  `COMMENT ON TABLE portal.organisations`) og ingen foreign keys på tværs af
  schemas.
- Gemmer ingen adgangskoder. POC'ens bcrypt-`hash` migreres aldrig.
- Tilføjer ingen RLS-policies (skive 2), men blokerer ikke for dem.
