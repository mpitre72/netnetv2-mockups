import { getJobNumberOverride } from './jobs-ui-state.js';

function computeJobNumberFromId(job) {
  const raw = String(job?.id || '');
  const digits = raw.replace(/\D/g, '');
  if (digits) return digits.slice(-4);
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) % 10000;
  }
  return `${1000 + (hash % 9000)}`;
}

export function getJobNumber(job) {
  if (!job) return '';
  const override = getJobNumberOverride(job.id);
  return override || computeJobNumberFromId(job);
}

export function buildJobNumberMap(jobs = []) {
  const map = new Map();
  (jobs || []).forEach((job) => {
    map.set(String(job.id), getJobNumber(job));
  });
  return map;
}

export function isJobNumberUnique(jobId, number, jobs = []) {
  const target = String(number || '').trim();
  if (!target) return false;
  return !(jobs || []).some((job) => {
    if (String(job.id) === String(jobId)) return false;
    return getJobNumber(job) === target;
  });
}
