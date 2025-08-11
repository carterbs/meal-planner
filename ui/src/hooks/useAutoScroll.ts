import { useEffect, useRef } from 'react';

export default function useAutoScroll<T extends HTMLElement>(
  depsKey?: string | number | boolean,
): React.RefObject<T> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [depsKey]);
  return ref as React.RefObject<T>;
}
