/**
 * Shared print utilities for Chittoor Farms Admin
 * All print outputs use Blob URLs (no document.write) and auto-trigger window.print()
 * Layout: A4 portrait, 10 mm top/bottom margin, 12 mm left/right margin
 * Every page carries a centred, semi-transparent Chittoor Farms logo watermark
 */

export const esc = (v: string | number | null | undefined): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const logoUrl = (): string => `${window.location.origin}/CTRFLOGO.jpeg`;

export const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  /* ── Reset ──────────────────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }

  /* ── Base ───────────────────────────────────────────────── */
  body {
    font-family: 'Inter', Arial, sans-serif;
    color: #1f2937;
    background: #fff;
    font-size: 11.5px;
    line-height: 1.4;
  }

  /* ── A4 page sizing & margins ───────────────────────────── */
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
  }

  /* .page fills the entire printable area — no extra padding */
  .page {
    width: 100%;
    padding: 0;
  }

  /* ── Watermark (fixed → repeats on every printed page) ──── */
  .wm {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 240px;
    height: 240px;
    opacity: 0.06;
    pointer-events: none;
    z-index: 0;
  }
  .wm img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* All direct content sits above the watermark */
  .page > * { position: relative; z-index: 1; }

  /* ── Typography ─────────────────────────────────────────── */
  h1 { font-size: 1.15rem; color: #17633f; margin-bottom: 2px; }
  h2 { font-size: 0.98rem; color: #17633f; margin: 10px 0 5px; }
  h3 { font-size: 0.86rem; margin: 8px 0 4px; color: #374151; }
  p  { line-height: 1.5; margin-bottom: 5px; }

  /* ── Tables ─────────────────────────────────────────────── */
  table { width: 100%; border-collapse: collapse; margin: 5px 0; }
  th, td {
    border: 1px solid #d1d5db;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
    line-height: 1.3;
  }
  th {
    background: #17633f;
    color: #fff;
    font-weight: 600;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  tr:nth-child(even) td { background: #f9fafb; }
  .total-row { background: #f0fdf4 !important; font-weight: 700; color: #15803d; }

  /* ── Logo header row ────────────────────────────────────── */
  .logo-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 9px;
    border-bottom: 2px solid #17633f;
    margin-bottom: 12px;
  }
  .logo-row img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
  .logo-row .brand h1 { font-size: 1.05rem; margin: 0; }
  .logo-row .brand p  { font-size: 0.7rem; color: #6b7280; margin: 1px 0 0; }
  .logo-row .doc-title { margin-left: auto; text-align: right; }
  .logo-row .doc-title .title {
    font-size: 0.95rem;
    font-weight: 800;
    color: #17633f;
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .logo-row .doc-title .ref { font-size: 0.72rem; color: #6b7280; margin-top: 2px; }

  /* ── Info boxes ─────────────────────────────────────────── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 9px 0; }
  .info-box  { padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 5px; }
  .info-box .lbl {
    font-size: 0.66rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: .06em;
    margin-bottom: 2px;
  }
  .info-box .val { font-weight: 600; font-size: 0.86rem; color: #111827; }
  .info-box .sub { font-size: 0.74rem; color: #4b5563; margin-top: 1px; }

  /* ── Signature block ────────────────────────────────────── */
  .sig-block { display: flex; gap: 36px; margin-top: 22px; padding-top: 10px; border-top: 1px solid #e5e7eb; }
  .sig-line { width: 160px; }
  .sig-line .line  { border-top: 1.5px solid #374151; margin-bottom: 4px; }
  .sig-line .label { font-size: 0.68rem; color: #6b7280; }

  /* ── Footer ─────────────────────────────────────────────── */
  .footer {
    margin-top: 14px;
    padding-top: 7px;
    border-top: 1px solid #e5e7eb;
    font-size: 0.68rem;
    color: #9ca3af;
    text-align: center;
  }

  /* ── Badges ─────────────────────────────────────────────── */
  .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 0.68rem; font-weight: 700; text-transform: capitalize; }
  .badge-pending   { background: #fef3c7; color: #92400e; }
  .badge-confirmed, .badge-fulfilled { background: #dcfce7; color: #166534; }
  .badge-cancelled, .badge-failed    { background: #fee2e2; color: #991b1b; }

  /* ── Referral cards ─────────────────────────────────────── */
  .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
  .ref-card {
    border: 2px solid #17633f;
    border-radius: 8px;
    padding: 14px 16px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .ref-card .card-logo { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
  .ref-card .card-logo img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
  .ref-card .card-logo span { font-weight: 700; color: #17633f; font-size: 0.86rem; }
  .ref-card .code     { font-size: 1.35rem; font-weight: 800; color: #17633f; letter-spacing: .1em; margin: 6px 0; }
  .ref-card .discount { font-size: 0.95rem; font-weight: 700; color: #92400e; margin-bottom: 5px; }
  .ref-card .url      { font-size: 0.72rem; color: #6b7280; }
  .ref-card .desc     { font-size: 0.72rem; color: #374151; margin-top: 5px; font-style: italic; }

  /* ── Print colour fidelity ──────────────────────────────── */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export const autoprint = (): string =>
  `<script>window.onload=()=>{window.print();window.onafterprint=()=>{try{URL.revokeObjectURL(window.location.href);}catch(e){}}};<\/script>`;

/**
 * Wraps body HTML in a full A4-ready document with watermark.
 * The .wm div uses position:fixed so it appears centered on every printed page.
 */
export const wrapHtml = (title: string, body: string): string =>
  `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="wm"><img src="${logoUrl()}" alt="" /></div>
  <div class="page">${body}</div>
  ${autoprint()}
</body>
</html>`;

export const openPrint = (html: string): void => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (win) {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } else {
    URL.revokeObjectURL(url);
    alert('Please allow pop-ups to print.');
  }
};

export const logoRow = (docTitle: string, ref?: string): string => `
  <div class="logo-row">
    <img src="${logoUrl()}" alt="Chittoor Farms" />
    <div class="brand">
      <h1>Chittoor Farms</h1>
      <p>Fresh from Chittoor's Orchards · chittoorfarms.in</p>
    </div>
    <div class="doc-title">
      <div class="title">${esc(docTitle)}</div>
      ${ref ? `<div class="ref">${esc(ref)}</div>` : ''}
    </div>
  </div>`;

export const footer = (): string =>
  `<div class="footer">Chittoor Farms · chittoorfarms.in · Printed ${new Date().toLocaleString('en-IN')}</div>`;
