import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { MobileTrainApp } from '../components/TrainApp';
import { getStoredEmployeeId } from '../lib/employeeSession';
import { isAllowedEmployeeId } from '../lib/employeeProfiles';

export default function MobileTrainPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    const stored = getStoredEmployeeId();
    if (stored && isAllowedEmployeeId(stored)) {
      setAuthorized(true);
    } else {
      router.replace('/');
    }
    setChecking(false);
  }, [router, router.isReady]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sky-100">
        <span className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-200/80">
          Verifying access…
        </span>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <MobileTrainApp />;
}
