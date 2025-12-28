const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function uniqueDrivers(deliverables) {
  const seen = new Map();
  deliverables.forEach((del) => {
    (del.reasons || []).forEach((r) => {
      if (!seen.has(r.id)) seen.set(r.id, { id: r.id, label: r.label, tone: r.tone });
    });
  });
  return Array.from(seen.values()).slice(0, 4);
}

export function buildJobsAtRiskRollup({ jobs = [], deliverables = [], todayOverride } = {}) {
  const today = todayOverride ? new Date(todayOverride) : new Date();
  const horizon = new Date(today.getTime() + 30 * DAY_MS);
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const bucket = new Map();

  deliverables.forEach((del) => {
    const dueDate = parseDate(del.due);
    if (!dueDate) return;
    if (del.status === 'completed') return;
    if (dueDate > horizon && !del.overdue) return;

    const atRiskDeliverable =
      del.overdue ||
      del.effortOver ||
      del.timelineOver ||
      del.lowConfidence ||
      del.paceTone === 'red';
    if (!atRiskDeliverable) return;

    const job = jobMap.get(del.jobId);
    if (!job) return;
    if (!bucket.has(job.id)) {
      bucket.set(job.id, { job, deliverables: [] });
    }
    bucket.get(job.id).deliverables.push(del);
  });

  const jobsAtRisk = Array.from(bucket.values())
    .map(({ job, deliverables: dels }) => {
      const reviewedCount = dels.filter((d) => d.reviewed).length;
      const unreviewedCount = dels.length - reviewedCount;
      const severity3 = dels.some((d) => d.overdue || d.effortOver || d.timelineOver || d.lowConfidence);
      const severity2 = !severity3 && dels.some((d) => d.paceTone === 'red');
      const severity = severity3 ? 3 : severity2 ? 2 : 0;
      const dates = dels
        .map((d) => parseDate(d.due))
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime());
      const nextPainDate = dates[0] || null;
      const drivers = uniqueDrivers(dels);

      return {
        jobId: job.id,
        jobName: job.name || `Job ${job.id}`,
        clientName: job.client || 'Client',
        atRiskDeliverables: dels,
        atRiskDeliverableCount: dels.length,
        reviewedAtRiskDeliverableCount: reviewedCount,
        unreviewedAtRiskDeliverableCount: unreviewedCount,
        jobReviewedState: {
          unreviewedAtRisk: unreviewedCount > 0,
          reviewedAtRisk: unreviewedCount === 0,
        },
        severity,
        nextPainDate,
        driverChips: drivers,
      };
    })
    .filter((j) => j.severity > 0);

  jobsAtRisk.sort((a, b) => {
    if (a.jobReviewedState.unreviewedAtRisk !== b.jobReviewedState.unreviewedAtRisk) {
      return a.jobReviewedState.unreviewedAtRisk ? -1 : 1;
    }
    if (b.severity !== a.severity) return b.severity - a.severity;
    const ad = a.nextPainDate ? a.nextPainDate.getTime() : Infinity;
    const bd = b.nextPainDate ? b.nextPainDate.getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return a.jobName.localeCompare(b.jobName);
  });

  const jobsAtRiskCount = jobsAtRisk.length;
  const jobsAtRiskReviewedCount = jobsAtRisk.filter((j) => j.jobReviewedState.reviewedAtRisk).length;
  const jobsAtRiskNeedingAttention = jobsAtRisk.filter((j) => j.jobReviewedState.unreviewedAtRisk).length;

  return {
    jobsAtRisk,
    jobsAtRiskCount,
    jobsAtRiskReviewedCount,
    jobsAtRiskNeedingAttention,
  };
}
