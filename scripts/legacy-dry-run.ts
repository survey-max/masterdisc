import path from 'node:path';

import {
  readPocData,
  resolveOwner,
  toArchiveInsert,
  toOrganisationInsert,
  toUserInsert,
} from './poc-data';

/**
 * ============================================================================
 * DRY-RUN — HVAD EN MIGRERING AF DE RIGTIGE DATA VILLE GØRE
 * ============================================================================
 *   pnpm dry-run                     (læser legacy-php/data/)
 *   pnpm dry-run -- --dir <mappe>
 *   pnpm dry-run -- --check-existing (læser OGSÅ portal-tabellerne, kun SELECT)
 *
 * Scriptet SKRIVER INTET. Uden --check-existing rører det slet ikke nettet, så
 * der ikke findes en vej fra dette script til en ændring i det delte projekt.
 *
 * Rapporten indeholder INGEN persondata: kun antal, POC-id'er, feltnavne og
 * maskerede e-mails. Navne, stillinger og noter kommer ikke ud i en terminal
 * eller en log.
 *
 * legacy-php/ er git-ignoreret, og dataene dér er rigtige. De må ikke seedes
 * ind i et dev-miljø — derfor er dette scriptet, der findes for dem.
 * ============================================================================
 */

const args = process.argv.slice(2);

function flagValue(name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

const dir = path.resolve(
  flagValue('--dir') ?? process.env.LEGACY_DATA_DIR?.trim() ?? path.join('legacy-php', 'data'),
);
const checkExisting = args.includes('--check-existing');

function line(text = ''): void {
  process.stdout.write(`${text}\n`);
}

function heading(text: string): void {
  line();
  line(text);
  line('-'.repeat(text.length));
}

async function main(): Promise<void> {
  line('DRY-RUN — ingen skrivning, hverken til Supabase eller til disk');
  line(`Kilde: ${dir}`);

  const data = readPocData(dir);

  const organisations = data.organisations.map(toOrganisationInsert);
  const users = data.users.map(toUserInsert);

  const owners = new Map<string, { id: string | null; grund: string }>();
  const rows = data.entries.map((entry) => {
    const owner = resolveOwner(entry, data.users);
    owners.set(entry.id, owner);
    const file = data.filer.get(entry.id);
    return toArchiveInsert(
      entry,
      owner.id,
      // Checksum udregnes ikke her: dry-run læser ikke filindhold.
      file ? { storrelse: file.storrelse, checksum: null } : null,
    );
  });

  heading('Ville blive oprettet i portal-schemaet');
  line(`  portal.organisations    ${organisations.length}`);
  line(`  portal.users            ${users.length}`);
  line(`  portal.archive_entries  ${rows.length}`);

  const medFil = rows.filter((row) => data.filer.has(row.legacy_id));
  heading('Ville blive uploadet til bucketen portal-arkiv');
  line(`  objekter                ${medFil.length}`);
  const eksempel = medFil[0];
  if (eksempel) line(`  stiformat               ${eksempel.storage_path}`);

  heading('Ejerskab (created_by_user_id)');
  const medEjer = rows.filter((row) => row.created_by_user_id !== null).length;
  line(`  med relation            ${medEjer}`);
  line(`  uden relation           ${rows.length - medEjer}  (navnet bevares i created_by_name)`);
  const grunde = new Map<string, number>();
  for (const [, owner] of owners) {
    if (owner.id) continue;
    grunde.set(owner.grund, (grunde.get(owner.grund) ?? 0) + 1);
  }
  for (const [grund, antal] of grunde) line(`    ${antal} × ${grund}`);

  heading('Filer');
  const udenFil = rows.filter((row) => !data.filer.has(row.legacy_id));
  line(`  poster med fil på disk  ${medFil.length}`);
  line(`  poster UDEN fil         ${udenFil.length}`);
  for (const row of udenFil) {
    line(`    ${row.legacy_id}: rækken ville blive oprettet uden objekt → download svarer "findes ikke længere"`);
  }
  const kendteIder = new Set(data.entries.map((entry) => entry.id));
  const forladte = [...data.filer.keys()].filter((id) => !kendteIder.has(id));
  line(`  filer uden en post      ${forladte.length}`);
  for (const id of forladte) line(`    ${id}: ligger på disken, men står ikke i data.json — ville ikke blive migreret`);

  heading('Ting der ikke migreres');
  const medHash = data.users.filter((user) => user.harHash).length;
  line(`  bcrypt-hash droppet     ${medHash} af ${data.users.length} brugere`);
  const orgadmins = data.users.filter((user) => user.rolleIFilen === 'orgadmin').length;
  line(`  'orgadmin' → 'bruger'   ${orgadmins}`);
  line("  loginforsog.json        læses ikke (login-spærring hører til auth, skive 2)");
  line('  opsat.flag              læses ikke (førstegangsopsætning, skive 2)');

  const fejl = data.issues.filter((issue) => issue.niveau === 'fejl');
  const noter = data.issues.filter((issue) => issue.niveau === 'note');

  heading(`Valideringsfejl og kollisioner (${fejl.length})`);
  if (fejl.length === 0) line('  ingen — alle poster kan mappes til skemaet');
  for (const issue of fejl) line(`  FEJL  ${issue.tabel} ${issue.id}: ${issue.besked}`);

  heading(`Noter (${noter.length})`);
  if (noter.length === 0) line('  ingen');
  for (const issue of noter) line(`  note  ${issue.tabel} ${issue.id}: ${issue.besked}`);

  if (checkExisting) {
    heading('Kollisioner mod portal-schemaet (kun SELECT)');
    // Importeres først her, så scriptet uden flaget ikke engang loader
    // Supabase-klienten — og dermed ikke kan komme til at kalde nettet.
    const { supabaseAdmin } = await import('../lib/supabase/server');
    const client = supabaseAdmin();
    const checks: Array<{ tabel: string; ids: string[] }> = [
      { tabel: 'organisations', ids: organisations.map((row) => row.legacy_id) },
      { tabel: 'users', ids: users.map((row) => row.legacy_id) },
      { tabel: 'archive_entries', ids: rows.map((row) => row.legacy_id) },
    ];
    for (const check of checks) {
      if (check.ids.length === 0) {
        line(`  portal.${check.tabel}: intet at tjekke`);
        continue;
      }
      const { data: found, error } = await client
        .from(check.tabel)
        .select('legacy_id')
        .in('legacy_id', check.ids);
      if (error) throw new Error(`Opslag i portal.${check.tabel} fejlede: ${error.message}`, { cause: error });
      const antal = Array.isArray(found) ? found.length : 0;
      line(`  portal.${check.tabel}: ${antal} af ${check.ids.length} legacy_id findes allerede (ville blive opdateret, ikke oprettet)`);
    }
  } else {
    line();
    line('Kør igen med --check-existing for at se, hvad der allerede findes i portal-schemaet.');
  }

  line();
  if (fejl.length > 0) {
    line(`KONKLUSION: ${fejl.length} post(er) kan ikke migreres, som dataene ser ud nu.`);
    process.exitCode = 1;
    return;
  }
  line('KONKLUSION: alle poster kan mappes. Intet er skrevet.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\nDry-run fejlede: ${message}\n`);
  process.exitCode = 1;
});
