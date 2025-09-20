'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

export interface UserProfile {
  id: string;
  aaid: string;
  password: string;
  createdAt: number;
}

export interface CreateProfileInput {
  aaid: string;
  password: string;
}

export interface CreateProfileResult {
  ok: boolean;
  error?: string;
  profile?: UserProfile;
}

interface GatewayContextValue {
  session: GatewaySession | null;
  profiles: UserProfile[];
  completeSignIn: (session: GatewaySession) => void;
  clearSession: () => void;
  createProfile: (input: CreateProfileInput) => CreateProfileResult;
  verifyCredentials: (aaid: string, password: string) => UserProfile | null;
}

const GatewayContext = createContext<GatewayContextValue | undefined>(undefined);

const PROFILE_STORAGE_KEY = 'dark-glass-flight-deck.profiles';

const defaultProfiles: UserProfile[] = [
  {
    id: 'profile-aaid-2045',
    aaid: 'AAID-2045',
    password: 'Frost#86',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: 'profile-aaid-3178',
    aaid: 'AAID-3178',
    password: 'Glide!221',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
];

const generateProfileId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<GatewaySession | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>(defaultProfiles);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as UserProfile[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setProfiles(parsed);
      }
    } catch (error) {
      console.warn('Failed to read stored profiles', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  const completeSignIn = useCallback((nextSession: GatewaySession) => {
    setSession(nextSession);
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
  }, []);

  const createProfile = useCallback(
    (input: CreateProfileInput): CreateProfileResult => {
      const normalizedAaid = input.aaid.trim();
      if (!normalizedAaid) {
        return { ok: false, error: 'AAID is required.' };
      }
      if (input.password.length < 6) {
        return { ok: false, error: 'Password must be at least 6 characters.' };
      }

      let outcome: CreateProfileResult = { ok: false };

      setProfiles((current) => {
        const duplicate = current.some(
          (profile) => profile.aaid.toLowerCase() === normalizedAaid.toLowerCase()
        );

        if (duplicate) {
          outcome = { ok: false, error: 'AAID already exists. Use a different identifier.' };
          return current;
        }

        const profile: UserProfile = {
          id: generateProfileId(),
          aaid: normalizedAaid,
          password: input.password,
          createdAt: Date.now(),
        };

        outcome = { ok: true, profile };
        return [...current, profile];
      });

      return outcome;
    },
    []
  );

  const verifyCredentials = useCallback(
    (aaid: string, password: string) => {
      const normalizedAaid = aaid.trim().toLowerCase();
      if (!normalizedAaid || password.length === 0) return null;

      return (
        profiles.find(
          (profile) =>
            profile.aaid.toLowerCase() === normalizedAaid && profile.password === password
        ) ?? null
      );
    },
    [profiles]
  );

  const value = useMemo(
    () => ({
      session,
      profiles,
      completeSignIn,
      clearSession,
      createProfile,
      verifyCredentials,
    }),
    [session, profiles, completeSignIn, clearSession, createProfile, verifyCredentials]
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
