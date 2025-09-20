'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type SignInMethod = 'aaid-password';

export type RoleId = 'ramp-agent' | 'trainer' | 'shift-manager' | 'gm';

export interface RoleDefinition {
  id: RoleId;
  title: string;
  subtitle: string;
  scopes: string[];
}

export interface GatewaySession {
  method: SignInMethod;
  role: RoleDefinition;
  grantedAt: number;
  identity?: {
    aaid: string;
  };
}

interface GatewayContextValue {
  session: GatewaySession | null;
  completeSignIn: (session: GatewaySession) => void;
  clearSession: () => void;
}

const GatewayContext = createContext<GatewayContextValue | undefined>(undefined);

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<GatewaySession | null>(null);

  const completeSignIn = useCallback((nextSession: GatewaySession) => {
    setSession(nextSession);
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      completeSignIn,
      clearSession,
    }),
    [session, completeSignIn, clearSession]
  );

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway() {
  const context = useContext(GatewayContext);
  if (!context) {
    throw new Error('useGateway must be used within a GatewayProvider');
  }
  return context;
}

export const ROLE_LIBRARY: RoleDefinition[] = [
  {
    id: 'ramp-agent',
    title: 'Ramp Agent',
    subtitle: 'Turn readiness, vehicle dispatch, and on-wing status.',
    scopes: ['Ramp operations', 'Vehicle telemetry', 'Ice detection alerts'],
  },
  {
    id: 'trainer',
    title: 'Trainer',
    subtitle: 'Scenario authoring, proficiency tracking, and coaching tools.',
    scopes: ['Curriculum designer', 'Session playback', 'Competency analytics'],
  },
  {
    id: 'shift-manager',
    title: 'Shift Manager',
    subtitle: 'Crew accountability and throughput orchestration.',
    scopes: ['Crew manifest', 'Gantt orchestration', 'Safety compliance'],
  },
  {
    id: 'gm',
    title: 'General Manager (GM)',
    subtitle: 'Portfolio insight for executive decision cadence.',
    scopes: ['Strategic KPIs', 'Budget oversight', 'Stakeholder briefs'],
  },
];

export function getRoleDefinition(roleId: RoleId): RoleDefinition {
  const role = ROLE_LIBRARY.find((entry) => entry.id === roleId);
  if (!role) {
    throw new Error(`Unknown role: ${roleId}`);
  }
  return role;
}
