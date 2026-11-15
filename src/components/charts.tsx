/**
 * Графики на чистом SVG: кольцо прогресса, полоса, столбцы, линия, тепловая карта.
 * Одна серия на график → однотонная изумрудная шкала; у каждого графика есть подсказки
 * при наведении/фокусе и скрытая таблица для экранных дикторов.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';

export function ProgressRing({
  value,
  size = 168,
  stroke = 12,
  children,
  label,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--brand))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          style={{ transition: 'stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, className = '', label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-surface-2 ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

function Tooltip({ x, y, children, width }: { x: number; y: number; children: ReactNode; width: number }) {
  const left = Math.min(Math.max(x, 60), width - 60);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
      style={{ left, top: y - 8 }}
    >
      {children}
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export interface BarDatum {
  key: string;
  label: string; // подпись оси
  tip: string; // заголовок подсказки
  value: number;
}

export function BarChart({ data, height = 180, format, caption }: { data: BarDatum[]; height?: number; format: (n: number) => string; caption: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const pad = { t: 10, r: 4, b: 22, l: 32 };
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const slot = innerW / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(28, slot - 2)); // ≥2px зазор между столбцами
  const labelEvery = Math.ceil(data.length / 8);
  const ref = useRef<HTMLDivElement>(null);
  const scale = ref.current ? ref.current.clientWidth / W : 1;

  return (
    <figure className="relative" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" aria-hidden="true">
        {[0, 0.5, 1].map((f) => {
          const y = pad.t + innerH * (1 - f);
          return (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="rgb(var(--line))" strokeDasharray={f === 0 ? '' : '2 4'} />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize="11" fill="rgb(var(--muted))">
                {format(max * f)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = pad.l + i * slot + (slot - bw) / 2;
          const y = pad.t + innerH - h;
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={d.key}>
              {h > 0 && (
                <path
                  d={`M${x},${pad.t + innerH} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${pad.t + innerH} Z`}
                  fill="rgb(var(--brand))"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {/* увеличенная зона наведения */}
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              {i % labelEvery === 0 && (
                <text x={x + bw / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <Tooltip
          width={ref.current?.clientWidth ?? W}
          x={(pad.l + hover * slot + slot / 2) * scale}
          y={(pad.t + innerH - (data[hover].value / max) * innerH) * scale}
        >
          <span className="text-muted">{data[hover].tip}</span>{' '}
          <span className="num font-semibold">{format(data[hover].value)}</span>
        </Tooltip>
      )}
      <DataTable caption={caption} rows={data.map((d) => [d.tip, format(d.value)])} />
    </figure>
  );
}

export function LineChart({
  data,
  height = 180,
  format,
  formatX,
  caption,
}: {
  data: { x: string; y: number }[];
  height?: number;
  format: (n: number) => string;
  formatX: (x: string) => string;
  caption: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const W = 640;
  const pad = { t: 12, r: 8, b: 22, l: 44 };
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.map((d) => d.y)));
  const pts = useMemo(
    () =>
      data.map((d, i) => [pad.l + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW), pad.t + innerH * (1 - d.y / max)] as const),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, max],
  );
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${pad.t + innerH} L${pts[0][0]},${pad.t + innerH} Z` : '';
  const scale = ref.current ? ref.current.clientWidth / W : 1;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((x - pad.l) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const ticks = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];

  return (
    <figure className="relative" ref={ref}>
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)} aria-hidden="true">
        <defs>
          <linearGradient id="qada-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--brand))" stopOpacity="0.22" />
            <stop offset="1" stopColor="rgb(var(--brand))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => {
          const y = pad.t + innerH * (1 - f);
          return (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="rgb(var(--line))" strokeDasharray={f === 0 ? '' : '2 4'} />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize="11" fill="rgb(var(--muted))">
                {format(max * f)}
              </text>
            </g>
          );
        })}
        {ticks.map((i) => (
          <text key={i} x={pts[i]?.[0]} y={height - 6} fontSize="11" fill="rgb(var(--muted))" textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
            {data[i] && formatX(data[i].x)}
          </text>
        ))}
        <path d={area} fill="url(#qada-area)" />
        <path d={line} fill="none" stroke="rgb(var(--brand))" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && pts[hover] && (
          <>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={pad.t} y2={pad.t + innerH} stroke="rgb(var(--muted))" strokeDasharray="3 3" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r={5} fill="rgb(var(--brand))" stroke="rgb(var(--surface))" strokeWidth={2} />
          </>
        )}
      </svg>
      {hover !== null && data[hover] && (
        <Tooltip width={ref.current?.clientWidth ?? W} x={pts[hover][0] * scale} y={pts[hover][1] * scale}>
          <span className="text-muted">{formatX(data[hover].x)}</span> <span className="num font-semibold">{format(data[hover].y)}</span>
        </Tooltip>
      )}
      <DataTable caption={caption} rows={data.map((d) => [formatX(d.x), format(d.y)])} />
    </figure>
  );
}

/** Календарь активности: недели — столбцы, дни — строки, насыщенность = количество. */
export function Heatmap({
  days,
  format,
  formatDate,
  caption,
  weekdayLabels,
}: {
  days: { date: string; value: number }[]; // по порядку, начиная с понедельника
  format: (n: number) => string;
  formatDate: (d: string) => string;
  caption: string;
  weekdayLabels: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.value));
  const weeks = Math.ceil(days.length / 7);
  const cell = 13;
  const gap = 3;
  const left = 22;
  const W = left + weeks * (cell + gap);
  const H = 7 * (cell + gap);
  const level = (v: number) => (v === 0 ? 0 : v <= max * 0.25 ? 0.3 : v <= max * 0.5 ? 0.5 : v <= max * 0.75 ? 0.75 : 1);

  return (
    <figure className="relative">
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block" aria-hidden="true" onMouseLeave={() => setHover(null)}>
          {[0, 2, 4].map((r) => (
            <text key={r} x={0} y={r * (cell + gap) + cell - 2} fontSize="10" fill="rgb(var(--muted))">
              {weekdayLabels[r]}
            </text>
          ))}
          {days.map((d, i) => {
            const w = Math.floor(i / 7);
            const r = i % 7;
            const lv = level(d.value);
            return (
              <rect
                key={d.date}
                x={left + w * (cell + gap)}
                y={r * (cell + gap)}
                width={cell}
                height={cell}
                rx={3}
                fill={lv === 0 ? 'rgb(var(--surface-2))' : `rgb(var(--brand) / ${lv})`}
                stroke={hover === i ? 'rgb(var(--ink))' : 'none'}
                onMouseEnter={() => setHover(i)}
              />
            );
          })}
        </svg>
      </div>
      <p className="mt-2 h-4 text-xs text-muted" aria-hidden="true">
        {hover !== null && days[hover] ? `${formatDate(days[hover].date)} — ${format(days[hover].value)}` : ''}
      </p>
      <DataTable caption={caption} rows={days.filter((d) => d.value > 0).map((d) => [formatDate(d.date), format(d.value)])} />
    </figure>
  );
}

function DataTable({ caption, rows }: { caption: string; rows: string[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
