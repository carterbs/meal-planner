import { useEffect, useRef } from 'react';

export default function useAutoScroll<T extends HTMLElement>(deps: unknown[]): React.RefObject<T> {
    const ref = useRef<T | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, deps);
    return ref as React.RefObject<T>;
}


