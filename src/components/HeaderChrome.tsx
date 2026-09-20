import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type HeaderChromeContextValue = {
  host: HTMLElement | null;
  setHost: (node: HTMLElement | null) => void;
};

const HeaderChromeContext = createContext<HeaderChromeContextValue | null>(null);

export function HeaderChromeProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ host, setHost }), [host]);
  return <HeaderChromeContext.Provider value={value}>{children}</HeaderChromeContext.Provider>;
}

export function useHeaderChromeHostSetter() {
  return useContext(HeaderChromeContext)?.setHost ?? null;
}

/** Render shop chrome into the signed-in account bar when a host is mounted. */
export function HeaderChromePortal({ children }: { children: ReactNode }) {
  const host = useContext(HeaderChromeContext)?.host ?? null;
  if (!host) return null;
  return createPortal(children, host);
}
