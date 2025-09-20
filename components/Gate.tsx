'use client';

import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { ReactNode } from 'react';
import { Glass } from './Glass';
import { ROLE_LIBRARY, RoleId, useGateway } from '@/lib/gateway-context';

interface GateProps {
  allowedRoles: RoleId[];
  children: ReactNode;
  heading?: string;
}

export function Gate({ allowedRoles, children, heading }: GateProps) {
  const { session } = useGateway();

  const permitted = session && allowedRoles.includes(session.role.id);

  if (!permitted) {
    return (
      <Glass className="p-8" ariaLabel="Access restricted">
        <div className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-neutral-100">
            <Lock aria-hidden className="h-5 w-5 text-amber-500" />
            {heading ?? 'Access restricted'}
          </h2>
          <p className="text-sm text-neutral-300/80">
            {session
              ? `Your current role, ${session.role.title}, does not unlock this surface. Choose a role with the required scopes.`
              : 'Authenticate through the user gateway to unlock this flight deck surface.'}
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-[0.28em] text-neutral-300/80">Permitted roles</span>
            {ROLE_LIBRARY.filter((role) => allowedRoles.includes(role.id)).map((role) => (
              <span key={role.id} className="rounded-full border border-neutral-800/80 bg-neutral-900/60 px-3 py-1 text-neutral-200">
                {role.title}
              </span>
            ))}
          </div>
          <Link
            href="/gateway"
            className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl border border-sky-500/60 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 transition-transform hover:-translate-y-0.5"
          >
            Launch user gateway
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </Glass>
    );
  }

  return <>{children}</>;
}
