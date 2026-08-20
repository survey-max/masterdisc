/**
 * Shown when the data layer could not deliver. It exists so a missing or
 * corrupt data file is stated plainly on the page — never rendered as an empty
 * list, a zero or a blank screen.
 *
 * Inline styles on purpose: this component is rendered by several routes, each
 * with its own stylesheet, and it must look the same everywhere.
 */
export function DataFejl({ titel, besked }: { titel: string; besked: string }) {
  return (
    <div
      style={{
        fontFamily: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif",
        background: '#EBE7E0',
        color: '#3D5270',
        minHeight: '100vh',
        padding: '56px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 620,
          margin: '0 auto',
          background: '#FBECEC',
          border: '1px solid #F0C4C4',
          borderRadius: 12,
          padding: '28px 30px',
        }}
      >
        <p
          style={{
            margin: '0 0 10px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.2em',
            textTransform: 'uppercase',
            color: '#8E1F1F',
          }}
        >
          Fejl i datalaget
        </p>
        <h1 style={{ margin: '0 0 12px', fontSize: 24, color: '#0F1E35', lineHeight: 1.2 }}>
          {titel}
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 15, color: '#8E1F1F', fontWeight: 500 }}>
          {besked}
        </p>
        <p style={{ margin: 0, fontSize: 13.5, color: '#6E7C93' }}>
          Datalaget læser i fase 1 JSON-filer fra <code>JOBMATCH_DATA_DIR</code> (standard:{' '}
          <code>./data/example</code>). Siden viser ikke tomme lister, når data mangler — den siger
          det.
        </p>
      </div>
    </div>
  );
}
