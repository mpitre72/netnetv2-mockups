const { createElement: h, useMemo, useState } = React;

const STEP_DEFS = [
  {
    index: 1,
    label: 'Summary',
    eyebrow: 'Step 1 of 4',
    title: 'Summary screen coming next.',
    body: 'This is the new clean stepper skeleton. The previous Plan UI has been fully bypassed so Step 1 can be rebuilt from scratch.',
    theme: 'from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
    accent: 'bg-netnet-purple',
  },
  {
    index: 2,
    label: 'Deliverables + LOE',
    eyebrow: 'Step 2 of 4',
    title: 'Deliverables + LOE screen coming next.',
    body: 'This placeholder reserves the new grid screen. No legacy Deliverables or LOE layout is rendered here anymore.',
    theme: 'from-cyan-50 via-white to-slate-50 dark:from-slate-950 dark:via-cyan-950/20 dark:to-slate-950',
    accent: 'bg-cyan-500',
  },
  {
    index: 3,
    label: 'Net Net',
    eyebrow: 'Step 3 of 4',
    title: 'Net Net screen coming next.',
    body: 'This step exists only as a skeleton screen for now so the stepper flow can be built cleanly before content is added.',
    theme: 'from-emerald-50 via-white to-slate-50 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950',
    accent: 'bg-emerald-500',
  },
  {
    index: 4,
    label: 'Timeline',
    eyebrow: 'Step 4 of 4',
    title: 'Timeline screen coming next.',
    body: 'This placeholder marks the final stage of the new Plan flow. Activation wiring can be added after the full structure is approved.',
    theme: 'from-amber-50 via-white to-slate-50 dark:from-slate-950 dark:via-amber-950/20 dark:to-slate-950',
    accent: 'bg-amber-500',
  },
];

function StepPill({ step, currentStep, onSelect }) {
  const isCurrent = step.index === currentStep;
  const isComplete = step.index < currentStep;
  return h('button', {
    type: 'button',
    className: [
      'flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
      isCurrent
        ? 'border-netnet-purple/50 bg-netnet-purple/10'
        : isComplete
          ? 'border-emerald-300/70 bg-emerald-50/80 dark:border-emerald-400/30 dark:bg-emerald-500/10'
          : 'border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/5',
    ].join(' '),
    onClick: () => onSelect(step.index),
  }, [
    h('div', {
      className: [
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
        isCurrent
          ? 'bg-netnet-purple text-white'
          : isComplete
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-300',
      ].join(' '),
    }, isComplete ? '✓' : `${step.index}`),
    h('div', { className: 'min-w-0' }, [
      h('div', { className: `truncate text-sm font-semibold ${isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}` }, step.label),
      h('div', { className: 'truncate text-xs text-slate-400 dark:text-slate-500' }, step.eyebrow),
    ]),
  ]);
}

function StepNavigation({ step, setStep }) {
  const isFirst = step === 1;
  const isLast = step === STEP_DEFS.length;
  return h('div', { className: 'flex items-center justify-between gap-3 border-t border-slate-200/80 px-6 py-4 dark:border-white/10 md:px-8' }, [
    isFirst
      ? h('div')
      : h('button', {
        type: 'button',
        className: 'inline-flex items-center justify-center h-11 px-5 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5',
        onClick: () => setStep((current) => Math.max(1, current - 1)),
      }, '← Back'),
    h('button', {
      type: 'button',
      className: 'inline-flex items-center justify-center h-11 px-5 rounded-md bg-netnet-purple text-sm font-semibold text-white hover:brightness-110',
      onClick: () => setStep((current) => Math.min(STEP_DEFS.length, current + 1)),
      disabled: isLast,
    }, isLast ? 'Done' : 'Continue →'),
  ]);
}

function StepScreen({ step }) {
  return h('section', {
    className: `w-full max-w-6xl min-h-[74vh] overflow-hidden rounded-[32px] border border-slate-200 dark:border-white/10 bg-gradient-to-br ${step.theme} shadow-[0_30px_120px_rgba(15,23,42,0.12)] dark:shadow-[0_30px_120px_rgba(2,6,23,0.45)]`,
  }, [
    h('div', { className: 'flex min-h-[74vh] flex-col' }, [
      h('div', { className: 'flex-1 px-6 py-8 md:px-8 md:py-10' }, [
        h('div', { className: 'flex h-full flex-col justify-between gap-10' }, [
          h('div', { className: 'space-y-6' }, [
            h('div', { className: 'inline-flex items-center rounded-full border border-slate-200/80 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300' }, step.eyebrow),
            h('div', { className: 'space-y-4' }, [
              h('div', { className: `h-1.5 w-24 rounded-full ${step.accent}` }),
              h('h2', { className: 'max-w-3xl text-3xl font-semibold leading-tight text-slate-900 dark:text-white md:text-5xl' }, step.title),
              h('p', { className: 'max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base' }, step.body),
            ]),
          ]),
          h('div', { className: 'grid gap-4 lg:grid-cols-[1.1fr_0.9fr]' }, [
            h('div', { className: 'rounded-[28px] border border-slate-200/80 bg-white/80 p-6 backdrop-blur dark:border-white/10 dark:bg-slate-950/35' }, [
              h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400' }, 'Empty Step'),
              h('div', { className: 'mt-3 text-sm text-slate-600 dark:text-slate-300' }, 'This is intentionally empty so the new Plan experience can be approved before any old fields or grids are reintroduced.'),
            ]),
            h('div', { className: 'rounded-[28px] border border-dashed border-slate-200 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5' }, [
              h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400' }, 'Next Build Phase'),
              h('div', { className: 'mt-3 text-sm text-slate-600 dark:text-slate-300' }, 'Populate this step with real content after the clean skeleton flow is locked in.'),
            ]),
          ]),
        ]),
      ]),
    ]),
  ]);
}

export function JobPlanStepperRoot() {
  const [step, setStep] = useState(1);
  const activeStep = useMemo(() => STEP_DEFS.find((item) => item.index === step) || STEP_DEFS[0], [step]);

  return h('div', { className: 'space-y-6 pb-[50px]' }, [
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-3 sm:p-4' }, [
      h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-center' }, STEP_DEFS.map((item) => h(StepPill, {
        key: item.index,
        step: item,
        currentStep: step,
        onSelect: setStep,
      }))),
    ]),
    h(StepScreen, { step: activeStep }),
    h(StepNavigation, { step, setStep }),
  ]);
}
