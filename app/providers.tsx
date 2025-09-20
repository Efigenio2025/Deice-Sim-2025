'use client';

import { GatewayProvider } from '@/lib/gateway-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return <GatewayProvider>{children}</GatewayProvider>;
}
