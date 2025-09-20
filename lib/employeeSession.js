const STORAGE_KEY = 'trainer.employeeId';

function safeStorage(fn) {
  if (typeof window === 'undefined') return null;
  try {
    return fn(window.sessionStorage, window.localStorage);
  } catch (error) {
    console.warn('Storage access error', error);
    return null;
  }
}

export function storeEmployeeId(employeeId) {
  safeStorage((session, local) => {
    session.setItem(STORAGE_KEY, employeeId);
    local.setItem(STORAGE_KEY, employeeId);
  });
}

export function getStoredEmployeeId() {
  return safeStorage((session, local) => {
    return session.getItem(STORAGE_KEY) || local.getItem(STORAGE_KEY);
  });
}

export function clearStoredEmployeeId() {
  safeStorage((session, local) => {
    session.removeItem(STORAGE_KEY);
    local.removeItem(STORAGE_KEY);
  });
}

export function getStorageKey() {
  return STORAGE_KEY;
}
