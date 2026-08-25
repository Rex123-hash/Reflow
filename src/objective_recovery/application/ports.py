"""External action boundary contracts."""

from typing import Protocol

from objective_recovery.domain.models import Action, ActionReceipt


class ActionExecutor(Protocol):
    def execute(self, action: Action) -> ActionReceipt: ...
