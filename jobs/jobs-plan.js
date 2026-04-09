import { JobCreateStepperRoot } from './jobs-create.js';
import { getJobCycleKey, setJobCycleKey } from './jobs-ui-state.js';
import { getCurrentCycleKey } from './retainer-cycle-utils.js';
import { RetainerMonthSwitcher } from './job-detail/retainer-month-switcher.js';

const { createElement: h, useEffect, useState } = React;

export function JobPlanTab({ job, onJobUpdate, readOnly, onOpenChat, chatIndicator }) {
  const isRetainer = job?.kind === 'retainer';
  const [selectedMonth, setSelectedMonth] = useState(() => (
    isRetainer && job?.id ? (getJobCycleKey(job.id) || job.currentCycleKey || getCurrentCycleKey()) : null
  ));

  useEffect(() => {
    if (!job || job.kind !== 'retainer') {
      setSelectedMonth(null);
      return;
    }
    setSelectedMonth(getJobCycleKey(job.id) || job.currentCycleKey || getCurrentCycleKey());
  }, [job?.id, job?.kind, job?.currentCycleKey]);

  const activeCycleKey = isRetainer ? (selectedMonth || getCurrentCycleKey()) : null;
  const setCycle = (nextKey) => {
    if (!job || !isRetainer || !nextKey) return;
    setSelectedMonth(nextKey);
    setJobCycleKey(job.id, nextKey);
  };

  const scopedJob = isRetainer && activeCycleKey
    ? { ...job, currentCycleKey: activeCycleKey }
    : job;
  const planReadOnly = readOnly || job?.status === 'active' || job?.status === 'completed' || job?.status === 'archived';

  return h('div', { className: 'space-y-4' }, [
    isRetainer
      ? h('div', { className: 'flex justify-end' }, [
        h(RetainerMonthSwitcher, {
          cycleKey: activeCycleKey,
          onChange: setCycle,
          ariaLabel: 'Selected plan month',
        }),
      ])
      : null,
    h(JobCreateStepperRoot, {
      job: scopedJob,
      onJobUpdate,
      readOnly: planReadOnly,
      onOpenChat,
      chatIndicator,
      showSectionHeader: false,
    }),
  ]);
}
