import { useEffect, useState } from 'react';
import { UpdateStatus } from '../../shared/types';

export function useAppUpdate(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    window.cloudflareRdp.app.getUpdateStatus().then(setStatus).catch(() => {});
    return window.cloudflareRdp.app.onUpdateStatus(setStatus);
  }, []);

  return status;
}
