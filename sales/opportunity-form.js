import { SectionHeader } from '../components/layout/SectionHeader.js';
import { PrimaryButton } from '../components/buttons/primary-button.js';
import { SelectInput } from '../components/forms/select-input.js';
import { TextInput } from '../components/forms/text-input.js';
import { mountSectionPageShell } from '../components/layout/section-page-shell.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';
import { mountCompanyLookup } from '../contacts/company-lookup.js';
import { mountPersonLookup } from '../contacts/person-lookup.js';
import { openSingleDatePickerPopover } from '../quick-tasks/quick-task-detail.js';
import { getCurrentUserId, loadTeamMembers } from '../quick-tasks/quick-tasks-store.js';
import { navigate } from '../router.js';
import {
  getMockSalesOpportunity,
  mockSalesJobOptions,
  saveMockSalesOpportunity,
} from '../data/mock-sales.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;
const { createRoot } = ReactDOM;

const TYPE_OPTIONS = [
  { value: 'project', label: 'Project' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'both', label: 'Both' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const DURATION_TYPE_OPTIONS = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'fixed', label: 'Fixed' },
];

function SectionBlock({ title, description, children }) {
  return h('section', {
    className: 'space-y-4 rounded-[24px] border border-slate-200/80 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-950/35 md:p-6',
  }, [
    h('div', { className: 'space-y-1' }, [
      h('h2', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, title),
      description ? h('p', { className: 'text-sm leading-6 text-slate-500 dark:text-slate-400' }, description) : null,
    ]),
    children,
  ]);
}

function FieldShell({ label, hint, required, children }) {
  return h('label', { className: 'space-y-2' }, [
    h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, label),
      required ? h('span', { className: 'text-[11px] font-semibold uppercase tracking-[0.16em] text-netnet-purple' }, 'Required') : null,
    ]),
    children,
    hint ? h('p', { className: 'text-xs leading-5 text-slate-500 dark:text-slate-400' }, hint) : null,
  ]);
}

function readOnlyField(value, hint = '') {
  return h('div', {
    className: 'min-h-[44px] rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200',
  }, [
    h('div', null, value || '—'),
    hint ? h('div', { className: 'mt-1 text-xs text-slate-500 dark:text-slate-400' }, hint) : null,
  ]);
}

function inputClassName() {
  return 'h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white';
}

function formatDateFieldValue(iso) {
  if (!iso) return 'mm/dd/yyyy';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'mm/dd/yyyy';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderCalendarIcon() {
  return h('svg', {
    viewBox: '0 0 24 24',
    className: 'h-5 w-5 text-slate-400',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
  }, [
    h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }),
    h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
    h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
    h('line', { x1: '3', y1: '10', x2: '21', y2: '10' }),
  ]);
}

function isLinkableJob(job) {
  const status = String(job?.status || '').trim().toLowerCase();
  return status === 'active' || status === 'pending';
}

function filterLinkableJobs(term, excludedIds = []) {
  const excluded = new Set((excludedIds || []).map((id) => String(id)));
  const query = String(term || '').trim().toLowerCase();
  return mockSalesJobOptions
    .filter((job) => isLinkableJob(job) && !excluded.has(String(job.id)))
    .filter((job) => {
      if (!query) return true;
      const haystack = [job.jobNumber, job.name, job.status].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    })
    .slice(0, 8);
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function getNextCompanyId() {
  return getContactsData().reduce((acc, company) => Math.max(acc, Number(company?.id) || 0), 0) + 1;
}

function getNextPersonId() {
  const companyMax = getContactsData().reduce((acc, company) => {
    const peopleMax = (company?.people || []).reduce((personAcc, person) => Math.max(personAcc, Number(person?.id) || 0), 0);
    return Math.max(acc, peopleMax);
  }, 0);
  const standaloneMax = getIndividualsData().reduce((acc, person) => Math.max(acc, Number(person?.id) || 0), 0);
  return Math.max(companyMax, standaloneMax) + 1;
}

function ensureCompany(name) {
  const target = normalizeName(name);
  if (!target) return null;
  const companies = getContactsData();
  const existing = companies.find((company) => normalizeName(company?.name) === target);
  if (existing) return existing;
  const created = {
    id: getNextCompanyId(),
    name: String(name || '').trim(),
    website: '',
    phone: '',
    city: '',
    state: '',
    people: [],
  };
  companies.push(created);
  return created;
}

function ensurePerson({ company, name }) {
  const target = normalizeName(name);
  if (!target) return null;
  if (company) {
    company.people = Array.isArray(company.people) ? company.people : [];
    const existing = company.people.find((person) => normalizeName(person?.name) === target);
    if (existing) {
      return {
        ...existing,
        companyId: company.id,
        companyName: company.name,
        type: 'company',
      };
    }
    const created = {
      id: getNextPersonId(),
      name: String(name || '').trim(),
      title: '',
      email: '',
    };
    company.people.push(created);
    return {
      ...created,
      companyId: company.id,
      companyName: company.name,
      type: 'company',
    };
  }

  const individuals = getIndividualsData();
  const existing = individuals.find((person) => normalizeName(person?.name) === target);
  if (existing) {
    return {
      ...existing,
      companyId: null,
      companyName: '',
      type: 'standalone',
    };
  }

  const created = {
    id: getNextPersonId(),
    name: String(name || '').trim(),
    title: '',
    email: '',
  };
  individuals.push(created);
  return {
    ...created,
    companyId: null,
    companyName: '',
    type: 'standalone',
  };
}

function ensureOpportunityRefs(opportunity) {
  if (!opportunity) return { company: null, person: null };
  const company = ensureCompany(opportunity.company);
  const person = ensurePerson({ company, name: opportunity.person });
  return { company, person };
}

function createDefaultDraft(members = []) {
  return {
    id: '',
    type: 'project',
    name: '',
    companyId: '',
    companyName: '',
    personId: '',
    personName: '',
    ownerId: getCurrentUserId(members) || '',
    status: 'open',
    clarity: 'fog',
    description: '',
    estimatedStartDate: '',
    estimatedCompletionDate: '',
    linkedJobIds: [],
    financial: {
      project: {
        budget: '',
        baseValue: '',
        overrideValue: '',
      },
      retainer: {
        monthlyValue: '',
        durationType: 'ongoing',
        durationMonths: '12',
        baseMonthly: '',
        overrideMonthly: '',
      },
    },
  };
}

function buildDraftFromOpportunity(opportunity, members = []) {
  const base = createDefaultDraft(members);
  const refs = ensureOpportunityRefs(opportunity);
  const linkedJobIds = Array.isArray(opportunity?.linkedJobs) && opportunity.linkedJobs.length
    ? opportunity.linkedJobs.map((job) => String(job.id))
    : mockSalesJobOptions.slice(0, Math.max(0, Number(opportunity?.linkedJobsCount) || 0)).map((job) => String(job.id));
  return {
    ...base,
    id: String(opportunity?.id || ''),
    type: opportunity?.type || 'project',
    name: opportunity?.name || '',
    companyId: refs.company ? String(refs.company.id) : '',
    companyName: refs.company?.name || opportunity?.company || '',
    personId: refs.person ? String(refs.person.id) : '',
    personName: refs.person?.name || opportunity?.person || '',
    ownerId: opportunity?.ownerId || base.ownerId,
    status: opportunity?.status || 'open',
    clarity: opportunity?.clarity || 'fog',
    description: opportunity?.description || '',
    estimatedStartDate: opportunity?.estimatedStartDate || '',
    estimatedCompletionDate: opportunity?.estimatedCompletionDate || '',
    linkedJobIds,
    financial: {
      project: {
        budget: opportunity?.value?.project?.budget || opportunity?.projectValue || '',
        baseValue: opportunity?.value?.project?.baseValue || '',
        overrideValue: opportunity?.value?.project?.overrideValue || '',
      },
      retainer: {
        monthlyValue: opportunity?.value?.retainer?.monthlyValue || opportunity?.retainerValue || '',
        durationType: opportunity?.value?.retainer?.durationType === 'fixed' ? 'fixed' : 'ongoing',
        durationMonths: opportunity?.value?.retainer?.durationMonths ? String(opportunity.value.retainer.durationMonths) : '12',
        baseMonthly: opportunity?.value?.retainer?.baseMonthly || '',
        overrideMonthly: opportunity?.value?.retainer?.overrideMonthly || '',
      },
    },
  };
}

function buildOpportunityPayload(draft, existingOpportunity = null) {
  return {
    ...(existingOpportunity || {}),
    id: draft.id || undefined,
    name: draft.name,
    company: draft.companyName,
    person: draft.personName,
    ownerId: draft.ownerId,
    status: draft.status,
    clarity: draft.clarity,
    description: draft.description,
    type: draft.type,
    estimatedStartDate: draft.estimatedStartDate,
    estimatedCompletionDate: draft.estimatedCompletionDate,
    linkedJobIds: draft.linkedJobIds,
    financial: draft.financial,
  };
}

function OpportunityFormScreen({ mode = 'create', opportunityId = null }) {
  const members = useMemo(() => loadTeamMembers(), []);
  const existingOpportunity = useMemo(
    () => (mode === 'edit' && opportunityId ? getMockSalesOpportunity(opportunityId) : null),
    [mode, opportunityId]
  );
  const [draft, setDraft] = useState(() => (
    existingOpportunity ? buildDraftFromOpportunity(existingOpportunity, members) : createDefaultDraft(members)
  ));
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [jobLookupOpen, setJobLookupOpen] = useState(false);
  const [jobLookupTerm, setJobLookupTerm] = useState('');
  const [jobLookupHighlight, setJobLookupHighlight] = useState(-1);

  const companyLookupSlotRef = useRef(null);
  const companyLookupApiRef = useRef(null);
  const personLookupSlotRef = useRef(null);
  const personLookupApiRef = useRef(null);
  const datePickerCleanupRef = useRef(null);
  const jobLookupRef = useRef(null);
  const jobLookupInputRef = useRef(null);

  const ownerOptions = useMemo(() => (
    members.map((member) => ({
      value: member.id,
      label: member.name || member.email || 'Owner',
    }))
  ), [members]);

  const selectedCompany = useMemo(() => {
    if (!draft.companyId) return null;
    return getContactsData().find((company) => String(company.id) === String(draft.companyId)) || null;
  }, [draft.companyId]);

  const selectedJobs = useMemo(
    () => mockSalesJobOptions.filter((job) => draft.linkedJobIds.includes(String(job.id))),
    [draft.linkedJobIds]
  );
  const linkableJobResults = useMemo(
    () => filterLinkableJobs(jobLookupTerm, draft.linkedJobIds),
    [jobLookupTerm, draft.linkedJobIds]
  );

  useEffect(() => {
    if (!companyLookupSlotRef.current) return undefined;
    companyLookupApiRef.current?.destroy?.();
    companyLookupApiRef.current = mountCompanyLookup(companyLookupSlotRef.current, {
      label: 'Company',
      placeholder: 'Search companies...',
      value: selectedCompany,
      onChange: (company) => {
        setDirty(true);
        setDraft((current) => ({
          ...current,
          companyId: company ? String(company.id) : '',
          companyName: company?.name || '',
          personId: '',
          personName: '',
        }));
        personLookupApiRef.current?.setCompany?.(company || null);
        personLookupApiRef.current?.setValue?.(null);
      },
    });
    return () => {
      companyLookupApiRef.current?.destroy?.();
      companyLookupApiRef.current = null;
    };
  }, [selectedCompany?.id]);

  useEffect(() => {
    if (!personLookupSlotRef.current) return undefined;
    personLookupApiRef.current?.destroy?.();
    const initialPerson = selectedCompany
      ? (selectedCompany.people || []).find((person) => String(person.id) === String(draft.personId)) || null
      : getIndividualsData().find((person) => String(person.id) === String(draft.personId)) || null;
    personLookupApiRef.current = mountPersonLookup(personLookupSlotRef.current, {
      label: 'Person',
      placeholder: 'Search people...',
      value: initialPerson,
      company: selectedCompany,
      onChange: (person, meta = {}) => {
        setDirty(true);
        setDraft((current) => ({
          ...current,
          companyId: meta.companyCreated ? String(meta.companyCreated.id) : current.companyId,
          companyName: meta.companyCreated ? meta.companyCreated.name : current.companyName,
          personId: person ? String(person.id) : '',
          personName: person?.name || '',
        }));
      },
    });
    return () => {
      personLookupApiRef.current?.destroy?.();
      personLookupApiRef.current = null;
    };
  }, [selectedCompany?.id, draft.personId]);

  useEffect(() => {
    if (!dirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => () => {
    if (datePickerCleanupRef.current) {
      datePickerCleanupRef.current();
      datePickerCleanupRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobLookupOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!jobLookupRef.current?.contains(event.target)) {
        setJobLookupOpen(false);
        setJobLookupTerm('');
        setJobLookupHighlight(-1);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [jobLookupOpen]);

  useEffect(() => {
    if (!jobLookupOpen) return;
    jobLookupInputRef.current?.focus();
  }, [jobLookupOpen]);

  useEffect(() => {
    setJobLookupHighlight(linkableJobResults.length ? 0 : -1);
  }, [jobLookupTerm, linkableJobResults.length]);

  const updateDraft = (partial) => {
    setDirty(true);
    setDraft((current) => ({ ...current, ...(partial || {}) }));
  };

  const openDatePicker = (anchorEl, field) => {
    if (!anchorEl) return;
    if (datePickerCleanupRef.current) datePickerCleanupRef.current();
    datePickerCleanupRef.current = openSingleDatePickerPopover({
      anchorEl,
      value: draft[field] || '',
      onSelect: (next) => updateDraft({ [field]: next || '' }),
      onClear: () => updateDraft({ [field]: '' }),
      onClose: () => {
        datePickerCleanupRef.current = null;
      },
    });
  };

  const updateFinancial = (section, field, value) => {
    setDirty(true);
    setDraft((current) => ({
      ...current,
      financial: {
        ...current.financial,
        [section]: {
          ...current.financial[section],
          [field]: value,
        },
      },
    }));
  };

  const addLinkedJob = (jobId) => {
    const key = String(jobId);
    setDirty(true);
    setDraft((current) => {
      const next = new Set((current.linkedJobIds || []).map((id) => String(id)));
      next.add(key);
      return {
        ...current,
        linkedJobIds: Array.from(next),
      };
    });
    setJobLookupOpen(false);
    setJobLookupTerm('');
    setJobLookupHighlight(-1);
  };

  const removeLinkedJob = (jobId) => {
    const key = String(jobId);
    setDirty(true);
    setDraft((current) => ({
      ...current,
      linkedJobIds: (current.linkedJobIds || []).filter((id) => String(id) !== key),
    }));
  };

  const openJobLookup = () => {
    setJobLookupOpen(true);
    setJobLookupTerm('');
    setJobLookupHighlight(-1);
  };

  const handleJobLookupKeyDown = (event) => {
    if (event.key === 'Escape') {
      setJobLookupOpen(false);
      setJobLookupTerm('');
      setJobLookupHighlight(-1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!linkableJobResults.length) return;
      setJobLookupHighlight((current) => (current + 1 + linkableJobResults.length) % linkableJobResults.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!linkableJobResults.length) return;
      setJobLookupHighlight((current) => (current - 1 + linkableJobResults.length) % linkableJobResults.length);
      return;
    }
    if (event.key === 'Enter' && linkableJobResults[jobLookupHighlight]) {
      event.preventDefault();
      addLinkedJob(linkableJobResults[jobLookupHighlight].id);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    const saved = saveMockSalesOpportunity(buildOpportunityPayload(draft, existingOpportunity));
    setDirty(false);
    setIsSaving(false);
    window?.showToast?.(mode === 'edit' ? 'Opportunity updated.' : 'Opportunity created.');
    navigate(`#/app/sales/${saved.id}`);
  };

  const handleCancel = () => {
    navigate(mode === 'edit' && opportunityId ? `#/app/sales/${opportunityId}` : '#/app/sales');
  };

  const showProjectFields = draft.type === 'project' || draft.type === 'both';
  const showRetainerFields = draft.type === 'retainer' || draft.type === 'both';

  return h('div', { className: 'space-y-5 pb-12' }, [
    h('div', { className: 'flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-slate-950/30' }, [
      h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, dirty ? 'Unsaved changes' : 'Ready to save'),
      h('div', { className: 'flex items-center gap-2' }, [
        h('button', {
          type: 'button',
          className: 'inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
          onClick: handleCancel,
        }, 'Cancel'),
        h(PrimaryButton, {
          onClick: handleSave,
          disabled: isSaving || !draft.name.trim(),
        }, isSaving ? 'Saving...' : 'Save Opportunity'),
      ]),
    ]),
    h(SectionBlock, {
      title: 'Opportunity Details',
      description: 'Keep the form tight and type-driven so the opportunity can be updated quickly.',
    }, h('div', { className: 'grid gap-4' }, [
      h(FieldShell, { label: 'Type', required: true }, h(SelectInput, {
        id: 'opportunity-type',
        value: draft.type,
        onChange: (event) => updateDraft({ type: event.target.value }),
        className: inputClassName(),
        options: TYPE_OPTIONS,
      })),
      h(FieldShell, { label: 'Opportunity Name', required: true }, h(TextInput, {
        id: 'opportunity-name',
        value: draft.name,
        onChange: (event) => updateDraft({ name: event.target.value }),
        className: inputClassName(),
        placeholder: 'e.g. Northstar Rebrand',
      })),
      h('div', { className: 'grid gap-4' }, [
        h('div', { ref: companyLookupSlotRef }),
        h('div', { ref: personLookupSlotRef }),
      ]),
      h(FieldShell, { label: 'Owner' }, h(SelectInput, {
        id: 'opportunity-owner',
        value: draft.ownerId,
        onChange: (event) => updateDraft({ ownerId: event.target.value }),
        className: inputClassName(),
        options: ownerOptions,
      })),
      h(FieldShell, { label: 'Status' }, h(SelectInput, {
        id: 'opportunity-status',
        value: draft.status,
        onChange: (event) => updateDraft({ status: event.target.value }),
        className: inputClassName(),
        options: STATUS_OPTIONS,
      })),
    ])),
    h(SectionBlock, {
      title: 'Financials',
      description: 'Only show the fields this opportunity type needs. Hidden sections keep their values if you switch back.',
    }, h('div', { className: 'space-y-5' }, [
      showProjectFields ? h('div', { className: 'space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/50' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Project'),
        h(FieldShell, { label: 'Budget' }, h(TextInput, {
          id: 'project-budget',
          value: draft.financial.project.budget,
          onChange: (event) => updateFinancial('project', 'budget', event.target.value),
          className: inputClassName(),
          placeholder: '$25,000',
        })),
        h(FieldShell, { label: 'Base Value' }, readOnlyField(
          draft.financial.project.baseValue || '—',
          draft.financial.project.baseValue ? 'Pulled from linked Jobs.' : 'Placeholder until linked Job totals are wired in.'
        )),
        h(FieldShell, { label: 'Override' }, h(TextInput, {
          id: 'project-override',
          value: draft.financial.project.overrideValue,
          onChange: (event) => updateFinancial('project', 'overrideValue', event.target.value),
          className: inputClassName(),
          placeholder: '$25,000',
        })),
      ]) : null,
      showRetainerFields ? h('div', { className: 'space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/50' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Retainer'),
        h(FieldShell, { label: 'Monthly Value' }, h(TextInput, {
          id: 'retainer-monthly',
          value: draft.financial.retainer.monthlyValue,
          onChange: (event) => updateFinancial('retainer', 'monthlyValue', event.target.value),
          className: inputClassName(),
          placeholder: '$5,000',
        })),
        h(FieldShell, { label: 'Duration Type' }, h(SelectInput, {
          id: 'retainer-duration-type',
          value: draft.financial.retainer.durationType,
          onChange: (event) => updateFinancial('retainer', 'durationType', event.target.value),
          className: inputClassName(),
          options: DURATION_TYPE_OPTIONS,
        })),
        draft.financial.retainer.durationType === 'fixed' ? h(FieldShell, { label: 'Duration Months' }, h(TextInput, {
          id: 'retainer-duration-months',
          value: draft.financial.retainer.durationMonths,
          onChange: (event) => updateFinancial('retainer', 'durationMonths', event.target.value.replace(/\D/g, '')),
          className: inputClassName(),
          inputMode: 'numeric',
          placeholder: '12',
        })) : null,
        h(FieldShell, { label: 'Base Monthly' }, readOnlyField(
          draft.financial.retainer.baseMonthly || '—',
          draft.financial.retainer.baseMonthly ? 'Pulled from linked Jobs.' : 'Placeholder until base monthly logic is connected.'
        )),
        h(FieldShell, { label: 'Override Monthly' }, h(TextInput, {
          id: 'retainer-override-monthly',
          value: draft.financial.retainer.overrideMonthly,
          onChange: (event) => updateFinancial('retainer', 'overrideMonthly', event.target.value),
          className: inputClassName(),
          placeholder: '$5,000',
        })),
      ]) : null,
    ])),
    h(SectionBlock, {
      title: 'Planning',
      description: 'Keep the notes and dates light. Notes themselves still live in the activity feed.',
    }, h('div', { className: 'grid gap-4' }, [
      h(FieldShell, { label: 'Description' }, h(TextInput, {
        id: 'opportunity-description',
        value: draft.description,
        onChange: (event) => updateDraft({ description: event.target.value }),
        className: inputClassName(),
        placeholder: 'Brief scope or context',
        multiline: true,
        rows: 4,
      })),
      h(FieldShell, { label: 'Estimated Start Date' }, h('button', {
        id: 'estimated-start-date',
        type: 'button',
        className: 'flex h-11 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
        onClick: (event) => openDatePicker(event.currentTarget, 'estimatedStartDate'),
      }, [
        h('span', { className: draft.estimatedStartDate ? '' : 'text-slate-400 dark:text-slate-500' }, formatDateFieldValue(draft.estimatedStartDate)),
        renderCalendarIcon(),
      ])),
      h(FieldShell, { label: 'Estimated Completion Date' }, h('button', {
        id: 'estimated-completion-date',
        type: 'button',
        className: 'flex h-11 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
        onClick: (event) => openDatePicker(event.currentTarget, 'estimatedCompletionDate'),
      }, [
        h('span', { className: draft.estimatedCompletionDate ? '' : 'text-slate-400 dark:text-slate-500' }, formatDateFieldValue(draft.estimatedCompletionDate)),
        renderCalendarIcon(),
      ])),
    ])),
    h(SectionBlock, {
      title: 'Linked Jobs',
      description: 'Search and attach the right Jobs without breaking flow.',
    }, h('div', { className: 'space-y-4' }, [
      h('div', { className: 'flex items-center justify-between gap-3' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Currently Linked'),
        h('button', {
          type: 'button',
          className: 'inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
          onClick: openJobLookup,
        }, '+ Link a Job'),
      ]),
      selectedJobs.length
        ? h('div', { className: 'space-y-2' }, selectedJobs.map((job) => (
          h('div', {
            key: job.id,
            className: 'flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60',
          }, [
            h('div', { className: 'min-w-0 flex-1' }, [
              h('div', { className: 'flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900 dark:text-white' }, [
                h('span', null, job.jobNumber),
                h('span', { className: 'text-slate-400 dark:text-slate-500' }, job.name),
              ]),
              h('div', { className: 'mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300' }, job.status),
            ]),
            h('button', {
              type: 'button',
              className: 'inline-flex h-8 min-w-[72px] items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-netnet-purple transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800',
              onClick: () => removeLinkedJob(job.id),
            }, 'Remove'),
          ])
        )))
        : h('div', { className: 'rounded-xl border border-dashed border-slate-200/80 px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400' }, 'No Jobs linked yet.'),
      jobLookupOpen
        ? h('div', {
          ref: jobLookupRef,
          className: 'relative space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/50',
        }, [
          h('div', { className: 'lookup-input-wrap' }, [
            h('input', {
              ref: jobLookupInputRef,
              type: 'text',
              value: jobLookupTerm,
              onChange: (event) => setJobLookupTerm(event.target.value),
              onFocus: () => setJobLookupOpen(true),
              onKeyDown: handleJobLookupKeyDown,
              placeholder: 'Search Jobs...',
              className: inputClassName(),
              'aria-label': 'Search Jobs',
            }),
            h('div', { className: 'lookup-menu-card' }, [
              linkableJobResults.length
                ? h('ul', { className: 'lookup-menu' }, linkableJobResults.map((job, index) => h('li', {
                  key: job.id,
                  className: `lookup-item ${index === jobLookupHighlight ? 'active' : ''}`.trim(),
                  onMouseDown: (event) => {
                    event.preventDefault();
                    addLinkedJob(job.id);
                  },
                }, [
                  h('div', { className: 'flex items-center justify-between gap-3' }, [
                    h('div', { className: 'min-w-0 flex-1' }, [
                      h('div', { className: 'flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white' }, [
                        h('span', { className: 'shrink-0' }, job.jobNumber),
                        h('span', { className: 'truncate' }, job.name),
                      ]),
                    ]),
                    h('span', { className: 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300' }, job.status),
                  ]),
                ])))
                : h('div', { className: 'px-3 py-3 text-sm text-slate-500 dark:text-slate-400' }, 'No matching Jobs'),
            ]),
          ]),
        ])
        : null,
    ])),
  ]);
}

export function renderOpportunityFormPage(
  container = document.getElementById('app-main'),
  { mode = 'create', opportunityId = null } = {}
) {
  if (!container) {
    console.warn('[SalesOpportunityForm] container not found for renderOpportunityFormPage.');
    return;
  }

  const { headerMount, bodyMount } = mountSectionPageShell(container, {
    headerId: 'sales-form-header',
    bodyId: 'sales-form-body',
  });
  const headerRoot = createRoot(headerMount);
  const bodyRoot = createRoot(bodyMount);

  headerRoot.render(h(SectionHeader, {
    breadcrumbs: [
      { label: 'Sales', path: '/sales' },
      { label: mode === 'edit' ? 'Edit Opportunity' : 'New Opportunity' },
    ],
    showHelpIcon: true,
    showSecondaryRow: false,
    className: 'mb-1',
  }));

  bodyRoot.render(h(OpportunityFormScreen, { mode, opportunityId }));
}
