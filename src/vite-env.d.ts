/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly GEMINI_API_KEY?: string
  readonly ALPACA_API_KEY?: string
  readonly ALPACA_SECRET_KEY?: string
  readonly EIA_API_KEY?: string
  readonly POLYGON_KEY?: string
  readonly FINNHUB_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
