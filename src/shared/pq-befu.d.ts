declare module 'pq-befu' {
  export interface PQClientOptions {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
    asyncSend?: boolean;
    userAgent?: string;
  }

  export class PQClient {
    constructor(options?: PQClientOptions);
    captureError(data?: Record<string, unknown>): Promise<unknown>;
    captureException(err: unknown, options?: Record<string, unknown>): Promise<unknown>;
    sendFeedback(data?: Record<string, unknown>): Promise<unknown>;
    createTicket(data?: Record<string, unknown>): Promise<unknown>;
    flush(): Promise<void>;
  }
}

declare module 'pq-befu/integrations/electron' {
  import { PQClient } from 'pq-befu';

  export const PQ_IPC_CHANNEL: string;
  export function pqElectronMain(
    client: PQClient,
    options?: { environment?: string; channel?: string; hooks?: boolean }
  ): () => void;
  export function pqElectronPreload(options?: { channel?: string }): {
    captureError: (data?: Record<string, unknown>) => Promise<unknown>;
    captureException: (err: unknown, data?: Record<string, unknown>) => Promise<unknown>;
    sendFeedback: (data?: Record<string, unknown>) => Promise<unknown>;
    createTicket: (data?: Record<string, unknown>) => Promise<unknown>;
  };
}
