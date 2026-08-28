"""Create the one dedicated Calendar resource used by human-directed qualification."""

from __future__ import annotations

import argparse
import json

from objective_recovery_agent.calendar_operator_adapter import OperatorCalendarGateway


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--calendar-id", required=True)
    parser.add_argument("--service-account", required=True)
    parser.add_argument("--event-id", default="p2goperator20260828")
    parser.add_argument("--start", default="2026-08-29T15:00:00+05:30")
    parser.add_argument("--end", default="2026-08-29T16:00:00+05:30")
    args = parser.parse_args()
    gateway = OperatorCalendarGateway(
        service_account_email=args.service_account,
        request_timeout=20,
    )
    existing = gateway.get_event(args.calendar_id, args.event_id)
    if existing is not None:
        extended = existing.get("extendedProperties", {})
        marker = (
            extended.get("private", {}).get("reflow_resource")
            if isinstance(extended, dict) and isinstance(extended.get("private"), dict)
            else None
        )
        if marker != "operator_demo":
            raise SystemExit("Refusing to adopt an event without the Operator-demo marker")
        print(json.dumps({"event_id": args.event_id, "result": "EXISTS"}))
        return
    created = gateway.create_operator_demo_event(
        args.calendar_id,
        args.event_id,
        args.start,
        args.end,
    )
    print(
        json.dumps(
            {
                "event_id": str(created.get("id")),
                "result": "CREATED",
                "summary": str(created.get("summary")),
            }
        )
    )


if __name__ == "__main__":
    main()
