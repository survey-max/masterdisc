import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ARCHIVE_BUCKET, supabaseAdmin } from '../lib/supabase/server';
import {
  readPocData,
  resolveOwner,
  toArchiveInsert,
  toOrganisationInsert,
  toUserInsert,
} from './poc-data';

/**
 * ============================================================================
 * SEED — ANONYME EKSEMPELDATA IND I portal-SCHEMAET
 * ============================================================================
 *   pnpm seed
 *
 * Idempotent: id'erne er udregnet ud fra POC-id'erne (deterministisk uuid), så
 * scriptet kan køres igen uden dubletter. Rækker upsertes på id, filer uploades
 * med upsert.
 *
 * Skriver KUN til:
 *   - portal.organisations, portal.users, portal.archive_entries
 *   - bucketen portal-arkiv
 * Aldrig til andre schemas, tabeller eller buckets i det delte projekt.
 *
 * Datakilden er data/example/ (fiktive personer). Peg SEED_DATA_DIR et andet
 * sted, hvis I vil seede fra en anden anonym mappe — men KØR ALDRIG denne på
 * legacy-php/data/: rigtige data hører ikke i et dev-miljø. Brug
 * `pnpm dry-run` til dem.
 * ============================================================================
 */

const dir = path.resolve(process.env.SEED_DATA_DIR?.trim() || path.join('data', 'example'));

function line(text = ''): void {
  process.stdout.write(`${text}\n`);
}

async function main(): Promise<void> {
  line(`Seeder portal-schemaet fra ${dir}`);
  const data = readPocData(dir);

  const fejl = data.issues.filter((issue) => issue.niveau === 'fejl');
  if (fejl.length > 0) {
    line('');
    line('Eksempeldataene kan ikke mappes til skemaet:');
    for (const issue of fejl) line(`  FEJL  ${issue.tabel} ${issue.id}: ${issue.besked}`);
    throw new Error('Seeden stoppede. Ret dataene, eller ret mapningen i scripts/poc-data.ts.');
  }
  for (const issue of data.issues) line(`  note  ${issue.tabel} ${issue.id}: ${issue.besked}`);

  const client = supabaseAdmin();

  // ---- virksomheder
  const organisations = data.organisations.map(toOrganisationInsert);
  {
    const { error } = await client
      .from('organisations')
      .upsert(organisations, { onConflict: 'id' });
    if (error) throw new Error(`Upsert af virksomheder fejlede: ${error.message}`, { cause: error });
  }
  line(`  ${organisations.length} virksomheder`);

  // ---- brugere
  const users = data.users.map(toUserInsert);
  {
    const { error } = await client.from('users').upsert(users, { onConflict: 'id' });
    if (error) throw new Error(`Upsert af brugere fejlede: ${error.message}`, { cause: error });
  }
  line(`  ${users.length} brugere`);
  for (const user of data.users) {
    line(`    ${user.rolle === 'admin' ? 'admin ' : 'bruger'} ${user.navn}${user.spaerret ? ' (spærret)' : ''}`);
  }

  // ---- arkivposter, én ad gangen: fil før række, som i datalaget
  let medFil = 0;
  let udenFil = 0;
  for (const entry of data.entries) {
    const owner = resolveOwner(entry, data.users);
    const file = data.filer.get(entry.id);
    const bytes = file ? readFileSync(path.join(dir, file.navn)) : null;
    const fileInfo = bytes
      ? { storrelse: bytes.byteLength, checksum: createHash('sha256').update(bytes).digest('hex') }
      : null;
    const row = toArchiveInsert(entry, owner.id, fileInfo);

    if (file && bytes) {
      const upload = await client.storage
        .from(ARCHIVE_BUCKET)
        .upload(row.storage_path, new Blob([new Uint8Array(bytes)], { type: row.content_type }), {
          contentType: row.content_type,
          upsert: true,
        });
      if (upload.error) {
        throw new Error(
          `Upload af ${file.navn} til ${row.storage_path} fejlede: ${upload.error.message}. ` +
            `Findes bucketen ${ARCHIVE_BUCKET}?`,
          { cause: upload.error },
        );
      }
      medFil += 1;
    } else {
      udenFil += 1;
    }

    const { error } = await client.from('archive_entries').upsert(row, { onConflict: 'id' });
    if (error) {
      throw new Error(`Upsert af arkivposten ${entry.id} fejlede: ${error.message}`, { cause: error });
    }
    line(
      `    ${entry.art.padEnd(7)} ${entry.navn} — ejer: ${owner.id ? owner.grund : `ingen (${owner.grund})`}` +
        `${file ? '' : ' — INGEN FIL (med vilje: viser "filen findes ikke længere")'}`,
    );
  }
  line(`  ${data.entries.length} arkivposter (${medFil} med fil, ${udenFil} uden)`);

  line('');
  line('Færdig. Tjek dashboardet: Table editor -> schema "portal", og Storage -> portal-arkiv.');
  const admin = data.users.find((user) => user.rolle === 'admin' && !user.spaerret);
  if (admin) {
    line(`Portalen vises som ${admin.navn}. Sæt MOCK_USER_ID for en anden bruger.`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\nSeeden fejlede: ${message}\n`);
  process.exitCode = 1;
});
