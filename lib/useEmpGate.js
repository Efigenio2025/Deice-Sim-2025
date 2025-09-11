import { useEffect, useRef } from 'react';

const KEY = 'trainer.employeeId';

export default function useEmpGate(){
  const badgeRef = useRef(null);

  useEffect(() => {
    const badge = badgeRef.current;
    const have = (typeof window !== 'undefined') &&
      (sessionStorage.getItem(KEY) || localStorage.getItem(KEY));
    if (!have) {
      document.getElementById('empIdModal')?.classList.remove('hidden');
    } else if (badge) {
      badge.textContent = 'ID: ' + have;
    }
  }, []);

  return {
    badge: badgeRef,
    modal: null
  };
}
