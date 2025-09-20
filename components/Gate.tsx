'use client';

import Link from 'next/link';
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
          <h2 className="text-xl font-semibold text-sky-100">{heading ?? 'Access restricted'}</h2>
          <p className="text-sm text-sky-100/70">
            {session
              ? `Your current role, ${session.role.title}, does not unlock this surface. Choose a role with the required scopes.`
              : 'Authenticate through the user gateway to unlock this flight deck surface.'}
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-sky-100/60">
            <span className="font-semibold uppercase tracking-[0.28em] text-sky-100/80">Permitted roles</span>
            {ROLE_LIBRARY.filter((role) => allowedRoles.includes(role.id)).map((role) => (
              <span key={role.id} className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                {role.title}
              </span>
            ))}
          </div>
          <Link
            href="/gateway"
            className="focus-ring inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/60 bg-sky-400/10 px-4 py-2 text-sm text-sky-100"
          >
            Launch user gateway
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Glass>
    );
  }

  return <>{children}</>;
}
