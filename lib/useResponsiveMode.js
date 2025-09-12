import { useState, useEffect } from "react";

export default function useResponsiveMode() {
  const [mode, setMode] = useState(
    typeof window !== "undefined" && window.innerWidth <= 860 ? "mobile" : "desktop"
  );

  useEffect(() => {
    const handler = () => setMode(window.innerWidth <= 860 ? "mobile" : "desktop");
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return mode; // 'desktop' or 'mobile'
}
