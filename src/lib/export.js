import { slotMech, sortSlots } from './mechs.js';
import { lineupStats } from './rules.js';

const pad = (s, n) => {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n - 1)}…` : str.padEnd(n);
};

// Discord message for one or more drops. Lineups go in a code block so the
// columns line up in Discord's monospace font.
export function discordText({ event, drops, ctx }) {
  const { catalog, pilotsById, mapsById, buildsById } = ctx;
  const out = [`♠ **ACES WILD · ${event.name}**${event.date ? ` · ${event.date}` : ''}`];
  drops.forEach((drop, i) => {
    const slots = sortSlots(catalog, drop.slots || []);
    const st = lineupStats(catalog, slots);
    const map = mapsById[drop.map_id]?.name || 'Map TBD';
    out.push('');
    out.push(`**Drop ${i + 1}: ${map}** · ${st.filled}/${slots.length} pilots · ${st.tons} t`);
    out.push('```');
    let lastLance = null;
    slots.forEach((s, idx) => {
      if (s.lance && s.lance !== lastLance) {
        out.push(`-- ${s.lance} --`);
        lastLance = s.lance;
      }
      const m = slotMech(catalog, s);
      const pilot = pilotsById[s.pilotId]?.name || '(open)';
      const mech = m ? m.code || m.chassis : '-';
      const tons = m ? `${m.tons}t ${m.wclass[0]}` : '';
      const build = buildsById[s.buildId]?.name || '';
      out.push(`${String(idx + 1).padStart(2)} ${pad(pilot, 16)} ${pad(mech, 14)} ${pad(tons, 7)} ${build}`.trimEnd());
    });
    out.push('```');
    if (drop.notes) out.push(`> ${drop.notes}`);
  });
  return out.join('\n');
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function lineupCsvRows({ event, drops, ctx }) {
  const { catalog, pilotsById, mapsById, buildsById } = ctx;
  const rows = [['Event', 'Date', 'Drop', 'Map', 'Slot', 'Lance', 'Pilot', 'Chassis', 'Variant', 'Tons', 'Class', 'Build', 'Build link', 'Result']];
  drops.forEach((drop, i) => {
    sortSlots(catalog, drop.slots || []).forEach((s, idx) => {
      const m = slotMech(catalog, s);
      const b = buildsById[s.buildId];
      rows.push([
        event.name, event.date, i + 1, mapsById[drop.map_id]?.name || '', idx + 1, s.lance || '',
        pilotsById[s.pilotId]?.name || '', m?.chassis || '', m?.code || '', m?.tons || '', m?.wclass || '',
        b?.name || '', b?.link || '', drop.result || '',
      ]);
    });
  });
  return rows;
}

export function downloadFile(filename, content, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
