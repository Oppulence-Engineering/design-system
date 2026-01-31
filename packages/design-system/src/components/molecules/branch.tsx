"use client";

import type { ChatRole } from "../../../lib/ai";
import { cn } from "../../../lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import { buttonVariants } from "../atoms/button";

type BranchContextType = {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: ReactElement[];
  setBranches: (branches: ReactElement[]) => void;
};

const BranchContext = createContext<BranchContextType | null>(null);

const useBranch = () => {
  const context = useContext(BranchContext);

  if (!context) {
    throw new Error("Branch components must be used within Branch");
  }

  return context;
};

export type BranchProps = Omit<HTMLAttributes<HTMLDivElement>, "className"> & {
  defaultBranch?: number;
  onBranchChange?: (branchIndex: number) => void;
};

export const Branch = ({
  defaultBranch = 0,
  onBranchChange,
  ...props
}: BranchProps) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<ReactElement[]>([]);

  const handleBranchChange = (newBranch: number) => {
    setCurrentBranch(newBranch);
    onBranchChange?.(newBranch);
  };

  const goToPrevious = () => {
    const newBranch =
      currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  };

  const goToNext = () => {
    const newBranch =
      currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  };

  const contextValue: BranchContextType = {
    currentBranch,
    totalBranches: branches.length,
    goToPrevious,
    goToNext,
    branches,
    setBranches,
  };

  return (
    <BranchContext.Provider value={contextValue}>
      <div className="grid w-full gap-2 [&>div]:pb-0" {...props} />
    </BranchContext.Provider>
  );
};

export type BranchMessagesProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className"
>;

export const BranchMessages = ({ children, ...props }: BranchMessagesProps) => {
  const { currentBranch, setBranches, branches } = useBranch();
  const childrenArray = Array.isArray(children) ? children : [children];

  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray as ReactElement[]);
    }
  }, [childrenArray, branches, setBranches]);

  return (childrenArray as ReactElement[]).map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden",
      )}
      key={branch.key}
      {...props}
    >
      {branch}
    </div>
  ));
};

export type BranchSelectorProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className"
> & {
  from: ChatRole;
};

export const BranchSelector = ({ from, ...props }: BranchSelectorProps) => {
  const { totalBranches } = useBranch();

  if (totalBranches <= 1) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 self-end px-10",
        from === "assistant" ? "justify-start" : "justify-end",
      )}
      {...props}
    />
  );
};

export type BranchPreviousProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
>;

export const BranchPrevious = ({ children, ...props }: BranchPreviousProps) => {
  const { goToPrevious, totalBranches } = useBranch();

  return (
    <button
      aria-label="Previous branch"
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-round-sm" }),
        "text-muted-foreground hover:text-foreground",
      )}
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      type="button"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} />}
    </button>
  );
};

export type BranchNextProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
>;

export const BranchNext = ({ children, ...props }: BranchNextProps) => {
  const { goToNext, totalBranches } = useBranch();

  return (
    <button
      aria-label="Next branch"
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-round-sm" }),
        "text-muted-foreground hover:text-foreground",
      )}
      disabled={totalBranches <= 1}
      onClick={goToNext}
      type="button"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} />}
    </button>
  );
};

export type BranchPageProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  "className"
>;

export const BranchPage = ({ ...props }: BranchPageProps) => {
  const { currentBranch, totalBranches } = useBranch();

  return (
    <span
      className="font-medium text-muted-foreground text-xs tabular-nums"
      {...props}
    >
      {currentBranch + 1} of {totalBranches}
    </span>
  );
};
