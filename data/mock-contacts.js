export const mockContactsData = [
       {
         id: 1,
         name: "Acme Corp",
         website: "acme.com",
         linkedin: "linkedin.com/company/acme",
         city: "New York",
         state: "NY",
         phone: "(212) 555-1234",
         email: "contact@acme.com",
         address: "123 Acme Way",
         zip: "10001",
         description: "The leading supplier of Coyote-stopping technology and anvils.",
         industry: "Manufacturing",
         socials: { twitter: "@acme", facebook: "acmecorp", instagram: "@acmelife" },
         activities: [
           { id: 1, type: 'note', text: 'Discussed Q4 anvil projections.', date: '2023-11-01', user: 'Bruce W.' },
           { id: 2, type: 'email', subject: 'Re: Fall Catalog', snippet: 'The new catalog is ready for review...', date: '2023-10-28', user: 'Alice S.' }
         ],
         people: [
           { id: 101, name: "Alice Smith", title: "CEO", email: "alice@acme.com", phone: "555-0101", city: "New York", state: "NY", address: "1 Park Ave", zip: "10002",
             activities: [{id: 10, type: 'meeting', title: 'Intro Call', date: '2023-09-15', user: 'System'}] },
           { id: 102, name: "Bob Johnson", title: "CTO", email: "bob@acme.com", phone: "555-0102", city: "New York", state: "NY", address: "2 Park Ave", zip: "10002", activities: [] }
         ]
       },
       {
         id: 2,
         name: "Globex Corporation",
         website: "globex.com",
         linkedin: "linkedin.com/company/globex",
         city: "Cypress Creek",
         state: "WA",
         phone: "(555) 867-5309",
         email: "info@globex.com",
         address: "456 Villain Lane",
         zip: "90210",
         description: "A high-tech company with global ambitions.",
         industry: "Technology",
         socials: { twitter: "@globex", facebook: "globexcorp" },
         activities: [],
         people: [
           { id: 201, name: "Hank Scorpio", title: "President", email: "hank@globex.com", phone: "555-9999", city: "Cypress Creek", state: "WA", address: "Secret Volcano Lair", zip: "99999", activities: [] },
           { id: 202, name: "Jane Doe", title: "VP Sales", email: "jane@globex.com", phone: "555-8888", city: "Seattle", state: "WA", address: "789 Pine St", zip: "98101", activities: [] }
         ]
       },
       {
         id: 3,
         name: "Soylent Corp",
         website: "soylent.com",
         linkedin: "",
         city: "Detroit",
         state: "MI",
         phone: "(313) 555-4567",
         email: "green@soylent.com",
         address: "100 Industrial Blvd",
         zip: "48201",
         description: "Manufacturers of high-energy plankton-based food products.",
         industry: "Food & Beverage",
         socials: {},
         activities: [{id:3, type:'note', text:'Client is requesting new flavor options.', date:'2023-11-05', user:'Rick T.'}],
         people: [
           { id: 301, name: "Richard Thornburg", title: "Director", email: "richard@soylent.com", phone: "313-555-9999", city: "Detroit", state: "MI", address: "500 Lake Shore Dr", zip: "48202", activities: [] }
         ]
       },
       {
         id: 4,
         name: "Initech",
         website: "initech.com",
         linkedin: "linkedin.com/company/initech",
         city: "Austin",
         state: "TX",
         phone: "(512) 555-0001",
         email: "support@initech.com",
         address: "4120 Freidrich Ln",
         zip: "78744",
         description: "Software consulting and Y2K preparation specialists.",
         industry: "Software",
         socials: { twitter: "@initech" },
         activities: [],
         people: [
           { id: 401, name: "Bill Lumbergh", title: "Division VP", email: "bill@initech.com", phone: "512-555-1000", city: "Austin", state: "TX", address: "1 Boss Way", zip: "78701", activities: [{id: 4, type:'email', subject:'TPS Reports', snippet:'Did you get the memo?', date:'2023-11-02'}] },
           { id: 402, name: "Peter Gibbons", title: "Programmer", email: "peter@initech.com", phone: "512-555-1001", city: "Austin", state: "TX", address: "3030 Morningwood Dr", zip: "78702", activities: [] },
           { id: 403, name: "Milton Waddams", title: "Collator", email: "milton@initech.com", phone: "512-555-0000", city: "Austin", state: "TX", address: "Basement B", zip: "78701", activities: [] }
         ]
       }
    ];

if (typeof window !== 'undefined') {
  window.mockContactsData = mockContactsData;
}
