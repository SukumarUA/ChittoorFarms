/**
 * Shared print utilities for Chittoor Farms Admin
 * All print outputs use Blob URLs (no document.write) and auto-trigger window.print()
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
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;color:#1f2937;background:#fff;font-size:13px}
  .page{max-width:800px;margin:0 auto;padding:28px}
  h1{font-size:1.35rem;color:#17633f;margin-bottom:2px}
  h2{font-size:1.05rem;color:#17633f;margin:18px 0 8px}
  h3{font-size:0.9rem;margin:12px 0 6px;color:#374151}
  p{line-height:1.5}
  table{width:100%;border-collapse:collapse;margin:10px 0}
  th,td{border:1px solid #d1d5db;padding:7px 10px;text-align:left;vertical-align:top}
  th{background:#17633f;color:#fff;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:.04em}
  tr:nth-child(even) td{background:#f9fafb}
  .logo-row{display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:2.5px solid #17633f;margin-bottom:18px}
  .logo-row img{width:52px;height:52px;border-radius:50%;object-fit:cover}
  .logo-row .brand h1{font-size:1.2rem;margin:0}
  .logo-row .brand p{font-size:0.75rem;color:#6b7280;margin:1px 0 0}
  .logo-row .doc-title{margin-left:auto;text-align:right}
  .logo-row .doc-title .title{font-size:1.1rem;font-weight:800;color:#17633f;text-transform:uppercase;letter-spacing:.06em}
  .logo-row .doc-title .ref{font-size:0.8rem;color:#6b7280;margin-top:2px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
  .info-box{padding:10px 12px;border:1px solid #e5e7eb;border-radius:6px}
  .info-box .lbl{font-size:0.7rem;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
  .info-box .val{font-weight:600;font-size:0.9rem;color:#111827}
  .info-box .sub{font-size:0.8rem;color:#4b5563;margin-top:2px}
  .total-row{background:#f0fdf4!important;font-weight:700;color:#15803d}
  .sig-block{display:flex;gap:40px;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb}
  .sig-line{width:180px}
  .sig-line .line{border-top:1.5px solid #374151;margin-bottom:4px}
  .sig-line .label{font-size:0.72rem;color:#6b7280}
  .footer{margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:0.72rem;color:#9ca3af;text-align:center}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:700;text-transform:capitalize}
  .badge-pending,.badge-pending{background:#fef3c7;color:#92400e}
  .badge-confirmed,.badge-fulfilled{background:#dcfce7;color:#166534}
  .badge-cancelled,.badge-failed{background:#fee2e2;color:#991b1b}
  /* Referral cards */
  .cards-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
  .ref-card{border:2px solid #17633f;border-radius:10px;padding:18px 20px;page-break-inside:avoid}
  .ref-card .card-logo{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  .ref-card .card-logo img{width:32px;height:32px;border-radius:50%;object-fit:cover}
  .ref-card .card-logo span{font-weight:700;color:#17633f;font-size:0.9rem}
  .ref-card .code{font-size:1.5rem;font-weight:800;color:#17633f;letter-spacing:.1em;margin:8px 0}
  .ref-card .discount{font-size:1.1rem;font-weight:700;color:#92400e;margin-bottom:6px}
  .ref-card .url{font-size:0.78rem;color:#6b7280}
  .ref-card .desc{font-size:0.78rem;color:#374151;margin-top:6px;font-style:italic}
  @page{margin:12mm}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

export const autoprint = (): string =>
  `<script>window.onload=()=>{window.print();window.onafterprint=()=>{try{URL.revokeObjectURL(window.location.href);}catch(e){}}};<\/script>`;

export const wrapHtml = (title: string, body: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body><div class="page">${body}</div>${autoprint()}</body></html>`;

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
