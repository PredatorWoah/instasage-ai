// "2026-11-20" + "19:30" as wall-clock time in a timezone → the real moment, DST included
function offsetMs(at: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) - at;
}

export function zonedDate(date: string, time: string, timeZone: string): Date | null {
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!d || !t) return null;
  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  if (Number.isNaN(wall) || Number(t[1]) > 23 || Number(t[2]) > 59) return null;
  let at = wall - offsetMs(wall, timeZone);
  at = wall - offsetMs(at, timeZone); // once more, for the hour around a DST change
  return new Date(at);
}

// Today's date in a timezone, as YYYY-MM-DD
export const zonedToday = (timeZone: string, now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
