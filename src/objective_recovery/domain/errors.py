"""Explicit domain failures."""


class DomainError(Exception):
    """Base class for expected domain failures."""


class DuplicateNodeError(DomainError):
    """Raised when a graph node identifier is reused."""


class UnknownNodeError(DomainError):
    """Raised when a graph edge or traversal references a missing node."""


class InvalidGraphEdgeError(DomainError):
    """Raised when an operational dependency edge is invalid."""


class CycleDetectedError(InvalidGraphEdgeError):
    """Raised when an edge would make the operational graph cyclic."""


class NoValidPlanError(DomainError):
    """Raised when deterministic validation leaves no selectable plan."""


class IllegalStateTransitionError(DomainError):
    """Raised when an incident lifecycle transition is not legal."""


class ResolutionRequiresVerificationError(IllegalStateTransitionError):
    """Raised when code tries to resolve an incident without verification."""


class DuplicateIdempotencyKeyError(DomainError):
    """Raised when two different action intentions reuse a stable key."""


class ReceiptMismatchError(DomainError):
    """Raised when an action receipt does not match its claimed intention."""
