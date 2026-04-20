export const chatUtilityViews = [
  { id: 'stream', label: 'Stream', description: 'All work channels and direct messages' },
  { id: 'unread', label: 'Unread', description: 'Seeded unread activity' },
  { id: 'mentions', label: 'Mentions', description: 'Seeded people mentions' },
];

export const generalChannel = {
  id: 'general',
  type: 'general',
  title: 'General',
  subtitle: 'Team-wide delivery notes',
  unreadCount: 1,
  mentionCount: 0,
  participants: ['Marc Pitre', 'Sherri Miles', 'Arthur Chen', 'Andres Rivera'],
  messages: [
    {
      id: 'general-1',
      author: 'Sherri Miles',
      timestamp: '8:44 AM',
      sortAt: 202604200844,
      body: 'I am keeping the client update queue tight today. Acme gets one recap after QA, Northstar gets the scope note after lunch.',
      isUnread: false,
      hasMention: false,
    },
    {
      id: 'general-2',
      author: 'Andres Rivera',
      timestamp: '9:02 AM',
      sortAt: 202604200902,
      body: 'Please keep any Chat reset notes in [[Net Net V2 Chat Reset]] so Arthur can pick up the next pack without reconstructing context.',
      isUnread: true,
      hasMention: false,
    },
  ],
};

export const jobChannels = {
  active: [
    {
      id: 'job-acme-growth',
      type: 'job',
      status: 'active',
      title: 'Acme Growth Retainer',
      client: 'Acme',
      subtitle: 'April cycle: landing page QA and paid launch',
      unreadCount: 2,
      mentionCount: 1,
      participants: ['Marc Pitre', 'Sherri Miles', 'Arthur Chen', 'Lena Park'],
      messages: [
        {
          id: 'acme-1',
          author: 'Arthur Chen',
          timestamp: '9:31 AM',
          sortAt: 202604200931,
          body: 'Landing page QA is down to analytics naming and the mobile testimonial placement. I moved both into [[Acme Growth Retainer]].',
          isUnread: true,
          hasMention: false,
        },
        {
          id: 'acme-2',
          author: 'Lena Park',
          timestamp: '10:42 AM',
          sortAt: 202604201042,
          body: '@Sherri the proof looks good from our side. Please send the final preview link once QA signs off.',
          isUnread: true,
          hasMention: true,
        },
      ],
    },
    {
      id: 'job-northstar-site',
      type: 'job',
      status: 'active',
      title: 'Northstar Site Refresh',
      client: 'Northstar',
      subtitle: 'Homepage revisions and launch readiness',
      unreadCount: 0,
      mentionCount: 0,
      participants: ['Marc Pitre', 'Arthur Chen', 'Priya Shah'],
      messages: [
        {
          id: 'northstar-1',
          author: 'Priya Shah',
          timestamp: '9:48 AM',
          sortAt: 202604200948,
          body: 'I am waiting on the revised hero copy before I update the staging page. The current proof still has the old positioning line.',
          isUnread: false,
          hasMention: false,
        },
      ],
    },
  ],
  pending: [
    {
      id: 'job-cobalt-onboarding',
      type: 'job',
      status: 'pending',
      title: 'Cobalt Onboarding',
      client: 'Cobalt',
      subtitle: 'Waiting on signed scope',
      unreadCount: 0,
      mentionCount: 0,
      participants: ['Marc Pitre', 'Sherri Miles'],
      messages: [
        {
          id: 'cobalt-1',
          author: 'Sherri Miles',
          timestamp: 'Yesterday',
          sortAt: 202604191530,
          body: 'Cobalt asked for the onboarding calendar before signature. I am sending the high-level version only.',
          isUnread: false,
          hasMention: false,
        },
      ],
    },
  ],
  completed: [
    {
      id: 'job-brand-system',
      type: 'job',
      status: 'completed',
      title: 'Internal Brand System',
      client: 'Net Net',
      subtitle: 'Completed internal system work',
      unreadCount: 0,
      mentionCount: 0,
      participants: ['Marc Pitre', 'Andres Rivera', 'Arthur Chen'],
      messages: [
        {
          id: 'brand-system-1',
          author: 'Andres Rivera',
          timestamp: 'Fri',
          sortAt: 202604171615,
          body: 'Final archive is clean. The only remaining note is to reuse the naming rules in future Net Net section work.',
          isUnread: false,
          hasMention: false,
        },
      ],
    },
  ],
};

export const directMessages = [
  {
    id: 'dm-sherri',
    type: 'direct',
    title: 'Sherri Miles',
    subtitle: 'Account lead follow-up',
    unreadCount: 0,
    mentionCount: 0,
    participants: ['Marc Pitre', 'Sherri Miles'],
    messages: [
      {
        id: 'dm-sherri-1',
        author: 'Sherri Miles',
        timestamp: '8:12 AM',
        sortAt: 202604200812,
        body: 'I am packaging Acme QA into one client update instead of sending them a trail of small comments.',
        isUnread: false,
        hasMention: false,
      },
    ],
  },
  {
    id: 'dm-arthur',
    type: 'direct',
    title: 'Arthur Chen',
    subtitle: 'Design system coordination',
    unreadCount: 1,
    mentionCount: 0,
    participants: ['Marc Pitre', 'Arthur Chen'],
    messages: [
      {
        id: 'dm-arthur-1',
        author: 'Arthur Chen',
        timestamp: '10:08 AM',
        sortAt: 202604201008,
        body: 'I can simplify the Chat screen today. The big win is removing the dashboard rails and making Stream feel like the real home.',
        isUnread: true,
        hasMention: false,
      },
    ],
  },
];

export const defaultChatLocation = { type: 'utility', id: 'stream' };
