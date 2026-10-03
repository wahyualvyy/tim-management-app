/**
 * Every Redis key used by the app. Keep all key construction here so the
 * data model stays discoverable and consistent.
 */
export const keys = {
  // Users
  user: (userId: string) => `user:${userId}`,
  userByEmail: (email: string) => `user_by_email:${email.toLowerCase()}`,
  userProjects: (userId: string) => `user:${userId}:projects`,
  userAssigned: (userId: string) => `user:${userId}:assigned`,
  userTimeLogs: (userId: string) => `user:${userId}:time_logs`,
  userNotifications: (userId: string) => `user:${userId}:notifications`,
  userUnread: (userId: string) => `user:${userId}:notifications:unread`,
  userDeadlineScan: (userId: string) => `user:${userId}:deadline_scan`,

  // Projects
  project: (projectId: string) => `project:${projectId}`,
  projectByKey: (key: string) => `project_by_key:${key.toUpperCase()}`,
  projectMembers: (projectId: string) => `project:${projectId}:members`,
  projectModules: (projectId: string) => `project:${projectId}:modules`,
  projectTasks: (projectId: string) => `project:${projectId}:tasks`,
  projectDue: (projectId: string) => `project:${projectId}:due`,
  projectStart: (projectId: string) => `project:${projectId}:start`,
  projectStats: (projectId: string) => `project:${projectId}:stats`,
  projectTaskSeq: (projectId: string) => `project:${projectId}:task_seq`,
  projectActivity: (projectId: string) => `project:${projectId}:activity`,
  projectSearch: (projectId: string) => `project:${projectId}:search`,

  // Modules
  module: (moduleId: string) => `module:${moduleId}`,
  moduleTasks: (moduleId: string) => `module:${moduleId}:tasks`,
  moduleStats: (moduleId: string) => `module:${moduleId}:stats`,

  // Tasks
  task: (taskId: string) => `task:${taskId}`,
  taskComments: (taskId: string) => `task:${taskId}:comments`,
  taskTimeLogs: (taskId: string) => `task:${taskId}:time_logs`,
  taskAttachments: (taskId: string) => `task:${taskId}:attachments`,
  taskActivity: (taskId: string) => `task:${taskId}:activity`,
  taskWatchers: (taskId: string) => `task:${taskId}:watchers`,
  taskDeadlineNotified: (taskId: string, userId: string, dueDate: string) =>
    `task:${taskId}:deadline_notified:${userId}:${dueDate}`,

  // Comments, time logs, notifications
  comment: (commentId: string) => `comment:${commentId}`,
  timeLog: (logId: string) => `time_log:${logId}`,
  notification: (notificationId: string) => `notification:${notificationId}`,

  // Timers: at most one active timer per user.
  activeTimer: (userId: string) => `timer:${userId}`,

  // Verification tokens are stored by SHA-256 hash, never in plain text.
  verification: (tokenHash: string) => `verification:${tokenHash}`,
} as const;
