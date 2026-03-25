import { useEffect } from "react";

export interface UseWarnIfUnsavedChangesOptions {
  enabled: boolean;
  message?: string;
}

export function useWarnIfUnsavedChanges(
  options: UseWarnIfUnsavedChangesOptions,
): void {
  const {
    enabled,
    message = "You have unsaved changes. Are you sure you want to leave?",
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, message]);
}
