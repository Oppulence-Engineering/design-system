/**
 * Design-lint hook (§ a11y). Re-lints on document change; clicking an issue selects the
 * offending node.
 */

"use client";

import * as React from "react";
import type { NodeId } from "../document/ids";
import { useCanvas } from "../store/context";
import { useDocumentStore } from "../store/hooks";
import { lintDocument, type LintIssue } from "./lint";

export interface DesignLint {
  issues: LintIssue[];
  select: (nodeId: NodeId) => void;
}

export function useDesignLint(): DesignLint {
  const { sessionStore } = useCanvas();
  const document = useDocumentStore((s) => s.document);
  const issues = React.useMemo(() => lintDocument(document), [document]);
  return {
    issues,
    select: (nodeId) => sessionStore.getState().setSelection([nodeId]),
  };
}
