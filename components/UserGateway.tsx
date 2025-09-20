'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Glass } from './Glass';
import {
  ROLE_LIBRARY,
  RoleDefinition,
  RoleId,
  SignInMethod,
  GatewaySession,
  getRoleDefinition,
  useGateway,
} from '@/lib/gateway-context';

interface MethodOption {
  id: SignInMethod;
  title: string;
  subtitle: string;
  detail: string;
  accent: string;
}

const methodOptions: MethodOption[] = [
  {
    id: 'azure-ad',
    title: 'Azure AD SSO',
    subtitle: 'Corporate identity · MFA enforced',
    detail: 'Instantly federate with the airport tenant. Scoped access inherits Azure entitlements.',
    accent: 'bg-sky-400/30 text-sky-50',
  },
  {
    id: 'email-otp',
    title: 'Email OTP',
    subtitle: 'Time-boxed · 6 digit code',
    detail: 'Use a one-time passcode delivered to your ramp mailbox. Session expires after 12 hours.',
    accent: 'bg-emerald-400/30 text-emerald-50',
  },
  {
    id: 'guest',
    title: 'Guest observation',
    subtitle: 'View only · 24h scope',
    detail: 'Bypass authentication to preview sanitized modules. No shift actions permitted.',
    accent: 'bg-amber-400/30 text-amber-100',
  },
];

const steps = ['Authenticate', 'Select role', 'Summary'];

type Step = 0 | 1 | 2;

export function UserGateway() {
  const { session, completeSignIn, clearSession } = useGateway();
  const [step, setStep] = useState<Step>(session ? 2 : 0);
  const [selectedMethod, setSelectedMethod] = useState<SignInMethod | null>(session?.method ?? null);
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(session?.role.id ?? null);
  const [announcement, setAnnouncement] = useState('');

  const roleDefinition: RoleDefinition | undefined = useMemo(
    () => (selectedRole ? getRoleDefinition(selectedRole) : undefined),
    [selectedRole]
  );

  const handleMethodSelect = (method: SignInMethod) => {
    setSelectedMethod(method);
    setStep(1);
    setAnnouncement(`Authentication method selected: ${methodOptions.find((option) => option.id === method)?.title ?? method}`);
  };

  const handleRoleSelect = (roleId: RoleId) => {
    setSelectedRole(roleId);
    setAnnouncement(`Role selected: ${getRoleDefinition(roleId).title}`);
  };

  const handleSummaryAdvance = () => {
    if (!selectedMethod || !selectedRole || !roleDefinition) return;
    const payload: GatewaySession = {
      method: selectedMethod,
      role: roleDefinition,
      grantedAt: Date.now(),
    };
    completeSignIn(payload);
    setAnnouncement(`Access granted as ${roleDefinition.title} via ${selectedMethod}.`);
    setStep(2);
  };

  const handleReset = () => {
    setSelectedMethod(null);
    setSelectedRole(null);
    clearSession();
    setStep(0);
    setAnnouncement('Gateway reset. Choose a sign-in method to begin again.');
  };

  return (
    <section aria-labelledby="user-gateway-heading" className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 id="user-gateway-heading" className="text-3xl font-semibold text-sky-100">
          User gateway
        </h1>
        <p className="max-w-2xl text-sm text-sky-100/75">
          Progress through authentication, role configuration, and review to unlock the Dark Glass Flight Deck.
          Every transition is announced for assistive technology.
        </p>
        <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.28em] text-sky-200/70">
          {steps.map((label, index) => (
            <span
              key={label}
              className={`rounded-full px-4 py-1 ${
                step === index ? 'bg-sky-400/30 text-sky-50' : 'bg-white/5 text-sky-100/60'
              }`}
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>
        <div role="status" aria-live="polite" className="text-xs text-sky-100/60">
          {announcement}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step-auth"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="grid gap-6 md:grid-cols-3"
          >
            {methodOptions.map((option) => (
              <Glass
                key={option.id}
                interactive
                ariaLabel={`${option.title} sign-in method`}
                onClick={() => handleMethodSelect(option.id)}
                className={`flex h-full flex-col gap-4 p-6 transition-shadow hover:shadow-[0_12px_45px_rgba(56,189,248,0.25)] ${
                  selectedMethod === option.id ? 'outline outline-2 outline-sky-400/70' : ''
                }`}
              >
                <div className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${option.accent}`}>{option.subtitle}</div>
                <h2 className="text-xl font-semibold text-sky-50">{option.title}</h2>
                <p className="text-sm text-sky-100/75">{option.detail}</p>
                <span className="mt-auto text-xs text-sky-100/60">Tap to continue →</span>
              </Glass>
            ))}
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step-role"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-sky-100">Select your operational role</h2>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="focus-ring rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-sky-100/70"
              >
                ← Sign-in method
              </button>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {ROLE_LIBRARY.map((roleOption) => {
                const active = selectedRole === roleOption.id;
                return (
                  <Glass
                    key={roleOption.id}
                    interactive
                    ariaLabel={`${roleOption.title} role option`}
                    onClick={() => handleRoleSelect(roleOption.id)}
                    className={`flex h-full flex-col gap-4 p-6 ${
                      active ? 'outline outline-2 outline-emerald-400/70' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-sky-50">{roleOption.title}</h3>
                      {active && <span className="text-xs text-emerald-300">Selected</span>}
                    </div>
                    <p className="text-sm text-sky-100/75">{roleOption.subtitle}</p>
                    <ul className="mt-auto grid gap-2 text-xs text-sky-100/70">
                      {roleOption.scopes.map((scope) => (
                        <li key={scope} className="inline-flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true" />
                          {scope}
                        </li>
                      ))}
                    </ul>
                  </Glass>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="focus-ring text-xs uppercase tracking-[0.3em] text-sky-100/70"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedRole || !selectedMethod}
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-sky-400/60 bg-sky-400/10 px-5 py-2 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to summary
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-summary"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex flex-col gap-6"
          >
            <Glass ariaLabel="Summary" className="flex flex-col gap-6 p-8">
              <h2 className="text-2xl font-semibold text-sky-50">Access summary</h2>
              <dl className="grid gap-4 text-sm text-sky-100/75">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-[0.3em] text-sky-100/60">Method</dt>
                  <dd>{selectedMethod ? methodOptions.find((option) => option.id === selectedMethod)?.title : 'Not selected'}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-[0.3em] text-sky-100/60">Role</dt>
                  <dd>{roleDefinition?.title ?? session?.role.title ?? 'Not selected'}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-[0.3em] text-sky-100/60">Scopes</dt>
                  <dd>
                    <ul className="grid gap-1 text-xs">
                      {(roleDefinition ?? session?.role)?.scopes.map((scope) => (
                        <li key={scope} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                          {scope}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={handleSummaryAdvance}
                  disabled={!selectedMethod || !selectedRole}
                  className="focus-ring inline-flex items-center gap-2 rounded-full border border-emerald-400/70 bg-emerald-400/10 px-5 py-2 text-sm text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirm access
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-sky-100"
                >
                  Start over
                </button>
                <Link
                  href="/"
                  className="focus-ring inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-400/10 px-5 py-2 text-sm text-sky-100"
                >
                  View index modules
                </Link>
              </div>
              {session && (
                <p className="text-xs text-sky-100/60">
                  Active session: {session.role.title} via {methodOptions.find((option) => option.id === session.method)?.title}{' '}
                  · refreshed {new Intl.DateTimeFormat('en', {
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
