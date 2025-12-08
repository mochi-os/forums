export interface ForumAuthor {
  name: string
  role?: string
  avatar?: string
}

export interface ForumComment {
  id: string
  author: ForumAuthor
  postedAt: string
  content: string
  isAnswer?: boolean
  upvotes?: number
  downvotes?: number
}

export interface ForumThread {
  id: string
  category: string
  title: string
  excerpt: string
  content: string
  author: ForumAuthor
  postedAt: string
  editedBy?: ForumAuthor
  tags: string[]
  status: 'open' | 'resolved' | 'announcement'
  replyCount: number
  viewCount: number
  participants: number
  watchers: number
  lastActivity: string
  pinned?: boolean
  comments: ForumComment[]
  memberPermission?: string
  allowSearch?: boolean
}

export const forumThreads: ForumThread[] = [
  {
    id: 't1',
    category: 'General Discussion',
    title: 'Tips for optimizing renders inside Studio',
    excerpt:
      'I have been experimenting with the new GI controls. Sharing what worked for me and curious to hear how others approach heavy scenes.',
    content:
      'Spent the weekend profiling a few hero scenes and noticed GI bounces spike once the scene exceeds ~180 lights. Pinning a skylight and switching to the adaptive denoiser got render time down 35%. Below is the sequence I landed on that still keeps reflections sharp.',
    author: {
      name: 'Pixelwave',
      role: 'Environment Lead',
    },
    postedAt: 'Today · 09:10',
    editedBy: {
      name: 'Community Team',
      role: 'Moderator',
    },
    tags: ['rendering', 'workflow'],
    status: 'open',
    replyCount: 3,
    viewCount: 420,
    participants: 12,
    watchers: 38,
    lastActivity: '35m ago',
    comments: [
      {
        id: 't1-c1',
        author: {
          name: 'Pixelwave',
          role: 'Environment Lead',
        },
        postedAt: '35m ago',
        content:
          'Pin a single skylight per zone, lock exposure, then switch GI to adaptive on the second bounce. I also added a rule inside the render manager that pauses background caching if the GPU memory touches 85%—that keeps the viewport responsive.',
        upvotes: 5,
        downvotes: 0,
      },
      {
        id: 't1-c2',
        author: {
          name: 'June Park',
          role: 'Lighting',
        },
        postedAt: '22m ago',
        content:
          'Co-sign the adaptive switch. We paired it with 0.65 intensity on reflection probes and it shaved ~9 seconds for our campus scene.',
        upvotes: 3,
        downvotes: 0,
      },
      {
        id: 't1-c3',
        author: {
          name: 'Luna Rivera',
          role: 'Visual Designer',
        },
        postedAt: '10m ago',
        content:
          'Adding for folks doing cinematic passes: enabling temporal accumulation before exporting frames kept noise predictable even with the adaptive bounces.',
        isAnswer: true,
        upvotes: 4,
        downvotes: 1,
      },
    ],
  },
  {
    id: 't2',
    category: 'How To',
    title: 'Walkthrough: building a collaborative mood board',
    excerpt:
      'Documenting the steps I use for assembling assets with the new board component. Includes a checklist template for teams.',
    content:
      'Outlined every step for how our design pods build boards for sprints. Covers setting up permissions, auto-tagging via asset metadata, and syncing comments into tasks.',
    author: {
      name: 'Studio Lab',
      role: 'Design Ops',
    },
    postedAt: 'Today · 08:00',
    editedBy: {
      name: 'Design Ops',
      role: 'Moderator',
    },
    tags: ['guide', 'templates'],
    status: 'resolved',
    replyCount: 2,
    viewCount: 188,
    participants: 6,
    watchers: 25,
    lastActivity: '1h ago',
    comments: [
      {
        id: 't2-c1',
        author: {
          name: 'Studio Lab',
          role: 'Design Ops',
        },
        postedAt: '1h ago',
        content:
          "Here's the checklist template: kick off with a blank board, drop in palette swatches, assign owners, and archive the board when the sprint closes. Keeps things tidy.",
        upvotes: 6,
        downvotes: 0,
      },
      {
        id: 't2-c2',
        author: {
          name: 'Avery Holt',
          role: 'Product',
        },
        postedAt: '45m ago',
        content:
          'We used the template this morning. The auto-tagging worked, though we had to rename the assets for better grouping. Minor tweak but worth noting.',
        upvotes: 2,
        downvotes: 0,
      },
    ],
  },
  {
    id: 't3',
    category: 'Show & Tell',
    title: 'Minimalist architecture scene breakdown',
    excerpt:
      'Posting the layers and passes I used for the contest entry. Download link is included for anyone that wants to remix.',
    content:
      'Attached my layer stack plus render passes. The trickiest part was balancing glass reflections with interior lighting, so I split them into separate render passes and recomposited.',
    author: {
      name: 'Luna Rivera',
      role: '3D Artist',
    },
    postedAt: 'Yesterday · 18:30',
    editedBy: {
      name: 'Pixelwave',
      role: 'Environment Lead',
    },
    tags: ['case-study', 'assets'],
    status: 'open',
    replyCount: 1,
    viewCount: 96,
    participants: 5,
    watchers: 18,
    lastActivity: '2h ago',
    pinned: true,
    comments: [
      {
        id: 't3-c1',
        author: {
          name: 'Luna Rivera',
          role: '3D Artist',
        },
        postedAt: '2h ago',
        content:
          'If you download the file, check the render layer names—they map to the compositing template in the doc. Happy to answer questions about the lighting rig.',
        upvotes: 7,
        downvotes: 0,
      },
    ],
  },
  {
    id: 't4',
    category: 'Support',
    title: 'Any fix for the viewport flicker on RTX hardware?',
    excerpt:
      'Seeing random flickers whenever depth of field is enabled. It only started with the latest beta build.',
    content:
      'Running driver 552.31 on dual RTX 5000s. The flicker only appears when DOF is toggled on and the camera F-stop drops under 2.4. I attached the render log and can capture a repro if anyone from the engine team needs it before I roll back.',
    author: {
      name: '3D Object',
      role: 'Pipeline Tech',
    },
    postedAt: 'Yesterday · 23:15',
    tags: ['bug', 'beta'],
    status: 'open',
    replyCount: 0,
    viewCount: 58,
    participants: 1,
    watchers: 12,
    lastActivity: '3h ago',
    comments: [],
  },
  {
    id: 't5',
    category: 'Announcements',
    title: 'Forum maintenance window this weekend',
    excerpt:
      'We are migrating the realtime layer for better reliability. Expect intermittent outages on Saturday 10:00 - 11:00 UTC.',
    content:
      'Downtime impacts live typing indicators and notifications only. Feel free to keep drafting posts—everything queues and syncs again once the window closes.',
    author: {
      name: 'Community Team',
      role: 'Admin',
    },
    postedAt: 'Today · 07:15',
    editedBy: {
      name: 'Community Team',
      role: 'Admin',
    },
    tags: ['announcement'],
    status: 'announcement',
    replyCount: 1,
    viewCount: 302,
    participants: 4,
    watchers: 41,
    lastActivity: '6h ago',
    pinned: true,
    comments: [
      {
        id: 't5-c1',
        author: {
          name: 'Community Team',
          role: 'Admin',
        },
        postedAt: '6h ago',
        content:
          'We will post in #status once the migration completes. No action required on your end.',
        upvotes: 1,
        downvotes: 0,
      },
    ],
  },
]

export function findThreadById(threadId: string) {
  return forumThreads.find((thread) => thread.id === threadId)
}
