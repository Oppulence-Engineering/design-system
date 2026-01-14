"use client";

interface BubbleMenuButtonProps {
  action: () => void;
  isActive: boolean;
  children: React.ReactNode;
}

export function BubbleMenuButton({
  action,
  isActive,
  children,
}: BubbleMenuButtonProps) {
  return (
    <button
      type="button"
      onClick={action}
      className={
        isActive
          ? "px-2.5 py-1.5 text-[11px] transition-colors bg-white dark:bg-stone-900 text-primary"
          : "px-2.5 py-1.5 text-[11px] transition-colors bg-transparent hover:bg-muted"
      }
    >
      {children}
    </button>
  );
}
