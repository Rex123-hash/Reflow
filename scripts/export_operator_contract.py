"""Export only P2F schemas, without changing the frozen P2E presentation contract."""

import argparse
import json
from pathlib import Path

from objective_recovery_agent.operator_schemas import (
    OperatorActionView,
    OperatorQuery,
    OperatorResponse,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    schemas = {}
    for model in (OperatorQuery, OperatorResponse, OperatorActionView):
        schema = model.model_json_schema(ref_template="#/components/schemas/{model}")
        schemas.update(schema.pop("$defs", {}))
        schemas[model.__name__] = schema
    document = {
        "openapi": "3.1.0",
        "info": {"title": "Reflow Operator", "version": "p2f-v1"},
        "paths": {
            "/api/v1/operator/query": {
                "post": {
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/OperatorQuery"}
                            }
                        },
                    },
                    "responses": {
                        "200": {
                            "description": "Validated reasoning or controlled action result",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/OperatorResponse"}
                                }
                            },
                        }
                    },
                }
            },
            "/api/v1/operator/actions/{action_id}/approve": {
                "post": {
                    "parameters": [
                        {
                            "in": "path",
                            "name": "action_id",
                            "required": True,
                            "schema": {"type": "string", "pattern": "^[a-f0-9]{64}$"},
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Approved action result after execution and read-back",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/OperatorActionView"
                                    }
                                }
                            },
                        }
                    },
                }
            },
        },
        "components": {"schemas": schemas},
    }
    text = json.dumps(document, indent=2, sort_keys=True) + "\n"
    path = Path(__file__).resolve().parents[1] / "docs/operator-openapi.json"
    if args.check:
        if path.read_text(encoding="utf-8") != text:
            raise SystemExit("Operator contract is stale")
    else:
        path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
