/** Vite env typings so import.meta.env is valid in connection-manager and elsewhere. */
declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_API_URL?: string;
      readonly VITE_WS_URL?: string;
      readonly VITE_OLLAMA_URL?: string;
      readonly VITE_WEB3_RPC?: string;
      readonly VITE_LOVE_LEDGER_ADDRESS?: string;
      [key: string]: string | undefined;
    };
  }
}
export {};
