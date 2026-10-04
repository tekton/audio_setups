// Parts list for a layout (what to gather and which cables to buy), as plain data. No DOM; unit tested.

const sizeText = (d) => `${d.width_in || 19}" × ${d.height_u || 1}U`;

function whereText(d, racks) {
  const rack = d.rack_id ? racks.find((r) => r.id === d.rack_id) : null;
  if (!rack) return 'Not in a rack';
  const top = d.rack_u + (d.height_u || 1) - 1;
  return `${rack.label || 'Rack'}, ${top === d.rack_u ? `U${d.rack_u}` : `U${d.rack_u}–U${top}`}`;
}

// portTypeName maps a port type slug to a readable name (defaults to the slug).
export function partsList(layout, portTypeName = (t) => t) {
  const devices = layout.devices || [];
  const racks = layout.racks || [];
  const label = (id) => {
    const d = devices.find((x) => x.id === id);
    return d ? (d.label || d.type || d.id) : '(missing device)';
  };
  const deviceRows = devices.map((d) => ({ name: d.label || d.type || d.id, size: sizeText(d), where: whereText(d, racks) }));
  const cableRows = (layout.connections || []).map((c) => {
    const type = c.from_port_type || c.to_port_type || 'audio';
    return {
      from: c.from_port ? `${label(c.from_device_id)} · ${c.from_port}` : label(c.from_device_id),
      to: c.to_port ? `${label(c.to_device_id)} · ${c.to_port}` : label(c.to_device_id),
      type: portTypeName(type),
    };
  });
  const counts = new Map();
  cableRows.forEach((c) => counts.set(c.type, (counts.get(c.type) || 0) + 1));
  const cableTotals = [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  return { devices: deviceRows, cables: cableRows, cableTotals, racks: racks.map((r) => ({ name: r.label || 'Rack', size: `${r.width_in}" × ${r.height_u}U` })) };
}

// CSV text of the same data, for pasting into a spreadsheet.
export function partsCsv(parts) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = ['Devices', 'Name,Size,Location', ...parts.devices.map((d) => [d.name, d.size, d.where].map(esc).join(',')),
    '', 'Cables', 'From,To,Type', ...parts.cables.map((c) => [c.from, c.to, c.type].map(esc).join(','))];
  return lines.join('\n');
}
