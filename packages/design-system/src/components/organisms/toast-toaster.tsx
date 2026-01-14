"use client";

import { Icons } from "../atoms/icons";
import { Progress } from "../atoms/progress";
import { Spinner } from "../atoms/spinner";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast";
import { useToast } from "./use-toast";

export function ToastToaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(
        ({
          id,
          title,
          description,
          progress = 0,
          action,
          footer,
          ...props
        }) => {
          return (
            <Toast key={id} {...props}>
              <div className="flex flex-col">
                <div className="flex w-full">
                  <div className="space-y-2 w-full justify-center">
                    <div className="flex space-x-2 justify-between">
                      <div className="flex space-x-2 items-center">
                        {props?.variant && (
                          <div className="w-[20px] h-[20px] flex items-center">
                            {props.variant === "ai" && (
                              <Icons.AI size={16} color="#0064D9" />
                            )}
                            {props?.variant === "success" && (
                              <Icons.Check size={16} />
                            )}
                            {props?.variant === "error" && (
                              <Icons.Error size={16} color="#FF3638" />
                            )}
                            {props?.variant === "progress" && <Spinner />}
                            {props?.variant === "spinner" && <Spinner />}
                          </div>
                        )}
                        <div>{title && <ToastTitle>{title}</ToastTitle>}</div>
                      </div>

                      <div>
                        {props?.variant === "progress" && (
                          <span className="text-sm text-[#878787]">
                            {progress}%
                          </span>
                        )}
                      </div>
                    </div>

                    {props.variant === "progress" && <Progress value={progress} />}

                    {description && (
                      <ToastDescription>{description}</ToastDescription>
                    )}
                  </div>
                  {action}
                  <ToastClose />
                </div>

                <div className="w-full flex justify-end">{footer}</div>
              </div>
            </Toast>
          );
        },
      )}
      <ToastViewport />
    </ToastProvider>
  );
}
