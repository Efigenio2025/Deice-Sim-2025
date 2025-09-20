import employeeDirectory from "../data/employees.json";

/**
 * Employee profile data is kept in data/employees.json so operations can update
 * access and dashboard details without touching the application code. This
 * module exposes helper utilities that the rest of the app consumes.
 */

export const EMPLOYEE_PROFILES = employeeDirectory;

export const EMPLOYEE_IDS = Object.keys(EMPLOYEE_PROFILES);

export function getEmployeeProfile(employeeId) {
  return EMPLOYEE_PROFILES[employeeId] ?? null;
}

export function isAllowedEmployeeId(employeeId) {
  return Object.prototype.hasOwnProperty.call(EMPLOYEE_PROFILES, employeeId);
}

export function normalizeEmployeeId(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\D+/g, "").trim();
}
