'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ActionResult } from '@/lib/action-result';
import type { Organisation, User } from '@/lib/data';

import { createOrganisationAction, createUserAction, toggleUserBlockedAction } from './actions';

interface Besked {
  text: string;
  type: 'ok' | 'fejl';
}

function dkDate(seconds: number): string {
  if (!seconds) return '—';
  const d = new Date(seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function dkDateTime(seconds: number): string {
  if (!seconds) return '—';
  const d = new Date(seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

const ROLE_LABEL: Record<User['rolle'], string> = { admin: 'System', bruger: 'Bruger' };

/**
 * admin.php's three cards, from the logged-in variant of the page.
 *
 * Two things are gone on purpose (docs/KORTLAEGNING.md): the "Virksomhedsadmin"
 * role, which granted nothing, and everything to do with passwords — the
 * "Adgangskode"-feltet og "Skift"-knappen.
 */
export function AdminForms({
  mig,
  orgs,
  brugere,
}: {
  mig: { id: string; navn: string; orgNavn: string };
  orgs: Organisation[];
  brugere: User[];
}) {
  const [besked, setBesked] = useState<Besked | null>(null);
  const [travl, setTravl] = useState(false);

  async function run(
    action: (formData: FormData) => Promise<ActionResult<string>>,
    formData: FormData,
    form?: HTMLFormElement,
  ) {
    setTravl(true);
    const result = await action(formData);
    setTravl(false);
    if (result.ok) {
      setBesked({ text: result.data, type: 'ok' });
      form?.reset();
    } else {
      setBesked({ text: result.fejl, type: 'fejl' });
    }
  }

  const antalBrugere = (orgId: string) => brugere.filter((b) => b.org === orgId).length;

  return (
    <div className="p-jm-admin">
      <header className="top">
        <div className="shell">
          <div className="toprow">
            <div className="logo">
              <div className="dots">
                <i />
                <i />
                <i />
                <i />
              </div>
              <b>Master DISC</b>
              <span>Administration</span>
            </div>
            <div className="who">
              <span>
                {mig.navn} · {mig.orgNavn}
              </span>
              <Link href="/jobmatch/">JobMatch</Link>
              <Link href="/jobmatch/login/">Log ud</Link>
            </div>
          </div>
        </div>
        <div className="grad" />
      </header>

      <main className="shell">
        {besked ? <div className={`msg ${besked.type}`}>{besked.text}</div> : null}

        <div className="card">
          <p className="eyebrow">Virksomheder</p>
          <h2>Opret en virksomhed</h2>
          <p>
            Hver virksomhed har sit eget arkiv. Brugere ser kun deres egen virksomheds sager og
            rapporter.
          </p>
          <form
            className="inline"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void run(createOrganisationAction, new FormData(form), form);
            }}
          >
            <input type="text" name="orgnavn" placeholder="Fx Nordisk Industri A/S" required />
            <button className="btn" type="submit" disabled={travl}>
              Opret
            </button>
          </form>

          {orgs.length ? (
            <table style={{ marginTop: 24 }}>
              <tbody>
                <tr>
                  <th>Virksomhed</th>
                  <th>Brugere</th>
                  <th>Oprettet</th>
                </tr>
                {orgs.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <b>{o.navn}</b>
                    </td>
                    <td>{antalBrugere(o.id)}</td>
                    <td>{dkDate(o.oprettet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        <div className="card">
          <p className="eyebrow">Brugere</p>
          <h2>Opret en bruger</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void run(createUserAction, new FormData(form), form);
            }}
          >
            <div className="g2">
              <label>
                <span>Navn</span>
                <input type="text" name="bnavn" required />
              </label>
              <label>
                <span>E-mail</span>
                <input type="email" name="bemail" required />
              </label>
            </div>
            <div className="g2">
              <label>
                <span>Virksomhed</span>
                <select name="borg" required defaultValue="">
                  <option value="">Vælg …</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.navn}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Rolle</span>
                <select name="brolle" defaultValue="bruger">
                  <option value="bruger">Bruger</option>
                  <option value="admin">Systemadministrator</option>
                </select>
              </label>
            </div>
            <button className="btn" type="submit" disabled={travl}>
              Opret bruger
            </button>
          </form>
          <div className="note">
            <b>Ingen adgangskode udleveres her</b>
            Brugeren oprettes uden credentials. Hvordan man logger ind — og hvor adgangskoder eller
            SSO hører hjemme — besluttes i fase 3, og indtil da laves der ingen midlertidig
            login-mekanik at forveksle med den rigtige.
          </div>
        </div>

        <div className="card">
          <p className="eyebrow">Oversigt</p>
          <h2>Alle brugere</h2>
          <table>
            <tbody>
              <tr>
                <th>Navn</th>
                <th>Virksomhed</th>
                <th>Rolle</th>
                <th>Sidst set</th>
                <th />
              </tr>
              {brugere.map((b) => {
                const org = orgs.find((o) => o.id === b.org);
                return (
                  <tr key={b.id}>
                    <td>
                      <b>{b.navn}</b>
                      <br />
                      <span style={{ fontSize: 12.5, color: 'var(--ink-45)' }}>{b.email}</span>
                    </td>
                    <td>{org?.navn ?? 'Ukendt virksomhed'}</td>
                    <td>
                      <span className={`tag ${b.rolle}`}>{ROLE_LABEL[b.rolle]}</span>
                      {b.spaerret ? <span className="tag spaer">Spærret</span> : null}
                    </td>
                    <td>{dkDateTime(b.sidstSet)}</td>
                    <td>
                      <div className="inline">
                        {b.id === mig.id ? null : (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              void run(toggleUserBlockedAction, new FormData(event.currentTarget));
                            }}
                          >
                            <input type="hidden" name="bid" value={b.id} />
                            <button className="btn danger sm" type="submit" disabled={travl}>
                              {b.spaerret ? 'Åbn' : 'Spær'}
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
