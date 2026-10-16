// Drop templates: a planned drop (map, team size, and each slot's chassis, variant and build) saved per ruleset,
// to import into any event with that ruleset. Templates never hold pilots.

const blank = () => ({ pilotId: null, chassis: null, variant: null, buildId: null, grim: null, lance: '' });

// Copy of a lineup's slots without pilots (and without stray auto-assign flags).
export function templateSlots(slots = []) {
  return slots.map(({ chassis = null, variant = null, buildId = null, grim = null, lance = '' }) => ({
    pilotId: null, chassis, variant, buildId, grim, lance,
  }));
}

// A template's slots resized to the event's team size: extra slots are dropped from the end, missing ones added blank.
export function slotsForSize(slots = [], size) {
  const base = templateSlots(slots).slice(0, size);
  while (base.length < size) base.push(blank());
  return base;
}

// Templates an event can import: same ruleset (or both without one).
export function templatesForEvent(templates, event) {
  return templates.filter((t) => (t.ruleset_id || null) === (event.ruleset_id || null));
}

// New drop row built from a template, ready for Auto-assign pilots.
export function dropFromTemplate(template, event, position, mapIds) {
  return {
    event_id: event.id,
    map_id: template.map_id && (!mapIds || mapIds.has(template.map_id)) ? template.map_id : null,
    position,
    slots: slotsForSize(template.slots, event.team_size),
    result: null,
    notes: template.notes || '',
  };
}

// "2× Timber Wolf, Atlas, 1 open"
export function templateSummary(t) {
  const counts = new Map();
  for (const s of t.slots || []) if (s.chassis) counts.set(s.chassis, (counts.get(s.chassis) || 0) + 1);
  const open = (t.slots || []).filter((s) => !s.chassis).length;
  const parts = [...counts].map(([c, n]) => (n > 1 ? `${n}× ${c}` : c));
  if (open) parts.push(`${open} open`);
  return parts.join(', ') || '–';
}
