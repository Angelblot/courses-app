import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const DRIVE_COLORS = [
  '#2D6A4F', // accent
  '#E07A5F', // coral
  '#D97706', // warning
  '#40916C', // success
  '#6366F1',
  '#C026D3',
];

const DRIVE_LABELS = { carrefour: 'Carrefour' };
function driveLabel(name) {
  if (!name) return '';
  if (DRIVE_LABELS[name]) return DRIVE_LABELS[name];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function fmtEuro(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(2)} €`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function fmtDateLong(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E8E6',
        borderRadius: 10,
        padding: '8px 10px',
        fontSize: 12,
        color: '#1A1A1A',
        boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{fmtDateLong(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {driveLabel(p.dataKey)} : {fmtEuro(p.value)}
        </div>
      ))}
    </div>
  );
}

export function PriceHistoryChart({ points }) {
  const [selected, setSelected] = useState(null);

  const { data, drives, colorMap } = useMemo(() => {
    const drivesSet = new Set();
    const byDate = new Map();
    (points || []).forEach((p) => {
      if (!p.purchase_date || p.unit_price_ttc == null) return;
      const drive = p.drive_name || 'inconnu';
      drivesSet.add(drive);
      const key = p.purchase_date;
      if (!byDate.has(key)) byDate.set(key, { date: key, _raw: {} });
      const slot = byDate.get(key);
      // moyenne si plusieurs lignes meme jour meme drive
      const cur = slot[drive];
      const price = Number(p.unit_price_ttc);
      slot[drive] = cur == null ? price : (cur + price) / 2;
      slot._raw[drive] = slot._raw[drive] || [];
      slot._raw[drive].push(p);
    });
    const drivesArr = Array.from(drivesSet).sort();
    const arr = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    const map = {};
    drivesArr.forEach((d, i) => {
      map[d] = DRIVE_COLORS[i % DRIVE_COLORS.length];
    });
    return { data: arr, drives: drivesArr, colorMap: map };
  }, [points]);

  if (!data.length) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: '#F7F4EC',
          color: '#6B6B6B',
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        Pas encore d'historique de prix pour ce produit.
      </div>
    );
  }

  function handleDotClick(drive) {
    return (dot) => {
      if (!dot || !dot.payload) return;
      const raws = dot.payload._raw?.[drive] || [];
      if (raws.length) setSelected({ drive, points: raws, date: dot.payload.date });
    };
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {drives.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {drives.map((d) => (
            <span
              key={d}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 999,
                background: '#F3F1EC',
                color: colorMap[d],
                fontWeight: 600,
                border: `1px solid ${colorMap[d]}22`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: colorMap[d],
                  display: 'inline-block',
                }}
              />
              {driveLabel(d)}
            </span>
          ))}
        </div>
      )}

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 12, right: 12, left: -12, bottom: 4 }}
          >
            <CartesianGrid stroke="#E8E8E6" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#6B6B6B' }}
              tickFormatter={fmtDate}
              minTickGap={24}
              axisLine={{ stroke: '#D8D6D2' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6B6B6B' }}
              tickFormatter={(v) => `${Number(v).toFixed(2)}`}
              axisLine={{ stroke: '#D8D6D2' }}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} />
            {drives.map((drive) => (
              <Line
                key={drive}
                type="monotone"
                dataKey={drive}
                stroke={colorMap[drive]}
                strokeWidth={2.2}
                connectNulls
                dot={{
                  r: 5,
                  stroke: colorMap[drive],
                  fill: '#FFFFFF',
                  strokeWidth: 2,
                  onClick: handleDotClick(drive),
                  style: { cursor: 'pointer' },
                }}
                activeDot={{
                  r: 7,
                  stroke: colorMap[drive],
                  fill: colorMap[drive],
                  strokeWidth: 2,
                  onClick: handleDotClick(drive),
                  style: { cursor: 'pointer' },
                }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {selected && (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #E8E8E6',
            background: '#FFFFFF',
            padding: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {driveLabel(selected.drive)} — {fmtDateLong(selected.date)}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#6B6B6B',
                fontSize: 18,
                lineHeight: 1,
                padding: 4,
              }}
              aria-label="Fermer le détail"
            >
              ×
            </button>
          </div>
          <div className="stack" style={{ gap: 6, fontSize: 13 }}>
            {selected.points.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 4,
                  padding: 8,
                  borderRadius: 8,
                  background: '#F7F4EC',
                }}
              >
                <div>
                  <span style={{ color: '#6B6B6B' }}>Qté commandée : </span>
                  <strong>{p.quantity_ordered}</strong>
                </div>
                <div>
                  <span style={{ color: '#6B6B6B' }}>Livrée : </span>
                  <strong>{p.quantity_delivered}</strong>
                </div>
                <div>
                  <span style={{ color: '#6B6B6B' }}>PU HT : </span>
                  <strong>{fmtEuro(p.unit_price_ht)}</strong>
                </div>
                <div>
                  <span style={{ color: '#6B6B6B' }}>PU TTC : </span>
                  <strong>{fmtEuro(p.unit_price_ttc)}</strong>
                </div>
                <div>
                  <span style={{ color: '#6B6B6B' }}>Remise : </span>
                  <strong>{fmtEuro(p.discount_ttc)}</strong>
                </div>
                <div>
                  <span style={{ color: '#6B6B6B' }}>Total TTC : </span>
                  <strong>{fmtEuro(p.total_ttc)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PriceHistoryChart;
