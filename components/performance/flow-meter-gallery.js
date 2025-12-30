const { createElement: h, useMemo } = React;

const COLORS = {
  green: '#10b981',
  amber: '#f59e0b',
  red: '#f43f5e',
};

export function getStateFromScore(scorePct = 0) {
  const s = Math.max(0, Math.min(100, Number(scorePct) || 0));
  if (s >= 90) return 'drifting';
  if (s >= 70) return 'watchlist';
  return 'in-flow';
}

function SpeedometerArc({ scorePct, state, driverLabel, dayOffAnswer }) {
  const gaugeWidth = 220;
  const gaugeHeight = 140;
  const cx = 110;
  const cy = 120;
  const radius = 85;
  const strokeWidth = 14;

  const clamped = Math.max(0, Math.min(100, scorePct));
  const angleDeg = 180 - (clamped / 100) * 180;
  const rad = (Math.PI / 180) * angleDeg;
  const rInner = radius - strokeWidth / 2 - 10;
  const rOuter = radius + strokeWidth / 2 + 10;
  const x1 = cx + Math.cos(rad) * rInner;
  const y1 = cy - Math.sin(rad) * rInner;
  const x2 = cx + Math.cos(rad) * rOuter;
  const y2 = cy - Math.sin(rad) * rOuter;

  const arcPath = (startDeg, endDeg) => {
    const toXY = (deg) => {
      const r = (Math.PI / 180) * deg;
      return { x: cx + radius * Math.cos(r), y: cy - radius * Math.sin(r) };
    };
    const sPt = toXY(startDeg);
    const ePt = toXY(endDeg);
    return `M ${sPt.x} ${sPt.y} A ${radius} ${radius} 0 0 ${endDeg > startDeg ? 0 : 1} ${ePt.x} ${ePt.y}`;
  };

  return h('div', { className: 'space-y-2' }, [
    h('svg', { viewBox: `0 0 ${gaugeWidth} ${gaugeHeight}` }, [
      h('path', { d: arcPath(180, 54), stroke: COLORS.green, strokeWidth, fill: 'none' }),
      h('path', { d: arcPath(54, 18), stroke: COLORS.amber, strokeWidth, fill: 'none' }),
      h('path', { d: arcPath(18, 0), stroke: COLORS.red, strokeWidth, fill: 'none' }),
      h('line', { x1, y1, x2, y2, stroke: 'rgba(0,0,0,0.35)', strokeWidth: 8, strokeLinecap: 'round', pointerEvents: 'none' }),
      h('line', { x1, y1, x2, y2, stroke: 'rgba(255,255,255,0.95)', strokeWidth: 6, strokeLinecap: 'round', pointerEvents: 'none' }),
      h('circle', { cx, cy, r: 4, fill: 'rgba(255,255,255,0.95)', pointerEvents: 'none' }),
    ]),
    h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, `Driven by: ${driverLabel} • Can I take this day off? ${dayOffAnswer}`),
  ]);
}

function FlowBand({ scorePct, driverLabel, dayOffAnswer }) {
  const clamped = Math.max(0, Math.min(100, scorePct));
  const markerPos = `${clamped}%`;
  return h('div', { className: 'space-y-2' }, [
    h('div', { className: 'relative h-6 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10' }, [
      h('div', { className: 'absolute inset-0 flex' }, [
        h('div', { className: 'h-full', style: { width: '70%', background: `${COLORS.green}33` } }),
        h('div', { className: 'h-full', style: { width: '20%', background: `${COLORS.amber}33` } }),
        h('div', { className: 'h-full flex-1', style: { background: `${COLORS.red}33` } }),
      ]),
      h('div', { className: 'absolute inset-0', style: { background: 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))' } }),
      h('div', {
        className: 'absolute top-0 bottom-0 w-[2px] bg-slate-800 dark:bg-white rounded-full transition-all',
        style: { left: markerPos },
      }),
    ]),
    h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, `Driven by: ${driverLabel} • Can I take this day off? ${dayOffAnswer}`),
  ]);
}

function PulseRing({ scorePct, state, driverLabel, dayOffAnswer }) {
  const size = 160;
  const radius = 65;
  const strokeWidth = 12;
  const clamped = Math.max(0, Math.min(100, scorePct));
  const angle = (Math.PI * clamped) / 100; // 0..π
  const dotX = size / 2 + radius * Math.cos(Math.PI - angle);
  const dotY = size / 2 - radius * Math.sin(Math.PI - angle);
  const color = state === 'drifting' ? COLORS.red : state === 'watchlist' ? COLORS.amber : COLORS.green;
  const breathe = state === 'drifting' ? 'animate-none' : state === 'watchlist' ? 'animate-pulse-slow' : 'animate-pulse';
  return h('div', { className: `space-y-2 flex flex-col items-center ${breathe}` }, [
    h('svg', { width: size, height: size }, [
      h('circle', { cx: size / 2, cy: size / 2, r: radius, stroke: `${color}55`, strokeWidth, fill: 'none' }),
      h('circle', { cx: size / 2, cy: size / 2, r: radius - 8, stroke: `${color}99`, strokeWidth: 6, fill: 'none', strokeLinecap: 'round' }),
      h('circle', { cx: dotX, cy: dotY, r: 6, fill: color }),
    ]),
    h('div', { className: 'text-xs text-slate-600 dark:text-slate-300 text-center' }, `Driven by: ${driverLabel}`),
    h('div', { className: 'text-xs text-slate-500 dark:text-slate-400 text-center' }, `Can I take this day off? ${dayOffAnswer}`),
  ]);
}

function RiverStream({ scorePct, driverLabel, dayOffAnswer }) {
  const clamped = Math.max(0, Math.min(100, scorePct));
  const markerPos = `${clamped}%`;
  const amp = Math.min(12, 4 + (clamped / 100) * 8);
  return h('div', { className: 'space-y-2' }, [
    h('div', { className: 'relative h-20 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900' }, [
      h('div', { className: 'absolute inset-0 flex' }, [
        h('div', { className: 'h-full', style: { width: '70%', background: `${COLORS.green}22` } }),
        h('div', { className: 'h-full', style: { width: '20%', background: `${COLORS.amber}22` } }),
        h('div', { className: 'h-full flex-1', style: { background: `${COLORS.red}22` } }),
      ]),
      h('svg', { className: 'absolute inset-0', viewBox: '0 0 100 40', preserveAspectRatio: 'none' },
        h('path', {
          d: `M0 ${20} C 25 ${20 - amp}, 25 ${20 + amp}, 50 ${20} C 75 ${20 - amp}, 75 ${20 + amp}, 100 ${20}`,
          stroke: '#0ea5e9',
          strokeWidth: 1.5,
          fill: 'none',
        })
      ),
      h('div', { className: 'absolute top-0 bottom-0 w-[2px] bg-slate-800 dark:bg-white rounded-full', style: { left: markerPos } }),
    ]),
    h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, `Driven by: ${driverLabel} • Can I take this day off? ${dayOffAnswer}`),
  ]);
}

function StackedBlocks({ scorePct, driverLabel, dayOffAnswer }) {
  const clamped = Math.max(0, Math.min(100, scorePct));
  const markerPos = `${clamped}%`;
  return h('div', { className: 'space-y-2' }, [
    h('div', { className: 'relative h-10 w-full flex overflow-hidden rounded-xl border border-slate-200 dark:border-white/10' }, [
      h('div', { className: 'h-full flex-1', style: { flexBasis: '70%', background: `${COLORS.green}33` } }),
      h('div', { className: 'h-full', style: { width: '20%', background: `${COLORS.amber}33` } }),
      h('div', { className: 'h-full', style: { width: '10%', background: `${COLORS.red}33` } }),
      h('div', {
        className: 'absolute top-0 bottom-0 w-[2px] bg-slate-800 dark:bg-white rounded-full transition-all',
        style: { left: markerPos },
      }),
    ]),
    h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, `Driven by: ${driverLabel} • Can I take this day off? ${dayOffAnswer}`),
  ]);
}

export function FlowMeterGallery({ scorePct = 20, driverLabel = 'Everything looks steady', dayOffAnswer = 'Yeah, you could.' }) {
  const state = getStateFromScore(scorePct);
  const cards = useMemo(() => [
    { key: 'speedometer', title: 'Speedometer Arc + Needle', node: h(SpeedometerArc, { scorePct, state, driverLabel, dayOffAnswer }) },
    { key: 'flow-band', title: 'Flow Band + Marker', node: h(FlowBand, { scorePct, driverLabel, dayOffAnswer }) },
    { key: 'pulse-ring', title: 'Pulse Ring (Breathing)', node: h(PulseRing, { scorePct, state, driverLabel, dayOffAnswer }) },
    { key: 'river-stream', title: 'River Stream + Wave', node: h(RiverStream, { scorePct, driverLabel, dayOffAnswer }) },
    { key: 'stacked-blocks', title: 'Stacked State Blocks', node: h(StackedBlocks, { scorePct, driverLabel, dayOffAnswer }) },
  ], [scorePct, state, driverLabel, dayOffAnswer]);

  return h('div', { className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' },
    cards.map((card) =>
      h('div', { key: card.key, className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 p-4 space-y-3' }, [
        h('div', { className: 'text-sm font-semibold text-slate-800 dark:text-white' }, card.title),
        card.node,
      ])
    )
  );
}
