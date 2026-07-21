/// <reference types="vite/client" />
interface Window {
  Razorpay: any;
  BarcodeDetector?: new (options?: { formats?: string[] }) => {
    detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
  };
}
