// @ts-nocheck -- generated standalone validator
/* oxlint-disable */
"use strict";
export const validateOperatorResponse = validate20;
const schema31 = {
  $id: "operator-response",
  $ref: "operator-contract#/components/schemas/OperatorResponse",
};
const schema33 = {
  additionalProperties: false,
  properties: {
    action: {
      anyOf: [
        { $ref: "#/components/schemas/OperatorActionView" },
        { type: "null" },
      ],
      default: null,
    },
    agents: {
      items: { $ref: "#/components/schemas/OperatorAgentTrace" },
      maxItems: 3,
      title: "Agents",
      type: "array",
    },
    answer: { maxLength: 8000, minLength: 1, title: "Answer", type: "string" },
    conversation: { $ref: "#/components/schemas/ConversationEnvelope" },
    disposition: {
      enum: ["SUPPORTED", "CLARIFICATION_REQUIRED", "UNSUPPORTED"],
      title: "Disposition",
      type: "string",
    },
    evidence: {
      items: { $ref: "#/components/schemas/OperatorEvidence" },
      maxItems: 40,
      title: "Evidence",
      type: "array",
    },
    external_effects_executed: {
      default: false,
      title: "External Effects Executed",
      type: "boolean",
    },
    facts: {
      items: { $ref: "#/components/schemas/OperatorFact" },
      maxItems: 12,
      title: "Facts",
      type: "array",
    },
    generated_at: { title: "Generated At", type: "string" },
    human_response: { $ref: "#/components/schemas/HumanResponse" },
    hypothetical_deadline: {
      anyOf: [{ type: "string" }, { type: "null" }],
      default: null,
      title: "Hypothetical Deadline",
    },
    incident_id: { title: "Incident Id", type: "string" },
    inspection: {
      anyOf: [
        { $ref: "#/components/schemas/OperatorInspection" },
        { type: "null" },
      ],
      default: null,
    },
    intent: {
      anyOf: [
        { $ref: "#/components/schemas/OperatorIntent" },
        { type: "null" },
      ],
      default: null,
    },
    provenance: {
      enum: [
        "CONVERSATION_ONLY",
        "AUTHORITATIVE_SNAPSHOT",
        "HYPOTHETICAL_NO_ACTION",
        "OPERATOR_ACTION",
      ],
      title: "Provenance",
      type: "string",
    },
    request_id: { title: "Request Id", type: "string" },
    revision: { title: "Revision", type: "integer" },
    simulation: {
      anyOf: [
        { $ref: "#/components/schemas/SimulationResult" },
        { type: "null" },
      ],
      default: null,
    },
    snapshot_fingerprint: { title: "Snapshot Fingerprint", type: "string" },
  },
  required: [
    "request_id",
    "incident_id",
    "revision",
    "snapshot_fingerprint",
    "generated_at",
    "disposition",
    "conversation",
    "human_response",
    "answer",
    "facts",
    "evidence",
    "provenance",
    "agents",
  ],
  title: "OperatorResponse",
  type: "object",
};
const schema39 = {
  additionalProperties: false,
  properties: {
    agent_id: {
      enum: [
        "conversation_understanding_agent",
        "operator_intent_interpreter",
        "simulation_agent",
      ],
      title: "Agent Id",
      type: "string",
    },
    attempts: { title: "Attempts", type: "integer" },
    input_tokens: { title: "Input Tokens", type: "integer" },
    latency_ms: { title: "Latency Ms", type: "integer" },
    model: { title: "Model", type: "string" },
    output_tokens: { title: "Output Tokens", type: "integer" },
    request_id: { title: "Request Id", type: "string" },
    total_tokens: { title: "Total Tokens", type: "integer" },
    validation: {
      const: "PASSED",
      default: "PASSED",
      title: "Validation",
      type: "string",
    },
  },
  required: [
    "agent_id",
    "model",
    "request_id",
    "latency_ms",
    "attempts",
    "input_tokens",
    "output_tokens",
    "total_tokens",
  ],
  title: "OperatorAgentTrace",
  type: "object",
};
const schema42 = {
  additionalProperties: false,
  properties: {
    evidence_id: {
      maxLength: 200,
      minLength: 1,
      title: "Evidence Id",
      type: "string",
    },
    observed_at: {
      anyOf: [{ type: "string" }, { type: "null" }],
      title: "Observed At",
    },
    title: { maxLength: 800, minLength: 1, title: "Title", type: "string" },
  },
  required: ["evidence_id", "title", "observed_at"],
  title: "OperatorEvidence",
  type: "object",
};
const schema43 = {
  additionalProperties: false,
  properties: {
    evidence_ids: {
      items: { maxLength: 200, minLength: 1, type: "string" },
      maxItems: 8,
      title: "Evidence Ids",
      type: "array",
    },
    fact_id: { maxLength: 200, minLength: 1, title: "Fact Id", type: "string" },
    text: { maxLength: 800, minLength: 1, title: "Text", type: "string" },
  },
  required: ["fact_id", "text", "evidence_ids"],
  title: "OperatorFact",
  type: "object",
};
const schema44 = {
  additionalProperties: false,
  properties: {
    current_state: {
      maxLength: 800,
      minLength: 1,
      title: "Current State",
      type: "string",
    },
    human_summary: {
      maxLength: 1600,
      minLength: 1,
      title: "Human Summary",
      type: "string",
    },
    next_step: {
      anyOf: [
        { maxLength: 800, minLength: 1, type: "string" },
        { type: "null" },
      ],
      default: null,
      title: "Next Step",
    },
    situation_type: {
      enum: [
        "GENERAL",
        "HELP",
        "SUCCESS",
        "FAILED",
        "UNCERTAIN",
        "DENIED",
        "UNSUPPORTED",
        "NEEDS_CLARIFICATION",
        "INSPECTION",
        "SIMULATION",
        "EXPLANATION",
        "OBJECTIVE_RESTORED",
      ],
      title: "Situation Type",
      type: "string",
    },
    suggestions: {
      default: [],
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 3,
      title: "Suggestions",
      type: "array",
    },
    truth_boundary: {
      maxLength: 800,
      minLength: 1,
      title: "Truth Boundary",
      type: "string",
    },
    why: {
      anyOf: [
        { maxLength: 800, minLength: 1, type: "string" },
        { type: "null" },
      ],
      default: null,
      title: "Why",
    },
  },
  required: [
    "human_summary",
    "situation_type",
    "current_state",
    "truth_boundary",
  ],
  title: "HumanResponse",
  type: "object",
};
const schema45 = {
  additionalProperties: false,
  properties: {
    authority: {
      enum: ["JIRA", "GOOGLE_CALENDAR", "REFLOW", "SLACK"],
      title: "Authority",
      type: "string",
    },
    observed_at: { title: "Observed At", type: "string" },
    observed_state: {
      additionalProperties: { anyOf: [{ type: "string" }, { type: "null" }] },
      title: "Observed State",
      type: "object",
    },
    resource_identifier: { title: "Resource Identifier", type: "string" },
    resource_type: {
      enum: ["ISSUE", "EVENT", "OBJECTIVE", "CHANNEL"],
      title: "Resource Type",
      type: "string",
    },
  },
  required: [
    "authority",
    "resource_type",
    "resource_identifier",
    "observed_state",
    "observed_at",
  ],
  title: "OperatorInspection",
  type: "object",
};
const func1 = Object.prototype.hasOwnProperty;
const func4 = (value) => Array.from(value).length;
const schema34 = {
  additionalProperties: false,
  properties: {
    adapter_proof: {
      additionalProperties: { type: "string" },
      title: "Adapter Proof",
      type: "object",
    },
    authenticated_subject_hash: {
      title: "Authenticated Subject Hash",
      type: "string",
    },
    authority: {
      enum: ["JIRA", "GOOGLE_CALENDAR", "REFLOW", "SLACK"],
      title: "Authority",
      type: "string",
    },
    authorization_result: {
      enum: ["AUTO_EXECUTABLE", "APPROVAL_REQUIRED", "DENIED"],
      title: "Authorization Result",
      type: "string",
    },
    created_at: { title: "Created At", type: "string" },
    error_category: {
      anyOf: [{ type: "string" }, { type: "null" }],
      default: null,
      title: "Error Category",
    },
    execution_acknowledgement: {
      additionalProperties: { type: "string" },
      title: "Execution Acknowledgement",
      type: "object",
    },
    expected_state: {
      additionalProperties: { anyOf: [{ type: "string" }, { type: "null" }] },
      title: "Expected State",
      type: "object",
    },
    external_effects_possible: {
      default: false,
      title: "External Effects Possible",
      type: "boolean",
    },
    lifecycle: {
      enum: [
        "REQUESTED",
        "AUTHORIZED",
        "APPROVAL_REQUIRED",
        "APPROVED",
        "EXECUTING",
        "EXECUTED",
        "READ_BACK",
        "VERIFIED",
        "VERIFICATION_FAILED",
        "DENIED",
        "FAILED",
      ],
      title: "Lifecycle",
      type: "string",
    },
    observed_state: {
      additionalProperties: { anyOf: [{ type: "string" }, { type: "null" }] },
      title: "Observed State",
      type: "object",
    },
    operations: {
      items: { $ref: "#/components/schemas/RequestedOperation" },
      title: "Operations",
      type: "array",
    },
    operator_action_id: { title: "Operator Action Id", type: "string" },
    request_fingerprint: {
      anyOf: [{ type: "string" }, { type: "null" }],
      default: null,
      title: "Request Fingerprint",
    },
    request_id: { title: "Request Id", type: "string" },
    resource_identifier: { title: "Resource Identifier", type: "string" },
    resource_type: {
      enum: ["ISSUE", "EVENT", "OBJECTIVE", "CHANNEL"],
      title: "Resource Type",
      type: "string",
    },
    updated_at: { title: "Updated At", type: "string" },
    verification_result: {
      default: "NOT_RUN",
      enum: ["NOT_RUN", "PASSED", "FAILED"],
      title: "Verification Result",
      type: "string",
    },
  },
  required: [
    "operator_action_id",
    "request_id",
    "authenticated_subject_hash",
    "authority",
    "resource_type",
    "resource_identifier",
    "operations",
    "authorization_result",
    "lifecycle",
    "created_at",
    "updated_at",
  ],
  title: "OperatorActionView",
  type: "object",
};
const schema35 = {
  additionalProperties: false,
  properties: {
    calendar_event: {
      anyOf: [
        { $ref: "#/components/schemas/CalendarEventCreation" },
        { type: "null" },
      ],
      default: null,
    },
    comment: {
      anyOf: [
        { maxLength: 1000, minLength: 1, type: "string" },
        { type: "null" },
      ],
      default: null,
      title: "Comment",
    },
    operation: {
      enum: [
        "JIRA_TRANSITION",
        "JIRA_SET_PRIORITY",
        "JIRA_ASSIGN",
        "JIRA_SET_DUE_DATE",
        "JIRA_ADD_COMMENT",
        "CALENDAR_RESCHEDULE",
        "CALENDAR_UPDATE_TITLE",
        "CALENDAR_UPDATE_DESCRIPTION",
        "CREATE_CALENDAR_EVENT",
        "MOVE_PROTECTED_DEADLINE",
        "SLACK_INSPECT_CHANNEL",
        "SLACK_POST_MESSAGE",
      ],
      title: "Operation",
      type: "string",
    },
    value: {
      anyOf: [
        { maxLength: 800, minLength: 1, type: "string" },
        { type: "null" },
      ],
      default: null,
      title: "Value",
    },
  },
  required: ["operation"],
  title: "RequestedOperation",
  type: "object",
};
const schema36 = {
  additionalProperties: false,
  properties: {
    description: {
      anyOf: [{ maxLength: 4000, type: "string" }, { type: "null" }],
      default: null,
      title: "Description",
    },
    duration_minutes: {
      anyOf: [{ maximum: 1440, minimum: 1, type: "integer" }, { type: "null" }],
      default: null,
      title: "Duration Minutes",
    },
    end: { maxLength: 40, minLength: 20, title: "End", type: "string" },
    location: {
      anyOf: [{ maxLength: 500, type: "string" }, { type: "null" }],
      default: null,
      title: "Location",
    },
    reminders: { $ref: "#/components/schemas/CalendarReminderConfiguration" },
    start: { maxLength: 40, minLength: 20, title: "Start", type: "string" },
    summary: { maxLength: 200, minLength: 1, title: "Summary", type: "string" },
    time_basis: {
      enum: ["ABSOLUTE", "RELATIVE"],
      title: "Time Basis",
      type: "string",
    },
    timezone: {
      maxLength: 64,
      minLength: 1,
      title: "Timezone",
      type: "string",
    },
  },
  required: ["summary", "start", "end", "timezone", "time_basis"],
  title: "CalendarEventCreation",
  type: "object",
};
const schema37 = {
  additionalProperties: false,
  properties: {
    overrides: {
      default: [],
      items: { $ref: "#/components/schemas/CalendarReminder" },
      maxItems: 5,
      title: "Overrides",
      type: "array",
    },
    use_default: { title: "Use Default", type: "boolean" },
  },
  required: ["use_default"],
  title: "CalendarReminderConfiguration",
  type: "object",
};
const schema38 = {
  additionalProperties: false,
  properties: {
    method: { enum: ["popup", "email"], title: "Method", type: "string" },
    minutes: { maximum: 40320, minimum: 0, title: "Minutes", type: "integer" },
  },
  required: ["method", "minutes"],
  title: "CalendarReminder",
  type: "object",
};

function validate26(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate26.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.use_default === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "use_default" },
        message: "must have required property '" + "use_default" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "overrides" || key0 === "use_default")) {
        const err1 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.overrides !== undefined) {
      let data0 = data.overrides;
      if (Array.isArray(data0)) {
        if (data0.length > 5) {
          const err2 = {
            instancePath: instancePath + "/overrides",
            schemaPath: "#/properties/overrides/maxItems",
            keyword: "maxItems",
            params: { limit: 5 },
            message: "must NOT have more than 5 items",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        const len0 = data0.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data1 = data0[i0];
          if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
            if (data1.method === undefined) {
              const err3 = {
                instancePath: instancePath + "/overrides/" + i0,
                schemaPath: "#/components/schemas/CalendarReminder/required",
                keyword: "required",
                params: { missingProperty: "method" },
                message: "must have required property '" + "method" + "'",
              };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
            }
            if (data1.minutes === undefined) {
              const err4 = {
                instancePath: instancePath + "/overrides/" + i0,
                schemaPath: "#/components/schemas/CalendarReminder/required",
                keyword: "required",
                params: { missingProperty: "minutes" },
                message: "must have required property '" + "minutes" + "'",
              };
              if (vErrors === null) {
                vErrors = [err4];
              } else {
                vErrors.push(err4);
              }
              errors++;
            }
            for (const key1 in data1) {
              if (!(key1 === "method" || key1 === "minutes")) {
                const err5 = {
                  instancePath: instancePath + "/overrides/" + i0,
                  schemaPath:
                    "#/components/schemas/CalendarReminder/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err5];
                } else {
                  vErrors.push(err5);
                }
                errors++;
              }
            }
            if (data1.method !== undefined) {
              let data2 = data1.method;
              if (typeof data2 !== "string") {
                const err6 = {
                  instancePath: instancePath + "/overrides/" + i0 + "/method",
                  schemaPath:
                    "#/components/schemas/CalendarReminder/properties/method/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err6];
                } else {
                  vErrors.push(err6);
                }
                errors++;
              }
              if (!(data2 === "popup" || data2 === "email")) {
                const err7 = {
                  instancePath: instancePath + "/overrides/" + i0 + "/method",
                  schemaPath:
                    "#/components/schemas/CalendarReminder/properties/method/enum",
                  keyword: "enum",
                  params: { allowedValues: schema38.properties.method.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err7];
                } else {
                  vErrors.push(err7);
                }
                errors++;
              }
            }
            if (data1.minutes !== undefined) {
              let data3 = data1.minutes;
              if (!(
                typeof data3 == "number" &&
                !(data3 % 1) &&
                !isNaN(data3)
              )) {
                const err8 = {
                  instancePath: instancePath + "/overrides/" + i0 + "/minutes",
                  schemaPath:
                    "#/components/schemas/CalendarReminder/properties/minutes/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err8];
                } else {
                  vErrors.push(err8);
                }
                errors++;
              }
              if (typeof data3 == "number") {
                if (data3 > 40320 || isNaN(data3)) {
                  const err9 = {
                    instancePath:
                      instancePath + "/overrides/" + i0 + "/minutes",
                    schemaPath:
                      "#/components/schemas/CalendarReminder/properties/minutes/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 40320 },
                    message: "must be <= 40320",
                  };
                  if (vErrors === null) {
                    vErrors = [err9];
                  } else {
                    vErrors.push(err9);
                  }
                  errors++;
                }
                if (data3 < 0 || isNaN(data3)) {
                  const err10 = {
                    instancePath:
                      instancePath + "/overrides/" + i0 + "/minutes",
                    schemaPath:
                      "#/components/schemas/CalendarReminder/properties/minutes/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err10];
                  } else {
                    vErrors.push(err10);
                  }
                  errors++;
                }
              }
            }
          } else {
            const err11 = {
              instancePath: instancePath + "/overrides/" + i0,
              schemaPath: "#/components/schemas/CalendarReminder/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/overrides",
          schemaPath: "#/properties/overrides/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.use_default !== undefined) {
      if (typeof data.use_default !== "boolean") {
        const err13 = {
          instancePath: instancePath + "/use_default",
          schemaPath: "#/properties/use_default/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
  } else {
    const err14 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate26.errors = vErrors;
  return errors === 0;
}
validate26.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};

function validate25(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate25.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.summary === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "summary" },
        message: "must have required property '" + "summary" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.start === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "start" },
        message: "must have required property '" + "start" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.end === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "end" },
        message: "must have required property '" + "end" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.timezone === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "timezone" },
        message: "must have required property '" + "timezone" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.time_basis === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "time_basis" },
        message: "must have required property '" + "time_basis" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema36.properties, key0)) {
        const err5 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      let data0 = data.description;
      const _errs3 = errors;
      let valid1 = false;
      const _errs4 = errors;
      if (typeof data0 === "string") {
        if (func4(data0) > 4000) {
          const err6 = {
            instancePath: instancePath + "/description",
            schemaPath: "#/properties/description/anyOf/0/maxLength",
            keyword: "maxLength",
            params: { limit: 4000 },
            message: "must NOT have more than 4000 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/description",
          schemaPath: "#/properties/description/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
      var _valid0 = _errs4 === errors;
      valid1 = valid1 || _valid0;
      const _errs6 = errors;
      if (data0 !== null) {
        const err8 = {
          instancePath: instancePath + "/description",
          schemaPath: "#/properties/description/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      var _valid0 = _errs6 === errors;
      valid1 = valid1 || _valid0;
      if (!valid1) {
        const err9 = {
          instancePath: instancePath + "/description",
          schemaPath: "#/properties/description/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.duration_minutes !== undefined) {
      let data1 = data.duration_minutes;
      const _errs9 = errors;
      let valid2 = false;
      const _errs10 = errors;
      if (!(typeof data1 == "number" && !(data1 % 1) && !isNaN(data1))) {
        const err10 = {
          instancePath: instancePath + "/duration_minutes",
          schemaPath: "#/properties/duration_minutes/anyOf/0/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      if (typeof data1 == "number") {
        if (data1 > 1440 || isNaN(data1)) {
          const err11 = {
            instancePath: instancePath + "/duration_minutes",
            schemaPath: "#/properties/duration_minutes/anyOf/0/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 1440 },
            message: "must be <= 1440",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (data1 < 1 || isNaN(data1)) {
          const err12 = {
            instancePath: instancePath + "/duration_minutes",
            schemaPath: "#/properties/duration_minutes/anyOf/0/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 1 },
            message: "must be >= 1",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      }
      var _valid1 = _errs10 === errors;
      valid2 = valid2 || _valid1;
      const _errs12 = errors;
      if (data1 !== null) {
        const err13 = {
          instancePath: instancePath + "/duration_minutes",
          schemaPath: "#/properties/duration_minutes/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      var _valid1 = _errs12 === errors;
      valid2 = valid2 || _valid1;
      if (!valid2) {
        const err14 = {
          instancePath: instancePath + "/duration_minutes",
          schemaPath: "#/properties/duration_minutes/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      } else {
        errors = _errs9;
        if (vErrors !== null) {
          if (_errs9) {
            vErrors.length = _errs9;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.end !== undefined) {
      let data2 = data.end;
      if (typeof data2 === "string") {
        if (func4(data2) > 40) {
          const err15 = {
            instancePath: instancePath + "/end",
            schemaPath: "#/properties/end/maxLength",
            keyword: "maxLength",
            params: { limit: 40 },
            message: "must NOT have more than 40 characters",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (func4(data2) < 20) {
          const err16 = {
            instancePath: instancePath + "/end",
            schemaPath: "#/properties/end/minLength",
            keyword: "minLength",
            params: { limit: 20 },
            message: "must NOT have fewer than 20 characters",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/end",
          schemaPath: "#/properties/end/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.location !== undefined) {
      let data3 = data.location;
      const _errs17 = errors;
      let valid3 = false;
      const _errs18 = errors;
      if (typeof data3 === "string") {
        if (func4(data3) > 500) {
          const err18 = {
            instancePath: instancePath + "/location",
            schemaPath: "#/properties/location/anyOf/0/maxLength",
            keyword: "maxLength",
            params: { limit: 500 },
            message: "must NOT have more than 500 characters",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = {
          instancePath: instancePath + "/location",
          schemaPath: "#/properties/location/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
      var _valid2 = _errs18 === errors;
      valid3 = valid3 || _valid2;
      const _errs20 = errors;
      if (data3 !== null) {
        const err20 = {
          instancePath: instancePath + "/location",
          schemaPath: "#/properties/location/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
      var _valid2 = _errs20 === errors;
      valid3 = valid3 || _valid2;
      if (!valid3) {
        const err21 = {
          instancePath: instancePath + "/location",
          schemaPath: "#/properties/location/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      } else {
        errors = _errs17;
        if (vErrors !== null) {
          if (_errs17) {
            vErrors.length = _errs17;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.reminders !== undefined) {
      if (
        !validate26(data.reminders, {
          instancePath: instancePath + "/reminders",
          parentData: data,
          parentDataProperty: "reminders",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate26.errors
            : vErrors.concat(validate26.errors);
        errors = vErrors.length;
      }
    }
    if (data.start !== undefined) {
      let data5 = data.start;
      if (typeof data5 === "string") {
        if (func4(data5) > 40) {
          const err22 = {
            instancePath: instancePath + "/start",
            schemaPath: "#/properties/start/maxLength",
            keyword: "maxLength",
            params: { limit: 40 },
            message: "must NOT have more than 40 characters",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (func4(data5) < 20) {
          const err23 = {
            instancePath: instancePath + "/start",
            schemaPath: "#/properties/start/minLength",
            keyword: "minLength",
            params: { limit: 20 },
            message: "must NOT have fewer than 20 characters",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/start",
          schemaPath: "#/properties/start/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.summary !== undefined) {
      let data6 = data.summary;
      if (typeof data6 === "string") {
        if (func4(data6) > 200) {
          const err25 = {
            instancePath: instancePath + "/summary",
            schemaPath: "#/properties/summary/maxLength",
            keyword: "maxLength",
            params: { limit: 200 },
            message: "must NOT have more than 200 characters",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (func4(data6) < 1) {
          const err26 = {
            instancePath: instancePath + "/summary",
            schemaPath: "#/properties/summary/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
      } else {
        const err27 = {
          instancePath: instancePath + "/summary",
          schemaPath: "#/properties/summary/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.time_basis !== undefined) {
      let data7 = data.time_basis;
      if (typeof data7 !== "string") {
        const err28 = {
          instancePath: instancePath + "/time_basis",
          schemaPath: "#/properties/time_basis/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
      if (!(data7 === "ABSOLUTE" || data7 === "RELATIVE")) {
        const err29 = {
          instancePath: instancePath + "/time_basis",
          schemaPath: "#/properties/time_basis/enum",
          keyword: "enum",
          params: { allowedValues: schema36.properties.time_basis.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.timezone !== undefined) {
      let data8 = data.timezone;
      if (typeof data8 === "string") {
        if (func4(data8) > 64) {
          const err30 = {
            instancePath: instancePath + "/timezone",
            schemaPath: "#/properties/timezone/maxLength",
            keyword: "maxLength",
            params: { limit: 64 },
            message: "must NOT have more than 64 characters",
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        if (func4(data8) < 1) {
          const err31 = {
            instancePath: instancePath + "/timezone",
            schemaPath: "#/properties/timezone/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
      } else {
        const err32 = {
          instancePath: instancePath + "/timezone",
          schemaPath: "#/properties/timezone/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err32];
        } else {
          vErrors.push(err32);
        }
        errors++;
      }
    }
  } else {
    const err33 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err33];
    } else {
      vErrors.push(err33);
    }
    errors++;
  }
  validate25.errors = vErrors;
  return errors === 0;
}
validate25.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};

function validate24(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate24.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.operation === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operation" },
        message: "must have required property '" + "operation" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "calendar_event" ||
        key0 === "comment" ||
        key0 === "operation" ||
        key0 === "value"
      )) {
        const err1 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.calendar_event !== undefined) {
      let data0 = data.calendar_event;
      const _errs3 = errors;
      let valid1 = false;
      const _errs4 = errors;
      if (
        !validate25(data0, {
          instancePath: instancePath + "/calendar_event",
          parentData: data,
          parentDataProperty: "calendar_event",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate25.errors
            : vErrors.concat(validate25.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      valid1 = valid1 || _valid0;
      const _errs5 = errors;
      if (data0 !== null) {
        const err2 = {
          instancePath: instancePath + "/calendar_event",
          schemaPath: "#/properties/calendar_event/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
      var _valid0 = _errs5 === errors;
      valid1 = valid1 || _valid0;
      if (!valid1) {
        const err3 = {
          instancePath: instancePath + "/calendar_event",
          schemaPath: "#/properties/calendar_event/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.comment !== undefined) {
      let data1 = data.comment;
      const _errs8 = errors;
      let valid2 = false;
      const _errs9 = errors;
      if (typeof data1 === "string") {
        if (func4(data1) > 1000) {
          const err4 = {
            instancePath: instancePath + "/comment",
            schemaPath: "#/properties/comment/anyOf/0/maxLength",
            keyword: "maxLength",
            params: { limit: 1000 },
            message: "must NOT have more than 1000 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func4(data1) < 1) {
          const err5 = {
            instancePath: instancePath + "/comment",
            schemaPath: "#/properties/comment/anyOf/0/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/comment",
          schemaPath: "#/properties/comment/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
      var _valid1 = _errs9 === errors;
      valid2 = valid2 || _valid1;
      const _errs11 = errors;
      if (data1 !== null) {
        const err7 = {
          instancePath: instancePath + "/comment",
          schemaPath: "#/properties/comment/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
      var _valid1 = _errs11 === errors;
      valid2 = valid2 || _valid1;
      if (!valid2) {
        const err8 = {
          instancePath: instancePath + "/comment",
          schemaPath: "#/properties/comment/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      } else {
        errors = _errs8;
        if (vErrors !== null) {
          if (_errs8) {
            vErrors.length = _errs8;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.operation !== undefined) {
      let data2 = data.operation;
      if (typeof data2 !== "string") {
        const err9 = {
          instancePath: instancePath + "/operation",
          schemaPath: "#/properties/operation/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (!(
        data2 === "JIRA_TRANSITION" ||
        data2 === "JIRA_SET_PRIORITY" ||
        data2 === "JIRA_ASSIGN" ||
        data2 === "JIRA_SET_DUE_DATE" ||
        data2 === "JIRA_ADD_COMMENT" ||
        data2 === "CALENDAR_RESCHEDULE" ||
        data2 === "CALENDAR_UPDATE_TITLE" ||
        data2 === "CALENDAR_UPDATE_DESCRIPTION" ||
        data2 === "CREATE_CALENDAR_EVENT" ||
        data2 === "MOVE_PROTECTED_DEADLINE" ||
        data2 === "SLACK_INSPECT_CHANNEL" ||
        data2 === "SLACK_POST_MESSAGE"
      )) {
        const err10 = {
          instancePath: instancePath + "/operation",
          schemaPath: "#/properties/operation/enum",
          keyword: "enum",
          params: { allowedValues: schema35.properties.operation.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.value !== undefined) {
      let data3 = data.value;
      const _errs16 = errors;
      let valid3 = false;
      const _errs17 = errors;
      if (typeof data3 === "string") {
        if (func4(data3) > 800) {
          const err11 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/properties/value/anyOf/0/maxLength",
            keyword: "maxLength",
            params: { limit: 800 },
            message: "must NOT have more than 800 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func4(data3) < 1) {
          const err12 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/properties/value/anyOf/0/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/properties/value/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      var _valid2 = _errs17 === errors;
      valid3 = valid3 || _valid2;
      const _errs19 = errors;
      if (data3 !== null) {
        const err14 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/properties/value/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
      var _valid2 = _errs19 === errors;
      valid3 = valid3 || _valid2;
      if (!valid3) {
        const err15 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/properties/value/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      } else {
        errors = _errs16;
        if (vErrors !== null) {
          if (_errs16) {
            vErrors.length = _errs16;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err16 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err16];
    } else {
      vErrors.push(err16);
    }
    errors++;
  }
  validate24.errors = vErrors;
  return errors === 0;
}
validate24.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};

function validate23(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.operator_action_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operator_action_id" },
        message: "must have required property '" + "operator_action_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.request_id === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "request_id" },
        message: "must have required property '" + "request_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.authenticated_subject_hash === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "authenticated_subject_hash" },
        message:
          "must have required property '" + "authenticated_subject_hash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.authority === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "authority" },
        message: "must have required property '" + "authority" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.resource_type === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "resource_type" },
        message: "must have required property '" + "resource_type" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.resource_identifier === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "resource_identifier" },
        message: "must have required property '" + "resource_identifier" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.operations === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operations" },
        message: "must have required property '" + "operations" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.authorization_result === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "authorization_result" },
        message: "must have required property '" + "authorization_result" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.lifecycle === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "lifecycle" },
        message: "must have required property '" + "lifecycle" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.created_at === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "created_at" },
        message: "must have required property '" + "created_at" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.updated_at === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updated_at" },
        message: "must have required property '" + "updated_at" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema34.properties, key0)) {
        const err11 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.adapter_proof !== undefined) {
      let data0 = data.adapter_proof;
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        for (const key1 in data0) {
          if (typeof data0[key1] !== "string") {
            const err12 = {
              instancePath:
                instancePath +
                "/adapter_proof/" +
                key1.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/adapter_proof/additionalProperties/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/adapter_proof",
          schemaPath: "#/properties/adapter_proof/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.authenticated_subject_hash !== undefined) {
      if (typeof data.authenticated_subject_hash !== "string") {
        const err14 = {
          instancePath: instancePath + "/authenticated_subject_hash",
          schemaPath: "#/properties/authenticated_subject_hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.authority !== undefined) {
      let data3 = data.authority;
      if (typeof data3 !== "string") {
        const err15 = {
          instancePath: instancePath + "/authority",
          schemaPath: "#/properties/authority/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
      if (!(
        data3 === "JIRA" ||
        data3 === "GOOGLE_CALENDAR" ||
        data3 === "REFLOW" ||
        data3 === "SLACK"
      )) {
        const err16 = {
          instancePath: instancePath + "/authority",
          schemaPath: "#/properties/authority/enum",
          keyword: "enum",
          params: { allowedValues: schema34.properties.authority.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.authorization_result !== undefined) {
      let data4 = data.authorization_result;
      if (typeof data4 !== "string") {
        const err17 = {
          instancePath: instancePath + "/authorization_result",
          schemaPath: "#/properties/authorization_result/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
      if (!(
        data4 === "AUTO_EXECUTABLE" ||
        data4 === "APPROVAL_REQUIRED" ||
        data4 === "DENIED"
      )) {
        const err18 = {
          instancePath: instancePath + "/authorization_result",
          schemaPath: "#/properties/authorization_result/enum",
          keyword: "enum",
          params: {
            allowedValues: schema34.properties.authorization_result.enum,
          },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.created_at !== undefined) {
      if (typeof data.created_at !== "string") {
        const err19 = {
          instancePath: instancePath + "/created_at",
          schemaPath: "#/properties/created_at/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.error_category !== undefined) {
      let data6 = data.error_category;
      const _errs16 = errors;
      let valid2 = false;
      const _errs17 = errors;
      if (typeof data6 !== "string") {
        const err20 = {
          instancePath: instancePath + "/error_category",
          schemaPath: "#/properties/error_category/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
      var _valid0 = _errs17 === errors;
      valid2 = valid2 || _valid0;
      const _errs19 = errors;
      if (data6 !== null) {
        const err21 = {
          instancePath: instancePath + "/error_category",
          schemaPath: "#/properties/error_category/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
      var _valid0 = _errs19 === errors;
      valid2 = valid2 || _valid0;
      if (!valid2) {
        const err22 = {
          instancePath: instancePath + "/error_category",
          schemaPath: "#/properties/error_category/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      } else {
        errors = _errs16;
        if (vErrors !== null) {
          if (_errs16) {
            vErrors.length = _errs16;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.execution_acknowledgement !== undefined) {
      let data7 = data.execution_acknowledgement;
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
        for (const key2 in data7) {
          if (typeof data7[key2] !== "string") {
            const err23 = {
              instancePath:
                instancePath +
                "/execution_acknowledgement/" +
                key2.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/execution_acknowledgement/additionalProperties/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/execution_acknowledgement",
          schemaPath: "#/properties/execution_acknowledgement/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.expected_state !== undefined) {
      let data9 = data.expected_state;
      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
        for (const key3 in data9) {
          let data10 = data9[key3];
          const _errs30 = errors;
          let valid5 = false;
          const _errs31 = errors;
          if (typeof data10 !== "string") {
            const err25 = {
              instancePath:
                instancePath +
                "/expected_state/" +
                key3.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/expected_state/additionalProperties/anyOf/0/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
          var _valid1 = _errs31 === errors;
          valid5 = valid5 || _valid1;
          const _errs33 = errors;
          if (data10 !== null) {
            const err26 = {
              instancePath:
                instancePath +
                "/expected_state/" +
                key3.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/expected_state/additionalProperties/anyOf/1/type",
              keyword: "type",
              params: { type: "null" },
              message: "must be null",
            };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
          var _valid1 = _errs33 === errors;
          valid5 = valid5 || _valid1;
          if (!valid5) {
            const err27 = {
              instancePath:
                instancePath +
                "/expected_state/" +
                key3.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/expected_state/additionalProperties/anyOf",
              keyword: "anyOf",
              params: {},
              message: "must match a schema in anyOf",
            };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          } else {
            errors = _errs30;
            if (vErrors !== null) {
              if (_errs30) {
                vErrors.length = _errs30;
              } else {
                vErrors = null;
              }
            }
          }
        }
      } else {
        const err28 = {
          instancePath: instancePath + "/expected_state",
          schemaPath: "#/properties/expected_state/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.external_effects_possible !== undefined) {
      if (typeof data.external_effects_possible !== "boolean") {
        const err29 = {
          instancePath: instancePath + "/external_effects_possible",
          schemaPath: "#/properties/external_effects_possible/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.lifecycle !== undefined) {
      let data12 = data.lifecycle;
      if (typeof data12 !== "string") {
        const err30 = {
          instancePath: instancePath + "/lifecycle",
          schemaPath: "#/properties/lifecycle/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
      if (!(
        data12 === "REQUESTED" ||
        data12 === "AUTHORIZED" ||
        data12 === "APPROVAL_REQUIRED" ||
        data12 === "APPROVED" ||
        data12 === "EXECUTING" ||
        data12 === "EXECUTED" ||
        data12 === "READ_BACK" ||
        data12 === "VERIFIED" ||
        data12 === "VERIFICATION_FAILED" ||
        data12 === "DENIED" ||
        data12 === "FAILED"
      )) {
        const err31 = {
          instancePath: instancePath + "/lifecycle",
          schemaPath: "#/properties/lifecycle/enum",
          keyword: "enum",
          params: { allowedValues: schema34.properties.lifecycle.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
    if (data.observed_state !== undefined) {
      let data13 = data.observed_state;
      if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
        for (const key4 in data13) {
          let data14 = data13[key4];
          const _errs43 = errors;
          let valid7 = false;
          const _errs44 = errors;
          if (typeof data14 !== "string") {
            const err32 = {
              instancePath:
                instancePath +
                "/observed_state/" +
                key4.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/observed_state/additionalProperties/anyOf/0/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
          var _valid2 = _errs44 === errors;
          valid7 = valid7 || _valid2;
          const _errs46 = errors;
          if (data14 !== null) {
            const err33 = {
              instancePath:
                instancePath +
                "/observed_state/" +
                key4.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/observed_state/additionalProperties/anyOf/1/type",
              keyword: "type",
              params: { type: "null" },
              message: "must be null",
            };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
          var _valid2 = _errs46 === errors;
          valid7 = valid7 || _valid2;
          if (!valid7) {
            const err34 = {
              instancePath:
                instancePath +
                "/observed_state/" +
                key4.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/observed_state/additionalProperties/anyOf",
              keyword: "anyOf",
              params: {},
              message: "must match a schema in anyOf",
            };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          } else {
            errors = _errs43;
            if (vErrors !== null) {
              if (_errs43) {
                vErrors.length = _errs43;
              } else {
                vErrors = null;
              }
            }
          }
        }
      } else {
        const err35 = {
          instancePath: instancePath + "/observed_state",
          schemaPath: "#/properties/observed_state/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
    if (data.operations !== undefined) {
      let data15 = data.operations;
      if (Array.isArray(data15)) {
        const len0 = data15.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate24(data15[i0], {
              instancePath: instancePath + "/operations/" + i0,
              parentData: data15,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate24.errors
                : vErrors.concat(validate24.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err36 = {
          instancePath: instancePath + "/operations",
          schemaPath: "#/properties/operations/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.operator_action_id !== undefined) {
      if (typeof data.operator_action_id !== "string") {
        const err37 = {
          instancePath: instancePath + "/operator_action_id",
          schemaPath: "#/properties/operator_action_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.request_fingerprint !== undefined) {
      let data18 = data.request_fingerprint;
      const _errs54 = errors;
      let valid10 = false;
      const _errs55 = errors;
      if (typeof data18 !== "string") {
        const err38 = {
          instancePath: instancePath + "/request_fingerprint",
          schemaPath: "#/properties/request_fingerprint/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
      var _valid3 = _errs55 === errors;
      valid10 = valid10 || _valid3;
      const _errs57 = errors;
      if (data18 !== null) {
        const err39 = {
          instancePath: instancePath + "/request_fingerprint",
          schemaPath: "#/properties/request_fingerprint/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
      var _valid3 = _errs57 === errors;
      valid10 = valid10 || _valid3;
      if (!valid10) {
        const err40 = {
          instancePath: instancePath + "/request_fingerprint",
          schemaPath: "#/properties/request_fingerprint/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      } else {
        errors = _errs54;
        if (vErrors !== null) {
          if (_errs54) {
            vErrors.length = _errs54;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.request_id !== undefined) {
      if (typeof data.request_id !== "string") {
        const err41 = {
          instancePath: instancePath + "/request_id",
          schemaPath: "#/properties/request_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
    }
    if (data.resource_identifier !== undefined) {
      if (typeof data.resource_identifier !== "string") {
        const err42 = {
          instancePath: instancePath + "/resource_identifier",
          schemaPath: "#/properties/resource_identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
    }
    if (data.resource_type !== undefined) {
      let data21 = data.resource_type;
      if (typeof data21 !== "string") {
        const err43 = {
          instancePath: instancePath + "/resource_type",
          schemaPath: "#/properties/resource_type/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
      if (!(
        data21 === "ISSUE" ||
        data21 === "EVENT" ||
        data21 === "OBJECTIVE" ||
        data21 === "CHANNEL"
      )) {
        const err44 = {
          instancePath: instancePath + "/resource_type",
          schemaPath: "#/properties/resource_type/enum",
          keyword: "enum",
          params: { allowedValues: schema34.properties.resource_type.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err44];
        } else {
          vErrors.push(err44);
        }
        errors++;
      }
    }
    if (data.updated_at !== undefined) {
      if (typeof data.updated_at !== "string") {
        const err45 = {
          instancePath: instancePath + "/updated_at",
          schemaPath: "#/properties/updated_at/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err45];
        } else {
          vErrors.push(err45);
        }
        errors++;
      }
    }
    if (data.verification_result !== undefined) {
      let data23 = data.verification_result;
      if (typeof data23 !== "string") {
        const err46 = {
          instancePath: instancePath + "/verification_result",
          schemaPath: "#/properties/verification_result/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err46];
        } else {
          vErrors.push(err46);
        }
        errors++;
      }
      if (!(
        data23 === "NOT_RUN" ||
        data23 === "PASSED" ||
        data23 === "FAILED"
      )) {
        const err47 = {
          instancePath: instancePath + "/verification_result",
          schemaPath: "#/properties/verification_result/enum",
          keyword: "enum",
          params: {
            allowedValues: schema34.properties.verification_result.enum,
          },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err47];
        } else {
          vErrors.push(err47);
        }
        errors++;
      }
    }
  } else {
    const err48 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err48];
    } else {
      vErrors.push(err48);
    }
    errors++;
  }
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};

const schema40 = {
  additionalProperties: false,
  properties: {
    ambiguity_flag: { title: "Ambiguity Flag", type: "boolean" },
    candidate_interpretations: {
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 3,
      minItems: 1,
      title: "Candidate Interpretations",
      type: "array",
    },
    clarification_required: {
      title: "Clarification Required",
      type: "boolean",
    },
    confidence: {
      enum: ["LOW", "MEDIUM", "HIGH"],
      title: "Confidence",
      type: "string",
    },
    constraints: {
      default: [],
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 6,
      title: "Constraints",
      type: "array",
    },
    context_resolution_used: {
      title: "Context Resolution Used",
      type: "boolean",
    },
    context_source: {
      enum: ["NONE", "CAPABILITY", "CONVERSATION", "RECOVERY"],
      title: "Context Source",
      type: "string",
    },
    direct_response: {
      anyOf: [
        { maxLength: 800, minLength: 1, type: "string" },
        { type: "null" },
      ],
      default: null,
      title: "Direct Response",
    },
    entities: {
      default: [],
      items: { $ref: "#/components/schemas/ConversationEntity" },
      maxItems: 8,
      title: "Entities",
      type: "array",
    },
    likely_provider: {
      enum: [
        "NONE",
        "REFLOW",
        "SLACK",
        "JIRA",
        "GOOGLE_CALENDAR",
        "GMAIL",
        "GITHUB",
      ],
      title: "Likely Provider",
      type: "string",
    },
    missing_information: {
      default: [],
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 5,
      title: "Missing Information",
      type: "array",
    },
    mode: {
      enum: ["GENERAL", "HELP", "TASK", "CLARIFY"],
      title: "Mode",
      type: "string",
    },
    normalized_request: {
      anyOf: [
        { maxLength: 800, minLength: 1, type: "string" },
        { type: "null" },
      ],
      default: null,
      title: "Normalized Request",
    },
    referenced_resource: {
      anyOf: [
        { maxLength: 800, minLength: 1, type: "string" },
        { type: "null" },
      ],
      default: null,
      title: "Referenced Resource",
    },
    requested_capability: {
      anyOf: [
        {
          enum: [
            "CAPABILITY_HELP",
            "RECOVERY_INSPECT",
            "RECOVERY_EXPLAIN",
            "RECOVERY_SIMULATE",
            "SLACK_INSPECT",
            "SLACK_POST",
            "SLACK_DM",
            "SLACK_ARBITRARY_TARGET",
            "JIRA_INSPECT",
            "JIRA_UPDATE",
            "CALENDAR_INSPECT",
            "CALENDAR_UPDATE",
            "CALENDAR_CREATE",
            "PROTECTED_OBJECTIVE_CHANGE",
            "UNKNOWN_OPERATIONAL",
          ],
          type: "string",
        },
        { type: "null" },
      ],
      default: null,
      title: "Requested Capability",
    },
    requires_operator: { title: "Requires Operator", type: "boolean" },
    scope_resolution: {
      enum: ["EXACT", "CONFIGURED_DEFAULT", "NEAREST_AUTHORIZED", "AMBIGUOUS"],
      title: "Scope Resolution",
      type: "string",
    },
    tone: {
      enum: ["neutral", "concise", "informal", "urgent"],
      title: "Tone",
      type: "string",
    },
    user_goal: {
      maxLength: 800,
      minLength: 1,
      title: "User Goal",
      type: "string",
    },
  },
  required: [
    "mode",
    "user_goal",
    "requires_operator",
    "tone",
    "confidence",
    "likely_provider",
    "context_resolution_used",
    "context_source",
    "ambiguity_flag",
    "candidate_interpretations",
    "clarification_required",
    "scope_resolution",
  ],
  title: "ConversationEnvelope",
  type: "object",
};
const schema41 = {
  additionalProperties: false,
  properties: {
    name: { pattern: "^[a-z][a-z0-9_]{0,39}$", title: "Name", type: "string" },
    value: { maxLength: 800, minLength: 1, title: "Value", type: "string" },
  },
  required: ["name", "value"],
  title: "ConversationEntity",
  type: "object",
};
const pattern4 = new RegExp("^[a-z][a-z0-9_]{0,39}$", "u");

function validate31(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate31.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.mode === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "mode" },
        message: "must have required property '" + "mode" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.user_goal === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "user_goal" },
        message: "must have required property '" + "user_goal" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.requires_operator === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "requires_operator" },
        message: "must have required property '" + "requires_operator" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.tone === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "tone" },
        message: "must have required property '" + "tone" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.confidence === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "confidence" },
        message: "must have required property '" + "confidence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.likely_provider === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "likely_provider" },
        message: "must have required property '" + "likely_provider" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.context_resolution_used === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "context_resolution_used" },
        message:
          "must have required property '" + "context_resolution_used" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.context_source === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "context_source" },
        message: "must have required property '" + "context_source" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.ambiguity_flag === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "ambiguity_flag" },
        message: "must have required property '" + "ambiguity_flag" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.candidate_interpretations === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "candidate_interpretations" },
        message:
          "must have required property '" + "candidate_interpretations" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.clarification_required === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "clarification_required" },
        message:
          "must have required property '" + "clarification_required" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.scope_resolution === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "scope_resolution" },
        message: "must have required property '" + "scope_resolution" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema40.properties, key0)) {
        const err12 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.ambiguity_flag !== undefined) {
      if (typeof data.ambiguity_flag !== "boolean") {
        const err13 = {
          instancePath: instancePath + "/ambiguity_flag",
          schemaPath: "#/properties/ambiguity_flag/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.candidate_interpretations !== undefined) {
      let data1 = data.candidate_interpretations;
      if (Array.isArray(data1)) {
        if (data1.length > 3) {
          const err14 = {
            instancePath: instancePath + "/candidate_interpretations",
            schemaPath: "#/properties/candidate_interpretations/maxItems",
            keyword: "maxItems",
            params: { limit: 3 },
            message: "must NOT have more than 3 items",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data1.length < 1) {
          const err15 = {
            instancePath: instancePath + "/candidate_interpretations",
            schemaPath: "#/properties/candidate_interpretations/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data2 = data1[i0];
          if (typeof data2 === "string") {
            if (func4(data2) > 800) {
              const err16 = {
                instancePath: instancePath + "/candidate_interpretations/" + i0,
                schemaPath:
                  "#/properties/candidate_interpretations/items/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err16];
              } else {
                vErrors.push(err16);
              }
              errors++;
            }
            if (func4(data2) < 1) {
              const err17 = {
                instancePath: instancePath + "/candidate_interpretations/" + i0,
                schemaPath:
                  "#/properties/candidate_interpretations/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors++;
            }
          } else {
            const err18 = {
              instancePath: instancePath + "/candidate_interpretations/" + i0,
              schemaPath: "#/properties/candidate_interpretations/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err18];
            } else {
              vErrors.push(err18);
            }
            errors++;
          }
        }
      } else {
        const err19 = {
          instancePath: instancePath + "/candidate_interpretations",
          schemaPath: "#/properties/candidate_interpretations/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.clarification_required !== undefined) {
      if (typeof data.clarification_required !== "boolean") {
        const err20 = {
          instancePath: instancePath + "/clarification_required",
          schemaPath: "#/properties/clarification_required/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.confidence !== undefined) {
      let data4 = data.confidence;
      if (typeof data4 !== "string") {
        const err21 = {
          instancePath: instancePath + "/confidence",
          schemaPath: "#/properties/confidence/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
      if (!(data4 === "LOW" || data4 === "MEDIUM" || data4 === "HIGH")) {
        const err22 = {
          instancePath: instancePath + "/confidence",
          schemaPath: "#/properties/confidence/enum",
          keyword: "enum",
          params: { allowedValues: schema40.properties.confidence.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.constraints !== undefined) {
      let data5 = data.constraints;
      if (Array.isArray(data5)) {
        if (data5.length > 6) {
          const err23 = {
            instancePath: instancePath + "/constraints",
            schemaPath: "#/properties/constraints/maxItems",
            keyword: "maxItems",
            params: { limit: 6 },
            message: "must NOT have more than 6 items",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        const len1 = data5.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data6 = data5[i1];
          if (typeof data6 === "string") {
            if (func4(data6) > 800) {
              const err24 = {
                instancePath: instancePath + "/constraints/" + i1,
                schemaPath: "#/properties/constraints/items/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err24];
              } else {
                vErrors.push(err24);
              }
              errors++;
            }
            if (func4(data6) < 1) {
              const err25 = {
                instancePath: instancePath + "/constraints/" + i1,
                schemaPath: "#/properties/constraints/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err25];
              } else {
                vErrors.push(err25);
              }
              errors++;
            }
          } else {
            const err26 = {
              instancePath: instancePath + "/constraints/" + i1,
              schemaPath: "#/properties/constraints/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
        }
      } else {
        const err27 = {
          instancePath: instancePath + "/constraints",
          schemaPath: "#/properties/constraints/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.context_resolution_used !== undefined) {
      if (typeof data.context_resolution_used !== "boolean") {
        const err28 = {
          instancePath: instancePath + "/context_resolution_used",
          schemaPath: "#/properties/context_resolution_used/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.context_source !== undefined) {
      let data8 = data.context_source;
      if (typeof data8 !== "string") {
        const err29 = {
          instancePath: instancePath + "/context_source",
          schemaPath: "#/properties/context_source/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
      if (!(
        data8 === "NONE" ||
        data8 === "CAPABILITY" ||
        data8 === "CONVERSATION" ||
        data8 === "RECOVERY"
      )) {
        const err30 = {
          instancePath: instancePath + "/context_source",
          schemaPath: "#/properties/context_source/enum",
          keyword: "enum",
          params: { allowedValues: schema40.properties.context_source.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
    if (data.direct_response !== undefined) {
      let data9 = data.direct_response;
      const _errs21 = errors;
      let valid5 = false;
      const _errs22 = errors;
      if (typeof data9 === "string") {
        if (func4(data9) > 800) {
          const err31 = {
            instancePath: instancePath + "/direct_response",
            schemaPath: "#/properties/direct_response/anyOf/0/maxLength",
            keyword: "maxLength",
            params: { limit: 800 },
            message: "must NOT have more than 800 characters",
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        if (func4(data9) < 1) {
          const err32 = {
            instancePath: instancePath + "/direct_response",
            schemaPath: "#/properties/direct_response/anyOf/0/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
      } else {
        const err33 = {
          instancePath: instancePath + "/direct_response",
          schemaPath: "#/properties/direct_response/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
      var _valid0 = _errs22 === errors;
      valid5 = valid5 || _valid0;
      const _errs24 = errors;
      if (data9 !== null) {
        const err34 = {
          instancePath: instancePath + "/direct_response",
          schemaPath: "#/properties/direct_response/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors++;
      }
      var _valid0 = _errs24 === errors;
      valid5 = valid5 || _valid0;
      if (!valid5) {
        const err35 = {
          instancePath: instancePath + "/direct_response",
          schemaPath: "#/properties/direct_response/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      } else {
        errors = _errs21;
        if (vErrors !== null) {
          if (_errs21) {
            vErrors.length = _errs21;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.entities !== undefined) {
      let data10 = data.entities;
      if (Array.isArray(data10)) {
        if (data10.length > 8) {
          const err36 = {
            instancePath: instancePath + "/entities",
            schemaPath: "#/properties/entities/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        }
        const len2 = data10.length;
        for (let i2 = 0; i2 < len2; i2++) {
          let data11 = data10[i2];
          if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
            if (data11.name === undefined) {
              const err37 = {
                instancePath: instancePath + "/entities/" + i2,
                schemaPath: "#/components/schemas/ConversationEntity/required",
                keyword: "required",
                params: { missingProperty: "name" },
                message: "must have required property '" + "name" + "'",
              };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
            if (data11.value === undefined) {
              const err38 = {
                instancePath: instancePath + "/entities/" + i2,
                schemaPath: "#/components/schemas/ConversationEntity/required",
                keyword: "required",
                params: { missingProperty: "value" },
                message: "must have required property '" + "value" + "'",
              };
              if (vErrors === null) {
                vErrors = [err38];
              } else {
                vErrors.push(err38);
              }
              errors++;
            }
            for (const key1 in data11) {
              if (!(key1 === "name" || key1 === "value")) {
                const err39 = {
                  instancePath: instancePath + "/entities/" + i2,
                  schemaPath:
                    "#/components/schemas/ConversationEntity/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err39];
                } else {
                  vErrors.push(err39);
                }
                errors++;
              }
            }
            if (data11.name !== undefined) {
              let data12 = data11.name;
              if (typeof data12 === "string") {
                if (!pattern4.test(data12)) {
                  const err40 = {
                    instancePath: instancePath + "/entities/" + i2 + "/name",
                    schemaPath:
                      "#/components/schemas/ConversationEntity/properties/name/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[a-z][a-z0-9_]{0,39}$" },
                    message:
                      'must match pattern "' + "^[a-z][a-z0-9_]{0,39}$" + '"',
                  };
                  if (vErrors === null) {
                    vErrors = [err40];
                  } else {
                    vErrors.push(err40);
                  }
                  errors++;
                }
              } else {
                const err41 = {
                  instancePath: instancePath + "/entities/" + i2 + "/name",
                  schemaPath:
                    "#/components/schemas/ConversationEntity/properties/name/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err41];
                } else {
                  vErrors.push(err41);
                }
                errors++;
              }
            }
            if (data11.value !== undefined) {
              let data13 = data11.value;
              if (typeof data13 === "string") {
                if (func4(data13) > 800) {
                  const err42 = {
                    instancePath: instancePath + "/entities/" + i2 + "/value",
                    schemaPath:
                      "#/components/schemas/ConversationEntity/properties/value/maxLength",
                    keyword: "maxLength",
                    params: { limit: 800 },
                    message: "must NOT have more than 800 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err42];
                  } else {
                    vErrors.push(err42);
                  }
                  errors++;
                }
                if (func4(data13) < 1) {
                  const err43 = {
                    instancePath: instancePath + "/entities/" + i2 + "/value",
                    schemaPath:
                      "#/components/schemas/ConversationEntity/properties/value/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err43];
                  } else {
                    vErrors.push(err43);
                  }
                  errors++;
                }
              } else {
                const err44 = {
                  instancePath: instancePath + "/entities/" + i2 + "/value",
                  schemaPath:
                    "#/components/schemas/ConversationEntity/properties/value/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err44];
                } else {
                  vErrors.push(err44);
                }
                errors++;
              }
            }
          } else {
            const err45 = {
              instancePath: instancePath + "/entities/" + i2,
              schemaPath: "#/components/schemas/ConversationEntity/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err45];
            } else {
              vErrors.push(err45);
            }
            errors++;
          }
        }
      } else {
        const err46 = {
          instancePath: instancePath + "/entities",
          schemaPath: "#/properties/entities/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err46];
        } else {
          vErrors.push(err46);
        }
        errors++;
      }
    }
    if (data.likely_provider !== undefined) {
      let data14 = data.likely_provider;
      if (typeof data14 !== "string") {
        const err47 = {
          instancePath: instancePath + "/likely_provider",
          schemaPath: "#/properties/likely_provider/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err47];
        } else {
          vErrors.push(err47);
        }
        errors++;
      }
      if (!(
        data14 === "NONE" ||
        data14 === "REFLOW" ||
        data14 === "SLACK" ||
        data14 === "JIRA" ||
        data14 === "GOOGLE_CALENDAR" ||
        data14 === "GMAIL" ||
        data14 === "GITHUB"
      )) {
        const err48 = {
          instancePath: instancePath + "/likely_provider",
          schemaPath: "#/properties/likely_provider/enum",
          keyword: "enum",
          params: { allowedValues: schema40.properties.likely_provider.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err48];
        } else {
          vErrors.push(err48);
        }
        errors++;
      }
    }
    if (data.missing_information !== undefined) {
      let data15 = data.missing_information;
      if (Array.isArray(data15)) {
        if (data15.length > 5) {
          const err49 = {
            instancePath: instancePath + "/missing_information",
            schemaPath: "#/properties/missing_information/maxItems",
            keyword: "maxItems",
            params: { limit: 5 },
            message: "must NOT have more than 5 items",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        const len3 = data15.length;
        for (let i3 = 0; i3 < len3; i3++) {
          let data16 = data15[i3];
          if (typeof data16 === "string") {
            if (func4(data16) > 800) {
              const err50 = {
                instancePath: instancePath + "/missing_information/" + i3,
                schemaPath: "#/properties/missing_information/items/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err50];
              } else {
                vErrors.push(err50);
              }
              errors++;
            }
            if (func4(data16) < 1) {
              const err51 = {
                instancePath: instancePath + "/missing_information/" + i3,
                schemaPath: "#/properties/missing_information/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
          } else {
            const err52 = {
              instancePath: instancePath + "/missing_information/" + i3,
              schemaPath: "#/properties/missing_information/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err52];
            } else {
              vErrors.push(err52);
            }
            errors++;
          }
        }
      } else {
        const err53 = {
          instancePath: instancePath + "/missing_information",
          schemaPath: "#/properties/missing_information/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err53];
        } else {
          vErrors.push(err53);
        }
        errors++;
      }
    }
    if (data.mode !== undefined) {
      let data17 = data.mode;
      if (typeof data17 !== "string") {
        const err54 = {
          instancePath: instancePath + "/mode",
          schemaPath: "#/properties/mode/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err54];
        } else {
          vErrors.push(err54);
        }
        errors++;
      }
      if (!(
        data17 === "GENERAL" ||
        data17 === "HELP" ||
        data17 === "TASK" ||
        data17 === "CLARIFY"
      )) {
        const err55 = {
          instancePath: instancePath + "/mode",
          schemaPath: "#/properties/mode/enum",
          keyword: "enum",
          params: { allowedValues: schema40.properties.mode.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err55];
        } else {
          vErrors.push(err55);
        }
        errors++;
      }
    }
    if (data.normalized_request !== undefined) {
      let data18 = data.normalized_request;
      const _errs45 = errors;
      let valid12 = false;
      const _errs46 = errors;
      if (typeof data18 === "string") {
        if (func4(data18) > 800) {
          const err56 = {
            instancePath: instancePath + "/normalized_request",
            schemaPath: "#/properties/normalized_request/anyOf/0/maxLength",
            keyword: "maxLength",
            params: { limit: 800 },
            message: "must NOT have more than 800 characters",
          };
          if (vErrors === null) {
            vErrors = [err56];
          } else {
            vErrors.push(err56);
          }
          errors++;
        }
        if (func4(data18) < 1) {
          const err57 = {
            instancePath: instancePath + "/normalized_request",
            schemaPath: "#/properties/normalized_request/anyOf/0/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err57];
          } else {
            vErrors.push(err57);
          }
          errors++;
        }
      } else {
        const err58 = {
          instancePath: instancePath + "/normalized_request",
          schemaPath: "#/properties/normalized_request/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err58];
        } else {
          vErrors.push(err58);
        }
        errors++;
      }
      var _valid1 = _errs46 === errors;
      valid12 = valid12 || _valid1;
      const _errs48 = errors;
      if (data18 !== null) {
        const err59 = {
          instancePath: instancePath + "/normalized_request",
          schemaPath: "#/properties/normalized_request/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err59];
        } else {
          vErrors.push(err59);
        }
        errors++;
      }
      var _valid1 = _errs48 === errors;
      valid12 = valid12 || _valid1;
      if (!valid12) {
        const err60 = {
          instancePath: instancePath + "/normalized_request",
          schemaPath: "#/properties/normalized_request/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err60];
        } else {
          vErrors.push(err60);
        }
        errors++;
      } else {
        errors = _errs45;
        if (vErrors !== null) {
          if (_errs45) {
            vErrors.length = _errs45;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.referenced_resource !== undefined) {
      let data19 = data.referenced_resource;
      const _errs51 = errors;
      let valid13 = false;
      const _errs52 = errors;
      if (typeof data19 === "string") {
        if (func4(data19) > 800) {
          const err61 = {
            instancePath: instancePath + "/referenced_resource",
            schemaPath: "#/properties/referenced_resource/anyOf/0/maxLength",
            keyword: "maxLength",
            params: { limit: 800 },
            message: "must NOT have more than 800 characters",
          };
          if (vErrors === null) {
            vErrors = [err61];
          } else {
            vErrors.push(err61);
          }
          errors++;
        }
        if (func4(data19) < 1) {
          const err62 = {
            instancePath: instancePath + "/referenced_resource",
            schemaPath: "#/properties/referenced_resource/anyOf/0/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err62];
          } else {
            vErrors.push(err62);
          }
          errors++;
        }
      } else {
        const err63 = {
          instancePath: instancePath + "/referenced_resource",
          schemaPath: "#/properties/referenced_resource/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err63];
        } else {
          vErrors.push(err63);
        }
        errors++;
      }
      var _valid2 = _errs52 === errors;
      valid13 = valid13 || _valid2;
      const _errs54 = errors;
      if (data19 !== null) {
        const err64 = {
          instancePath: instancePath + "/referenced_resource",
          schemaPath: "#/properties/referenced_resource/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err64];
        } else {
          vErrors.push(err64);
        }
        errors++;
      }
      var _valid2 = _errs54 === errors;
      valid13 = valid13 || _valid2;
      if (!valid13) {
        const err65 = {
          instancePath: instancePath + "/referenced_resource",
          schemaPath: "#/properties/referenced_resource/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err65];
        } else {
          vErrors.push(err65);
        }
        errors++;
      } else {
        errors = _errs51;
        if (vErrors !== null) {
          if (_errs51) {
            vErrors.length = _errs51;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.requested_capability !== undefined) {
      let data20 = data.requested_capability;
      const _errs57 = errors;
      let valid14 = false;
      const _errs58 = errors;
      if (typeof data20 !== "string") {
        const err66 = {
          instancePath: instancePath + "/requested_capability",
          schemaPath: "#/properties/requested_capability/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err66];
        } else {
          vErrors.push(err66);
        }
        errors++;
      }
      if (!(
        data20 === "CAPABILITY_HELP" ||
        data20 === "RECOVERY_INSPECT" ||
        data20 === "RECOVERY_EXPLAIN" ||
        data20 === "RECOVERY_SIMULATE" ||
        data20 === "SLACK_INSPECT" ||
        data20 === "SLACK_POST" ||
        data20 === "SLACK_DM" ||
        data20 === "SLACK_ARBITRARY_TARGET" ||
        data20 === "JIRA_INSPECT" ||
        data20 === "JIRA_UPDATE" ||
        data20 === "CALENDAR_INSPECT" ||
        data20 === "CALENDAR_UPDATE" ||
        data20 === "CALENDAR_CREATE" ||
        data20 === "PROTECTED_OBJECTIVE_CHANGE" ||
        data20 === "UNKNOWN_OPERATIONAL"
      )) {
        const err67 = {
          instancePath: instancePath + "/requested_capability",
          schemaPath: "#/properties/requested_capability/anyOf/0/enum",
          keyword: "enum",
          params: {
            allowedValues:
              schema40.properties.requested_capability.anyOf[0].enum,
          },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err67];
        } else {
          vErrors.push(err67);
        }
        errors++;
      }
      var _valid3 = _errs58 === errors;
      valid14 = valid14 || _valid3;
      const _errs60 = errors;
      if (data20 !== null) {
        const err68 = {
          instancePath: instancePath + "/requested_capability",
          schemaPath: "#/properties/requested_capability/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err68];
        } else {
          vErrors.push(err68);
        }
        errors++;
      }
      var _valid3 = _errs60 === errors;
      valid14 = valid14 || _valid3;
      if (!valid14) {
        const err69 = {
          instancePath: instancePath + "/requested_capability",
          schemaPath: "#/properties/requested_capability/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err69];
        } else {
          vErrors.push(err69);
        }
        errors++;
      } else {
        errors = _errs57;
        if (vErrors !== null) {
          if (_errs57) {
            vErrors.length = _errs57;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.requires_operator !== undefined) {
      if (typeof data.requires_operator !== "boolean") {
        const err70 = {
          instancePath: instancePath + "/requires_operator",
          schemaPath: "#/properties/requires_operator/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err70];
        } else {
          vErrors.push(err70);
        }
        errors++;
      }
    }
    if (data.scope_resolution !== undefined) {
      let data22 = data.scope_resolution;
      if (typeof data22 !== "string") {
        const err71 = {
          instancePath: instancePath + "/scope_resolution",
          schemaPath: "#/properties/scope_resolution/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err71];
        } else {
          vErrors.push(err71);
        }
        errors++;
      }
      if (!(
        data22 === "EXACT" ||
        data22 === "CONFIGURED_DEFAULT" ||
        data22 === "NEAREST_AUTHORIZED" ||
        data22 === "AMBIGUOUS"
      )) {
        const err72 = {
          instancePath: instancePath + "/scope_resolution",
          schemaPath: "#/properties/scope_resolution/enum",
          keyword: "enum",
          params: { allowedValues: schema40.properties.scope_resolution.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err72];
        } else {
          vErrors.push(err72);
        }
        errors++;
      }
    }
    if (data.tone !== undefined) {
      let data23 = data.tone;
      if (typeof data23 !== "string") {
        const err73 = {
          instancePath: instancePath + "/tone",
          schemaPath: "#/properties/tone/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err73];
        } else {
          vErrors.push(err73);
        }
        errors++;
      }
      if (!(
        data23 === "neutral" ||
        data23 === "concise" ||
        data23 === "informal" ||
        data23 === "urgent"
      )) {
        const err74 = {
          instancePath: instancePath + "/tone",
          schemaPath: "#/properties/tone/enum",
          keyword: "enum",
          params: { allowedValues: schema40.properties.tone.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err74];
        } else {
          vErrors.push(err74);
        }
        errors++;
      }
    }
    if (data.user_goal !== undefined) {
      let data24 = data.user_goal;
      if (typeof data24 === "string") {
        if (func4(data24) > 800) {
          const err75 = {
            instancePath: instancePath + "/user_goal",
            schemaPath: "#/properties/user_goal/maxLength",
            keyword: "maxLength",
            params: { limit: 800 },
            message: "must NOT have more than 800 characters",
          };
          if (vErrors === null) {
            vErrors = [err75];
          } else {
            vErrors.push(err75);
          }
          errors++;
        }
        if (func4(data24) < 1) {
          const err76 = {
            instancePath: instancePath + "/user_goal",
            schemaPath: "#/properties/user_goal/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
      } else {
        const err77 = {
          instancePath: instancePath + "/user_goal",
          schemaPath: "#/properties/user_goal/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err77];
        } else {
          vErrors.push(err77);
        }
        errors++;
      }
    }
  } else {
    const err78 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err78];
    } else {
      vErrors.push(err78);
    }
    errors++;
  }
  validate31.errors = vErrors;
  return errors === 0;
}
validate31.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};

const schema46 = {
  additionalProperties: false,
  properties: {
    clarification: {
      anyOf: [
        { maxLength: 800, minLength: 1, type: "string" },
        { type: "null" },
      ],
      default: null,
      title: "Clarification",
    },
    constraints: {
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 5,
      title: "Constraints",
      type: "array",
    },
    disposition: {
      enum: ["SUPPORTED", "CLARIFICATION_REQUIRED", "UNSUPPORTED"],
      title: "Disposition",
      type: "string",
    },
    fact_ids: {
      items: { maxLength: 200, minLength: 1, type: "string" },
      maxItems: 8,
      title: "Fact Ids",
      type: "array",
    },
    hypothetical_changes: {
      items: { $ref: "#/components/schemas/HypotheticalChange" },
      maxItems: 3,
      title: "Hypothetical Changes",
      type: "array",
    },
    incident_id: { title: "Incident Id", type: "string" },
    intent_type: {
      anyOf: [
        { enum: ["INSPECT", "EXPLAIN", "SIMULATE", "ACT"], type: "string" },
        { type: "null" },
      ],
      default: null,
      title: "Intent Type",
    },
    question: {
      maxLength: 800,
      minLength: 1,
      title: "Question",
      type: "string",
    },
    recovery_attempt: {
      anyOf: [{ type: "integer" }, { type: "null" }],
      default: null,
      title: "Recovery Attempt",
    },
    requested_operations: {
      default: [],
      items: { $ref: "#/components/schemas/RequestedOperation" },
      maxItems: 5,
      title: "Requested Operations",
      type: "array",
    },
    subject: {
      enum: [
        "OBJECTIVE",
        "RECOVERY",
        "CALENDAR",
        "JIRA",
        "SLACK",
        "EVIDENCE",
        "CHRONOLOGY",
      ],
      title: "Subject",
      type: "string",
    },
    target: {
      anyOf: [
        { $ref: "#/components/schemas/OperatorTarget" },
        { type: "null" },
      ],
      default: null,
    },
  },
  required: [
    "disposition",
    "subject",
    "incident_id",
    "question",
    "hypothetical_changes",
    "constraints",
    "fact_ids",
  ],
  title: "OperatorIntent",
  type: "object",
};
const schema47 = {
  additionalProperties: false,
  properties: {
    kind: {
      enum: ["CI_PASSED", "DEADLINE_SHIFT_MINUTES", "RESOURCE_AVAILABLE_AT"],
      title: "Kind",
      type: "string",
    },
    target: { maxLength: 800, minLength: 1, title: "Target", type: "string" },
    value: { maxLength: 800, minLength: 1, title: "Value", type: "string" },
  },
  required: ["kind", "target", "value"],
  title: "HypotheticalChange",
  type: "object",
};
const schema48 = {
  additionalProperties: false,
  properties: {
    authority: {
      enum: ["JIRA", "GOOGLE_CALENDAR", "REFLOW", "SLACK"],
      title: "Authority",
      type: "string",
    },
    resource_identifier: {
      maxLength: 200,
      minLength: 1,
      title: "Resource Identifier",
      type: "string",
    },
    resource_type: {
      enum: ["ISSUE", "EVENT", "OBJECTIVE", "CHANNEL"],
      title: "Resource Type",
      type: "string",
    },
  },
  required: ["authority", "resource_type", "resource_identifier"],
  title: "OperatorTarget",
  type: "object",
};

function validate33(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate33.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.disposition === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "disposition" },
        message: "must have required property '" + "disposition" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.subject === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "subject" },
        message: "must have required property '" + "subject" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.incident_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "incident_id" },
        message: "must have required property '" + "incident_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.question === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "question" },
        message: "must have required property '" + "question" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.hypothetical_changes === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "hypothetical_changes" },
        message: "must have required property '" + "hypothetical_changes" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.constraints === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "constraints" },
        message: "must have required property '" + "constraints" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.fact_ids === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "fact_ids" },
        message: "must have required property '" + "fact_ids" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema46.properties, key0)) {
        const err7 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.clarification !== undefined) {
      let data0 = data.clarification;
      const _errs3 = errors;
      let valid1 = false;
      const _errs4 = errors;
      if (typeof data0 === "string") {
        if (func4(data0) > 800) {
          const err8 = {
            instancePath: instancePath + "/clarification",
            schemaPath: "#/properties/clarification/anyOf/0/maxLength",
            keyword: "maxLength",
            params: { limit: 800 },
            message: "must NOT have more than 800 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func4(data0) < 1) {
          const err9 = {
            instancePath: instancePath + "/clarification",
            schemaPath: "#/properties/clarification/anyOf/0/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/clarification",
          schemaPath: "#/properties/clarification/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      var _valid0 = _errs4 === errors;
      valid1 = valid1 || _valid0;
      const _errs6 = errors;
      if (data0 !== null) {
        const err11 = {
          instancePath: instancePath + "/clarification",
          schemaPath: "#/properties/clarification/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      var _valid0 = _errs6 === errors;
      valid1 = valid1 || _valid0;
      if (!valid1) {
        const err12 = {
          instancePath: instancePath + "/clarification",
          schemaPath: "#/properties/clarification/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.constraints !== undefined) {
      let data1 = data.constraints;
      if (Array.isArray(data1)) {
        if (data1.length > 5) {
          const err13 = {
            instancePath: instancePath + "/constraints",
            schemaPath: "#/properties/constraints/maxItems",
            keyword: "maxItems",
            params: { limit: 5 },
            message: "must NOT have more than 5 items",
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data2 = data1[i0];
          if (typeof data2 === "string") {
            if (func4(data2) > 800) {
              const err14 = {
                instancePath: instancePath + "/constraints/" + i0,
                schemaPath: "#/properties/constraints/items/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err14];
              } else {
                vErrors.push(err14);
              }
              errors++;
            }
            if (func4(data2) < 1) {
              const err15 = {
                instancePath: instancePath + "/constraints/" + i0,
                schemaPath: "#/properties/constraints/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err15];
              } else {
                vErrors.push(err15);
              }
              errors++;
            }
          } else {
            const err16 = {
              instancePath: instancePath + "/constraints/" + i0,
              schemaPath: "#/properties/constraints/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/constraints",
          schemaPath: "#/properties/constraints/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.disposition !== undefined) {
      let data3 = data.disposition;
      if (typeof data3 !== "string") {
        const err18 = {
          instancePath: instancePath + "/disposition",
          schemaPath: "#/properties/disposition/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
      if (!(
        data3 === "SUPPORTED" ||
        data3 === "CLARIFICATION_REQUIRED" ||
        data3 === "UNSUPPORTED"
      )) {
        const err19 = {
          instancePath: instancePath + "/disposition",
          schemaPath: "#/properties/disposition/enum",
          keyword: "enum",
          params: { allowedValues: schema46.properties.disposition.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.fact_ids !== undefined) {
      let data4 = data.fact_ids;
      if (Array.isArray(data4)) {
        if (data4.length > 8) {
          const err20 = {
            instancePath: instancePath + "/fact_ids",
            schemaPath: "#/properties/fact_ids/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        const len1 = data4.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data5 = data4[i1];
          if (typeof data5 === "string") {
            if (func4(data5) > 200) {
              const err21 = {
                instancePath: instancePath + "/fact_ids/" + i1,
                schemaPath: "#/properties/fact_ids/items/maxLength",
                keyword: "maxLength",
                params: { limit: 200 },
                message: "must NOT have more than 200 characters",
              };
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
            }
            if (func4(data5) < 1) {
              const err22 = {
                instancePath: instancePath + "/fact_ids/" + i1,
                schemaPath: "#/properties/fact_ids/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
          } else {
            const err23 = {
              instancePath: instancePath + "/fact_ids/" + i1,
              schemaPath: "#/properties/fact_ids/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/fact_ids",
          schemaPath: "#/properties/fact_ids/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.hypothetical_changes !== undefined) {
      let data6 = data.hypothetical_changes;
      if (Array.isArray(data6)) {
        if (data6.length > 3) {
          const err25 = {
            instancePath: instancePath + "/hypothetical_changes",
            schemaPath: "#/properties/hypothetical_changes/maxItems",
            keyword: "maxItems",
            params: { limit: 3 },
            message: "must NOT have more than 3 items",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        const len2 = data6.length;
        for (let i2 = 0; i2 < len2; i2++) {
          let data7 = data6[i2];
          if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
            if (data7.kind === undefined) {
              const err26 = {
                instancePath: instancePath + "/hypothetical_changes/" + i2,
                schemaPath: "#/components/schemas/HypotheticalChange/required",
                keyword: "required",
                params: { missingProperty: "kind" },
                message: "must have required property '" + "kind" + "'",
              };
              if (vErrors === null) {
                vErrors = [err26];
              } else {
                vErrors.push(err26);
              }
              errors++;
            }
            if (data7.target === undefined) {
              const err27 = {
                instancePath: instancePath + "/hypothetical_changes/" + i2,
                schemaPath: "#/components/schemas/HypotheticalChange/required",
                keyword: "required",
                params: { missingProperty: "target" },
                message: "must have required property '" + "target" + "'",
              };
              if (vErrors === null) {
                vErrors = [err27];
              } else {
                vErrors.push(err27);
              }
              errors++;
            }
            if (data7.value === undefined) {
              const err28 = {
                instancePath: instancePath + "/hypothetical_changes/" + i2,
                schemaPath: "#/components/schemas/HypotheticalChange/required",
                keyword: "required",
                params: { missingProperty: "value" },
                message: "must have required property '" + "value" + "'",
              };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
            for (const key1 in data7) {
              if (!(key1 === "kind" || key1 === "target" || key1 === "value")) {
                const err29 = {
                  instancePath: instancePath + "/hypothetical_changes/" + i2,
                  schemaPath:
                    "#/components/schemas/HypotheticalChange/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err29];
                } else {
                  vErrors.push(err29);
                }
                errors++;
              }
            }
            if (data7.kind !== undefined) {
              let data8 = data7.kind;
              if (typeof data8 !== "string") {
                const err30 = {
                  instancePath:
                    instancePath + "/hypothetical_changes/" + i2 + "/kind",
                  schemaPath:
                    "#/components/schemas/HypotheticalChange/properties/kind/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err30];
                } else {
                  vErrors.push(err30);
                }
                errors++;
              }
              if (!(
                data8 === "CI_PASSED" ||
                data8 === "DEADLINE_SHIFT_MINUTES" ||
                data8 === "RESOURCE_AVAILABLE_AT"
              )) {
                const err31 = {
                  instancePath:
                    instancePath + "/hypothetical_changes/" + i2 + "/kind",
                  schemaPath:
                    "#/components/schemas/HypotheticalChange/properties/kind/enum",
                  keyword: "enum",
                  params: { allowedValues: schema47.properties.kind.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err31];
                } else {
                  vErrors.push(err31);
                }
                errors++;
              }
            }
            if (data7.target !== undefined) {
              let data9 = data7.target;
              if (typeof data9 === "string") {
                if (func4(data9) > 800) {
                  const err32 = {
                    instancePath:
                      instancePath + "/hypothetical_changes/" + i2 + "/target",
                    schemaPath:
                      "#/components/schemas/HypotheticalChange/properties/target/maxLength",
                    keyword: "maxLength",
                    params: { limit: 800 },
                    message: "must NOT have more than 800 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err32];
                  } else {
                    vErrors.push(err32);
                  }
                  errors++;
                }
                if (func4(data9) < 1) {
                  const err33 = {
                    instancePath:
                      instancePath + "/hypothetical_changes/" + i2 + "/target",
                    schemaPath:
                      "#/components/schemas/HypotheticalChange/properties/target/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err33];
                  } else {
                    vErrors.push(err33);
                  }
                  errors++;
                }
              } else {
                const err34 = {
                  instancePath:
                    instancePath + "/hypothetical_changes/" + i2 + "/target",
                  schemaPath:
                    "#/components/schemas/HypotheticalChange/properties/target/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err34];
                } else {
                  vErrors.push(err34);
                }
                errors++;
              }
            }
            if (data7.value !== undefined) {
              let data10 = data7.value;
              if (typeof data10 === "string") {
                if (func4(data10) > 800) {
                  const err35 = {
                    instancePath:
                      instancePath + "/hypothetical_changes/" + i2 + "/value",
                    schemaPath:
                      "#/components/schemas/HypotheticalChange/properties/value/maxLength",
                    keyword: "maxLength",
                    params: { limit: 800 },
                    message: "must NOT have more than 800 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err35];
                  } else {
                    vErrors.push(err35);
                  }
                  errors++;
                }
                if (func4(data10) < 1) {
                  const err36 = {
                    instancePath:
                      instancePath + "/hypothetical_changes/" + i2 + "/value",
                    schemaPath:
                      "#/components/schemas/HypotheticalChange/properties/value/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err36];
                  } else {
                    vErrors.push(err36);
                  }
                  errors++;
                }
              } else {
                const err37 = {
                  instancePath:
                    instancePath + "/hypothetical_changes/" + i2 + "/value",
                  schemaPath:
                    "#/components/schemas/HypotheticalChange/properties/value/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err37];
                } else {
                  vErrors.push(err37);
                }
                errors++;
              }
            }
          } else {
            const err38 = {
              instancePath: instancePath + "/hypothetical_changes/" + i2,
              schemaPath: "#/components/schemas/HypotheticalChange/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err38];
            } else {
              vErrors.push(err38);
            }
            errors++;
          }
        }
      } else {
        const err39 = {
          instancePath: instancePath + "/hypothetical_changes",
          schemaPath: "#/properties/hypothetical_changes/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
    }
    if (data.incident_id !== undefined) {
      if (typeof data.incident_id !== "string") {
        const err40 = {
          instancePath: instancePath + "/incident_id",
          schemaPath: "#/properties/incident_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.intent_type !== undefined) {
      let data12 = data.intent_type;
      const _errs33 = errors;
      let valid10 = false;
      const _errs34 = errors;
      if (typeof data12 !== "string") {
        const err41 = {
          instancePath: instancePath + "/intent_type",
          schemaPath: "#/properties/intent_type/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
      if (!(
        data12 === "INSPECT" ||
        data12 === "EXPLAIN" ||
        data12 === "SIMULATE" ||
        data12 === "ACT"
      )) {
        const err42 = {
          instancePath: instancePath + "/intent_type",
          schemaPath: "#/properties/intent_type/anyOf/0/enum",
          keyword: "enum",
          params: {
            allowedValues: schema46.properties.intent_type.anyOf[0].enum,
          },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
      var _valid1 = _errs34 === errors;
      valid10 = valid10 || _valid1;
      const _errs36 = errors;
      if (data12 !== null) {
        const err43 = {
          instancePath: instancePath + "/intent_type",
          schemaPath: "#/properties/intent_type/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
      var _valid1 = _errs36 === errors;
      valid10 = valid10 || _valid1;
      if (!valid10) {
        const err44 = {
          instancePath: instancePath + "/intent_type",
          schemaPath: "#/properties/intent_type/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err44];
        } else {
          vErrors.push(err44);
        }
        errors++;
      } else {
        errors = _errs33;
        if (vErrors !== null) {
          if (_errs33) {
            vErrors.length = _errs33;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.question !== undefined) {
      let data13 = data.question;
      if (typeof data13 === "string") {
        if (func4(data13) > 800) {
          const err45 = {
            instancePath: instancePath + "/question",
            schemaPath: "#/properties/question/maxLength",
            keyword: "maxLength",
            params: { limit: 800 },
            message: "must NOT have more than 800 characters",
          };
          if (vErrors === null) {
            vErrors = [err45];
          } else {
            vErrors.push(err45);
          }
          errors++;
        }
        if (func4(data13) < 1) {
          const err46 = {
            instancePath: instancePath + "/question",
            schemaPath: "#/properties/question/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err46];
          } else {
            vErrors.push(err46);
          }
          errors++;
        }
      } else {
        const err47 = {
          instancePath: instancePath + "/question",
          schemaPath: "#/properties/question/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err47];
        } else {
          vErrors.push(err47);
        }
        errors++;
      }
    }
    if (data.recovery_attempt !== undefined) {
      let data14 = data.recovery_attempt;
      const _errs41 = errors;
      let valid11 = false;
      const _errs42 = errors;
      if (!(typeof data14 == "number" && !(data14 % 1) && !isNaN(data14))) {
        const err48 = {
          instancePath: instancePath + "/recovery_attempt",
          schemaPath: "#/properties/recovery_attempt/anyOf/0/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err48];
        } else {
          vErrors.push(err48);
        }
        errors++;
      }
      var _valid2 = _errs42 === errors;
      valid11 = valid11 || _valid2;
      const _errs44 = errors;
      if (data14 !== null) {
        const err49 = {
          instancePath: instancePath + "/recovery_attempt",
          schemaPath: "#/properties/recovery_attempt/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err49];
        } else {
          vErrors.push(err49);
        }
        errors++;
      }
      var _valid2 = _errs44 === errors;
      valid11 = valid11 || _valid2;
      if (!valid11) {
        const err50 = {
          instancePath: instancePath + "/recovery_attempt",
          schemaPath: "#/properties/recovery_attempt/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err50];
        } else {
          vErrors.push(err50);
        }
        errors++;
      } else {
        errors = _errs41;
        if (vErrors !== null) {
          if (_errs41) {
            vErrors.length = _errs41;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.requested_operations !== undefined) {
      let data15 = data.requested_operations;
      if (Array.isArray(data15)) {
        if (data15.length > 5) {
          const err51 = {
            instancePath: instancePath + "/requested_operations",
            schemaPath: "#/properties/requested_operations/maxItems",
            keyword: "maxItems",
            params: { limit: 5 },
            message: "must NOT have more than 5 items",
          };
          if (vErrors === null) {
            vErrors = [err51];
          } else {
            vErrors.push(err51);
          }
          errors++;
        }
        const len3 = data15.length;
        for (let i3 = 0; i3 < len3; i3++) {
          if (
            !validate24(data15[i3], {
              instancePath: instancePath + "/requested_operations/" + i3,
              parentData: data15,
              parentDataProperty: i3,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate24.errors
                : vErrors.concat(validate24.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err52 = {
          instancePath: instancePath + "/requested_operations",
          schemaPath: "#/properties/requested_operations/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err52];
        } else {
          vErrors.push(err52);
        }
        errors++;
      }
    }
    if (data.subject !== undefined) {
      let data17 = data.subject;
      if (typeof data17 !== "string") {
        const err53 = {
          instancePath: instancePath + "/subject",
          schemaPath: "#/properties/subject/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err53];
        } else {
          vErrors.push(err53);
        }
        errors++;
      }
      if (!(
        data17 === "OBJECTIVE" ||
        data17 === "RECOVERY" ||
        data17 === "CALENDAR" ||
        data17 === "JIRA" ||
        data17 === "SLACK" ||
        data17 === "EVIDENCE" ||
        data17 === "CHRONOLOGY"
      )) {
        const err54 = {
          instancePath: instancePath + "/subject",
          schemaPath: "#/properties/subject/enum",
          keyword: "enum",
          params: { allowedValues: schema46.properties.subject.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err54];
        } else {
          vErrors.push(err54);
        }
        errors++;
      }
    }
    if (data.target !== undefined) {
      let data18 = data.target;
      const _errs52 = errors;
      let valid14 = false;
      const _errs53 = errors;
      if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
        if (data18.authority === undefined) {
          const err55 = {
            instancePath: instancePath + "/target",
            schemaPath: "#/components/schemas/OperatorTarget/required",
            keyword: "required",
            params: { missingProperty: "authority" },
            message: "must have required property '" + "authority" + "'",
          };
          if (vErrors === null) {
            vErrors = [err55];
          } else {
            vErrors.push(err55);
          }
          errors++;
        }
        if (data18.resource_type === undefined) {
          const err56 = {
            instancePath: instancePath + "/target",
            schemaPath: "#/components/schemas/OperatorTarget/required",
            keyword: "required",
            params: { missingProperty: "resource_type" },
            message: "must have required property '" + "resource_type" + "'",
          };
          if (vErrors === null) {
            vErrors = [err56];
          } else {
            vErrors.push(err56);
          }
          errors++;
        }
        if (data18.resource_identifier === undefined) {
          const err57 = {
            instancePath: instancePath + "/target",
            schemaPath: "#/components/schemas/OperatorTarget/required",
            keyword: "required",
            params: { missingProperty: "resource_identifier" },
            message:
              "must have required property '" + "resource_identifier" + "'",
          };
          if (vErrors === null) {
            vErrors = [err57];
          } else {
            vErrors.push(err57);
          }
          errors++;
        }
        for (const key2 in data18) {
          if (!(
            key2 === "authority" ||
            key2 === "resource_identifier" ||
            key2 === "resource_type"
          )) {
            const err58 = {
              instancePath: instancePath + "/target",
              schemaPath:
                "#/components/schemas/OperatorTarget/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err58];
            } else {
              vErrors.push(err58);
            }
            errors++;
          }
        }
        if (data18.authority !== undefined) {
          let data19 = data18.authority;
          if (typeof data19 !== "string") {
            const err59 = {
              instancePath: instancePath + "/target/authority",
              schemaPath:
                "#/components/schemas/OperatorTarget/properties/authority/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err59];
            } else {
              vErrors.push(err59);
            }
            errors++;
          }
          if (!(
            data19 === "JIRA" ||
            data19 === "GOOGLE_CALENDAR" ||
            data19 === "REFLOW" ||
            data19 === "SLACK"
          )) {
            const err60 = {
              instancePath: instancePath + "/target/authority",
              schemaPath:
                "#/components/schemas/OperatorTarget/properties/authority/enum",
              keyword: "enum",
              params: { allowedValues: schema48.properties.authority.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err60];
            } else {
              vErrors.push(err60);
            }
            errors++;
          }
        }
        if (data18.resource_identifier !== undefined) {
          let data20 = data18.resource_identifier;
          if (typeof data20 === "string") {
            if (func4(data20) > 200) {
              const err61 = {
                instancePath: instancePath + "/target/resource_identifier",
                schemaPath:
                  "#/components/schemas/OperatorTarget/properties/resource_identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 200 },
                message: "must NOT have more than 200 characters",
              };
              if (vErrors === null) {
                vErrors = [err61];
              } else {
                vErrors.push(err61);
              }
              errors++;
            }
            if (func4(data20) < 1) {
              const err62 = {
                instancePath: instancePath + "/target/resource_identifier",
                schemaPath:
                  "#/components/schemas/OperatorTarget/properties/resource_identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
          } else {
            const err63 = {
              instancePath: instancePath + "/target/resource_identifier",
              schemaPath:
                "#/components/schemas/OperatorTarget/properties/resource_identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err63];
            } else {
              vErrors.push(err63);
            }
            errors++;
          }
        }
        if (data18.resource_type !== undefined) {
          let data21 = data18.resource_type;
          if (typeof data21 !== "string") {
            const err64 = {
              instancePath: instancePath + "/target/resource_type",
              schemaPath:
                "#/components/schemas/OperatorTarget/properties/resource_type/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err64];
            } else {
              vErrors.push(err64);
            }
            errors++;
          }
          if (!(
            data21 === "ISSUE" ||
            data21 === "EVENT" ||
            data21 === "OBJECTIVE" ||
            data21 === "CHANNEL"
          )) {
            const err65 = {
              instancePath: instancePath + "/target/resource_type",
              schemaPath:
                "#/components/schemas/OperatorTarget/properties/resource_type/enum",
              keyword: "enum",
              params: { allowedValues: schema48.properties.resource_type.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err65];
            } else {
              vErrors.push(err65);
            }
            errors++;
          }
        }
      } else {
        const err66 = {
          instancePath: instancePath + "/target",
          schemaPath: "#/components/schemas/OperatorTarget/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err66];
        } else {
          vErrors.push(err66);
        }
        errors++;
      }
      var _valid3 = _errs53 === errors;
      valid14 = valid14 || _valid3;
      const _errs63 = errors;
      if (data18 !== null) {
        const err67 = {
          instancePath: instancePath + "/target",
          schemaPath: "#/properties/target/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err67];
        } else {
          vErrors.push(err67);
        }
        errors++;
      }
      var _valid3 = _errs63 === errors;
      valid14 = valid14 || _valid3;
      if (!valid14) {
        const err68 = {
          instancePath: instancePath + "/target",
          schemaPath: "#/properties/target/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err68];
        } else {
          vErrors.push(err68);
        }
        errors++;
      } else {
        errors = _errs52;
        if (vErrors !== null) {
          if (_errs52) {
            vErrors.length = _errs52;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err69 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err69];
    } else {
      vErrors.push(err69);
    }
    errors++;
  }
  validate33.errors = vErrors;
  return errors === 0;
}
validate33.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};

const schema49 = {
  additionalProperties: false,
  properties: {
    assumptions: {
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 6,
      minItems: 1,
      title: "Assumptions",
      type: "array",
    },
    candidate_futures: {
      items: { $ref: "#/components/schemas/SimulationFuture" },
      maxItems: 3,
      minItems: 1,
      title: "Candidate Futures",
      type: "array",
    },
    evidence_ids: {
      items: { maxLength: 200, minLength: 1, type: "string" },
      maxItems: 12,
      minItems: 1,
      title: "Evidence Ids",
      type: "array",
    },
    external_effects_executed: {
      title: "External Effects Executed",
      type: "boolean",
    },
    likely_objective_outcome: {
      enum: ["MAY_IMPROVE", "STILL_AT_RISK", "INSUFFICIENT_EVIDENCE"],
      title: "Likely Objective Outcome",
      type: "string",
    },
    provenance: {
      const: "HYPOTHETICAL_NO_ACTION",
      title: "Provenance",
      type: "string",
    },
    risk_critique: {
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 6,
      minItems: 1,
      title: "Risk Critique",
      type: "array",
    },
    scenario_summary: {
      maxLength: 800,
      minLength: 1,
      title: "Scenario Summary",
      type: "string",
    },
    threatened_invariants: {
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 8,
      title: "Threatened Invariants",
      type: "array",
    },
    unsupported_assumptions: {
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 6,
      title: "Unsupported Assumptions",
      type: "array",
    },
  },
  required: [
    "provenance",
    "scenario_summary",
    "assumptions",
    "threatened_invariants",
    "candidate_futures",
    "risk_critique",
    "likely_objective_outcome",
    "unsupported_assumptions",
    "evidence_ids",
    "external_effects_executed",
  ],
  title: "SimulationResult",
  type: "object",
};
const schema50 = {
  additionalProperties: false,
  properties: {
    consequence: {
      maxLength: 800,
      minLength: 1,
      title: "Consequence",
      type: "string",
    },
    required_verification: {
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 4,
      minItems: 1,
      title: "Required Verification",
      type: "array",
    },
    title: { maxLength: 800, minLength: 1, title: "Title", type: "string" },
    tradeoffs: {
      items: { maxLength: 800, minLength: 1, type: "string" },
      maxItems: 4,
      minItems: 1,
      title: "Tradeoffs",
      type: "array",
    },
  },
  required: ["title", "consequence", "tradeoffs", "required_verification"],
  title: "SimulationFuture",
  type: "object",
};

function validate36(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate36.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.provenance === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provenance" },
        message: "must have required property '" + "provenance" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.scenario_summary === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "scenario_summary" },
        message: "must have required property '" + "scenario_summary" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.assumptions === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "assumptions" },
        message: "must have required property '" + "assumptions" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.threatened_invariants === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "threatened_invariants" },
        message:
          "must have required property '" + "threatened_invariants" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.candidate_futures === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "candidate_futures" },
        message: "must have required property '" + "candidate_futures" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.risk_critique === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "risk_critique" },
        message: "must have required property '" + "risk_critique" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.likely_objective_outcome === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "likely_objective_outcome" },
        message:
          "must have required property '" + "likely_objective_outcome" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.unsupported_assumptions === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "unsupported_assumptions" },
        message:
          "must have required property '" + "unsupported_assumptions" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.evidence_ids === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "evidence_ids" },
        message: "must have required property '" + "evidence_ids" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.external_effects_executed === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "external_effects_executed" },
        message:
          "must have required property '" + "external_effects_executed" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema49.properties, key0)) {
        const err10 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.assumptions !== undefined) {
      let data0 = data.assumptions;
      if (Array.isArray(data0)) {
        if (data0.length > 6) {
          const err11 = {
            instancePath: instancePath + "/assumptions",
            schemaPath: "#/properties/assumptions/maxItems",
            keyword: "maxItems",
            params: { limit: 6 },
            message: "must NOT have more than 6 items",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (data0.length < 1) {
          const err12 = {
            instancePath: instancePath + "/assumptions",
            schemaPath: "#/properties/assumptions/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        const len0 = data0.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data1 = data0[i0];
          if (typeof data1 === "string") {
            if (func4(data1) > 800) {
              const err13 = {
                instancePath: instancePath + "/assumptions/" + i0,
                schemaPath: "#/properties/assumptions/items/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
            if (func4(data1) < 1) {
              const err14 = {
                instancePath: instancePath + "/assumptions/" + i0,
                schemaPath: "#/properties/assumptions/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err14];
              } else {
                vErrors.push(err14);
              }
              errors++;
            }
          } else {
            const err15 = {
              instancePath: instancePath + "/assumptions/" + i0,
              schemaPath: "#/properties/assumptions/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/assumptions",
          schemaPath: "#/properties/assumptions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.candidate_futures !== undefined) {
      let data2 = data.candidate_futures;
      if (Array.isArray(data2)) {
        if (data2.length > 3) {
          const err17 = {
            instancePath: instancePath + "/candidate_futures",
            schemaPath: "#/properties/candidate_futures/maxItems",
            keyword: "maxItems",
            params: { limit: 3 },
            message: "must NOT have more than 3 items",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (data2.length < 1) {
          const err18 = {
            instancePath: instancePath + "/candidate_futures",
            schemaPath: "#/properties/candidate_futures/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        const len1 = data2.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data3 = data2[i1];
          if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
            if (data3.title === undefined) {
              const err19 = {
                instancePath: instancePath + "/candidate_futures/" + i1,
                schemaPath: "#/components/schemas/SimulationFuture/required",
                keyword: "required",
                params: { missingProperty: "title" },
                message: "must have required property '" + "title" + "'",
              };
              if (vErrors === null) {
                vErrors = [err19];
              } else {
                vErrors.push(err19);
              }
              errors++;
            }
            if (data3.consequence === undefined) {
              const err20 = {
                instancePath: instancePath + "/candidate_futures/" + i1,
                schemaPath: "#/components/schemas/SimulationFuture/required",
                keyword: "required",
                params: { missingProperty: "consequence" },
                message: "must have required property '" + "consequence" + "'",
              };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
            if (data3.tradeoffs === undefined) {
              const err21 = {
                instancePath: instancePath + "/candidate_futures/" + i1,
                schemaPath: "#/components/schemas/SimulationFuture/required",
                keyword: "required",
                params: { missingProperty: "tradeoffs" },
                message: "must have required property '" + "tradeoffs" + "'",
              };
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
            }
            if (data3.required_verification === undefined) {
              const err22 = {
                instancePath: instancePath + "/candidate_futures/" + i1,
                schemaPath: "#/components/schemas/SimulationFuture/required",
                keyword: "required",
                params: { missingProperty: "required_verification" },
                message:
                  "must have required property '" +
                  "required_verification" +
                  "'",
              };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
            for (const key1 in data3) {
              if (!(
                key1 === "consequence" ||
                key1 === "required_verification" ||
                key1 === "title" ||
                key1 === "tradeoffs"
              )) {
                const err23 = {
                  instancePath: instancePath + "/candidate_futures/" + i1,
                  schemaPath:
                    "#/components/schemas/SimulationFuture/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err23];
                } else {
                  vErrors.push(err23);
                }
                errors++;
              }
            }
            if (data3.consequence !== undefined) {
              let data4 = data3.consequence;
              if (typeof data4 === "string") {
                if (func4(data4) > 800) {
                  const err24 = {
                    instancePath:
                      instancePath +
                      "/candidate_futures/" +
                      i1 +
                      "/consequence",
                    schemaPath:
                      "#/components/schemas/SimulationFuture/properties/consequence/maxLength",
                    keyword: "maxLength",
                    params: { limit: 800 },
                    message: "must NOT have more than 800 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err24];
                  } else {
                    vErrors.push(err24);
                  }
                  errors++;
                }
                if (func4(data4) < 1) {
                  const err25 = {
                    instancePath:
                      instancePath +
                      "/candidate_futures/" +
                      i1 +
                      "/consequence",
                    schemaPath:
                      "#/components/schemas/SimulationFuture/properties/consequence/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err25];
                  } else {
                    vErrors.push(err25);
                  }
                  errors++;
                }
              } else {
                const err26 = {
                  instancePath:
                    instancePath + "/candidate_futures/" + i1 + "/consequence",
                  schemaPath:
                    "#/components/schemas/SimulationFuture/properties/consequence/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err26];
                } else {
                  vErrors.push(err26);
                }
                errors++;
              }
            }
            if (data3.required_verification !== undefined) {
              let data5 = data3.required_verification;
              if (Array.isArray(data5)) {
                if (data5.length > 4) {
                  const err27 = {
                    instancePath:
                      instancePath +
                      "/candidate_futures/" +
                      i1 +
                      "/required_verification",
                    schemaPath:
                      "#/components/schemas/SimulationFuture/properties/required_verification/maxItems",
                    keyword: "maxItems",
                    params: { limit: 4 },
                    message: "must NOT have more than 4 items",
                  };
                  if (vErrors === null) {
                    vErrors = [err27];
                  } else {
                    vErrors.push(err27);
                  }
                  errors++;
                }
                if (data5.length < 1) {
                  const err28 = {
                    instancePath:
                      instancePath +
                      "/candidate_futures/" +
                      i1 +
                      "/required_verification",
                    schemaPath:
                      "#/components/schemas/SimulationFuture/properties/required_verification/minItems",
                    keyword: "minItems",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 items",
                  };
                  if (vErrors === null) {
                    vErrors = [err28];
                  } else {
                    vErrors.push(err28);
                  }
                  errors++;
                }
                const len2 = data5.length;
                for (let i2 = 0; i2 < len2; i2++) {
                  let data6 = data5[i2];
                  if (typeof data6 === "string") {
                    if (func4(data6) > 800) {
                      const err29 = {
                        instancePath:
                          instancePath +
                          "/candidate_futures/" +
                          i1 +
                          "/required_verification/" +
                          i2,
                        schemaPath:
                          "#/components/schemas/SimulationFuture/properties/required_verification/items/maxLength",
                        keyword: "maxLength",
                        params: { limit: 800 },
                        message: "must NOT have more than 800 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err29];
                      } else {
                        vErrors.push(err29);
                      }
                      errors++;
                    }
                    if (func4(data6) < 1) {
                      const err30 = {
                        instancePath:
                          instancePath +
                          "/candidate_futures/" +
                          i1 +
                          "/required_verification/" +
                          i2,
                        schemaPath:
                          "#/components/schemas/SimulationFuture/properties/required_verification/items/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err30];
                      } else {
                        vErrors.push(err30);
                      }
                      errors++;
                    }
                  } else {
                    const err31 = {
                      instancePath:
                        instancePath +
                        "/candidate_futures/" +
                        i1 +
                        "/required_verification/" +
                        i2,
                      schemaPath:
                        "#/components/schemas/SimulationFuture/properties/required_verification/items/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err31];
                    } else {
                      vErrors.push(err31);
                    }
                    errors++;
                  }
                }
              } else {
                const err32 = {
                  instancePath:
                    instancePath +
                    "/candidate_futures/" +
                    i1 +
                    "/required_verification",
                  schemaPath:
                    "#/components/schemas/SimulationFuture/properties/required_verification/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                };
                if (vErrors === null) {
                  vErrors = [err32];
                } else {
                  vErrors.push(err32);
                }
                errors++;
              }
            }
            if (data3.title !== undefined) {
              let data7 = data3.title;
              if (typeof data7 === "string") {
                if (func4(data7) > 800) {
                  const err33 = {
                    instancePath:
                      instancePath + "/candidate_futures/" + i1 + "/title",
                    schemaPath:
                      "#/components/schemas/SimulationFuture/properties/title/maxLength",
                    keyword: "maxLength",
                    params: { limit: 800 },
                    message: "must NOT have more than 800 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err33];
                  } else {
                    vErrors.push(err33);
                  }
                  errors++;
                }
                if (func4(data7) < 1) {
                  const err34 = {
                    instancePath:
                      instancePath + "/candidate_futures/" + i1 + "/title",
                    schemaPath:
                      "#/components/schemas/SimulationFuture/properties/title/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err34];
                  } else {
                    vErrors.push(err34);
                  }
                  errors++;
                }
              } else {
                const err35 = {
                  instancePath:
                    instancePath + "/candidate_futures/" + i1 + "/title",
                  schemaPath:
                    "#/components/schemas/SimulationFuture/properties/title/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err35];
                } else {
                  vErrors.push(err35);
                }
                errors++;
              }
            }
            if (data3.tradeoffs !== undefined) {
              let data8 = data3.tradeoffs;
              if (Array.isArray(data8)) {
                if (data8.length > 4) {
                  const err36 = {
                    instancePath:
                      instancePath + "/candidate_futures/" + i1 + "/tradeoffs",
                    schemaPath:
                      "#/components/schemas/SimulationFuture/properties/tradeoffs/maxItems",
                    keyword: "maxItems",
                    params: { limit: 4 },
                    message: "must NOT have more than 4 items",
                  };
                  if (vErrors === null) {
                    vErrors = [err36];
                  } else {
                    vErrors.push(err36);
                  }
                  errors++;
                }
                if (data8.length < 1) {
                  const err37 = {
                    instancePath:
                      instancePath + "/candidate_futures/" + i1 + "/tradeoffs",
                    schemaPath:
                      "#/components/schemas/SimulationFuture/properties/tradeoffs/minItems",
                    keyword: "minItems",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 items",
                  };
                  if (vErrors === null) {
                    vErrors = [err37];
                  } else {
                    vErrors.push(err37);
                  }
                  errors++;
                }
                const len3 = data8.length;
                for (let i3 = 0; i3 < len3; i3++) {
                  let data9 = data8[i3];
                  if (typeof data9 === "string") {
                    if (func4(data9) > 800) {
                      const err38 = {
                        instancePath:
                          instancePath +
                          "/candidate_futures/" +
                          i1 +
                          "/tradeoffs/" +
                          i3,
                        schemaPath:
                          "#/components/schemas/SimulationFuture/properties/tradeoffs/items/maxLength",
                        keyword: "maxLength",
                        params: { limit: 800 },
                        message: "must NOT have more than 800 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err38];
                      } else {
                        vErrors.push(err38);
                      }
                      errors++;
                    }
                    if (func4(data9) < 1) {
                      const err39 = {
                        instancePath:
                          instancePath +
                          "/candidate_futures/" +
                          i1 +
                          "/tradeoffs/" +
                          i3,
                        schemaPath:
                          "#/components/schemas/SimulationFuture/properties/tradeoffs/items/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err39];
                      } else {
                        vErrors.push(err39);
                      }
                      errors++;
                    }
                  } else {
                    const err40 = {
                      instancePath:
                        instancePath +
                        "/candidate_futures/" +
                        i1 +
                        "/tradeoffs/" +
                        i3,
                      schemaPath:
                        "#/components/schemas/SimulationFuture/properties/tradeoffs/items/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err40];
                    } else {
                      vErrors.push(err40);
                    }
                    errors++;
                  }
                }
              } else {
                const err41 = {
                  instancePath:
                    instancePath + "/candidate_futures/" + i1 + "/tradeoffs",
                  schemaPath:
                    "#/components/schemas/SimulationFuture/properties/tradeoffs/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                };
                if (vErrors === null) {
                  vErrors = [err41];
                } else {
                  vErrors.push(err41);
                }
                errors++;
              }
            }
          } else {
            const err42 = {
              instancePath: instancePath + "/candidate_futures/" + i1,
              schemaPath: "#/components/schemas/SimulationFuture/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err42];
            } else {
              vErrors.push(err42);
            }
            errors++;
          }
        }
      } else {
        const err43 = {
          instancePath: instancePath + "/candidate_futures",
          schemaPath: "#/properties/candidate_futures/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
    }
    if (data.evidence_ids !== undefined) {
      let data10 = data.evidence_ids;
      if (Array.isArray(data10)) {
        if (data10.length > 12) {
          const err44 = {
            instancePath: instancePath + "/evidence_ids",
            schemaPath: "#/properties/evidence_ids/maxItems",
            keyword: "maxItems",
            params: { limit: 12 },
            message: "must NOT have more than 12 items",
          };
          if (vErrors === null) {
            vErrors = [err44];
          } else {
            vErrors.push(err44);
          }
          errors++;
        }
        if (data10.length < 1) {
          const err45 = {
            instancePath: instancePath + "/evidence_ids",
            schemaPath: "#/properties/evidence_ids/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err45];
          } else {
            vErrors.push(err45);
          }
          errors++;
        }
        const len4 = data10.length;
        for (let i4 = 0; i4 < len4; i4++) {
          let data11 = data10[i4];
          if (typeof data11 === "string") {
            if (func4(data11) > 200) {
              const err46 = {
                instancePath: instancePath + "/evidence_ids/" + i4,
                schemaPath: "#/properties/evidence_ids/items/maxLength",
                keyword: "maxLength",
                params: { limit: 200 },
                message: "must NOT have more than 200 characters",
              };
              if (vErrors === null) {
                vErrors = [err46];
              } else {
                vErrors.push(err46);
              }
              errors++;
            }
            if (func4(data11) < 1) {
              const err47 = {
                instancePath: instancePath + "/evidence_ids/" + i4,
                schemaPath: "#/properties/evidence_ids/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err47];
              } else {
                vErrors.push(err47);
              }
              errors++;
            }
          } else {
            const err48 = {
              instancePath: instancePath + "/evidence_ids/" + i4,
              schemaPath: "#/properties/evidence_ids/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err48];
            } else {
              vErrors.push(err48);
            }
            errors++;
          }
        }
      } else {
        const err49 = {
          instancePath: instancePath + "/evidence_ids",
          schemaPath: "#/properties/evidence_ids/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err49];
        } else {
          vErrors.push(err49);
        }
        errors++;
      }
    }
    if (data.external_effects_executed !== undefined) {
      if (typeof data.external_effects_executed !== "boolean") {
        const err50 = {
          instancePath: instancePath + "/external_effects_executed",
          schemaPath: "#/properties/external_effects_executed/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err50];
        } else {
          vErrors.push(err50);
        }
        errors++;
      }
    }
    if (data.likely_objective_outcome !== undefined) {
      let data13 = data.likely_objective_outcome;
      if (typeof data13 !== "string") {
        const err51 = {
          instancePath: instancePath + "/likely_objective_outcome",
          schemaPath: "#/properties/likely_objective_outcome/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err51];
        } else {
          vErrors.push(err51);
        }
        errors++;
      }
      if (!(
        data13 === "MAY_IMPROVE" ||
        data13 === "STILL_AT_RISK" ||
        data13 === "INSUFFICIENT_EVIDENCE"
      )) {
        const err52 = {
          instancePath: instancePath + "/likely_objective_outcome",
          schemaPath: "#/properties/likely_objective_outcome/enum",
          keyword: "enum",
          params: {
            allowedValues: schema49.properties.likely_objective_outcome.enum,
          },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err52];
        } else {
          vErrors.push(err52);
        }
        errors++;
      }
    }
    if (data.provenance !== undefined) {
      let data14 = data.provenance;
      if (typeof data14 !== "string") {
        const err53 = {
          instancePath: instancePath + "/provenance",
          schemaPath: "#/properties/provenance/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err53];
        } else {
          vErrors.push(err53);
        }
        errors++;
      }
      if ("HYPOTHETICAL_NO_ACTION" !== data14) {
        const err54 = {
          instancePath: instancePath + "/provenance",
          schemaPath: "#/properties/provenance/const",
          keyword: "const",
          params: { allowedValue: "HYPOTHETICAL_NO_ACTION" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err54];
        } else {
          vErrors.push(err54);
        }
        errors++;
      }
    }
    if (data.risk_critique !== undefined) {
      let data15 = data.risk_critique;
      if (Array.isArray(data15)) {
        if (data15.length > 6) {
          const err55 = {
            instancePath: instancePath + "/risk_critique",
            schemaPath: "#/properties/risk_critique/maxItems",
            keyword: "maxItems",
            params: { limit: 6 },
            message: "must NOT have more than 6 items",
          };
          if (vErrors === null) {
            vErrors = [err55];
          } else {
            vErrors.push(err55);
          }
          errors++;
        }
        if (data15.length < 1) {
          const err56 = {
            instancePath: instancePath + "/risk_critique",
            schemaPath: "#/properties/risk_critique/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err56];
          } else {
            vErrors.push(err56);
          }
          errors++;
        }
        const len5 = data15.length;
        for (let i5 = 0; i5 < len5; i5++) {
          let data16 = data15[i5];
          if (typeof data16 === "string") {
            if (func4(data16) > 800) {
              const err57 = {
                instancePath: instancePath + "/risk_critique/" + i5,
                schemaPath: "#/properties/risk_critique/items/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err57];
              } else {
                vErrors.push(err57);
              }
              errors++;
            }
            if (func4(data16) < 1) {
              const err58 = {
                instancePath: instancePath + "/risk_critique/" + i5,
                schemaPath: "#/properties/risk_critique/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err58];
              } else {
                vErrors.push(err58);
              }
              errors++;
            }
          } else {
            const err59 = {
              instancePath: instancePath + "/risk_critique/" + i5,
              schemaPath: "#/properties/risk_critique/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err59];
            } else {
              vErrors.push(err59);
            }
            errors++;
          }
        }
      } else {
        const err60 = {
          instancePath: instancePath + "/risk_critique",
          schemaPath: "#/properties/risk_critique/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err60];
        } else {
          vErrors.push(err60);
        }
        errors++;
      }
    }
    if (data.scenario_summary !== undefined) {
      let data17 = data.scenario_summary;
      if (typeof data17 === "string") {
        if (func4(data17) > 800) {
          const err61 = {
            instancePath: instancePath + "/scenario_summary",
            schemaPath: "#/properties/scenario_summary/maxLength",
            keyword: "maxLength",
            params: { limit: 800 },
            message: "must NOT have more than 800 characters",
          };
          if (vErrors === null) {
            vErrors = [err61];
          } else {
            vErrors.push(err61);
          }
          errors++;
        }
        if (func4(data17) < 1) {
          const err62 = {
            instancePath: instancePath + "/scenario_summary",
            schemaPath: "#/properties/scenario_summary/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err62];
          } else {
            vErrors.push(err62);
          }
          errors++;
        }
      } else {
        const err63 = {
          instancePath: instancePath + "/scenario_summary",
          schemaPath: "#/properties/scenario_summary/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err63];
        } else {
          vErrors.push(err63);
        }
        errors++;
      }
    }
    if (data.threatened_invariants !== undefined) {
      let data18 = data.threatened_invariants;
      if (Array.isArray(data18)) {
        if (data18.length > 8) {
          const err64 = {
            instancePath: instancePath + "/threatened_invariants",
            schemaPath: "#/properties/threatened_invariants/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err64];
          } else {
            vErrors.push(err64);
          }
          errors++;
        }
        const len6 = data18.length;
        for (let i6 = 0; i6 < len6; i6++) {
          let data19 = data18[i6];
          if (typeof data19 === "string") {
            if (func4(data19) > 800) {
              const err65 = {
                instancePath: instancePath + "/threatened_invariants/" + i6,
                schemaPath:
                  "#/properties/threatened_invariants/items/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err65];
              } else {
                vErrors.push(err65);
              }
              errors++;
            }
            if (func4(data19) < 1) {
              const err66 = {
                instancePath: instancePath + "/threatened_invariants/" + i6,
                schemaPath:
                  "#/properties/threatened_invariants/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err66];
              } else {
                vErrors.push(err66);
              }
              errors++;
            }
          } else {
            const err67 = {
              instancePath: instancePath + "/threatened_invariants/" + i6,
              schemaPath: "#/properties/threatened_invariants/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err67];
            } else {
              vErrors.push(err67);
            }
            errors++;
          }
        }
      } else {
        const err68 = {
          instancePath: instancePath + "/threatened_invariants",
          schemaPath: "#/properties/threatened_invariants/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err68];
        } else {
          vErrors.push(err68);
        }
        errors++;
      }
    }
    if (data.unsupported_assumptions !== undefined) {
      let data20 = data.unsupported_assumptions;
      if (Array.isArray(data20)) {
        if (data20.length > 6) {
          const err69 = {
            instancePath: instancePath + "/unsupported_assumptions",
            schemaPath: "#/properties/unsupported_assumptions/maxItems",
            keyword: "maxItems",
            params: { limit: 6 },
            message: "must NOT have more than 6 items",
          };
          if (vErrors === null) {
            vErrors = [err69];
          } else {
            vErrors.push(err69);
          }
          errors++;
        }
        const len7 = data20.length;
        for (let i7 = 0; i7 < len7; i7++) {
          let data21 = data20[i7];
          if (typeof data21 === "string") {
            if (func4(data21) > 800) {
              const err70 = {
                instancePath: instancePath + "/unsupported_assumptions/" + i7,
                schemaPath:
                  "#/properties/unsupported_assumptions/items/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err70];
              } else {
                vErrors.push(err70);
              }
              errors++;
            }
            if (func4(data21) < 1) {
              const err71 = {
                instancePath: instancePath + "/unsupported_assumptions/" + i7,
                schemaPath:
                  "#/properties/unsupported_assumptions/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err71];
              } else {
                vErrors.push(err71);
              }
              errors++;
            }
          } else {
            const err72 = {
              instancePath: instancePath + "/unsupported_assumptions/" + i7,
              schemaPath: "#/properties/unsupported_assumptions/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err72];
            } else {
              vErrors.push(err72);
            }
            errors++;
          }
        }
      } else {
        const err73 = {
          instancePath: instancePath + "/unsupported_assumptions",
          schemaPath: "#/properties/unsupported_assumptions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err73];
        } else {
          vErrors.push(err73);
        }
        errors++;
      }
    }
  } else {
    const err74 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err74];
    } else {
      vErrors.push(err74);
    }
    errors++;
  }
  validate36.errors = vErrors;
  return errors === 0;
}
validate36.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};

function validate22(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.request_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "request_id" },
        message: "must have required property '" + "request_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.incident_id === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "incident_id" },
        message: "must have required property '" + "incident_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.revision === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "revision" },
        message: "must have required property '" + "revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.snapshot_fingerprint === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "snapshot_fingerprint" },
        message: "must have required property '" + "snapshot_fingerprint" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.generated_at === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "generated_at" },
        message: "must have required property '" + "generated_at" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.disposition === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "disposition" },
        message: "must have required property '" + "disposition" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.conversation === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "conversation" },
        message: "must have required property '" + "conversation" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.human_response === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "human_response" },
        message: "must have required property '" + "human_response" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.answer === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "answer" },
        message: "must have required property '" + "answer" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.facts === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "facts" },
        message: "must have required property '" + "facts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.evidence === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "evidence" },
        message: "must have required property '" + "evidence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.provenance === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provenance" },
        message: "must have required property '" + "provenance" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.agents === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "agents" },
        message: "must have required property '" + "agents" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema33.properties, key0)) {
        const err13 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.action !== undefined) {
      let data0 = data.action;
      const _errs3 = errors;
      let valid1 = false;
      const _errs4 = errors;
      if (
        !validate23(data0, {
          instancePath: instancePath + "/action",
          parentData: data,
          parentDataProperty: "action",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate23.errors
            : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      valid1 = valid1 || _valid0;
      const _errs5 = errors;
      if (data0 !== null) {
        const err14 = {
          instancePath: instancePath + "/action",
          schemaPath: "#/properties/action/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
      var _valid0 = _errs5 === errors;
      valid1 = valid1 || _valid0;
      if (!valid1) {
        const err15 = {
          instancePath: instancePath + "/action",
          schemaPath: "#/properties/action/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      } else {
        errors = _errs3;
        if (vErrors !== null) {
          if (_errs3) {
            vErrors.length = _errs3;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.agents !== undefined) {
      let data1 = data.agents;
      if (Array.isArray(data1)) {
        if (data1.length > 3) {
          const err16 = {
            instancePath: instancePath + "/agents",
            schemaPath: "#/properties/agents/maxItems",
            keyword: "maxItems",
            params: { limit: 3 },
            message: "must NOT have more than 3 items",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data2 = data1[i0];
          if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
            if (data2.agent_id === undefined) {
              const err17 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "agent_id" },
                message: "must have required property '" + "agent_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors++;
            }
            if (data2.model === undefined) {
              const err18 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "model" },
                message: "must have required property '" + "model" + "'",
              };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
            if (data2.request_id === undefined) {
              const err19 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "request_id" },
                message: "must have required property '" + "request_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err19];
              } else {
                vErrors.push(err19);
              }
              errors++;
            }
            if (data2.latency_ms === undefined) {
              const err20 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "latency_ms" },
                message: "must have required property '" + "latency_ms" + "'",
              };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
            if (data2.attempts === undefined) {
              const err21 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "attempts" },
                message: "must have required property '" + "attempts" + "'",
              };
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
            }
            if (data2.input_tokens === undefined) {
              const err22 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "input_tokens" },
                message: "must have required property '" + "input_tokens" + "'",
              };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
            if (data2.output_tokens === undefined) {
              const err23 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "output_tokens" },
                message:
                  "must have required property '" + "output_tokens" + "'",
              };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
            if (data2.total_tokens === undefined) {
              const err24 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "total_tokens" },
                message: "must have required property '" + "total_tokens" + "'",
              };
              if (vErrors === null) {
                vErrors = [err24];
              } else {
                vErrors.push(err24);
              }
              errors++;
            }
            for (const key1 in data2) {
              if (!func1.call(schema39.properties, key1)) {
                const err25 = {
                  instancePath: instancePath + "/agents/" + i0,
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err25];
                } else {
                  vErrors.push(err25);
                }
                errors++;
              }
            }
            if (data2.agent_id !== undefined) {
              let data3 = data2.agent_id;
              if (typeof data3 !== "string") {
                const err26 = {
                  instancePath: instancePath + "/agents/" + i0 + "/agent_id",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/agent_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err26];
                } else {
                  vErrors.push(err26);
                }
                errors++;
              }
              if (!(
                data3 === "conversation_understanding_agent" ||
                data3 === "operator_intent_interpreter" ||
                data3 === "simulation_agent"
              )) {
                const err27 = {
                  instancePath: instancePath + "/agents/" + i0 + "/agent_id",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/agent_id/enum",
                  keyword: "enum",
                  params: { allowedValues: schema39.properties.agent_id.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err27];
                } else {
                  vErrors.push(err27);
                }
                errors++;
              }
            }
            if (data2.attempts !== undefined) {
              let data4 = data2.attempts;
              if (!(
                typeof data4 == "number" &&
                !(data4 % 1) &&
                !isNaN(data4)
              )) {
                const err28 = {
                  instancePath: instancePath + "/agents/" + i0 + "/attempts",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/attempts/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err28];
                } else {
                  vErrors.push(err28);
                }
                errors++;
              }
            }
            if (data2.input_tokens !== undefined) {
              let data5 = data2.input_tokens;
              if (!(
                typeof data5 == "number" &&
                !(data5 % 1) &&
                !isNaN(data5)
              )) {
                const err29 = {
                  instancePath:
                    instancePath + "/agents/" + i0 + "/input_tokens",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/input_tokens/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err29];
                } else {
                  vErrors.push(err29);
                }
                errors++;
              }
            }
            if (data2.latency_ms !== undefined) {
              let data6 = data2.latency_ms;
              if (!(
                typeof data6 == "number" &&
                !(data6 % 1) &&
                !isNaN(data6)
              )) {
                const err30 = {
                  instancePath: instancePath + "/agents/" + i0 + "/latency_ms",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/latency_ms/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err30];
                } else {
                  vErrors.push(err30);
                }
                errors++;
              }
            }
            if (data2.model !== undefined) {
              if (typeof data2.model !== "string") {
                const err31 = {
                  instancePath: instancePath + "/agents/" + i0 + "/model",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/model/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err31];
                } else {
                  vErrors.push(err31);
                }
                errors++;
              }
            }
            if (data2.output_tokens !== undefined) {
              let data8 = data2.output_tokens;
              if (!(
                typeof data8 == "number" &&
                !(data8 % 1) &&
                !isNaN(data8)
              )) {
                const err32 = {
                  instancePath:
                    instancePath + "/agents/" + i0 + "/output_tokens",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/output_tokens/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err32];
                } else {
                  vErrors.push(err32);
                }
                errors++;
              }
            }
            if (data2.request_id !== undefined) {
              if (typeof data2.request_id !== "string") {
                const err33 = {
                  instancePath: instancePath + "/agents/" + i0 + "/request_id",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/request_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err33];
                } else {
                  vErrors.push(err33);
                }
                errors++;
              }
            }
            if (data2.total_tokens !== undefined) {
              let data10 = data2.total_tokens;
              if (!(
                typeof data10 == "number" &&
                !(data10 % 1) &&
                !isNaN(data10)
              )) {
                const err34 = {
                  instancePath:
                    instancePath + "/agents/" + i0 + "/total_tokens",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/total_tokens/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err34];
                } else {
                  vErrors.push(err34);
                }
                errors++;
              }
            }
            if (data2.validation !== undefined) {
              let data11 = data2.validation;
              if (typeof data11 !== "string") {
                const err35 = {
                  instancePath: instancePath + "/agents/" + i0 + "/validation",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/validation/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err35];
                } else {
                  vErrors.push(err35);
                }
                errors++;
              }
              if ("PASSED" !== data11) {
                const err36 = {
                  instancePath: instancePath + "/agents/" + i0 + "/validation",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/validation/const",
                  keyword: "const",
                  params: { allowedValue: "PASSED" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err36];
                } else {
                  vErrors.push(err36);
                }
                errors++;
              }
            }
          } else {
            const err37 = {
              instancePath: instancePath + "/agents/" + i0,
              schemaPath: "#/components/schemas/OperatorAgentTrace/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err37];
            } else {
              vErrors.push(err37);
            }
            errors++;
          }
        }
      } else {
        const err38 = {
          instancePath: instancePath + "/agents",
          schemaPath: "#/properties/agents/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
    if (data.answer !== undefined) {
      let data12 = data.answer;
      if (typeof data12 === "string") {
        if (func4(data12) > 8000) {
          const err39 = {
            instancePath: instancePath + "/answer",
            schemaPath: "#/properties/answer/maxLength",
            keyword: "maxLength",
            params: { limit: 8000 },
            message: "must NOT have more than 8000 characters",
          };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
        if (func4(data12) < 1) {
          const err40 = {
            instancePath: instancePath + "/answer",
            schemaPath: "#/properties/answer/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err40];
          } else {
            vErrors.push(err40);
          }
          errors++;
        }
      } else {
        const err41 = {
          instancePath: instancePath + "/answer",
          schemaPath: "#/properties/answer/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
    }
    if (data.conversation !== undefined) {
      if (
        !validate31(data.conversation, {
          instancePath: instancePath + "/conversation",
          parentData: data,
          parentDataProperty: "conversation",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate31.errors
            : vErrors.concat(validate31.errors);
        errors = vErrors.length;
      }
    }
    if (data.disposition !== undefined) {
      let data14 = data.disposition;
      if (typeof data14 !== "string") {
        const err42 = {
          instancePath: instancePath + "/disposition",
          schemaPath: "#/properties/disposition/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
      if (!(
        data14 === "SUPPORTED" ||
        data14 === "CLARIFICATION_REQUIRED" ||
        data14 === "UNSUPPORTED"
      )) {
        const err43 = {
          instancePath: instancePath + "/disposition",
          schemaPath: "#/properties/disposition/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.disposition.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
    }
    if (data.evidence !== undefined) {
      let data15 = data.evidence;
      if (Array.isArray(data15)) {
        if (data15.length > 40) {
          const err44 = {
            instancePath: instancePath + "/evidence",
            schemaPath: "#/properties/evidence/maxItems",
            keyword: "maxItems",
            params: { limit: 40 },
            message: "must NOT have more than 40 items",
          };
          if (vErrors === null) {
            vErrors = [err44];
          } else {
            vErrors.push(err44);
          }
          errors++;
        }
        const len1 = data15.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data16 = data15[i1];
          if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
            if (data16.evidence_id === undefined) {
              const err45 = {
                instancePath: instancePath + "/evidence/" + i1,
                schemaPath: "#/components/schemas/OperatorEvidence/required",
                keyword: "required",
                params: { missingProperty: "evidence_id" },
                message: "must have required property '" + "evidence_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err45];
              } else {
                vErrors.push(err45);
              }
              errors++;
            }
            if (data16.title === undefined) {
              const err46 = {
                instancePath: instancePath + "/evidence/" + i1,
                schemaPath: "#/components/schemas/OperatorEvidence/required",
                keyword: "required",
                params: { missingProperty: "title" },
                message: "must have required property '" + "title" + "'",
              };
              if (vErrors === null) {
                vErrors = [err46];
              } else {
                vErrors.push(err46);
              }
              errors++;
            }
            if (data16.observed_at === undefined) {
              const err47 = {
                instancePath: instancePath + "/evidence/" + i1,
                schemaPath: "#/components/schemas/OperatorEvidence/required",
                keyword: "required",
                params: { missingProperty: "observed_at" },
                message: "must have required property '" + "observed_at" + "'",
              };
              if (vErrors === null) {
                vErrors = [err47];
              } else {
                vErrors.push(err47);
              }
              errors++;
            }
            for (const key2 in data16) {
              if (!(
                key2 === "evidence_id" ||
                key2 === "observed_at" ||
                key2 === "title"
              )) {
                const err48 = {
                  instancePath: instancePath + "/evidence/" + i1,
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key2 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err48];
                } else {
                  vErrors.push(err48);
                }
                errors++;
              }
            }
            if (data16.evidence_id !== undefined) {
              let data17 = data16.evidence_id;
              if (typeof data17 === "string") {
                if (func4(data17) > 200) {
                  const err49 = {
                    instancePath:
                      instancePath + "/evidence/" + i1 + "/evidence_id",
                    schemaPath:
                      "#/components/schemas/OperatorEvidence/properties/evidence_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 200 },
                    message: "must NOT have more than 200 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err49];
                  } else {
                    vErrors.push(err49);
                  }
                  errors++;
                }
                if (func4(data17) < 1) {
                  const err50 = {
                    instancePath:
                      instancePath + "/evidence/" + i1 + "/evidence_id",
                    schemaPath:
                      "#/components/schemas/OperatorEvidence/properties/evidence_id/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err50];
                  } else {
                    vErrors.push(err50);
                  }
                  errors++;
                }
              } else {
                const err51 = {
                  instancePath:
                    instancePath + "/evidence/" + i1 + "/evidence_id",
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/properties/evidence_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err51];
                } else {
                  vErrors.push(err51);
                }
                errors++;
              }
            }
            if (data16.observed_at !== undefined) {
              let data18 = data16.observed_at;
              const _errs45 = errors;
              let valid10 = false;
              const _errs46 = errors;
              if (typeof data18 !== "string") {
                const err52 = {
                  instancePath:
                    instancePath + "/evidence/" + i1 + "/observed_at",
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/properties/observed_at/anyOf/0/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err52];
                } else {
                  vErrors.push(err52);
                }
                errors++;
              }
              var _valid1 = _errs46 === errors;
              valid10 = valid10 || _valid1;
              const _errs48 = errors;
              if (data18 !== null) {
                const err53 = {
                  instancePath:
                    instancePath + "/evidence/" + i1 + "/observed_at",
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/properties/observed_at/anyOf/1/type",
                  keyword: "type",
                  params: { type: "null" },
                  message: "must be null",
                };
                if (vErrors === null) {
                  vErrors = [err53];
                } else {
                  vErrors.push(err53);
                }
                errors++;
              }
              var _valid1 = _errs48 === errors;
              valid10 = valid10 || _valid1;
              if (!valid10) {
                const err54 = {
                  instancePath:
                    instancePath + "/evidence/" + i1 + "/observed_at",
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/properties/observed_at/anyOf",
                  keyword: "anyOf",
                  params: {},
                  message: "must match a schema in anyOf",
                };
                if (vErrors === null) {
                  vErrors = [err54];
                } else {
                  vErrors.push(err54);
                }
                errors++;
              } else {
                errors = _errs45;
                if (vErrors !== null) {
                  if (_errs45) {
                    vErrors.length = _errs45;
                  } else {
                    vErrors = null;
                  }
                }
              }
            }
            if (data16.title !== undefined) {
              let data19 = data16.title;
              if (typeof data19 === "string") {
                if (func4(data19) > 800) {
                  const err55 = {
                    instancePath: instancePath + "/evidence/" + i1 + "/title",
                    schemaPath:
                      "#/components/schemas/OperatorEvidence/properties/title/maxLength",
                    keyword: "maxLength",
                    params: { limit: 800 },
                    message: "must NOT have more than 800 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err55];
                  } else {
                    vErrors.push(err55);
                  }
                  errors++;
                }
                if (func4(data19) < 1) {
                  const err56 = {
                    instancePath: instancePath + "/evidence/" + i1 + "/title",
                    schemaPath:
                      "#/components/schemas/OperatorEvidence/properties/title/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err56];
                  } else {
                    vErrors.push(err56);
                  }
                  errors++;
                }
              } else {
                const err57 = {
                  instancePath: instancePath + "/evidence/" + i1 + "/title",
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/properties/title/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err57];
                } else {
                  vErrors.push(err57);
                }
                errors++;
              }
            }
          } else {
            const err58 = {
              instancePath: instancePath + "/evidence/" + i1,
              schemaPath: "#/components/schemas/OperatorEvidence/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err58];
            } else {
              vErrors.push(err58);
            }
            errors++;
          }
        }
      } else {
        const err59 = {
          instancePath: instancePath + "/evidence",
          schemaPath: "#/properties/evidence/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err59];
        } else {
          vErrors.push(err59);
        }
        errors++;
      }
    }
    if (data.external_effects_executed !== undefined) {
      if (typeof data.external_effects_executed !== "boolean") {
        const err60 = {
          instancePath: instancePath + "/external_effects_executed",
          schemaPath: "#/properties/external_effects_executed/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err60];
        } else {
          vErrors.push(err60);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data21 = data.facts;
      if (Array.isArray(data21)) {
        if (data21.length > 12) {
          const err61 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/properties/facts/maxItems",
            keyword: "maxItems",
            params: { limit: 12 },
            message: "must NOT have more than 12 items",
          };
          if (vErrors === null) {
            vErrors = [err61];
          } else {
            vErrors.push(err61);
          }
          errors++;
        }
        const len2 = data21.length;
        for (let i2 = 0; i2 < len2; i2++) {
          let data22 = data21[i2];
          if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
            if (data22.fact_id === undefined) {
              const err62 = {
                instancePath: instancePath + "/facts/" + i2,
                schemaPath: "#/components/schemas/OperatorFact/required",
                keyword: "required",
                params: { missingProperty: "fact_id" },
                message: "must have required property '" + "fact_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
            if (data22.text === undefined) {
              const err63 = {
                instancePath: instancePath + "/facts/" + i2,
                schemaPath: "#/components/schemas/OperatorFact/required",
                keyword: "required",
                params: { missingProperty: "text" },
                message: "must have required property '" + "text" + "'",
              };
              if (vErrors === null) {
                vErrors = [err63];
              } else {
                vErrors.push(err63);
              }
              errors++;
            }
            if (data22.evidence_ids === undefined) {
              const err64 = {
                instancePath: instancePath + "/facts/" + i2,
                schemaPath: "#/components/schemas/OperatorFact/required",
                keyword: "required",
                params: { missingProperty: "evidence_ids" },
                message: "must have required property '" + "evidence_ids" + "'",
              };
              if (vErrors === null) {
                vErrors = [err64];
              } else {
                vErrors.push(err64);
              }
              errors++;
            }
            for (const key3 in data22) {
              if (!(
                key3 === "evidence_ids" ||
                key3 === "fact_id" ||
                key3 === "text"
              )) {
                const err65 = {
                  instancePath: instancePath + "/facts/" + i2,
                  schemaPath:
                    "#/components/schemas/OperatorFact/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key3 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err65];
                } else {
                  vErrors.push(err65);
                }
                errors++;
              }
            }
            if (data22.evidence_ids !== undefined) {
              let data23 = data22.evidence_ids;
              if (Array.isArray(data23)) {
                if (data23.length > 8) {
                  const err66 = {
                    instancePath:
                      instancePath + "/facts/" + i2 + "/evidence_ids",
                    schemaPath:
                      "#/components/schemas/OperatorFact/properties/evidence_ids/maxItems",
                    keyword: "maxItems",
                    params: { limit: 8 },
                    message: "must NOT have more than 8 items",
                  };
                  if (vErrors === null) {
                    vErrors = [err66];
                  } else {
                    vErrors.push(err66);
                  }
                  errors++;
                }
                const len3 = data23.length;
                for (let i3 = 0; i3 < len3; i3++) {
                  let data24 = data23[i3];
                  if (typeof data24 === "string") {
                    if (func4(data24) > 200) {
                      const err67 = {
                        instancePath:
                          instancePath + "/facts/" + i2 + "/evidence_ids/" + i3,
                        schemaPath:
                          "#/components/schemas/OperatorFact/properties/evidence_ids/items/maxLength",
                        keyword: "maxLength",
                        params: { limit: 200 },
                        message: "must NOT have more than 200 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err67];
                      } else {
                        vErrors.push(err67);
                      }
                      errors++;
                    }
                    if (func4(data24) < 1) {
                      const err68 = {
                        instancePath:
                          instancePath + "/facts/" + i2 + "/evidence_ids/" + i3,
                        schemaPath:
                          "#/components/schemas/OperatorFact/properties/evidence_ids/items/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err68];
                      } else {
                        vErrors.push(err68);
                      }
                      errors++;
                    }
                  } else {
                    const err69 = {
                      instancePath:
                        instancePath + "/facts/" + i2 + "/evidence_ids/" + i3,
                      schemaPath:
                        "#/components/schemas/OperatorFact/properties/evidence_ids/items/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err69];
                    } else {
                      vErrors.push(err69);
                    }
                    errors++;
                  }
                }
              } else {
                const err70 = {
                  instancePath: instancePath + "/facts/" + i2 + "/evidence_ids",
                  schemaPath:
                    "#/components/schemas/OperatorFact/properties/evidence_ids/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                };
                if (vErrors === null) {
                  vErrors = [err70];
                } else {
                  vErrors.push(err70);
                }
                errors++;
              }
            }
            if (data22.fact_id !== undefined) {
              let data25 = data22.fact_id;
              if (typeof data25 === "string") {
                if (func4(data25) > 200) {
                  const err71 = {
                    instancePath: instancePath + "/facts/" + i2 + "/fact_id",
                    schemaPath:
                      "#/components/schemas/OperatorFact/properties/fact_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 200 },
                    message: "must NOT have more than 200 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err71];
                  } else {
                    vErrors.push(err71);
                  }
                  errors++;
                }
                if (func4(data25) < 1) {
                  const err72 = {
                    instancePath: instancePath + "/facts/" + i2 + "/fact_id",
                    schemaPath:
                      "#/components/schemas/OperatorFact/properties/fact_id/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err72];
                  } else {
                    vErrors.push(err72);
                  }
                  errors++;
                }
              } else {
                const err73 = {
                  instancePath: instancePath + "/facts/" + i2 + "/fact_id",
                  schemaPath:
                    "#/components/schemas/OperatorFact/properties/fact_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err73];
                } else {
                  vErrors.push(err73);
                }
                errors++;
              }
            }
            if (data22.text !== undefined) {
              let data26 = data22.text;
              if (typeof data26 === "string") {
                if (func4(data26) > 800) {
                  const err74 = {
                    instancePath: instancePath + "/facts/" + i2 + "/text",
                    schemaPath:
                      "#/components/schemas/OperatorFact/properties/text/maxLength",
                    keyword: "maxLength",
                    params: { limit: 800 },
                    message: "must NOT have more than 800 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err74];
                  } else {
                    vErrors.push(err74);
                  }
                  errors++;
                }
                if (func4(data26) < 1) {
                  const err75 = {
                    instancePath: instancePath + "/facts/" + i2 + "/text",
                    schemaPath:
                      "#/components/schemas/OperatorFact/properties/text/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err75];
                  } else {
                    vErrors.push(err75);
                  }
                  errors++;
                }
              } else {
                const err76 = {
                  instancePath: instancePath + "/facts/" + i2 + "/text",
                  schemaPath:
                    "#/components/schemas/OperatorFact/properties/text/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err76];
                } else {
                  vErrors.push(err76);
                }
                errors++;
              }
            }
          } else {
            const err77 = {
              instancePath: instancePath + "/facts/" + i2,
              schemaPath: "#/components/schemas/OperatorFact/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err77];
            } else {
              vErrors.push(err77);
            }
            errors++;
          }
        }
      } else {
        const err78 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/properties/facts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err78];
        } else {
          vErrors.push(err78);
        }
        errors++;
      }
    }
    if (data.generated_at !== undefined) {
      if (typeof data.generated_at !== "string") {
        const err79 = {
          instancePath: instancePath + "/generated_at",
          schemaPath: "#/properties/generated_at/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err79];
        } else {
          vErrors.push(err79);
        }
        errors++;
      }
    }
    if (data.human_response !== undefined) {
      let data28 = data.human_response;
      if (data28 && typeof data28 == "object" && !Array.isArray(data28)) {
        if (data28.human_summary === undefined) {
          const err80 = {
            instancePath: instancePath + "/human_response",
            schemaPath: "#/components/schemas/HumanResponse/required",
            keyword: "required",
            params: { missingProperty: "human_summary" },
            message: "must have required property '" + "human_summary" + "'",
          };
          if (vErrors === null) {
            vErrors = [err80];
          } else {
            vErrors.push(err80);
          }
          errors++;
        }
        if (data28.situation_type === undefined) {
          const err81 = {
            instancePath: instancePath + "/human_response",
            schemaPath: "#/components/schemas/HumanResponse/required",
            keyword: "required",
            params: { missingProperty: "situation_type" },
            message: "must have required property '" + "situation_type" + "'",
          };
          if (vErrors === null) {
            vErrors = [err81];
          } else {
            vErrors.push(err81);
          }
          errors++;
        }
        if (data28.current_state === undefined) {
          const err82 = {
            instancePath: instancePath + "/human_response",
            schemaPath: "#/components/schemas/HumanResponse/required",
            keyword: "required",
            params: { missingProperty: "current_state" },
            message: "must have required property '" + "current_state" + "'",
          };
          if (vErrors === null) {
            vErrors = [err82];
          } else {
            vErrors.push(err82);
          }
          errors++;
        }
        if (data28.truth_boundary === undefined) {
          const err83 = {
            instancePath: instancePath + "/human_response",
            schemaPath: "#/components/schemas/HumanResponse/required",
            keyword: "required",
            params: { missingProperty: "truth_boundary" },
            message: "must have required property '" + "truth_boundary" + "'",
          };
          if (vErrors === null) {
            vErrors = [err83];
          } else {
            vErrors.push(err83);
          }
          errors++;
        }
        for (const key4 in data28) {
          if (!(
            key4 === "current_state" ||
            key4 === "human_summary" ||
            key4 === "next_step" ||
            key4 === "situation_type" ||
            key4 === "suggestions" ||
            key4 === "truth_boundary" ||
            key4 === "why"
          )) {
            const err84 = {
              instancePath: instancePath + "/human_response",
              schemaPath:
                "#/components/schemas/HumanResponse/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key4 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err84];
            } else {
              vErrors.push(err84);
            }
            errors++;
          }
        }
        if (data28.current_state !== undefined) {
          let data29 = data28.current_state;
          if (typeof data29 === "string") {
            if (func4(data29) > 800) {
              const err85 = {
                instancePath: instancePath + "/human_response/current_state",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/current_state/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err85];
              } else {
                vErrors.push(err85);
              }
              errors++;
            }
            if (func4(data29) < 1) {
              const err86 = {
                instancePath: instancePath + "/human_response/current_state",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/current_state/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err86];
              } else {
                vErrors.push(err86);
              }
              errors++;
            }
          } else {
            const err87 = {
              instancePath: instancePath + "/human_response/current_state",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/current_state/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err87];
            } else {
              vErrors.push(err87);
            }
            errors++;
          }
        }
        if (data28.human_summary !== undefined) {
          let data30 = data28.human_summary;
          if (typeof data30 === "string") {
            if (func4(data30) > 1600) {
              const err88 = {
                instancePath: instancePath + "/human_response/human_summary",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/human_summary/maxLength",
                keyword: "maxLength",
                params: { limit: 1600 },
                message: "must NOT have more than 1600 characters",
              };
              if (vErrors === null) {
                vErrors = [err88];
              } else {
                vErrors.push(err88);
              }
              errors++;
            }
            if (func4(data30) < 1) {
              const err89 = {
                instancePath: instancePath + "/human_response/human_summary",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/human_summary/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err89];
              } else {
                vErrors.push(err89);
              }
              errors++;
            }
          } else {
            const err90 = {
              instancePath: instancePath + "/human_response/human_summary",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/human_summary/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err90];
            } else {
              vErrors.push(err90);
            }
            errors++;
          }
        }
        if (data28.next_step !== undefined) {
          let data31 = data28.next_step;
          const _errs79 = errors;
          let valid19 = false;
          const _errs80 = errors;
          if (typeof data31 === "string") {
            if (func4(data31) > 800) {
              const err91 = {
                instancePath: instancePath + "/human_response/next_step",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/next_step/anyOf/0/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err91];
              } else {
                vErrors.push(err91);
              }
              errors++;
            }
            if (func4(data31) < 1) {
              const err92 = {
                instancePath: instancePath + "/human_response/next_step",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/next_step/anyOf/0/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err92];
              } else {
                vErrors.push(err92);
              }
              errors++;
            }
          } else {
            const err93 = {
              instancePath: instancePath + "/human_response/next_step",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/next_step/anyOf/0/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err93];
            } else {
              vErrors.push(err93);
            }
            errors++;
          }
          var _valid2 = _errs80 === errors;
          valid19 = valid19 || _valid2;
          const _errs82 = errors;
          if (data31 !== null) {
            const err94 = {
              instancePath: instancePath + "/human_response/next_step",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/next_step/anyOf/1/type",
              keyword: "type",
              params: { type: "null" },
              message: "must be null",
            };
            if (vErrors === null) {
              vErrors = [err94];
            } else {
              vErrors.push(err94);
            }
            errors++;
          }
          var _valid2 = _errs82 === errors;
          valid19 = valid19 || _valid2;
          if (!valid19) {
            const err95 = {
              instancePath: instancePath + "/human_response/next_step",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/next_step/anyOf",
              keyword: "anyOf",
              params: {},
              message: "must match a schema in anyOf",
            };
            if (vErrors === null) {
              vErrors = [err95];
            } else {
              vErrors.push(err95);
            }
            errors++;
          } else {
            errors = _errs79;
            if (vErrors !== null) {
              if (_errs79) {
                vErrors.length = _errs79;
              } else {
                vErrors = null;
              }
            }
          }
        }
        if (data28.situation_type !== undefined) {
          let data32 = data28.situation_type;
          if (typeof data32 !== "string") {
            const err96 = {
              instancePath: instancePath + "/human_response/situation_type",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/situation_type/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err96];
            } else {
              vErrors.push(err96);
            }
            errors++;
          }
          if (!(
            data32 === "GENERAL" ||
            data32 === "HELP" ||
            data32 === "SUCCESS" ||
            data32 === "FAILED" ||
            data32 === "UNCERTAIN" ||
            data32 === "DENIED" ||
            data32 === "UNSUPPORTED" ||
            data32 === "NEEDS_CLARIFICATION" ||
            data32 === "INSPECTION" ||
            data32 === "SIMULATION" ||
            data32 === "EXPLANATION" ||
            data32 === "OBJECTIVE_RESTORED"
          )) {
            const err97 = {
              instancePath: instancePath + "/human_response/situation_type",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/situation_type/enum",
              keyword: "enum",
              params: {
                allowedValues: schema44.properties.situation_type.enum,
              },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err97];
            } else {
              vErrors.push(err97);
            }
            errors++;
          }
        }
        if (data28.suggestions !== undefined) {
          let data33 = data28.suggestions;
          if (Array.isArray(data33)) {
            if (data33.length > 3) {
              const err98 = {
                instancePath: instancePath + "/human_response/suggestions",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/suggestions/maxItems",
                keyword: "maxItems",
                params: { limit: 3 },
                message: "must NOT have more than 3 items",
              };
              if (vErrors === null) {
                vErrors = [err98];
              } else {
                vErrors.push(err98);
              }
              errors++;
            }
            const len4 = data33.length;
            for (let i4 = 0; i4 < len4; i4++) {
              let data34 = data33[i4];
              if (typeof data34 === "string") {
                if (func4(data34) > 800) {
                  const err99 = {
                    instancePath:
                      instancePath + "/human_response/suggestions/" + i4,
                    schemaPath:
                      "#/components/schemas/HumanResponse/properties/suggestions/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 800 },
                    message: "must NOT have more than 800 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err99];
                  } else {
                    vErrors.push(err99);
                  }
                  errors++;
                }
                if (func4(data34) < 1) {
                  const err100 = {
                    instancePath:
                      instancePath + "/human_response/suggestions/" + i4,
                    schemaPath:
                      "#/components/schemas/HumanResponse/properties/suggestions/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err100];
                  } else {
                    vErrors.push(err100);
                  }
                  errors++;
                }
              } else {
                const err101 = {
                  instancePath:
                    instancePath + "/human_response/suggestions/" + i4,
                  schemaPath:
                    "#/components/schemas/HumanResponse/properties/suggestions/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err101];
                } else {
                  vErrors.push(err101);
                }
                errors++;
              }
            }
          } else {
            const err102 = {
              instancePath: instancePath + "/human_response/suggestions",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/suggestions/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err102];
            } else {
              vErrors.push(err102);
            }
            errors++;
          }
        }
        if (data28.truth_boundary !== undefined) {
          let data35 = data28.truth_boundary;
          if (typeof data35 === "string") {
            if (func4(data35) > 800) {
              const err103 = {
                instancePath: instancePath + "/human_response/truth_boundary",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/truth_boundary/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err103];
              } else {
                vErrors.push(err103);
              }
              errors++;
            }
            if (func4(data35) < 1) {
              const err104 = {
                instancePath: instancePath + "/human_response/truth_boundary",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/truth_boundary/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err104];
              } else {
                vErrors.push(err104);
              }
              errors++;
            }
          } else {
            const err105 = {
              instancePath: instancePath + "/human_response/truth_boundary",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/truth_boundary/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err105];
            } else {
              vErrors.push(err105);
            }
            errors++;
          }
        }
        if (data28.why !== undefined) {
          let data36 = data28.why;
          const _errs93 = errors;
          let valid22 = false;
          const _errs94 = errors;
          if (typeof data36 === "string") {
            if (func4(data36) > 800) {
              const err106 = {
                instancePath: instancePath + "/human_response/why",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/why/anyOf/0/maxLength",
                keyword: "maxLength",
                params: { limit: 800 },
                message: "must NOT have more than 800 characters",
              };
              if (vErrors === null) {
                vErrors = [err106];
              } else {
                vErrors.push(err106);
              }
              errors++;
            }
            if (func4(data36) < 1) {
              const err107 = {
                instancePath: instancePath + "/human_response/why",
                schemaPath:
                  "#/components/schemas/HumanResponse/properties/why/anyOf/0/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err107];
              } else {
                vErrors.push(err107);
              }
              errors++;
            }
          } else {
            const err108 = {
              instancePath: instancePath + "/human_response/why",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/why/anyOf/0/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err108];
            } else {
              vErrors.push(err108);
            }
            errors++;
          }
          var _valid3 = _errs94 === errors;
          valid22 = valid22 || _valid3;
          const _errs96 = errors;
          if (data36 !== null) {
            const err109 = {
              instancePath: instancePath + "/human_response/why",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/why/anyOf/1/type",
              keyword: "type",
              params: { type: "null" },
              message: "must be null",
            };
            if (vErrors === null) {
              vErrors = [err109];
            } else {
              vErrors.push(err109);
            }
            errors++;
          }
          var _valid3 = _errs96 === errors;
          valid22 = valid22 || _valid3;
          if (!valid22) {
            const err110 = {
              instancePath: instancePath + "/human_response/why",
              schemaPath:
                "#/components/schemas/HumanResponse/properties/why/anyOf",
              keyword: "anyOf",
              params: {},
              message: "must match a schema in anyOf",
            };
            if (vErrors === null) {
              vErrors = [err110];
            } else {
              vErrors.push(err110);
            }
            errors++;
          } else {
            errors = _errs93;
            if (vErrors !== null) {
              if (_errs93) {
                vErrors.length = _errs93;
              } else {
                vErrors = null;
              }
            }
          }
        }
      } else {
        const err111 = {
          instancePath: instancePath + "/human_response",
          schemaPath: "#/components/schemas/HumanResponse/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err111];
        } else {
          vErrors.push(err111);
        }
        errors++;
      }
    }
    if (data.hypothetical_deadline !== undefined) {
      let data37 = data.hypothetical_deadline;
      const _errs99 = errors;
      let valid23 = false;
      const _errs100 = errors;
      if (typeof data37 !== "string") {
        const err112 = {
          instancePath: instancePath + "/hypothetical_deadline",
          schemaPath: "#/properties/hypothetical_deadline/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err112];
        } else {
          vErrors.push(err112);
        }
        errors++;
      }
      var _valid4 = _errs100 === errors;
      valid23 = valid23 || _valid4;
      const _errs102 = errors;
      if (data37 !== null) {
        const err113 = {
          instancePath: instancePath + "/hypothetical_deadline",
          schemaPath: "#/properties/hypothetical_deadline/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err113];
        } else {
          vErrors.push(err113);
        }
        errors++;
      }
      var _valid4 = _errs102 === errors;
      valid23 = valid23 || _valid4;
      if (!valid23) {
        const err114 = {
          instancePath: instancePath + "/hypothetical_deadline",
          schemaPath: "#/properties/hypothetical_deadline/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err114];
        } else {
          vErrors.push(err114);
        }
        errors++;
      } else {
        errors = _errs99;
        if (vErrors !== null) {
          if (_errs99) {
            vErrors.length = _errs99;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.incident_id !== undefined) {
      if (typeof data.incident_id !== "string") {
        const err115 = {
          instancePath: instancePath + "/incident_id",
          schemaPath: "#/properties/incident_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err115];
        } else {
          vErrors.push(err115);
        }
        errors++;
      }
    }
    if (data.inspection !== undefined) {
      let data39 = data.inspection;
      const _errs107 = errors;
      let valid24 = false;
      const _errs108 = errors;
      if (data39 && typeof data39 == "object" && !Array.isArray(data39)) {
        if (data39.authority === undefined) {
          const err116 = {
            instancePath: instancePath + "/inspection",
            schemaPath: "#/components/schemas/OperatorInspection/required",
            keyword: "required",
            params: { missingProperty: "authority" },
            message: "must have required property '" + "authority" + "'",
          };
          if (vErrors === null) {
            vErrors = [err116];
          } else {
            vErrors.push(err116);
          }
          errors++;
        }
        if (data39.resource_type === undefined) {
          const err117 = {
            instancePath: instancePath + "/inspection",
            schemaPath: "#/components/schemas/OperatorInspection/required",
            keyword: "required",
            params: { missingProperty: "resource_type" },
            message: "must have required property '" + "resource_type" + "'",
          };
          if (vErrors === null) {
            vErrors = [err117];
          } else {
            vErrors.push(err117);
          }
          errors++;
        }
        if (data39.resource_identifier === undefined) {
          const err118 = {
            instancePath: instancePath + "/inspection",
            schemaPath: "#/components/schemas/OperatorInspection/required",
            keyword: "required",
            params: { missingProperty: "resource_identifier" },
            message:
              "must have required property '" + "resource_identifier" + "'",
          };
          if (vErrors === null) {
            vErrors = [err118];
          } else {
            vErrors.push(err118);
          }
          errors++;
        }
        if (data39.observed_state === undefined) {
          const err119 = {
            instancePath: instancePath + "/inspection",
            schemaPath: "#/components/schemas/OperatorInspection/required",
            keyword: "required",
            params: { missingProperty: "observed_state" },
            message: "must have required property '" + "observed_state" + "'",
          };
          if (vErrors === null) {
            vErrors = [err119];
          } else {
            vErrors.push(err119);
          }
          errors++;
        }
        if (data39.observed_at === undefined) {
          const err120 = {
            instancePath: instancePath + "/inspection",
            schemaPath: "#/components/schemas/OperatorInspection/required",
            keyword: "required",
            params: { missingProperty: "observed_at" },
            message: "must have required property '" + "observed_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err120];
          } else {
            vErrors.push(err120);
          }
          errors++;
        }
        for (const key5 in data39) {
          if (!(
            key5 === "authority" ||
            key5 === "observed_at" ||
            key5 === "observed_state" ||
            key5 === "resource_identifier" ||
            key5 === "resource_type"
          )) {
            const err121 = {
              instancePath: instancePath + "/inspection",
              schemaPath:
                "#/components/schemas/OperatorInspection/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key5 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err121];
            } else {
              vErrors.push(err121);
            }
            errors++;
          }
        }
        if (data39.authority !== undefined) {
          let data40 = data39.authority;
          if (typeof data40 !== "string") {
            const err122 = {
              instancePath: instancePath + "/inspection/authority",
              schemaPath:
                "#/components/schemas/OperatorInspection/properties/authority/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err122];
            } else {
              vErrors.push(err122);
            }
            errors++;
          }
          if (!(
            data40 === "JIRA" ||
            data40 === "GOOGLE_CALENDAR" ||
            data40 === "REFLOW" ||
            data40 === "SLACK"
          )) {
            const err123 = {
              instancePath: instancePath + "/inspection/authority",
              schemaPath:
                "#/components/schemas/OperatorInspection/properties/authority/enum",
              keyword: "enum",
              params: { allowedValues: schema45.properties.authority.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err123];
            } else {
              vErrors.push(err123);
            }
            errors++;
          }
        }
        if (data39.observed_at !== undefined) {
          if (typeof data39.observed_at !== "string") {
            const err124 = {
              instancePath: instancePath + "/inspection/observed_at",
              schemaPath:
                "#/components/schemas/OperatorInspection/properties/observed_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err124];
            } else {
              vErrors.push(err124);
            }
            errors++;
          }
        }
        if (data39.observed_state !== undefined) {
          let data42 = data39.observed_state;
          if (data42 && typeof data42 == "object" && !Array.isArray(data42)) {
            for (const key6 in data42) {
              let data43 = data42[key6];
              const _errs120 = errors;
              let valid28 = false;
              const _errs121 = errors;
              if (typeof data43 !== "string") {
                const err125 = {
                  instancePath:
                    instancePath +
                    "/inspection/observed_state/" +
                    key6.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/components/schemas/OperatorInspection/properties/observed_state/additionalProperties/anyOf/0/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err125];
                } else {
                  vErrors.push(err125);
                }
                errors++;
              }
              var _valid6 = _errs121 === errors;
              valid28 = valid28 || _valid6;
              const _errs123 = errors;
              if (data43 !== null) {
                const err126 = {
                  instancePath:
                    instancePath +
                    "/inspection/observed_state/" +
                    key6.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/components/schemas/OperatorInspection/properties/observed_state/additionalProperties/anyOf/1/type",
                  keyword: "type",
                  params: { type: "null" },
                  message: "must be null",
                };
                if (vErrors === null) {
                  vErrors = [err126];
                } else {
                  vErrors.push(err126);
                }
                errors++;
              }
              var _valid6 = _errs123 === errors;
              valid28 = valid28 || _valid6;
              if (!valid28) {
                const err127 = {
                  instancePath:
                    instancePath +
                    "/inspection/observed_state/" +
                    key6.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/components/schemas/OperatorInspection/properties/observed_state/additionalProperties/anyOf",
                  keyword: "anyOf",
                  params: {},
                  message: "must match a schema in anyOf",
                };
                if (vErrors === null) {
                  vErrors = [err127];
                } else {
                  vErrors.push(err127);
                }
                errors++;
              } else {
                errors = _errs120;
                if (vErrors !== null) {
                  if (_errs120) {
                    vErrors.length = _errs120;
                  } else {
                    vErrors = null;
                  }
                }
              }
            }
          } else {
            const err128 = {
              instancePath: instancePath + "/inspection/observed_state",
              schemaPath:
                "#/components/schemas/OperatorInspection/properties/observed_state/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err128];
            } else {
              vErrors.push(err128);
            }
            errors++;
          }
        }
        if (data39.resource_identifier !== undefined) {
          if (typeof data39.resource_identifier !== "string") {
            const err129 = {
              instancePath: instancePath + "/inspection/resource_identifier",
              schemaPath:
                "#/components/schemas/OperatorInspection/properties/resource_identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err129];
            } else {
              vErrors.push(err129);
            }
            errors++;
          }
        }
        if (data39.resource_type !== undefined) {
          let data45 = data39.resource_type;
          if (typeof data45 !== "string") {
            const err130 = {
              instancePath: instancePath + "/inspection/resource_type",
              schemaPath:
                "#/components/schemas/OperatorInspection/properties/resource_type/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err130];
            } else {
              vErrors.push(err130);
            }
            errors++;
          }
          if (!(
            data45 === "ISSUE" ||
            data45 === "EVENT" ||
            data45 === "OBJECTIVE" ||
            data45 === "CHANNEL"
          )) {
            const err131 = {
              instancePath: instancePath + "/inspection/resource_type",
              schemaPath:
                "#/components/schemas/OperatorInspection/properties/resource_type/enum",
              keyword: "enum",
              params: { allowedValues: schema45.properties.resource_type.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err131];
            } else {
              vErrors.push(err131);
            }
            errors++;
          }
        }
      } else {
        const err132 = {
          instancePath: instancePath + "/inspection",
          schemaPath: "#/components/schemas/OperatorInspection/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err132];
        } else {
          vErrors.push(err132);
        }
        errors++;
      }
      var _valid5 = _errs108 === errors;
      valid24 = valid24 || _valid5;
      const _errs129 = errors;
      if (data39 !== null) {
        const err133 = {
          instancePath: instancePath + "/inspection",
          schemaPath: "#/properties/inspection/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err133];
        } else {
          vErrors.push(err133);
        }
        errors++;
      }
      var _valid5 = _errs129 === errors;
      valid24 = valid24 || _valid5;
      if (!valid24) {
        const err134 = {
          instancePath: instancePath + "/inspection",
          schemaPath: "#/properties/inspection/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err134];
        } else {
          vErrors.push(err134);
        }
        errors++;
      } else {
        errors = _errs107;
        if (vErrors !== null) {
          if (_errs107) {
            vErrors.length = _errs107;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.intent !== undefined) {
      let data46 = data.intent;
      const _errs132 = errors;
      let valid29 = false;
      const _errs133 = errors;
      if (
        !validate33(data46, {
          instancePath: instancePath + "/intent",
          parentData: data,
          parentDataProperty: "intent",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate33.errors
            : vErrors.concat(validate33.errors);
        errors = vErrors.length;
      }
      var _valid7 = _errs133 === errors;
      valid29 = valid29 || _valid7;
      const _errs134 = errors;
      if (data46 !== null) {
        const err135 = {
          instancePath: instancePath + "/intent",
          schemaPath: "#/properties/intent/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err135];
        } else {
          vErrors.push(err135);
        }
        errors++;
      }
      var _valid7 = _errs134 === errors;
      valid29 = valid29 || _valid7;
      if (!valid29) {
        const err136 = {
          instancePath: instancePath + "/intent",
          schemaPath: "#/properties/intent/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err136];
        } else {
          vErrors.push(err136);
        }
        errors++;
      } else {
        errors = _errs132;
        if (vErrors !== null) {
          if (_errs132) {
            vErrors.length = _errs132;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.provenance !== undefined) {
      let data47 = data.provenance;
      if (typeof data47 !== "string") {
        const err137 = {
          instancePath: instancePath + "/provenance",
          schemaPath: "#/properties/provenance/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err137];
        } else {
          vErrors.push(err137);
        }
        errors++;
      }
      if (!(
        data47 === "CONVERSATION_ONLY" ||
        data47 === "AUTHORITATIVE_SNAPSHOT" ||
        data47 === "HYPOTHETICAL_NO_ACTION" ||
        data47 === "OPERATOR_ACTION"
      )) {
        const err138 = {
          instancePath: instancePath + "/provenance",
          schemaPath: "#/properties/provenance/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.provenance.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err138];
        } else {
          vErrors.push(err138);
        }
        errors++;
      }
    }
    if (data.request_id !== undefined) {
      if (typeof data.request_id !== "string") {
        const err139 = {
          instancePath: instancePath + "/request_id",
          schemaPath: "#/properties/request_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err139];
        } else {
          vErrors.push(err139);
        }
        errors++;
      }
    }
    if (data.revision !== undefined) {
      let data49 = data.revision;
      if (!(typeof data49 == "number" && !(data49 % 1) && !isNaN(data49))) {
        const err140 = {
          instancePath: instancePath + "/revision",
          schemaPath: "#/properties/revision/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err140];
        } else {
          vErrors.push(err140);
        }
        errors++;
      }
    }
    if (data.simulation !== undefined) {
      let data50 = data.simulation;
      const _errs143 = errors;
      let valid30 = false;
      const _errs144 = errors;
      if (
        !validate36(data50, {
          instancePath: instancePath + "/simulation",
          parentData: data,
          parentDataProperty: "simulation",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate36.errors
            : vErrors.concat(validate36.errors);
        errors = vErrors.length;
      }
      var _valid8 = _errs144 === errors;
      valid30 = valid30 || _valid8;
      const _errs145 = errors;
      if (data50 !== null) {
        const err141 = {
          instancePath: instancePath + "/simulation",
          schemaPath: "#/properties/simulation/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err141];
        } else {
          vErrors.push(err141);
        }
        errors++;
      }
      var _valid8 = _errs145 === errors;
      valid30 = valid30 || _valid8;
      if (!valid30) {
        const err142 = {
          instancePath: instancePath + "/simulation",
          schemaPath: "#/properties/simulation/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err142];
        } else {
          vErrors.push(err142);
        }
        errors++;
      } else {
        errors = _errs143;
        if (vErrors !== null) {
          if (_errs143) {
            vErrors.length = _errs143;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.snapshot_fingerprint !== undefined) {
      if (typeof data.snapshot_fingerprint !== "string") {
        const err143 = {
          instancePath: instancePath + "/snapshot_fingerprint",
          schemaPath: "#/properties/snapshot_fingerprint/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err143];
        } else {
          vErrors.push(err143);
        }
        errors++;
      }
    }
  } else {
    const err144 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err144];
    } else {
      vErrors.push(err144);
    }
    errors++;
  }
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};

function validate20(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  /*# sourceURL="operator-response" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !validate22(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
      dynamicAnchors,
    })
  ) {
    vErrors =
      vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
    errors = vErrors.length;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};

export const validateOperatorAction = validate39;
const schema51 = {
  $id: "operator-action",
  $ref: "operator-contract#/components/schemas/OperatorActionView",
};

function validate40(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate40.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.operator_action_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operator_action_id" },
        message: "must have required property '" + "operator_action_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.request_id === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "request_id" },
        message: "must have required property '" + "request_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.authenticated_subject_hash === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "authenticated_subject_hash" },
        message:
          "must have required property '" + "authenticated_subject_hash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.authority === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "authority" },
        message: "must have required property '" + "authority" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.resource_type === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "resource_type" },
        message: "must have required property '" + "resource_type" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.resource_identifier === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "resource_identifier" },
        message: "must have required property '" + "resource_identifier" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.operations === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operations" },
        message: "must have required property '" + "operations" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.authorization_result === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "authorization_result" },
        message: "must have required property '" + "authorization_result" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.lifecycle === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "lifecycle" },
        message: "must have required property '" + "lifecycle" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.created_at === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "created_at" },
        message: "must have required property '" + "created_at" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.updated_at === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updated_at" },
        message: "must have required property '" + "updated_at" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema34.properties, key0)) {
        const err11 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.adapter_proof !== undefined) {
      let data0 = data.adapter_proof;
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        for (const key1 in data0) {
          if (typeof data0[key1] !== "string") {
            const err12 = {
              instancePath:
                instancePath +
                "/adapter_proof/" +
                key1.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/adapter_proof/additionalProperties/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/adapter_proof",
          schemaPath: "#/properties/adapter_proof/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.authenticated_subject_hash !== undefined) {
      if (typeof data.authenticated_subject_hash !== "string") {
        const err14 = {
          instancePath: instancePath + "/authenticated_subject_hash",
          schemaPath: "#/properties/authenticated_subject_hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.authority !== undefined) {
      let data3 = data.authority;
      if (typeof data3 !== "string") {
        const err15 = {
          instancePath: instancePath + "/authority",
          schemaPath: "#/properties/authority/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
      if (!(
        data3 === "JIRA" ||
        data3 === "GOOGLE_CALENDAR" ||
        data3 === "REFLOW" ||
        data3 === "SLACK"
      )) {
        const err16 = {
          instancePath: instancePath + "/authority",
          schemaPath: "#/properties/authority/enum",
          keyword: "enum",
          params: { allowedValues: schema34.properties.authority.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.authorization_result !== undefined) {
      let data4 = data.authorization_result;
      if (typeof data4 !== "string") {
        const err17 = {
          instancePath: instancePath + "/authorization_result",
          schemaPath: "#/properties/authorization_result/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
      if (!(
        data4 === "AUTO_EXECUTABLE" ||
        data4 === "APPROVAL_REQUIRED" ||
        data4 === "DENIED"
      )) {
        const err18 = {
          instancePath: instancePath + "/authorization_result",
          schemaPath: "#/properties/authorization_result/enum",
          keyword: "enum",
          params: {
            allowedValues: schema34.properties.authorization_result.enum,
          },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.created_at !== undefined) {
      if (typeof data.created_at !== "string") {
        const err19 = {
          instancePath: instancePath + "/created_at",
          schemaPath: "#/properties/created_at/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.error_category !== undefined) {
      let data6 = data.error_category;
      const _errs16 = errors;
      let valid2 = false;
      const _errs17 = errors;
      if (typeof data6 !== "string") {
        const err20 = {
          instancePath: instancePath + "/error_category",
          schemaPath: "#/properties/error_category/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
      var _valid0 = _errs17 === errors;
      valid2 = valid2 || _valid0;
      const _errs19 = errors;
      if (data6 !== null) {
        const err21 = {
          instancePath: instancePath + "/error_category",
          schemaPath: "#/properties/error_category/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
      var _valid0 = _errs19 === errors;
      valid2 = valid2 || _valid0;
      if (!valid2) {
        const err22 = {
          instancePath: instancePath + "/error_category",
          schemaPath: "#/properties/error_category/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      } else {
        errors = _errs16;
        if (vErrors !== null) {
          if (_errs16) {
            vErrors.length = _errs16;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.execution_acknowledgement !== undefined) {
      let data7 = data.execution_acknowledgement;
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
        for (const key2 in data7) {
          if (typeof data7[key2] !== "string") {
            const err23 = {
              instancePath:
                instancePath +
                "/execution_acknowledgement/" +
                key2.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/execution_acknowledgement/additionalProperties/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/execution_acknowledgement",
          schemaPath: "#/properties/execution_acknowledgement/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.expected_state !== undefined) {
      let data9 = data.expected_state;
      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
        for (const key3 in data9) {
          let data10 = data9[key3];
          const _errs30 = errors;
          let valid5 = false;
          const _errs31 = errors;
          if (typeof data10 !== "string") {
            const err25 = {
              instancePath:
                instancePath +
                "/expected_state/" +
                key3.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/expected_state/additionalProperties/anyOf/0/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
          var _valid1 = _errs31 === errors;
          valid5 = valid5 || _valid1;
          const _errs33 = errors;
          if (data10 !== null) {
            const err26 = {
              instancePath:
                instancePath +
                "/expected_state/" +
                key3.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/expected_state/additionalProperties/anyOf/1/type",
              keyword: "type",
              params: { type: "null" },
              message: "must be null",
            };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
          var _valid1 = _errs33 === errors;
          valid5 = valid5 || _valid1;
          if (!valid5) {
            const err27 = {
              instancePath:
                instancePath +
                "/expected_state/" +
                key3.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/expected_state/additionalProperties/anyOf",
              keyword: "anyOf",
              params: {},
              message: "must match a schema in anyOf",
            };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          } else {
            errors = _errs30;
            if (vErrors !== null) {
              if (_errs30) {
                vErrors.length = _errs30;
              } else {
                vErrors = null;
              }
            }
          }
        }
      } else {
        const err28 = {
          instancePath: instancePath + "/expected_state",
          schemaPath: "#/properties/expected_state/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.external_effects_possible !== undefined) {
      if (typeof data.external_effects_possible !== "boolean") {
        const err29 = {
          instancePath: instancePath + "/external_effects_possible",
          schemaPath: "#/properties/external_effects_possible/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.lifecycle !== undefined) {
      let data12 = data.lifecycle;
      if (typeof data12 !== "string") {
        const err30 = {
          instancePath: instancePath + "/lifecycle",
          schemaPath: "#/properties/lifecycle/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
      if (!(
        data12 === "REQUESTED" ||
        data12 === "AUTHORIZED" ||
        data12 === "APPROVAL_REQUIRED" ||
        data12 === "APPROVED" ||
        data12 === "EXECUTING" ||
        data12 === "EXECUTED" ||
        data12 === "READ_BACK" ||
        data12 === "VERIFIED" ||
        data12 === "VERIFICATION_FAILED" ||
        data12 === "DENIED" ||
        data12 === "FAILED"
      )) {
        const err31 = {
          instancePath: instancePath + "/lifecycle",
          schemaPath: "#/properties/lifecycle/enum",
          keyword: "enum",
          params: { allowedValues: schema34.properties.lifecycle.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
    if (data.observed_state !== undefined) {
      let data13 = data.observed_state;
      if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
        for (const key4 in data13) {
          let data14 = data13[key4];
          const _errs43 = errors;
          let valid7 = false;
          const _errs44 = errors;
          if (typeof data14 !== "string") {
            const err32 = {
              instancePath:
                instancePath +
                "/observed_state/" +
                key4.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/observed_state/additionalProperties/anyOf/0/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
          var _valid2 = _errs44 === errors;
          valid7 = valid7 || _valid2;
          const _errs46 = errors;
          if (data14 !== null) {
            const err33 = {
              instancePath:
                instancePath +
                "/observed_state/" +
                key4.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/observed_state/additionalProperties/anyOf/1/type",
              keyword: "type",
              params: { type: "null" },
              message: "must be null",
            };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
          var _valid2 = _errs46 === errors;
          valid7 = valid7 || _valid2;
          if (!valid7) {
            const err34 = {
              instancePath:
                instancePath +
                "/observed_state/" +
                key4.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath:
                "#/properties/observed_state/additionalProperties/anyOf",
              keyword: "anyOf",
              params: {},
              message: "must match a schema in anyOf",
            };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          } else {
            errors = _errs43;
            if (vErrors !== null) {
              if (_errs43) {
                vErrors.length = _errs43;
              } else {
                vErrors = null;
              }
            }
          }
        }
      } else {
        const err35 = {
          instancePath: instancePath + "/observed_state",
          schemaPath: "#/properties/observed_state/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
    if (data.operations !== undefined) {
      let data15 = data.operations;
      if (Array.isArray(data15)) {
        const len0 = data15.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate24(data15[i0], {
              instancePath: instancePath + "/operations/" + i0,
              parentData: data15,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate24.errors
                : vErrors.concat(validate24.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err36 = {
          instancePath: instancePath + "/operations",
          schemaPath: "#/properties/operations/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.operator_action_id !== undefined) {
      if (typeof data.operator_action_id !== "string") {
        const err37 = {
          instancePath: instancePath + "/operator_action_id",
          schemaPath: "#/properties/operator_action_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.request_fingerprint !== undefined) {
      let data18 = data.request_fingerprint;
      const _errs54 = errors;
      let valid10 = false;
      const _errs55 = errors;
      if (typeof data18 !== "string") {
        const err38 = {
          instancePath: instancePath + "/request_fingerprint",
          schemaPath: "#/properties/request_fingerprint/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
      var _valid3 = _errs55 === errors;
      valid10 = valid10 || _valid3;
      const _errs57 = errors;
      if (data18 !== null) {
        const err39 = {
          instancePath: instancePath + "/request_fingerprint",
          schemaPath: "#/properties/request_fingerprint/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
      var _valid3 = _errs57 === errors;
      valid10 = valid10 || _valid3;
      if (!valid10) {
        const err40 = {
          instancePath: instancePath + "/request_fingerprint",
          schemaPath: "#/properties/request_fingerprint/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      } else {
        errors = _errs54;
        if (vErrors !== null) {
          if (_errs54) {
            vErrors.length = _errs54;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.request_id !== undefined) {
      if (typeof data.request_id !== "string") {
        const err41 = {
          instancePath: instancePath + "/request_id",
          schemaPath: "#/properties/request_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
    }
    if (data.resource_identifier !== undefined) {
      if (typeof data.resource_identifier !== "string") {
        const err42 = {
          instancePath: instancePath + "/resource_identifier",
          schemaPath: "#/properties/resource_identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
    }
    if (data.resource_type !== undefined) {
      let data21 = data.resource_type;
      if (typeof data21 !== "string") {
        const err43 = {
          instancePath: instancePath + "/resource_type",
          schemaPath: "#/properties/resource_type/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
      if (!(
        data21 === "ISSUE" ||
        data21 === "EVENT" ||
        data21 === "OBJECTIVE" ||
        data21 === "CHANNEL"
      )) {
        const err44 = {
          instancePath: instancePath + "/resource_type",
          schemaPath: "#/properties/resource_type/enum",
          keyword: "enum",
          params: { allowedValues: schema34.properties.resource_type.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err44];
        } else {
          vErrors.push(err44);
        }
        errors++;
      }
    }
    if (data.updated_at !== undefined) {
      if (typeof data.updated_at !== "string") {
        const err45 = {
          instancePath: instancePath + "/updated_at",
          schemaPath: "#/properties/updated_at/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err45];
        } else {
          vErrors.push(err45);
        }
        errors++;
      }
    }
    if (data.verification_result !== undefined) {
      let data23 = data.verification_result;
      if (typeof data23 !== "string") {
        const err46 = {
          instancePath: instancePath + "/verification_result",
          schemaPath: "#/properties/verification_result/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err46];
        } else {
          vErrors.push(err46);
        }
        errors++;
      }
      if (!(
        data23 === "NOT_RUN" ||
        data23 === "PASSED" ||
        data23 === "FAILED"
      )) {
        const err47 = {
          instancePath: instancePath + "/verification_result",
          schemaPath: "#/properties/verification_result/enum",
          keyword: "enum",
          params: {
            allowedValues: schema34.properties.verification_result.enum,
          },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err47];
        } else {
          vErrors.push(err47);
        }
        errors++;
      }
    }
  } else {
    const err48 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err48];
    } else {
      vErrors.push(err48);
    }
    errors++;
  }
  validate40.errors = vErrors;
  return errors === 0;
}
validate40.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};

function validate39(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  /*# sourceURL="operator-action" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate39.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !validate40(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
      dynamicAnchors,
    })
  ) {
    vErrors =
      vErrors === null ? validate40.errors : vErrors.concat(validate40.errors);
    errors = vErrors.length;
  }
  validate39.errors = vErrors;
  return errors === 0;
}
validate39.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
