import type { ReactNode } from "react";
import type { UiDataError } from "../data/UiDataProvider";
import { Icon } from "./Icon";

export function Notice({
  children,
  dashed = false,
  tone = "info",
}: {
  children: ReactNode;
  dashed?: boolean;
  tone?: "info" | "shield";
}) {
  return (
    <div className={`notice${dashed ? " is-dashed" : ""}`}>
      <Icon name={tone === "shield" ? "shield" : "info"} size={15} />
      <p>{children}</p>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  resource_not_found: {
    title: "That incident does not exist",
    body: "Reflow has no durable recovery state under this identifier. Nothing has been guessed in its place.",
  },
  backend_infrastructure_unavailable: {
    title: "Reflow's records are temporarily unreadable",
    body: "The presentation backend could not be reached. This says nothing about the objective — an unreadable authority is not a failed one.",
  },
  malformed_request: {
    title: "That request was not valid",
    body: "The cursor or filter in the address is malformed. Reload the page to start from a known position.",
  },
  transport_failure: {
    title: "Reflow's records could not be loaded",
    body: "The request did not complete. This says nothing about the objective — an unreadable authority is not a failed one.",
  },
  authentication_required: {
    title: "Your product session expired",
    body: "Sign in again to return to the workspace. No recovery state was changed.",
  },
};

export function ErrorState({
  error,
  onRetry,
}: {
  error: UiDataError;
  onRetry?: () => void;
}) {
  const copy = ERROR_COPY[error.code] ?? ERROR_COPY.transport_failure;
  return (
    <EmptyState
      title={copy.title}
      action={
        onRetry ? (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Try again
          </button>
        ) : undefined
      }
    >
      {copy.body}
    </EmptyState>
  );
}

export function LoadingState({
  label,
  rows = 3,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{ display: "grid", gap: "var(--space-3)" }}
    >
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{ height: index === 0 ? 34 : 66 }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
