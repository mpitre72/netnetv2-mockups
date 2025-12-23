function getDateShifted(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const mockReportData = {
  jobs: [
    { id: 1, name: 'NCBF Web Redesign', client: 'National Cherry Blossom Festival', estHours: 200, actualHours: 80, plannedEnd: getDateShifted(14), startDate: getDateShifted(-20), wipPressure: 0.85 },
    { id: 2, name: 'Quantum Leap Website', client: 'Future Systems', estHours: 350, actualHours: 300, plannedEnd: getDateShifted(7), startDate: getDateShifted(-60), wipPressure: 1.2 },
    { id: 3, name: 'Data Migration Strategy', client: 'Legacy Corp', estHours: 120, actualHours: 125, plannedEnd: getDateShifted(-5), startDate: getDateShifted(-40), wipPressure: 1.5 },
    { id: 4, name: 'Mobile App Revamp', client: 'Appify', estHours: 500, actualHours: 150, plannedEnd: getDateShifted(45), startDate: getDateShifted(-10), wipPressure: 0.7 },
  ],
  deliverables: [
    { id: 101, jobId: 2, jobName: 'Quantum Leap Website', name: 'API Integration', owner: 'Sam', due: getDateShifted(-2), effortConsumed: 110, durationConsumed: 105, estHours: 40 }, 
    { id: 102, jobId: 3, jobName: 'Data Migration Strategy', name: 'Final Report Delivery', owner: 'Maria', due: getDateShifted(3), effortConsumed: 102, durationConsumed: 115, estHours: 20 }, 
    { id: 103, jobId: 2, jobName: 'Quantum Leap Website', name: 'Frontend Deployment', owner: 'Alex', due: getDateShifted(5), effortConsumed: 98, durationConsumed: 101, estHours: 60 }, 
    { id: 104, jobId: 4, jobName: 'Mobile App Revamp', name: 'Wireframes', owner: 'Sarah', due: getDateShifted(12), effortConsumed: 40, durationConsumed: 30, estHours: 80 }, 
  ]
};

if (typeof window !== 'undefined') {
  window.mockReportData = mockReportData;
}
