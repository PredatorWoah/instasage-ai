// Date helpers for the content calendar. Everything works in the viewer's local time.

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function thisMonth() {
  return startOfMonth(new Date());
}

export function todayKey() {
  return dayKey(new Date());
}

export function nowMs() {
  return Date.now();
}

// Six weeks starting on the Monday on or before the 1st, so every month has the same shape
export function monthGrid(month: Date) {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + i));
}

// "Tuesday", "tue", "Tue 7 PM" → 1 (Monday = 0)
export function weekdayIndex(day: string) {
  const i = WEEKDAYS.findIndex((w) => day.trim().toLowerCase().startsWith(w.toLowerCase()));
  return i;
}

// "7:30 PM", "19:00", "7pm" → [19, 30]; anything else → null
export function parseTime(time: string): [number, number] | null {
  const m = time.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return h < 24 && min < 60 ? [h, min] : null;
}

export function atTime(day: Date, hm: [number, number] | null) {
  const [h, m] = hm ?? [18, 0];
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);

// A calendar file any calendar app can import: one 30 minute event per planned post
export function buildIcs(events: { id: string; title: string; start: Date; notes?: string; url?: string }[]) {
  const stamp = icsDate(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//InstaSage//Content calendar//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:InstaSage posts'];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@instasage`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(e.start)}`,
      `DTEND:${icsDate(new Date(e.start.getTime() + 30 * 60_000))}`,
      `SUMMARY:${icsText(`Post: ${e.title}`)}`,
      ...(e.notes ? [`DESCRIPTION:${icsText(e.notes.slice(0, 1500))}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(e.title)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  // Lines over 75 octets must be folded
  return lines.map((l) => (l.length > 74 ? l.match(/.{1,73}/g)!.join('\r\n ') : l)).join('\r\n');
}
