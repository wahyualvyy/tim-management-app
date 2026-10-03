/**
 * Every Redis key the app uses. Keys are only ever built here, so the data
 * model stays discoverable and a typo cannot create a stray key.
 */
export const keys = {
  // Users and lookup indexes
  user: (userId: string) => `user:${userId}`,
  users: () => `users`,
  /** Lex index "{term}|{userId}" over name words, username and email, for user search. */
  usersSearch: () => `users:search`,
  userOpenTasks: (userId: string) => `user:${userId}:open`,
  userOpenDue: (userId: string) => `user:${userId}:open_due`,
  userDoneTasks: (userId: string) => `user:${userId}:done`,
  userByEmail: (email: string) => `user_by_email:${email.toLowerCase()}`,
  userByUsername: (username: string) => `user_by_username:${username.toLowerCase()}`,
  userByAccount: (provider: string, accountId: string) => `user_by_account:${provider}:${accountId}`,
  userProjects: (userId: string) => `user:${userId}:projects`,
  userTasks: (userId: string) => `user:${userId}:tasks`,
  userTimeLogs: (userId: string) => `user:${userId}:timelogs`,
  userNotifications: (userId: string) => `user:${userId}:notifications`,
  userUnread: (userId: string) => `user:${userId}:notifications:unread`,
  userDeadlineScan: (userId: string) => `user:${userId}:deadline_scan`,
  userTimer: (userId: string) => `user:${userId}:timer`,

  // Projects
  project: (projectId: string) => `project:${projectId}`,
  projectByKey: (key: string) => `project_by_key:${key.toUpperCase()}`,
  projectMembers: (projectId: string) => `project:${projectId}:members`,
  /** Lex index "{name}|{userId}" for alphabetical member pages. */
  projectMemberNames: (projectId: string) => `project:${projectId}:member_names`,
  projectMembersByRole: (projectId: string, role: string) => `project:${projectId}:members:${role}`,
  projectMemberJoined: (projectId: string) => `project:${projectId}:member_joined`,
  /** Lex index "{term}|{userId}" for member search. */
  projectMemberSearch: (projectId: string) => `project:${projectId}:member_search`,
  /** Tasks in a board column, scored by board position. */
  projectStatus: (projectId: string, status: string) => `project:${projectId}:status:${status}`,
  /** Not-done tasks with a due date, scored by due date (overdue counts and attention lists). */
  projectOpenDue: (projectId: string) => `project:${projectId}:open_due`,
  projectModules: (projectId: string) => `project:${projectId}:modules`,
  projectTasks: (projectId: string) => `project:${projectId}:tasks`,
  projectDue: (projectId: string) => `project:${projectId}:due`,
  projectStart: (projectId: string) => `project:${projectId}:start`,
  projectStats: (projectId: string) => `project:${projectId}:stats`,
  projectTime: (projectId: string) => `project:${projectId}:time`,
  projectTaskSeq: (projectId: string) => `project:${projectId}:task_seq`,
  projectActivities: (projectId: string) => `project:${projectId}:activities`,
  /** Lex index "{term}|{kind}:{id}" over modules, sub modules and tasks. */
  projectSearch: (projectId: string) => `project:${projectId}:search_terms`,
  /** Hash used by the first Redis version; removed by the index rebuild. */
  legacyProjectSearch: (projectId: string) => `project:${projectId}:search`,

  // Modules
  module: (moduleId: string) => `module:${moduleId}`,
  moduleSubModules: (moduleId: string) => `module:${moduleId}:submodules`,
  moduleTasks: (moduleId: string) => `module:${moduleId}:tasks`,
  /** Tasks placed directly under the module (no sub module). */
  moduleDirectTasks: (moduleId: string) => `module:${moduleId}:direct`,
  moduleStats: (moduleId: string) => `module:${moduleId}:stats`,
  moduleTime: (moduleId: string) => `module:${moduleId}:time`,

  // Sub modules
  subModule: (subModuleId: string) => `submodule:${subModuleId}`,
  subModuleTasks: (subModuleId: string) => `submodule:${subModuleId}:tasks`,
  subModuleStats: (subModuleId: string) => `submodule:${subModuleId}:stats`,
  subModuleTime: (subModuleId: string) => `submodule:${subModuleId}:time`,

  // Tasks
  task: (taskId: string) => `task:${taskId}`,
  taskComments: (taskId: string) => `task:${taskId}:comments`,
  taskTimeLogs: (taskId: string) => `task:${taskId}:timelogs`,
  taskTime: (taskId: string) => `task:${taskId}:time`,
  taskAttachments: (taskId: string) => `task:${taskId}:attachments`,
  taskActivities: (taskId: string) => `task:${taskId}:activities`,
  taskWatchers: (taskId: string) => `task:${taskId}:watchers`,
  taskTimers: (taskId: string) => `task:${taskId}:timers`,
  taskDeadlineNotified: (taskId: string, userId: string, dueDate: string) =>
    `task:${taskId}:deadline_notified:${userId}:${dueDate}`,

  // Records referenced from the indexes above
  comment: (commentId: string) => `comment:${commentId}`,
  timeLog: (logId: string) => `timelog:${logId}`,
  notification: (notificationId: string) => `notification:${notificationId}`,

  // Verification tokens are stored by SHA-256 hash, never in plain text.
  verification: (tokenHash: string) => `verification:${tokenHash}`,
} as const;
