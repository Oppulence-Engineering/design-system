import type { ComponentProps } from "react";
import type { GeneratedImage } from "../../../lib/ai";

export type ImageProps = GeneratedImage &
  Omit<ComponentProps<"img">, "src" | "className"> & {
    alt?: string;
  };

export function Image({ base64, mediaType, alt, ...props }: ImageProps) {
  return (
    <img
      {...props}
      alt={alt}
      className="h-auto max-w-full overflow-hidden rounded-md"
      src={`data:${mediaType};base64,${base64}`}
    />
  );
}
