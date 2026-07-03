import { useEffect, useRef, useState } from "react";

// Debounced live-suggestion fetch for Hugging Face model/dataset id fields.
export function useHfSearch(query, searchFn, { minLength = 2, delay = 300 } = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    clearTimeout(timerRef.current);

    if (q.length < minLength) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const reqId = ++reqIdRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        const results = await searchFn(q);
        if (reqIdRef.current === reqId) setSuggestions(results || []);
      } catch {
        if (reqIdRef.current === reqId) setSuggestions([]);
      } finally {
        if (reqIdRef.current === reqId) setLoading(false);
      }
    }, delay);

    return () => clearTimeout(timerRef.current);
  }, [query, searchFn, minLength, delay]);

  return { suggestions, loading };
}
