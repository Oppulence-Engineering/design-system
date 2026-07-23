/**
 * Per-node error boundary (§6). A throwing consumer component becomes an inline error
 * card instead of unmounting the whole canvas. Keyed by id+componentKey; resets on prop
 * change. Reports through `onError` so consumers' Sentry sees it.
 */

"use client";

import * as React from "react";
import type { NodeId } from "../document/ids";

interface Props {
  nodeId: NodeId;
  resetKey: string;
  onError?: (error: unknown) => void;
  children: React.ReactNode;
}

interface State {
  error: unknown;
}

export class NodeErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown): void {
    this.props.onError?.(error);
  }

  componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error !== null) {
      this.setState({ error: null });
    }
  }

  render(): React.ReactNode {
    if (this.state.error !== null) {
      return (
        <div
          data-canvas-node-error=""
          style={{
            border: "1px solid var(--ic-error, #e5484d)",
            background: "var(--ic-error-bg, rgba(229,72,77,0.08))",
            color: "var(--ic-error, #e5484d)",
            font: "12px/1.4 system-ui, sans-serif",
            padding: "8px 10px",
            borderRadius: 6,
          }}
        >
          Component failed to render
        </div>
      );
    }
    return this.props.children;
  }
}
