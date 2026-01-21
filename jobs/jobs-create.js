import { SectionHeader } from '../components/layout/SectionHeader.js';
import { navigate } from '../router.js';
import { getContactsData } from '../contacts/contacts-data.js';
import { loadServiceTypes } from '../quick-tasks/quick-tasks-store.js';
import { createJob } from './jobs-store.js';
import { JobPlanEditor, buildDeliverablesFromPlan, createPlanStateFromJob, sumRowHours } from './jobs-plan-grid.js';

const { createElement: h, useMemo, useState } = React;

function buildDefaultServiceTypeIds(serviceTypes) {
  return (serviceTypes || []).slice(0, 3).map((type) => type.id);
}

export function JobsCreateScreen() {
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const defaultServiceTypeIds = useMemo(() => buildDefaultServiceTypeIds(serviceTypes), [serviceTypes]);
  const companies = useMemo(() => getContactsData(), []);

  const [name, setName] = useState('');
  const [kind, setKind] = useState('project');
  const [isInternal, setIsInternal] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [plan, setPlan] = useState(() => createPlanStateFromJob(
    { serviceTypeIds: defaultServiceTypeIds, deliverables: [] },
    defaultServiceTypeIds
  ));

  const breadcrumb = h('div', { className: 'flex items-center gap-2' }, [
    h('span', { className: 'text-sm text-slate-500 dark:text-white/70' }, 'Jobs'),
    h('span', { className: 'text-slate-400 dark:text-white/50' }, '›'),
    h('span', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'New Job'),
  ]);

  const toggleButton = (value, label, isActive, onClick) => h('button', {
    type: 'button',
    className: [
      'px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border',
      isActive
        ? 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm'
        : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-white/10',
    ].join(' '),
    onClick,
  }, label);

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      window?.showToast?.('Job name is required.');
      return;
    }
    if (!plan.serviceTypeIds || !plan.serviceTypeIds.length) {
      window?.showToast?.('Select at least one service type.');
      return;
    }
    const namedRows = plan.rows.filter((row) => String(row.name || '').trim());
    if (!namedRows.length) {
      window?.showToast?.('Add at least one deliverable.');
      return;
    }
    const invalid = namedRows.some((row) => sumRowHours(row, plan.serviceTypeIds) <= 0);
    if (invalid) {
      window?.showToast?.('Each deliverable needs available hours.');
      return;
    }
    const deliverables = buildDeliverablesFromPlan({ ...plan, rows: namedRows }, []);
    const job = createJob({
      name: trimmedName,
      kind,
      status: 'pending',
      isInternal,
      companyId: isInternal ? null : (companyId || null),
      personId: null,
      serviceTypeIds: plan.serviceTypeIds,
      deliverables,
    });
    window?.showToast?.('Job created');
    navigate(`#/app/jobs/${job.id}`);
  };

  return h('div', { className: 'space-y-6 px-4 pt-4 pb-12' }, [
    h(SectionHeader, {
      title: breadcrumb,
      showHelpIcon: true,
      showSecondaryRow: false,
    }),
    h('div', { className: 'flex flex-wrap items-center gap-2' }, [
      h('button', {
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
        onClick: () => navigate('#/app/jobs'),
      }, 'Cancel'),
      h('button', {
        type: 'button',
        className: 'inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
        onClick: handleCreate,
      }, 'Create Job'),
    ]),
    h('section', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5 space-y-4' }, [
      h('div', { className: 'space-y-1' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Job Basics'),
        h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Create a pending job and plan available hours.'),
      ]),
      h('div', { className: 'grid gap-4 sm:grid-cols-2' }, [
        h('label', { className: 'space-y-1' }, [
          h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Job name'),
          h('input', {
            type: 'text',
            value: name,
            onChange: (e) => setName(e.target.value),
            placeholder: 'e.g. Website Refresh',
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white',
          }),
        ]),
        h('div', { className: 'space-y-2' }, [
          h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 block' }, 'Kind'),
          h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-1 py-1' }, [
            toggleButton('project', 'Project', kind === 'project', () => setKind('project')),
            toggleButton('retainer', 'Retainer', kind === 'retainer', () => setKind('retainer')),
          ]),
        ]),
      ]),
      h('div', { className: 'grid gap-4 sm:grid-cols-2' }, [
        h('div', { className: 'space-y-2' }, [
          h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 block' }, 'Client vs internal'),
          h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-1 py-1' }, [
            toggleButton('client', 'Client', !isInternal, () => setIsInternal(false)),
            toggleButton('internal', 'Internal', isInternal, () => {
              setIsInternal(true);
              setCompanyId('');
            }),
          ]),
        ]),
        !isInternal
          ? h('label', { className: 'space-y-1' }, [
            h('span', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Company (optional)'),
            h('select', {
              value: companyId,
              onChange: (e) => setCompanyId(e.target.value),
              className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
            }, [
              h('option', { value: '' }, 'Select a company'),
              ...(companies || []).map((company) => h('option', { key: company.id, value: String(company.id) }, company.name || `Company ${company.id}`)),
            ]),
          ])
          : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Internal jobs do not require a client.'),
      ]),
    ]),
    h(JobPlanEditor, {
      plan,
      onPlanChange: setPlan,
      serviceTypes,
    }),
  ]);
}
