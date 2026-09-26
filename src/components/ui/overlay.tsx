'use client';

import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type Placement,
} from '@floating-ui/react-dom';
import { Slot } from 'radix-ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

const OPEN_DELAY_MS = 300;
const CLOSE_DELAY_MS = 120;

interface TooltipState {
  open: boolean;
  reference: HTMLElement | null;
  setReference(element: HTMLElement | null): void;
  show(immediately: boolean): void;
  hide(immediately: boolean): void;
}

const TooltipContext = createContext<TooltipState | null>(null);

function useTooltip(): TooltipState {
  const state = useContext(TooltipContext);
  if (!state) throw new Error('Tooltip parts must be inside <Tooltip>');
  return state;
}

/**
 * A visual hint on hover or keyboard focus. It is deliberately `aria-hidden`: every caller already
 * exposes the same text to assistive technology (an aria-label, aria-describedby or sr-only text).
 * Escape dismisses it and the pointer can move onto it (WCAG 1.4.13). Positioned with the
 * floating-ui build the menus already ship, so it adds no library of its own.
 */
function Tooltip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const schedule = useCallback((next: boolean, delay: number) => {
    clearTimeout(timer.current);
    if (delay === 0) setOpen(next);
    else timer.current = setTimeout(() => setOpen(next), delay);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') schedule(false, 0);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, schedule]);

  const state = useMemo<TooltipState>(
    () => ({
      open,
      reference,
      setReference,
      show: (immediately) => schedule(true, immediately ? 0 : OPEN_DELAY_MS),
      hide: (immediately) => schedule(false, immediately ? 0 : CLOSE_DELAY_MS),
    }),
    [open, reference, schedule],
  );

  return <TooltipContext.Provider value={state}>{children}</TooltipContext.Provider>;
}

/** Always wraps its single child (the former `asChild` behaviour); the prop is accepted for clarity. */
function TooltipTrigger({ children }: { asChild?: boolean; children: ReactNode }) {
  const { setReference, show, hide } = useTooltip();
  return (
    <Slot.Root
      data-slot="tooltip-trigger"
      ref={setReference}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') show(false);
      }}
      onPointerLeave={() => hide(false)}
      onPointerDown={() => hide(true)}
      onFocus={() => show(true)}
      onBlur={() => hide(true)}
    >
      {children}
    </Slot.Root>
  );
}

function TooltipContent({
  className,
  side = 'top',
  sideOffset = 4,
  children,
}: {
  className?: string;
  side?: Placement;
  sideOffset?: number;
  children: ReactNode;
}) {
  const { open, reference, show, hide } = useTooltip();
  const [floating, setFloating] = useState<HTMLDivElement | null>(null);
  const { floatingStyles } = useFloating({
    open,
    placement: side,
    elements: { reference, floating },
    middleware: [offset(sideOffset), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  if (!open || !reference) return null;
  return createPortal(
    <div
      ref={setFloating}
      aria-hidden
      data-slot="tooltip-content"
      style={floatingStyles}
      onPointerEnter={() => show(true)}
      onPointerLeave={() => hide(false)}
      className={cn(
        'z-50 w-max max-w-xs animate-in rounded-md bg-foreground px-3 py-1.5 text-xs leading-snug text-background fade-in-0',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

export { Tooltip, TooltipContent, TooltipTrigger };
