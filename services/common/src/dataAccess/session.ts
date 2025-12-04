import SessionManager from './SessionManager.js';
import SessionTasks from './SessionTasks.js';

let sessionManagerInstance: SessionManager | null = null;
let sessionTasksInstance: SessionTasks | null = null;

/**
 * Get the singleton SessionManager instance
 * @returns SessionManager instance
 */
export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

export function getSessionTasks(): SessionTasks {
  if (!sessionTasksInstance) {
    sessionTasksInstance = new SessionTasks( getSessionManager() );
  }
  return sessionTasksInstance;
}