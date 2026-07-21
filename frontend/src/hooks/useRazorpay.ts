import { useEffect, useState } from "react";

const SCRIPT_ID = "razorpay-checkout-script";

export function useRazorpay() {
  const [loaded, setLoaded] = useState(() => Boolean(window.Razorpay));

  useEffect(() => {
    if (window.Razorpay) {
      setLoaded(true);
      return;
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }

    const handleLoad = () => setLoaded(true);
    const handleError = () => setLoaded(false);
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    return () => {
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
  }, []);

  return loaded;
}
