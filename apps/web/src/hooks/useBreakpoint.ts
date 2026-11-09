import { useEffect, useState } from 'react';

/** md 断点（768px）以下视为移动端布局 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth < breakpoint));

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isMobile;
}

export function useIsTablet(breakpoint = 1120): boolean {
  const [isTablet, setIsTablet] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth < breakpoint));

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (event: MediaQueryListEvent) => setIsTablet(event.matches);
    setIsTablet(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isTablet;
}
