'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createRealtimeClient } from '@neon/realtime/client';
import { RealtimeProvider } from '@neon/realtime-react';
import { normalizeRealtimeWsUrl } from '@/lib/realtimeShared';
import { getCloudStatusSnapshot, syncCloudStatus } from '@/services/cloudServices';

const RealtimeAvailableContext = createContext<boolean>(false);

export function useIsRealtimeAvailable(): boolean {
  return useContext(RealtimeAvailableContext);
}

function RealtimeClientBoundary({
  url,
  children
}: {
  url: string;
  children: React.ReactNode;
}) {
  const [client] = useState(() =>
    createRealtimeClient({
      url,
      logLevel: process.env.NODE_ENV === 'development' ? 'warn' : 'error'
    })
  );

  return (
    <RealtimeAvailableContext.Provider value={true}>
      <RealtimeProvider client={client}>{children}</RealtimeProvider>
    </RealtimeAvailableContext.Provider>
  );
}

export const RealtimeRoot: React.FC<{
  initialUrl?: string;
  children: React.ReactNode;
}> = ({ initialUrl = '', children }) => {
  const [realtimeUrl, setRealtimeUrl] = useState<string>(() => {
    const fromProp = normalizeRealtimeWsUrl(initialUrl);
    if (fromProp) return fromProp;
    const fromEnv = normalizeRealtimeWsUrl(process.env.NEXT_PUBLIC_NEON_REALTIME_URL || '');
    if (fromEnv) return fromEnv;
    return normalizeRealtimeWsUrl(getCloudStatusSnapshot().realtimeUrl);
  });

  useEffect(() => {
    let active = true;
    syncCloudStatus()
      .then((status) => {
        if (!active) return;
        const nextUrl = normalizeRealtimeWsUrl(status.realtimeUrl);
        if (nextUrl && nextUrl !== realtimeUrl) {
          setRealtimeUrl(nextUrl);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [realtimeUrl]);

  if (!realtimeUrl) {
    return (
      <RealtimeAvailableContext.Provider value={false}>
        {children}
      </RealtimeAvailableContext.Provider>
    );
  }

  return (
    <RealtimeClientBoundary key={realtimeUrl} url={realtimeUrl}>
      {children}
    </RealtimeClientBoundary>
  );
};
