"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { FileIcon, UploadCloudIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useDropzone, type FileRejection } from "react-dropzone";

import { Button } from "../atoms/button";

const FileUploadContext = React.createContext<{
  files: File[];
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  disabled: boolean;
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
  open: ReturnType<typeof useDropzone>["open"];
  isDragActive: boolean;
}>({
  files: [],
  addFiles: () => {},
  removeFile: () => {},
  disabled: false,
  getRootProps: () => ({}) as never,
  getInputProps: () => ({}) as never,
  open: () => {},
  isDragActive: false,
});

type FileUploadProps = Omit<React.ComponentProps<"div">, "className"> & {
  accept?: Record<string, string[]>;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  onFilesChange?: (files: File[]) => void;
  onFileReject?: (rejections: FileRejection[]) => void;
};

function FileUpload({
  accept,
  maxSize,
  maxFiles,
  multiple = true,
  disabled = false,
  onFilesChange,
  onFileReject,
  children,
  ...props
}: FileUploadProps) {
  const [files, setFiles] = React.useState<File[]>([]);

  const onDrop = React.useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      const newFiles = multiple ? [...files, ...accepted] : accepted;
      const limited = maxFiles ? newFiles.slice(0, maxFiles) : newFiles;
      setFiles(limited);
      onFilesChange?.(limited);
      if (rejected.length > 0) onFileReject?.(rejected);
    },
    [files, multiple, maxFiles, onFilesChange, onFileReject],
  );

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles,
    multiple,
    disabled,
    noClick: true,
    noKeyboard: true,
  });

  const addFiles = React.useCallback(
    (newFiles: File[]) => {
      const updated = multiple ? [...files, ...newFiles] : newFiles;
      const limited = maxFiles ? updated.slice(0, maxFiles) : updated;
      setFiles(limited);
      onFilesChange?.(limited);
    },
    [files, multiple, maxFiles, onFilesChange],
  );

  const removeFile = React.useCallback(
    (index: number) => {
      const updated = files.filter((_, i) => i !== index);
      setFiles(updated);
      onFilesChange?.(updated);
    },
    [files, onFilesChange],
  );

  return (
    <FileUploadContext.Provider
      value={{
        files,
        addFiles,
        removeFile,
        disabled,
        getRootProps,
        getInputProps,
        open,
        isDragActive,
      }}
    >
      <div data-slot="file-upload" {...props}>
        {children}
      </div>
    </FileUploadContext.Provider>
  );
}

const fileUploadDropzoneVariants = cva(
  "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
  {
    variants: {
      variant: {
        default: "border-border hover:border-muted-foreground/50",
        compact: "border-border hover:border-muted-foreground/50 p-4",
      },
      isDragActive: {
        true: "border-primary bg-primary/5",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      isDragActive: false,
    },
  },
);

function FileUploadDropzone({
  variant = "default",
  ...props
}: Omit<React.ComponentProps<"div">, "className"> &
  Pick<VariantProps<typeof fileUploadDropzoneVariants>, "variant">) {
  const { getRootProps, getInputProps, open, isDragActive, disabled } =
    React.useContext(FileUploadContext);

  return (
    <div
      {...getRootProps()}
      data-slot="file-upload-dropzone"
      onClick={open}
      className={fileUploadDropzoneVariants({
        variant,
        isDragActive,
      })}
      aria-disabled={disabled || undefined}
      {...props}
    >
      <input {...getInputProps()} />
      <UploadCloudIcon className="size-8 text-muted-foreground" />
      <div className="text-sm text-muted-foreground">
        {isDragActive ? (
          <span>Drop files here</span>
        ) : (
          <span>Drag & drop files here, or click to browse</span>
        )}
      </div>
      {props.children}
    </div>
  );
}

function FileUploadList({
  ...props
}: Omit<React.ComponentProps<"ul">, "className">) {
  const { files } = React.useContext(FileUploadContext);
  if (files.length === 0) return null;

  return (
    <ul
      data-slot="file-upload-list"
      className="mt-2 flex flex-col gap-1"
      {...props}
    >
      {files.map((file, index) => (
        <FileUploadItem
          key={`${file.name}-${index}`}
          index={index}
          file={file}
        />
      ))}
    </ul>
  );
}

function FileUploadItem({ file, index }: { file: File; index: number }) {
  const { removeFile, disabled } = React.useContext(FileUploadContext);
  const size =
    file.size < 1024
      ? `${file.size} B`
      : file.size < 1048576
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / 1048576).toFixed(1)} MB`;

  return (
    <li
      data-slot="file-upload-item"
      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{file.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">{size}</span>
      {!disabled && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => removeFile(index)}
          aria-label={`Remove ${file.name}`}
        >
          <XIcon className="size-3" />
        </Button>
      )}
    </li>
  );
}

function FileUploadTrigger({
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick">) {
  const { open, disabled } = React.useContext(FileUploadContext);
  return (
    <Button
      data-slot="file-upload-trigger"
      variant="outline"
      disabled={disabled}
      onClick={open}
      {...props}
    >
      {children ?? "Browse files"}
    </Button>
  );
}

export {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadList,
  FileUploadTrigger,
};
export type { FileUploadProps };
