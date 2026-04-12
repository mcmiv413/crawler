/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ASCII_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
