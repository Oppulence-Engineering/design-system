import { type KeyboardEvent, type RefObject, useRef } from "react";

export function useEnterSubmit(): {
  formRef: RefObject<HTMLFormElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
} {
  const formRef = useRef<HTMLFormElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return { formRef, onKeyDown };
}
