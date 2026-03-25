const { createElement: h } = React;

function stepState(step, currentStep) {
  if (step.index < currentStep) return 'complete';
  if (step.index === currentStep) return 'current';
  return 'upcoming';
}

function iconForState(state, index) {
  if (state === 'complete') return '✓';
  return `${index}`;
}

export function JobPlanStepper({ steps = [], currentStep = 1, onStepChange }) {
  return h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-3 sm:p-4' }, [
    h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-center' }, steps.map((step, index) => {
      const state = stepState(step, currentStep);
      const isCurrent = state === 'current';
      const isComplete = state === 'complete';
      const connector = index < steps.length - 1
        ? h('div', { className: `hidden md:block h-px flex-1 ${isComplete ? 'bg-netnet-purple/60' : 'bg-slate-200 dark:bg-white/10'}` })
        : null;
      return h(React.Fragment, { key: step.index }, [
        h('button', {
          type: 'button',
          className: [
            'group min-w-0 flex-1 rounded-xl border px-3 py-3 text-left transition-colors',
            isCurrent
              ? 'border-netnet-purple/60 bg-netnet-purple/10'
              : isComplete
                ? 'border-emerald-300/70 bg-emerald-50/80 dark:border-emerald-400/30 dark:bg-emerald-500/10'
                : 'border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/5',
          ].join(' '),
          onClick: () => onStepChange?.(step.index),
        }, [
          h('div', { className: 'flex items-center gap-3' }, [
            h('div', {
              className: [
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                isCurrent
                  ? 'bg-netnet-purple text-white'
                  : isComplete
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-300',
              ].join(' '),
            }, iconForState(state, step.index)),
            h('div', { className: 'min-w-0' }, [
              h('div', { className: `truncate text-sm font-semibold ${isCurrent ? 'text-slate-900 dark:text-white' : isComplete ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}` }, step.label),
              h('div', { className: `truncate text-xs ${isCurrent ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}` }, step.subtitle || ''),
            ]),
          ]),
        ]),
        connector,
      ]);
    })),
  ]);
}
