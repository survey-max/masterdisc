import { handleWithUser, jsonFail, jsonOk, portalRepository } from '@/app/api/portal/_lib/context';
import {
  archiveKind,
  field,
  isoDate,
  looksLikePdf,
  MAX_ARCHIVE_BYTES,
} from '@/lib/jobmatch/archive-input';

/**
 * Arkivet. Erstatter arkiv.php ?a=liste og ?a=gem.
 *
 * Virksomheds-scopingen sker på den bruger, serveren selv har slået op: GET
 * filtrerer på hendes virksomhed (en admin ser alle), og POST skriver ALTID til
 * hendes virksomhed med hende som ejer. Et org-id fra klienten bliver ignoreret
 * — ellers kunne et kald lægge en sag i en anden virksomheds arkiv.
 *
 * POC'ens regler håndhæves her igen (ikke kun i server action'en), fordi routen
 * er en selvstændig indgang: 25 MB, %PDF--tjek på rapporter, gyldig JSON på
 * sager, felt()-rensning og dato-normalisering.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleWithUser(request, async ({ viewer }) =>
    jsonOk({
      filer: await portalRepository.listArchiveEntries(viewer),
      visOrg: viewer.rolle === 'admin',
    }),
  );
}

export async function POST(request: Request): Promise<Response> {
  return handleWithUser(request, async ({ user, viewer }) => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonFail('Kaldet var ikke en gyldig upload.', 400, 'DataError');
    }

    const art = archiveKind(form.get('art'));
    const file = form.get('fil');
    if (!(file instanceof File)) return jsonFail('Der blev ikke sendt nogen fil.', 400, 'DataError');
    if (file.size <= 0) return jsonFail('Filen er tom.', 400, 'DataError');
    if (file.size > MAX_ARCHIVE_BYTES) {
      return jsonFail(
        art === 'sag' ? 'Sagen er større end 25 MB.' : 'Filen er større end 25 MB.',
        400,
        'DataError',
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (art === 'rapport' && !looksLikePdf(bytes)) {
      return jsonFail('Filen er ikke en PDF.', 400, 'DataError');
    }
    if (art === 'sag') {
      try {
        JSON.parse(new TextDecoder().decode(bytes)) as unknown;
      } catch {
        return jsonFail('Sagen kunne ikke læses som gyldig data.', 400, 'DataError');
      }
    }

    const filnavn = (file.name || (art === 'sag' ? 'sag.json' : 'rapport.pdf')).slice(0, 160);
    const fallbackName = filnavn.replace(/\.(pdf|json)$/i, '');
    const navn = field(form.get('navn')) || (art === 'sag' ? '' : fallbackName || 'Uden navn');
    if (navn === '') {
      return jsonFail(
        'Udfyld kandidatens navn på trin 1, før sagen kan gemmes.',
        400,
        'DataError',
      );
    }

    const post = await portalRepository.createArchiveEntry({
      org: viewer.org,
      bruger: user.navn,
      brugerId: user.id,
      art,
      navn,
      stilling: field(form.get('stilling')),
      dato: isoDate(field(form.get('dato'), 10)),
      note: field(form.get('note'), 1000),
      filnavn,
      bytes,
    });
    return jsonOk({ post }, 201);
  });
}
