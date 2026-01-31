"use client";

import type { ChatStatus, FileUIPart } from "../../../lib/ai";
import { cn } from "../../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../molecules/select";
import { PaperclipIcon, PlusIcon, XIcon } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  type ChangeEventHandler,
  Children,
  type ComponentProps,
  type FormEvent,
  type FormEventHandler,
  Fragment,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type ReactNode,
  type RefObject,
  type TextareaHTMLAttributes,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icons } from "../atoms/icons";
import { buttonVariants, type ButtonProps } from "../atoms/button";

type AttachmentsContext = {
  files: (FileUIPart & { id: string })[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: () => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
};

const AttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputAttachments = () => {
  const context = useContext(AttachmentsContext);

  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput",
    );
  }

  return context;
};

export type PromptInputAttachmentProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className"
> & {
  data: FileUIPart & { id: string };
};

export function PromptInputAttachment({
  data,
  ...props
}: PromptInputAttachmentProps) {
  const attachments = usePromptInputAttachments();

  return (
    <div className="group relative h-14 w-14 border" key={data.id} {...props}>
      {data.mediaType?.startsWith("image/") && data.url ? (
        <img
          alt={data.filename || "attachment"}
          className="size-full object-cover"
          height={56}
          src={data.url}
          width={56}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <PaperclipIcon className="size-4" />
        </div>
      )}
      <button
        aria-label="Remove attachment"
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-xs" }),
          "-right-1.5 -top-1.5 absolute h-6 w-6 rounded-full opacity-0 group-hover:opacity-100",
        )}
        onClick={() => attachments.remove(data.id)}
        type="button"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

export type PromptInputAttachmentsProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "className"
> & {
  children: (attachment: FileUIPart & { id: string }) => ReactNode;
};

export function PromptInputAttachments({
  children,
  ...props
}: PromptInputAttachmentsProps) {
  const attachments = usePromptInputAttachments();
  const [height, setHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(() => {
      setHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    setHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      aria-live="polite"
      className="overflow-hidden transition-[height] duration-200 ease-out"
      style={{ height: attachments.files.length ? height : 0 }}
      {...props}
    >
      <div className="flex flex-wrap gap-2 p-3 pt-3" ref={contentRef}>
        {attachments.files.map((file) => (
          <Fragment key={file.id}>{children(file)}</Fragment>
        ))}
      </div>
    </div>
  );
}

export type PromptInputActionAddAttachmentsProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
> & {
  label?: string;
};

export const PromptInputActionAddAttachments = (
  props: PromptInputActionAddAttachmentsProps,
) => {
  const attachments = usePromptInputAttachments();

  return (
    <button
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-xs" }),
        "size-6 text-muted-foreground",
      )}
      type="button"
      onClick={() => attachments.openFileDialog()}
      {...props}
    >
      <Icons.Add size={16} />
    </button>
  );
};

export type PromptInputMessage = {
  text?: string;
  files?: FileUIPart[];
};

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit" | "className"
> & {
  accept?: string; // e.g., "image/*" or leave undefined for any
  multiple?: boolean;
  // When true, accepts drops anywhere on document. Default false (opt-in).
  globalDrop?: boolean;
  // Render a hidden input with given name and keep it in sync for native form posts. Default false.
  syncHiddenInput?: boolean;
  // Minimal constraints
  maxFiles?: number;
  maxFileSize?: number; // bytes
  onError?: (err: {
    code: "max_files" | "max_file_size" | "accept";
    message: string;
  }) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

export const PromptInput = ({
  accept,
  multiple,
  globalDrop,
  syncHiddenInput,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  ...props
}: PromptInputProps) => {
  const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Find nearest form to scope drag & drop
  useEffect(() => {
    const root = anchorRef.current?.closest("form");
    if (root instanceof HTMLFormElement) {
      formRef.current = root;
    }
  }, []);

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const matchesAccept = useCallback(
    (f: File) => {
      if (!accept || accept.trim() === "") {
        return true;
      }
      // Split accept string into individual types
      const acceptTypes = accept.split(",").map((t) => t.trim());
      return acceptTypes.some((type) => {
        if (type.endsWith("/*")) {
          // Handle wildcard types like "image/*" or "application/*"
          const baseType = type.slice(0, -2);
          return f.type.startsWith(`${baseType}/`);
        }
        // Handle specific MIME types like "application/pdf"
        return f.type === type;
      });
    },
    [accept],
  );

  const convertFilesToDataURLs = useCallback(
    (
      files: FileList | File[],
    ): Promise<
      { type: "file"; filename: string; mediaType: string; url: string }[]
    > => {
      return Promise.all(
        Array.from(files).map(
          (file) =>
            new Promise<{
              type: "file";
              filename: string;
              mediaType: string;
              url: string;
            }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                resolve({
                  type: "file",
                  filename: file.name,
                  mediaType: file.type,
                  url: reader.result as string, // Data URL
                });
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            }),
        ),
      );
    },
    [],
  );

  const add = useCallback(
    (files: File[] | FileList) => {
      const incoming = Array.from(files);
      const accepted = incoming.filter((f) => matchesAccept(f));
      if (accepted.length === 0) {
        onError?.({
          code: "accept",
          message: "No files match the accepted types.",
        });
        return;
      }
      const withinSize = (f: File) =>
        maxFileSize ? f.size <= maxFileSize : true;
      const sized = accepted.filter(withinSize);
      if (sized.length === 0 && accepted.length > 0) {
        onError?.({
          code: "max_file_size",
          message: "All files exceed the maximum size.",
        });
        return;
      }
      setItems((prev) => {
        const capacity =
          typeof maxFiles === "number"
            ? Math.max(0, maxFiles - prev.length)
            : undefined;
        const capped =
          typeof capacity === "number" ? sized.slice(0, capacity) : sized;
        if (typeof capacity === "number" && sized.length > capacity) {
          onError?.({
            code: "max_files",
            message: "Too many files. Some were not added.",
          });
        }

        // Create temporary items with blob URLs for immediate UI display
        // Use filename + index as ID
        const tempItems = capped.map((file, index) => {
          const blobUrl = URL.createObjectURL(file);
          return {
            id: `${file.name}-${index}-${Date.now()}`,
            type: "file" as const,
            url: blobUrl,
            mediaType: file.type,
            filename: file.name,
          };
        });

        // Convert files to data URLs using FileReader and replace temp items
        convertFilesToDataURLs(capped).then((convertedFiles) => {
          setItems((current) => {
            // Match temp items to converted items by index (since arrays are parallel)
            return current.map((item) => {
              // If this is a temp item (blob URL), find its corresponding converted file
              const itemUrl = item.url;
              if (
                itemUrl &&
                typeof itemUrl === "string" &&
                itemUrl.startsWith("blob:")
              ) {
                // Find the temp item by matching ID
                const tempItem = tempItems.find((temp) => temp.id === item.id);
                if (tempItem) {
                  const tempIndex = tempItems.indexOf(tempItem);
                  if (
                    tempIndex >= 0 &&
                    tempIndex < convertedFiles.length &&
                    itemUrl
                  ) {
                    const converted = convertedFiles[tempIndex];
                    if (converted) {
                      // Revoke the blob URL
                      URL.revokeObjectURL(itemUrl);
                      // Return converted item with same id and filename
                      return {
                        ...item,
                        url: converted.url, // Data URL
                        data: converted.url, // Also store in data field
                        filename: converted.filename, // Keep original filename
                      };
                    }
                  }
                }
              }
              return item;
            });
          });
        });

        // Return immediately with temporary blob URLs for UI responsiveness
        return prev.concat(tempItems);
      });
    },
    [matchesAccept, maxFiles, maxFileSize, onError, convertFilesToDataURLs],
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const found = prev.find((file) => file.id === id);
      // Only revoke blob URLs, not data URLs
      if (found?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(found.url);
      }
      return prev.filter((file) => file.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setItems((prev) => {
      for (const file of prev) {
        // Only revoke blob URLs, not data URLs
        if (file.url?.startsWith("blob:")) {
          URL.revokeObjectURL(file.url);
        }
      }
      return [];
    });
  }, []);

  // Note: File input cannot be programmatically set for security reasons
  // The syncHiddenInput prop is no longer functional
  useEffect(() => {
    if (syncHiddenInput && inputRef.current) {
      // Clear the input when items are cleared
      if (items.length === 0) {
        inputRef.current.value = "";
      }
    }
  }, [items, syncHiddenInput]);

  // Attach drop handlers on nearest form and document (opt-in)
  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    form.addEventListener("dragover", onDragOver);
    form.addEventListener("drop", onDrop);
    return () => {
      form.removeEventListener("dragover", onDragOver);
      form.removeEventListener("drop", onDrop);
    };
  }, [add]);

  useEffect(() => {
    if (!globalDrop) {
      return;
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (event.currentTarget.files) {
      add(event.currentTarget.files);
    }
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const files: FileUIPart[] = items.map(({ ...item }) => ({
      ...item,
    }));

    const formData = new FormData(event.currentTarget);
    const textValue = formData.get("message");
    const text = typeof textValue === "string" ? textValue : undefined;

    onSubmit({ text, files }, event);
  };

  const ctx = useMemo<AttachmentsContext>(
    () => ({
      files: items.map((item) => ({ ...item, id: item.id })),
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef: inputRef,
    }),
    [items, add, remove, clear, openFileDialog],
  );

  return (
    <AttachmentsContext.Provider value={ctx}>
      <span aria-hidden="true" className="hidden" ref={anchorRef} />
      <input
        accept={accept}
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      <form
        className="w-full overflow-hidden bg-[#F7F7F7] dark:bg-[#131313]"
        onSubmit={handleSubmit}
        {...props}
      />
    </AttachmentsContext.Provider>
  );
};

export type PromptInputBodyProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className"
>;

export const PromptInputBody = ({ ...props }: PromptInputBodyProps) => (
  <div className="flex flex-col" {...props} />
);

export type PromptInputTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className"
>;

export const PromptInputTextarea = ({
  onChange,
  placeholder = "Ask anything",
  ...props
}: PromptInputTextareaProps) => {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter") {
      // Don't submit if IME composition is in progress
      if (e.nativeEvent.isComposing) {
        return;
      }

      if (e.shiftKey) {
        // Allow newline
        return;
      }

      // Submit on Enter (without Shift)
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-none border-none p-3 pt-4 shadow-none outline-none ring-0 text-sm",
        "field-sizing-content bg-transparent dark:bg-transparent placeholder:text-[rgba(102,102,102,0.5)]",
        "max-h-[55px] min-h-[55px]",
        "focus-visible:ring-0",
      )}
      name="message"
      onChange={(e) => {
        onChange?.(e);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputToolbarProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className"
>;

export const PromptInputToolbar = ({ ...props }: PromptInputToolbarProps) => (
  <div className="flex items-center justify-between px-3 pb-2" {...props} />
);

export type PromptInputToolsProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className"
>;

export const PromptInputTools = ({ ...props }: PromptInputToolsProps) => (
  <div className="flex items-center gap-3.5" {...props} />
);

export type PromptInputButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
> & {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

export const PromptInputButton = ({
  variant = "ghost",
  size,
  ...props
}: PromptInputButtonProps) => {
  const newSize =
    (size ?? Children.count(props.children) > 1) ? "default" : "icon";

  return (
    <button
      className={cn(
        buttonVariants({ variant, size: newSize }),
        "shrink-0 gap-1.5",
        variant === "ghost" && "text-muted-foreground",
        newSize === "default" && "px-3",
      )}
      type={props.type ?? "button"}
      {...props}
    />
  );
};

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;
export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
  <DropdownMenu {...props} />
);

export type PromptInputActionMenuTriggerProps = ComponentProps<
  typeof PromptInputButton
> & {};
export const PromptInputActionMenuTrigger = ({
  children,
  ...props
}: PromptInputActionMenuTriggerProps) => (
  <DropdownMenuTrigger render={<PromptInputButton {...props} />}>
    {children ?? <PlusIcon className="size-4" />}
  </DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;
export const PromptInputActionMenuContent = (
  props: PromptInputActionMenuContentProps,
) => <DropdownMenuContent align="start" {...props} />;

export type PromptInputActionMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>;
export const PromptInputActionMenuItem = (
  props: PromptInputActionMenuItemProps,
) => <DropdownMenuItem {...props} />;

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

export type PromptInputSubmitProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
> & {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  status?: ChatStatus;
};

export const PromptInputSubmit = ({
  variant = "default",
  size = "icon",
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <Icons.ArrowUpward size={16} />;

  if (status === "streaming") {
    Icon = <Icons.Stop size={16} />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  // Change button type to "button" when streaming to prevent form submission
  // The onClick handler will handle stopping the stream
  const buttonType =
    status === "streaming" || status === "submitted" ? "button" : "submit";

  return (
    <button
      className={cn(
        buttonVariants({ variant, size }),
        "gap-1.5",
        size === "icon" && "size-8",
      )}
      type={buttonType}
      {...props}
    >
      {children ?? Icon}
    </button>
  );
};

export type PromptInputModelSelectProps = ComponentProps<typeof Select>;

export const PromptInputModelSelect = (props: PromptInputModelSelectProps) => (
  <Select {...props} />
);

export type PromptInputModelSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;

export const PromptInputModelSelectTrigger = (
  props: PromptInputModelSelectTriggerProps,
) => <SelectTrigger {...props} />;

export type PromptInputModelSelectContentProps = ComponentProps<
  typeof SelectContent
>;

export const PromptInputModelSelectContent = (
  props: PromptInputModelSelectContentProps,
) => <SelectContent {...props} />;

export type PromptInputModelSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputModelSelectItem = (
  props: PromptInputModelSelectItemProps,
) => <SelectItem {...props} />;

export type PromptInputModelSelectValueProps = ComponentProps<
  typeof SelectValue
>;

export const PromptInputModelSelectValue = (
  props: PromptInputModelSelectValueProps,
) => <SelectValue {...props} />;
