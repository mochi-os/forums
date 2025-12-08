const endpoints = {
  auth: {
    login: '/login',
    signup: '/signup',
    verify: '/login/auth',
    logout: '/logout',
  },
  forums: {
    list: '/forums',
    create: '/forums/create',
    find: '/forums/find',
    new: '/forums/new',
    search: '/forums/search',
    subscribe: '/forums/subscribe',
    unsubscribe: '/forums/unsubscribe',
    membersEdit: '/forums/members/edit',
    membersSave: '/forums/members/save',
    postNew: '/forums/post/new',
    postCreate: '/forums/post/create',
    postView: '/forums/post/view',
    postVote: '/forums/post/vote',
    commentNew: '/forums/comment/new',
    commentCreate: '/forums/comment/create',
    commentVote: '/forums/comment/vote',
  },
} as const

export type Endpoints = typeof endpoints

export default endpoints
