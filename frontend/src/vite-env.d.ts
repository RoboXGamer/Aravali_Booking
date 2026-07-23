/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CONVEX_SITE_URL: string;
  readonly VITE_SITE_URL: string;
  readonly VITE_RAZORPAY_KEY_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  Razorpay: any;
  BarcodeDetector?: new (options?: { formats?: string[] }) => {
    detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
  };
}
