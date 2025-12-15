const endpoints = {
  forums: {
    list: '/list',
    create: '/create',
    find: '/find',
    new: '/new',
    search: '/search',
    subscribe: '/subscribe',
    unsubscribe: '/unsubscribe',
    membersEdit: '/members/edit',
    membersSave: '/members/save',
    postNew: '/post/new',
    postCreate: '/post/create',
    postView: '/post/view',
    postVote: '/post/vote',
    commentNew: '/comment/new',
    commentCreate: '/comment/create',
    commentVote: '/comment/vote',
  },
} as const

export type Endpoints = typeof endpoints

export default endpoints
