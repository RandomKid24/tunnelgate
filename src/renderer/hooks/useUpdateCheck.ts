import { useEffect, useState } from 'react';
import { UpdateInfo } from '../../shared/types';

export function useUpdateCheck(): UpdateInfo | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.cloudflareRdp.app
      .checkForUpdates()
      .then((result) => {
        if (!cancelled && result && result.hasUpdate) {
          setInfo(result);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}
