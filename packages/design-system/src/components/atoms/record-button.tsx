"use client";

import { cn } from "../../../lib/utils";
import { buttonVariants } from "./button";
import { Loader } from "./loader";

export interface RecordButtonProps {
  isRecording?: boolean;
  isProcessing?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: number;
}

const RecordIcon = ({
  size = 16,
  isRecording = false,
}: {
  size?: number;
  isRecording?: boolean;
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="10" width="2" height="4" fill="currentColor">
        {isRecording && (
          <>
            <animate
              attributeName="height"
              values="4;2;6;3;8;1;5;2;7;4"
              dur="2.4s"
              repeatCount="indefinite"
              begin="0s"
            />
            <animate
              attributeName="y"
              values="10;11;7;10.5;6;11.5;8.5;11;6.5;10"
              dur="2.4s"
              repeatCount="indefinite"
              begin="0s"
            />
          </>
        )}
      </rect>

      <rect x="7" y="6" width="2" height="12" fill="currentColor">
        {isRecording && (
          <>
            <animate
              attributeName="height"
              values="12;8;16;10;18;6;14;9;15;12"
              dur="2.7s"
              repeatCount="indefinite"
              begin="0.45s"
            />
            <animate
              attributeName="y"
              values="6;8;2;7;1;9;5;7.5;4.5;6"
              dur="2.7s"
              repeatCount="indefinite"
              begin="0.45s"
            />
          </>
        )}
      </rect>

      <rect x="11" y="2" width="2" height="20" fill="currentColor">
        {isRecording && (
          <>
            <animate
              attributeName="height"
              values="20;14;22;16;24;12;18;15;21;20"
              dur="2.1s"
              repeatCount="indefinite"
              begin="0.9s"
            />
            <animate
              attributeName="y"
              values="2;5;1;4;0;6;3;4.5;1.5;2"
              dur="2.1s"
              repeatCount="indefinite"
              begin="0.9s"
            />
          </>
        )}
      </rect>

      <rect x="15" y="6" width="2" height="12" fill="currentColor">
        {isRecording && (
          <>
            <animate
              attributeName="height"
              values="12;16;8;14;10;18;6;13;9;12"
              dur="3.3s"
              repeatCount="indefinite"
              begin="1.35s"
            />
            <animate
              attributeName="y"
              values="6;2;8;5;7;1;9;5.5;7.5;6"
              dur="3.3s"
              repeatCount="indefinite"
              begin="1.35s"
            />
          </>
        )}
      </rect>

      <rect x="19" y="10" width="2" height="4" fill="currentColor">
        {isRecording && (
          <>
            <animate
              attributeName="height"
              values="4;6;2;7;3;8;1;5;3;4"
              dur="3.0s"
              repeatCount="indefinite"
              begin="1.8s"
            />
            <animate
              attributeName="y"
              values="10;7;11;6.5;10.5;6;11.5;8.5;10.5;10"
              dur="3.0s"
              repeatCount="indefinite"
              begin="1.8s"
            />
          </>
        )}
      </rect>
    </svg>
  );
};

export function RecordButton({
  isRecording = false,
  isProcessing = false,
  onClick,
  disabled = false,
  size = 16,
}: RecordButtonProps) {
  const baseClassName = cn(
    buttonVariants({ variant: "ghost", size: "icon-xs" }),
    "size-6 mr-2 transition-all duration-300",
  );

  if (isProcessing) {
    return (
      <button
        type="button"
        className={cn(baseClassName, "opacity-50")}
        disabled
        aria-busy="true"
      >
        <Loader size={size} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        baseClassName,
        "text-muted-foreground hover:bg-transparent hover:text-foreground",
        isRecording && "text-red-500",
        disabled && "opacity-50",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <RecordIcon size={size} isRecording={isRecording} />
    </button>
  );
}
