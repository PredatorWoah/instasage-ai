import type { MonthlyReport, MonthKpis } from '@/services/reports';
import type { ReportStory } from '@/services/ai';

// Builds the month's report as a real, designed A4 PDF in the browser (no server round trip)

const INK: [number, number, number] = [10, 10, 15];
const MUTED: [number, number, number] = [110, 110, 128];
const PANEL: [number, number, number] = [244, 244, 248];
const VIOLET: [number, number, number] = [123, 97, 255];
const GREEN: [number, number, number] = [22, 163, 106];
const RED: [number, number, number] = [220, 60, 90];
const PRISM: [number, number, number][] = [[255, 107, 154], [255, 159, 67], [255, 224, 102], [74, 222, 158], [76, 201, 240], [123, 97, 255]];

// The built-in PDF fonts only cover Latin-1: swap smart punctuation, drop emoji and the like
const clean = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

const num = (n: number | null | undefined) => {
  if (n == null) return '-';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US');
};

const delta = (now: number | null, before: number | null) => {
  if (now == null || before == null || before === 0) return null;
  return ((now - before) / Math.abs(before)) * 100;
};

export async function downloadReportPdf(report: MonthlyReport, story: ReportStory | null) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = 0;

  const ensure = (space: number) => {
    if (y + space > H - 50) {
      doc.addPage();
      y = 50;
    }
  };
  const heading = (text: string) => {
    ensure(40);
    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...INK).text(text, M, y);
    y += 16;
  };
  const para = (text: string, size = 10, color = MUTED, width = W - 2 * M) => {
    doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(clean(text), width) as string[];
    ensure(lines.length * size * 1.35);
    doc.text(lines, M, y);
    y += lines.length * size * 1.35;
  };
  const tableEnd = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ----- Header band -----
  doc.setFillColor(...INK).rect(0, 0, W, 128, 'F');
  const stripe = W / PRISM.length;
  PRISM.forEach((c, i) => doc.setFillColor(...c).rect(i * stripe, 128, stripe + 1, 5, 'F'));
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...PRISM[0]).text('INSTASAGE', M, 42);
  doc.setFontSize(28).setTextColor(255, 255, 255).text(`${report.label} report`, M, 78);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(190, 190, 205);
  doc.text(clean(`${report.accounts.map((a) => `@${a.username}`).join(', ') || 'No accounts'}  ·  Times in ${report.timeZone}`), M, 102);
  y = 162;

  // ----- Headline -----
  const k = report.kpis;
  const p = report.previous.kpis;
  const headline = story?.headline ?? (k.posts
    ? `${k.posts} posts and ${num(k.views)} views in ${report.label}.`
    : `A quiet month: no posts in ${report.label}.`);
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...INK);
  const hl = doc.splitTextToSize(clean(headline), W - 2 * M) as string[];
  doc.text(hl, M, y);
  y += hl.length * 21 + 8;

  // ----- KPI tiles -----
  const tiles: { label: string; value: string; change: number | null; suffix?: string }[] = [
    { label: 'Followers gained', value: k.followersGained == null ? '-' : `${k.followersGained >= 0 ? '+' : ''}${num(k.followersGained)}`, change: delta(k.followersGained, p.followersGained) },
    { label: 'Views on posts', value: num(k.views), change: delta(k.views, p.views) },
    { label: 'Accounts reached', value: num(k.reach), change: delta(k.reach, p.reach) },
    { label: 'Avg engagement', value: `${k.engagement.toFixed(2)}%`, change: delta(k.engagement, p.engagement) },
    { label: 'Posts', value: num(k.posts), change: delta(k.posts, p.posts) },
    { label: 'Saves', value: num(k.saves), change: delta(k.saves, p.saves) },
    { label: 'Shares', value: num(k.shares), change: delta(k.shares, p.shares) },
    { label: 'Comments', value: num(k.comments), change: delta(k.comments, p.comments) },
  ];
  const cols = 4;
  const gap = 10;
  const tw = (W - 2 * M - gap * (cols - 1)) / cols;
  const th = 62;
  tiles.forEach((t, i) => {
    const x = M + (i % cols) * (tw + gap);
    const ty = y + Math.floor(i / cols) * (th + gap);
    doc.setFillColor(...PANEL).roundedRect(x, ty, tw, th, 10, 10, 'F');
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED).text(t.label.toUpperCase(), x + 10, ty + 17);
    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK).text(t.value, x + 10, ty + 40);
    if (t.change != null && Number.isFinite(t.change)) {
      doc.setFontSize(8.5).setTextColor(...(t.change >= 0 ? GREEN : RED));
      doc.text(`${t.change >= 0 ? '+' : ''}${t.change.toFixed(0)}% vs ${report.previous.label.split(' ')[0]}`, x + 10, ty + 54);
    }
  });
  y += 2 * th + gap + 26;

  // ----- AI review -----
  if (story) {
    heading('The month in review');
    para(story.summary, 10.5, INK);
    y += 6;
    const bullets = (title: string, items: string[], color: [number, number, number]) => {
      if (!items?.length) return;
      ensure(30);
      doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(...color).text(title, M, y);
      y += 14;
      for (const item of items) {
        doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK);
        const lines = doc.splitTextToSize(clean(item), W - 2 * M - 14) as string[];
        ensure(lines.length * 13.5);
        doc.setFillColor(...color).circle(M + 3, y - 3.5, 2, 'F');
        doc.text(lines, M + 12, y);
        y += lines.length * 13.5 + 2;
      }
      y += 6;
    };
    bullets('Wins', story.wins, GREEN);
    bullets('Watch outs', story.watchouts, RED);
    bullets('Next month', story.nextMonth, VIOLET);
  }

  // ----- Daily views chart -----
  const maxViews = Math.max(1, ...report.days.map((d) => d.views));
  if (report.days.some((d) => d.views > 0)) {
    ensure(150);
    heading('Views by day posted');
    const chartH = 90;
    const bw = (W - 2 * M) / report.days.length;
    doc.setDrawColor(225, 225, 232).setLineWidth(0.5).line(M, y + chartH, W - M, y + chartH);
    report.days.forEach((d, i) => {
      if (!d.views) return;
      const h = Math.max(2, (d.views / maxViews) * chartH);
      doc.setFillColor(...(d.views >= maxViews * 0.75 ? VIOLET : [196, 188, 255] as [number, number, number]));
      doc.roundedRect(M + i * bw + 1.5, y + chartH - h, Math.max(2, bw - 3), h, 1.5, 1.5, 'F');
    });
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
    [0, Math.floor(report.days.length / 2), report.days.length - 1].forEach((i) => {
      doc.text(String(Number(report.days[i].date.slice(8))), M + i * bw + bw / 2, y + chartH + 11, { align: 'center' });
    });
    doc.text(`peak ${num(maxViews)}`, W - M, y - 4, { align: 'right' });
    y += chartH + 30;
  }

  const tableStyle = {
    theme: 'plain' as const,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: INK },
    headStyles: { fillColor: INK, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: PANEL },
    margin: { left: M, right: M },
  };

  // ----- Top posts -----
  if (report.topPosts.length) {
    ensure(120);
    heading('Top posts');
    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [['Posted', 'Format', 'Caption', 'Views', 'Likes', 'Saves', 'Shares', 'Eng.']],
      body: report.topPosts.map((t) => [
        clean(t.postedLocal), t.type, clean(t.caption).slice(0, 70) || '-', num(t.views), num(t.likes), num(t.saves), num(t.shares), `${t.engagement.toFixed(1)}%`,
      ]),
      columnStyles: { 2: { cellWidth: 170 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    });
    y = tableEnd() + 26;
  }

  // ----- Breakdown -----
  const breakdown = (title: string, rows: MonthlyReport['byFormat']) => {
    if (!rows.length) return;
    ensure(100);
    heading(title);
    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [['', 'Posts', 'Avg views', 'Vs month avg', 'Avg eng.', 'Avg saves', 'Avg shares']],
      body: rows.map((r) => [r.label, r.posts, num(r.avgViews), `${r.viewsLift >= 0 ? '+' : ''}${r.viewsLift}%`, `${r.avgEngagement.toFixed(1)}%`, r.avgSaves, r.avgShares]),
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 } },
    });
    y = tableEnd() + 26;
  };
  breakdown('By format', report.byFormat);
  breakdown('By weekday', report.byWeekday);

  // ----- Month vs month -----
  ensure(140);
  heading(`${report.label} vs ${report.previous.label}`);
  const rows: [string, (x: MonthKpis) => number | null][] = [
    ['Posts', (x) => x.posts], ['Views on posts', (x) => x.views], ['Accounts reached', (x) => x.reach],
    ['Likes', (x) => x.likes], ['Comments', (x) => x.comments], ['Saves', (x) => x.saves], ['Shares', (x) => x.shares],
    ['Followers at month end', (x) => x.followersEnd],
  ];
  autoTable(doc, {
    ...tableStyle,
    startY: y,
    head: [['', report.label, report.previous.label, 'Change']],
    body: rows.map(([label, pick]) => {
      const change = delta(pick(k), pick(p));
      return [label, num(pick(k)), num(pick(p)), change == null ? '-' : `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`];
    }),
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });

  // ----- Footer on every page -----
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
    doc.text(`InstaSage · generated ${stamp}`, M, H - 24);
    doc.text(`${i} / ${pages}`, W - M, H - 24, { align: 'right' });
  }

  doc.save(`instasage-report-${report.month}.pdf`);
}
