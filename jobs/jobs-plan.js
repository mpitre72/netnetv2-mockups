import { JobCreateStepperRoot } from './jobs-create.js';

const { createElement: h } = React;

export function JobPlanTab({ job, onJobUpdate, readOnly, onOpenChat, chatIndicator }) {
  return h(JobCreateStepperRoot, {
    job,
    onJobUpdate,
    readOnly,
    onOpenChat,
    chatIndicator,
    showSectionHeader: false,
  });
}
