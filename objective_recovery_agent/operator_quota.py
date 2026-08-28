"""Small shared admission budget; metadata only, never recovery-state persistence."""

from datetime import UTC, datetime
from typing import Any

from google.cloud import firestore


class OperatorRateLimited(Exception):
    pass


class FirestoreOperatorQuota:
    """Atomic across replicas: 6 queries/user/minute and 120 queries/project/UTC day.

    Failed requests consume budget. Only two counters are touched, before reasoning;
    no query text, model output, credentials, or recovery document is stored here.
    """

    def __init__(self, project: str) -> None:
        self._client = firestore.Client(project=project)

    def consume(self, subject_hash: str) -> None:
        now = datetime.now(UTC)
        collection = self._client.collection("operator_query_quota")
        subject = collection.document(f"subject-{subject_hash}")
        project = collection.document("global")
        minute = now.strftime("%Y%m%d%H%M")
        day = now.strftime("%Y%m%d")

        @firestore.transactional
        def admit(transaction: Any) -> None:
            user_value = subject.get(transaction=transaction).to_dict() or {}
            global_value = project.get(transaction=transaction).to_dict() or {}
            user_count = (
                int(user_value.get("count", 0)) if user_value.get("window") == minute else 0
            )
            global_count = (
                int(global_value.get("count", 0)) if global_value.get("window") == day else 0
            )
            if user_count >= 6 or global_count >= 120:
                raise OperatorRateLimited("Operator request budget exhausted")
            transaction.set(subject, {"window": minute, "count": user_count + 1})
            transaction.set(project, {"window": day, "count": global_count + 1})

        admit(self._client.transaction())
