'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleUserRound,
  LockKeyhole,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { DeckCard } from './DeckCard';
import { Glass } from './Glass';
import { cn } from '@/lib/utils';
import {
  ROLE_LIBRARY,
  RoleDefinition,
  RoleId,
  SignInMethod,
  GatewaySession,
  getRoleDefinition,
  useGateway,
  UserProfile,
} from '@/lib/gateway-context';

const steps = ['Authenticate', 'Select role', 'Summary'] as const;

type Step = 0 | 1 | 2;

const METHOD_LABEL = 'AAID credentials';

const solidButtonClasses =
  'focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-500/30 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50';
const ghostButtonClasses =
  'focus-ring inline-flex items-center gap-2 rounded-2xl border border-neutral-800/80 bg-neutral-900/50 px-5 py-2 text-sm text-neutral-100 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50';
const infoButtonClasses =
  'focus-ring inline-flex items-center gap-2 rounded-2xl border border-sky-500/60 bg-sky-500/10 px-5 py-2 text-sm text-sky-200 transition-transform hover:-translate-y-0.5';
const subtleLinkClasses =
  'focus-ring inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-neutral-400 transition-colors hover:text-neutral-100';
const toggleButtonBase =
  'focus-ring inline-flex items-center gap-2 rounded-2xl border border-neutral-800/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400 transition-colors hover:text-neutral-100';

export function UserGateway() {
  const reduceMotion = useReducedMotion();
  const { session, completeSignIn, clearSession, profiles, createProfile, verifyCredentials } = useGateway();
  const [step, setStep] = useState<Step>(session ? 2 : 0);
  const [selectedMethod, setSelectedMethod] = useState<SignInMethod | null>(session?.method ?? null);
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(session?.role.id ?? null);
  const [mode, setMode] = useState<'sign-in' | 'create-profile'>(profiles.length === 0 ? 'create-profile' : 'sign-in');
  const [aaidInput, setAaidInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [newAaid, setNewAaid] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [prefilledProfileId, setPrefilledProfileId] = useState<string | null>(null);
  const [credentialSummary, setCredentialSummary] = useState<{ aaid: string; passwordLength: number } | null>(
    session?.identity ? { aaid: session.identity.aaid, passwordLength: 8 } : null
  );
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (profiles.length === 0) {
      setMode('create-profile');
    }
  }, [profiles.length]);

  const roleDefinition: RoleDefinition | undefined = useMemo(
    () => (selectedRole ? getRoleDefinition(selectedRole) : undefined),
    [selectedRole]
  );

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => b.createdAt - a.createdAt),
    [profiles]
  );

  const addedFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    []
  );

  const summaryMethodTitle = selectedMethod || session?.method ? METHOD_LABEL : 'Not selected';
  const summaryRoleTitle = roleDefinition?.title ?? session?.role.title ?? 'Not selected';
  const summaryScopes = (roleDefinition ?? session?.role)?.scopes ?? [];
  const summaryAaid = credentialSummary?.aaid ?? session?.identity?.aaid ?? 'Not provided';
  const summaryPasswordMask = credentialSummary
    ? '•'.repeat(Math.max(credentialSummary.passwordLength, 4))
    : session?.identity
    ? '••••••'
    : 'Not provided';
  const canSubmitCredentials = aaidInput.trim().length > 0 && passwordInput.length >= 6;
  const canCreateProfile =
    newAaid.trim().length >= 4 && newPassword.length >= 6 && newPassword === confirmPassword;

  const handleModeChange = (nextMode: 'sign-in' | 'create-profile') => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setAnnouncement(
      nextMode === 'sign-in'
        ? 'Sign-in mode activated. Enter stored AAID credentials.'
        : 'Profile creation mode activated. Provide a new AAID and password.'
    );
  };

  const handleCredentialSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmitCredentials) {
      setAnnouncement('Enter a valid AAID and password to continue.');
      return;
    }
    if (profiles.length === 0) {
      setAnnouncement('No stored profiles found. Create a profile before signing in.');
      return;
    }

    const trimmedAaid = aaidInput.trim();
    const credentialMatch = verifyCredentials(trimmedAaid, passwordInput);

    if (!credentialMatch) {
      setAnnouncement('Credentials not recognized. Check your AAID or create a new profile.');
      return;
    }

    const passwordLength = passwordInput.length;
    setSelectedMethod('aaid-password');
    setCredentialSummary({ aaid: trimmedAaid, passwordLength });
    setAnnouncement(`Credentials validated for AAID ${trimmedAaid}. Proceed to role selection.`);
    setAaidInput(trimmedAaid);
    setPasswordInput('');
    setPrefilledProfileId(credentialMatch.id);
    setStep(1);
  };

  const handleCreateProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateProfile) {
      setAnnouncement('Enter a unique AAID and matching password to create a profile.');
      return;
    }

    const trimmedAaid = newAaid.trim();
    const result = createProfile({ aaid: trimmedAaid, password: newPassword });

    if (!result.ok || !result.profile) {
      setAnnouncement(result.error ?? 'Unable to create profile. Try again.');
      return;
    }

    setAnnouncement(`Profile ${trimmedAaid} created. Switch to sign-in to authenticate.`);
    setMode('sign-in');
    setNewAaid('');
    setNewPassword('');
    setConfirmPassword('');
    setAaidInput(trimmedAaid);
    setPasswordInput(newPassword);
    setPrefilledProfileId(result.profile.id);
  };

  const handleProfilePrefill = (profile: UserProfile) => {
    setMode('sign-in');
    setPrefilledProfileId(profile.id);
    setAaidInput(profile.aaid);
    setPasswordInput('');
    setAnnouncement(`AAID ${profile.aaid} selected. Enter password to continue.`);
  };

  const handleRoleSelect = (roleId: RoleId) => {
    const role = getRoleDefinition(roleId);
    setSelectedRole(roleId);
    setAnnouncement(`Role selected: ${role.title}.`);
  };

  const handleSummaryAdvance = () => {
    if (!selectedMethod || !selectedRole || !roleDefinition || !credentialSummary) return;
    const payload: GatewaySession = {
      method: selectedMethod,
      role: roleDefinition,
      grantedAt: Date.now(),
      identity: { aaid: credentialSummary.aaid },
    };
    completeSignIn(payload);
    setAnnouncement(`Access granted as ${roleDefinition.title} via ${METHOD_LABEL}.`);
    setStep(2);
  };

  const handleReset = () => {
    setSelectedMethod(null);
    setSelectedRole(null);
    setAaidInput('');
    setPasswordInput('');
    setNewAaid('');
    setNewPassword('');
    setConfirmPassword('');
    setPrefilledProfileId(null);
    setCredentialSummary(null);
    clearSession();
    setStep(0);
    setMode(profiles.length === 0 ? 'create-profile' : 'sign-in');
    setAnnouncement('Gateway reset. Enter AAID credentials or create a profile to begin again.');
  };

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -18 },
        transition: { duration: 0.35, ease: 'easeOut' as const },
      };

  return (
    <section aria-labelledby="user-gateway-heading" className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 id="user-gateway-heading" className="flex items-center gap-3 text-3xl font-semibold text-neutral-50">
          <Sparkles aria-hidden className="h-6 w-6 text-emerald-400" />
          User gateway
        </h1>
        <p className="max-w-2xl text-sm text-neutral-300/80">
          Progress through authentication, role configuration, and final review to unlock the Dark Glass Flight Deck. Screen reader announcements follow each transition.
        </p>
        <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.28em] text-neutral-400">
          {steps.map((label, index) => {
            const active = step === index;
            return (
              <span
                key={label}
                className={cn(
                  'rounded-2xl border border-neutral-800/80 px-4 py-1',
                  active && 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
                )}
              >
                {index + 1}. {label}
              </span>
            );
          })}
        </div>
        <div role="status" aria-live="polite" className="text-xs text-neutral-400">
          {announcement}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step-auth"
            className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
            {...motionProps}
          >
            <Glass ariaLabel="AAID credential management" className="flex flex-col gap-6 p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <span className="inline-flex w-fit items-center gap-2 rounded-2xl border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/80">
                    {mode === 'sign-in' ? (
                      <LockKeyhole aria-hidden className="h-3.5 w-3.5" />
                    ) : (
                      <UserPlus aria-hidden className="h-3.5 w-3.5" />
                    )}
                    {mode === 'sign-in' ? 'Secure access' : 'New profile'}
                  </span>
                  <h2 className="text-2xl font-semibold text-neutral-50">
                    {mode === 'sign-in' ? 'Sign in with AAID' : 'Create an AAID profile'}
                  </h2>
                  <p className="max-w-xl text-sm text-neutral-300/80">
                    {mode === 'sign-in'
                      ? 'Enter your Airport Associate ID and password to continue to role assignment. Credentials are validated against stored profiles.'
                      : 'Save a new Airport Associate ID and password to your local flight deck profile directory. Profiles are stored in-browser for this simulation.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleModeChange('sign-in')}
                    className={cn(toggleButtonBase, mode === 'sign-in' && 'border-sky-500/60 bg-sky-500/10 text-sky-200')}
                    aria-pressed={mode === 'sign-in'}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange('create-profile')}
                    className={cn(
                      toggleButtonBase,
                      mode === 'create-profile' && 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                    )}
                    aria-pressed={mode === 'create-profile'}
                  >
                    Create profile
                  </button>
                </div>
              </div>

              {mode === 'sign-in' ? (
                <form className="flex flex-col gap-6" onSubmit={handleCredentialSubmit}>
                  <div className="grid gap-4">
                    <label className="grid gap-2 text-sm text-neutral-300/80" htmlFor="aaid">
                      AAID
                      <div className="relative">
                        <CircleUserRound aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
                        <input
                          id="aaid"
                          name="aaid"
                          type="text"
                          required
                          minLength={4}
                          value={aaidInput}
                          onChange={(event) => {
                            setAaidInput(event.target.value);
                            setPrefilledProfileId(null);
                          }}
                          placeholder="AAID-2045"
                          autoComplete="username"
                          className="w-full rounded-2xl border border-neutral-800/80 bg-neutral-900/60 px-4 py-3 pl-10 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                        />
                      </div>
                    </label>
                    <label className="grid gap-2 text-sm text-neutral-300/80" htmlFor="password">
                      Password
                      <div className="relative">
                        <LockKeyhole aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                        <input
                          id="password"
                          name="password"
                          type="password"
                          required
                          minLength={6}
                          value={passwordInput}
                          onChange={(event) => setPasswordInput(event.target.value)}
                          placeholder="Enter your password"
                          aria-describedby="password-hint"
                          autoComplete="current-password"
                          className="w-full rounded-2xl border border-neutral-800/80 bg-neutral-900/60 px-4 py-3 pl-10 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                        />
                      </div>
                      <span id="password-hint" className="text-xs text-neutral-500">
                        Use your AAID network password. Minimum 6 characters.
                      </span>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className="text-xs text-neutral-400">
                      Need help? Contact{' '}
                      <a
                        href="mailto:ops-support@deice.local"
                        className="focus-ring underline decoration-dotted underline-offset-4"
                      >
                        Ops support
                      </a>{' '}
                      for resets.
                    </span>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="submit"
                        className={solidButtonClasses}
                        disabled={!canSubmitCredentials || profiles.length === 0}
                      >
                        Continue
                        <ArrowRight aria-hidden className="h-4 w-4" />
                      </button>
                      {profiles.length === 0 && (
                        <span className="text-xs text-amber-400/80">Add a profile to enable sign-in.</span>
                      )}
                    </div>
                  </div>
                </form>
              ) : (
                <form className="flex flex-col gap-6" onSubmit={handleCreateProfile}>
                  <div className="grid gap-4">
                    <label className="grid gap-2 text-sm text-neutral-300/80" htmlFor="new-aaid">
                      AAID
                      <div className="relative">
                        <CircleUserRound aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                        <input
                          id="new-aaid"
                          name="new-aaid"
                          type="text"
                          required
                          minLength={4}
                          value={newAaid}
                          onChange={(event) => setNewAaid(event.target.value.toUpperCase())}
                          placeholder="AAID-4098"
                          autoComplete="off"
                          className="w-full rounded-2xl border border-neutral-800/80 bg-neutral-900/60 px-4 py-3 pl-10 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                        />
                      </div>
                    </label>
                    <label className="grid gap-2 text-sm text-neutral-300/80" htmlFor="new-password">
                      Password
                      <div className="relative">
                        <LockKeyhole aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                        <input
                          id="new-password"
                          name="new-password"
                          type="password"
                          required
                          minLength={6}
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          placeholder="Set a password"
                          aria-describedby="password-create-hint"
                          autoComplete="new-password"
                          className="w-full rounded-2xl border border-neutral-800/80 bg-neutral-900/60 px-4 py-3 pl-10 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                        />
                      </div>
                    </label>
                    <label className="grid gap-2 text-sm text-neutral-300/80" htmlFor="confirm-password">
                      Confirm password
                      <div className="relative">
                        <LockKeyhole aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
                        <input
                          id="confirm-password"
                          name="confirm-password"
                          type="password"
                          required
                          minLength={6}
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Repeat password"
                          aria-describedby="password-create-hint"
                          autoComplete="new-password"
                          className="w-full rounded-2xl border border-neutral-800/80 bg-neutral-900/60 px-4 py-3 pl-10 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                        />
                      </div>
                    </label>
                    <span id="password-create-hint" className="text-xs text-neutral-500">
                      AAIDs must be unique. Passwords require at least 6 characters and must match.
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className="text-xs text-neutral-400">
                      Profiles stay on this device for training and can be removed by clearing browser storage.
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setNewAaid('');
                          setNewPassword('');
                          setConfirmPassword('');
                          handleModeChange('sign-in');
                        }}
                        className={ghostButtonClasses}
                      >
                        Cancel
                      </button>
                      <button type="submit" className={solidButtonClasses} disabled={!canCreateProfile}>
                        Save profile
                        <UserPlus aria-hidden className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </Glass>

            <Glass ariaLabel="Stored AAID profiles" className="flex flex-col gap-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400">
                    <Users aria-hidden className="h-4 w-4 text-sky-400" />
                    Stored profiles
                  </div>
                  <h2 className="text-lg font-semibold text-neutral-100">AAID directory</h2>
                </div>
                <span className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 px-3 py-1 text-xs text-neutral-400">
                  {sortedProfiles.length} total
                </span>
              </div>
              {sortedProfiles.length > 0 ? (
                <ul className="grid gap-3" role="list">
                  {sortedProfiles.map((profile) => (
                    <li key={profile.id} role="listitem">
                      <button
                        type="button"
                        onClick={() => handleProfilePrefill(profile)}
                        className={cn(
                          'focus-ring flex w-full items-center justify-between gap-4 rounded-2xl border border-neutral-800/80 bg-neutral-900/60 px-4 py-3 text-left transition-colors hover:border-sky-500/60 hover:bg-neutral-900/40',
                          prefilledProfileId === profile.id && 'border-sky-500/70 bg-sky-500/10 text-sky-100'
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <CircleUserRound
                            aria-hidden
                            className={cn(
                              'h-5 w-5 text-sky-300',
                              prefilledProfileId === profile.id && 'text-sky-200'
                            )}
                          />
                          <span className="flex flex-col">
                            <span className="text-sm font-semibold text-neutral-100">{profile.aaid}</span>
                            <span className="text-xs text-neutral-400">
                              Added {addedFormatter.format(profile.createdAt)}
                            </span>
                          </span>
                        </span>
                        <span className="text-xs text-sky-200">Prefill →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-300/80">
                  No profiles stored yet. Create a profile to enable AAID authentication.
                </p>
              )}
              <p className="text-xs text-neutral-500">
                Profile data is saved in local storage for this simulation and never leaves your browser.
              </p>
            </Glass>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step-role" className="flex flex-col gap-6" {...motionProps}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-neutral-100">Select your operational role</h2>
              <button type="button" onClick={() => setStep(0)} className={ghostButtonClasses}>
                <ArrowLeft aria-hidden className="h-4 w-4" />
                Sign-in method
              </button>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {ROLE_LIBRARY.map((roleOption) => {
                const active = selectedRole === roleOption.id;
                return (
                  <DeckCard
                    key={roleOption.id}
                    interactive
                    hoverLift
                    ariaLabel={`${roleOption.title} role option`}
                    onClick={() => handleRoleSelect(roleOption.id)}
                    title={roleOption.title}
                    description={roleOption.subtitle}
                    eyebrow="Role access"
                    tone="emerald"
                    className={cn('cursor-pointer transition-all', active && 'ring-2 ring-emerald-500/60')}
                    actions={
                      active ? (
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
                          <BadgeCheck aria-hidden className="h-4 w-4" />
                          Selected
                        </span>
                      ) : undefined
                    }
                  >
                    <ul className="mt-auto grid gap-2 text-xs text-neutral-300/80">
                      {roleOption.scopes.map((scope) => (
                        <li key={scope} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                          {scope}
                        </li>
                      ))}
                    </ul>
                  </DeckCard>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-4">
              <button type="button" onClick={() => setStep(0)} className={subtleLinkClasses}>
                <ArrowLeft aria-hidden className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedRole || !selectedMethod || !credentialSummary}
                className={solidButtonClasses}
              >
                Continue to summary
                <ArrowRight aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step-summary" className="flex flex-col gap-6" {...motionProps}>
            <Glass ariaLabel="Summary" className="flex flex-col gap-6 p-8">
              <h2 className="text-2xl font-semibold text-neutral-50">Access summary</h2>
              <dl className="grid gap-4 text-sm text-neutral-300/80">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-[0.3em] text-neutral-500">Method</dt>
                  <dd>{summaryMethodTitle}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-[0.3em] text-neutral-500">AAID</dt>
                  <dd>{summaryAaid}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-[0.3em] text-neutral-500">Password</dt>
                  <dd>{summaryPasswordMask}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-[0.3em] text-neutral-500">Role</dt>
                  <dd>{summaryRoleTitle}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-[0.3em] text-neutral-500">Scopes</dt>
                  <dd>
                    <ul className="grid gap-1 text-xs">
                      {summaryScopes.map((scope) => (
                        <li key={scope} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                          {scope}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSummaryAdvance}
                  disabled={!selectedMethod || !selectedRole || !credentialSummary}
                  className={solidButtonClasses}
                >
                  Confirm access
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </button>
                <button type="button" onClick={handleReset} className={ghostButtonClasses}>
                  Reset
                </button>
                <Link href="/" className={infoButtonClasses}>
                  View index modules
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              </div>
              {session && (
                <p className="text-xs text-neutral-500">
                  Active session: {session.role.title} via {METHOD_LABEL}
                  {session.identity?.aaid ? ` · ${session.identity.aaid}` : ''} · refreshed{' '}
                  {new Intl.DateTimeFormat('en', {
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(session.grantedAt)}
                </p>
              )}
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

