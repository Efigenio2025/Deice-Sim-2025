'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Eye,
  MailCheck,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
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
} from '@/lib/gateway-context';

type Accent = 'emerald' | 'sky' | 'amber';

interface MethodOption {
  id: SignInMethod;
  title: string;
  subtitle: string;
  detail: string;
  accent: Accent;
  icon: LucideIcon;
}

const methodOptions: MethodOption[] = [
  {
    id: 'azure-ad',
    title: 'Azure AD SSO',
    subtitle: 'Corporate identity · MFA enforced',
    detail: 'Instant federation with the airport tenant. Scopes inherit Azure entitlements automatically.',
    accent: 'sky',
    icon: ShieldCheck,
  },
  {
    id: 'email-otp',
    title: 'Email OTP',
    subtitle: 'Time-boxed · 6 digit code',
    detail: 'Leverage a one-time passcode delivered to your ramp mailbox. Sessions expire after 12 hours.',
    accent: 'emerald',
    icon: MailCheck,
  },
  {
    id: 'guest',
    title: 'Guest observation',
    subtitle: 'View only · 24h scope',
    detail: 'Preview sanitized modules without authentication. Shift-altering actions remain locked.',
    accent: 'amber',
    icon: Eye,
  },
];

const accentRing: Record<Accent, string> = {
  emerald: 'ring-2 ring-emerald-500/60',
  sky: 'ring-2 ring-sky-500/60',
  amber: 'ring-2 ring-amber-500/60',
};

const steps = ['Authenticate', 'Select role', 'Summary'] as const;

type Step = 0 | 1 | 2;

const solidButtonClasses =
  'focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-500/30 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50';
const ghostButtonClasses =
  'focus-ring inline-flex items-center gap-2 rounded-2xl border border-neutral-800/80 bg-neutral-900/50 px-5 py-2 text-sm text-neutral-100 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50';
const infoButtonClasses =
  'focus-ring inline-flex items-center gap-2 rounded-2xl border border-sky-500/60 bg-sky-500/10 px-5 py-2 text-sm text-sky-200 transition-transform hover:-translate-y-0.5';
const subtleLinkClasses =
  'focus-ring inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-neutral-400 transition-colors hover:text-neutral-100';

export function UserGateway() {
  const reduceMotion = useReducedMotion();
  const { session, completeSignIn, clearSession } = useGateway();
  const [step, setStep] = useState<Step>(session ? 2 : 0);
  const [selectedMethod, setSelectedMethod] = useState<SignInMethod | null>(session?.method ?? null);
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(session?.role.id ?? null);
  const [announcement, setAnnouncement] = useState('');

  const roleDefinition: RoleDefinition | undefined = useMemo(
    () => (selectedRole ? getRoleDefinition(selectedRole) : undefined),
    [selectedRole]
  );

  const summaryMethodTitle = selectedMethod
    ? methodOptions.find((option) => option.id === selectedMethod)?.title ?? selectedMethod
    : session
    ? methodOptions.find((option) => option.id === session.method)?.title ?? session.method
    : 'Not selected';
  const summaryRoleTitle = roleDefinition?.title ?? session?.role.title ?? 'Not selected';
  const summaryScopes = (roleDefinition ?? session?.role)?.scopes ?? [];

  const handleMethodSelect = (method: SignInMethod) => {
    const option = methodOptions.find((entry) => entry.id === method);
    setSelectedMethod(method);
    setStep(1);
    setAnnouncement(`Authentication method selected: ${option?.title ?? method}.`);
  };

  const handleRoleSelect = (roleId: RoleId) => {
    const role = getRoleDefinition(roleId);
    setSelectedRole(roleId);
    setAnnouncement(`Role selected: ${role.title}.`);
  };

  const handleSummaryAdvance = () => {
    if (!selectedMethod || !selectedRole || !roleDefinition) return;
    const payload: GatewaySession = {
      method: selectedMethod,
      role: roleDefinition,
      grantedAt: Date.now(),
    };
    completeSignIn(payload);
    const methodLabel = methodOptions.find((entry) => entry.id === selectedMethod)?.title ?? selectedMethod;
    setAnnouncement(`Access granted as ${roleDefinition.title} via ${methodLabel}.`);
    setStep(2);
  };

  const handleReset = () => {
    setSelectedMethod(null);
    setSelectedRole(null);
    clearSession();
    setStep(0);
    setAnnouncement('Gateway reset. Choose a sign-in method to begin again.');
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
          <motion.div key="step-auth" className="grid gap-6 md:grid-cols-3" {...motionProps}>
            {methodOptions.map((option) => {
              const selected = selectedMethod === option.id;
              return (
                <DeckCard
                  key={option.id}
                  interactive
                  hoverLift
                  ariaLabel={`${option.title} sign-in method`}
                  onClick={() => handleMethodSelect(option.id)}
                  title={option.title}
                  description={option.detail}
                  eyebrow={option.subtitle}
                  icon={option.icon}
                  tone={option.accent}
                  className={cn('cursor-pointer transition-all', selected && accentRing[option.accent])}
                  actions={
                    <span className="inline-flex items-center gap-2 text-xs text-neutral-400">
                      Tap to continue
                      <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                    </span>
                  }
                />
              );
            })}
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
                disabled={!selectedRole || !selectedMethod}
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
                  disabled={!selectedMethod || !selectedRole}
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
                  Active session: {session.role.title} via{' '}
                  {methodOptions.find((option) => option.id === session.method)?.title ?? session.method} · refreshed{' '}
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

