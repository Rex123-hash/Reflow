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
    agents: {
      items: { $ref: "#/components/schemas/OperatorAgentTrace" },
      maxItems: 2,
      minItems: 1,
      title: "Agents",
      type: "array",
    },
    answer: { maxLength: 8000, minLength: 1, title: "Answer", type: "string" },
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
      const: false,
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
    hypothetical_deadline: {
      anyOf: [{ type: "string" }, { type: "null" }],
      default: null,
      title: "Hypothetical Deadline",
    },
    incident_id: { title: "Incident Id", type: "string" },
    intent: { $ref: "#/components/schemas/OperatorIntent" },
    provenance: {
      enum: ["AUTHORITATIVE_SNAPSHOT", "HYPOTHETICAL_NO_ACTION"],
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
    "intent",
    "answer",
    "facts",
    "evidence",
    "provenance",
    "agents",
  ],
  title: "OperatorResponse",
  type: "object",
};
const schema34 = {
  additionalProperties: false,
  properties: {
    agent_id: {
      enum: ["operator_intent_interpreter", "simulation_agent"],
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
const schema35 = {
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
const schema36 = {
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
const func1 = Object.prototype.hasOwnProperty;
import func3 from "ajv/dist/runtime/ucs2length.js";
const schema37 = {
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
        { enum: ["INSPECT", "EXPLAIN", "SIMULATE"], type: "string" },
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
    subject: {
      enum: ["OBJECTIVE", "RECOVERY", "CALENDAR", "EVIDENCE", "CHRONOLOGY"],
      title: "Subject",
      type: "string",
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
const schema38 = {
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
      if (!func1.call(schema37.properties, key0)) {
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
        if (func3(data0) > 800) {
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
        if (func3(data0) < 1) {
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
            if (func3(data2) > 800) {
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
            if (func3(data2) < 1) {
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
          params: { allowedValues: schema37.properties.disposition.enum },
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
            if (func3(data5) > 200) {
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
            if (func3(data5) < 1) {
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
                  params: { allowedValues: schema38.properties.kind.enum },
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
                if (func3(data9) > 800) {
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
                if (func3(data9) < 1) {
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
                if (func3(data10) > 800) {
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
                if (func3(data10) < 1) {
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
        data12 === "SIMULATE"
      )) {
        const err42 = {
          instancePath: instancePath + "/intent_type",
          schemaPath: "#/properties/intent_type/anyOf/0/enum",
          keyword: "enum",
          params: {
            allowedValues: schema37.properties.intent_type.anyOf[0].enum,
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
        if (func3(data13) > 800) {
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
        if (func3(data13) < 1) {
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
    if (data.subject !== undefined) {
      let data15 = data.subject;
      if (typeof data15 !== "string") {
        const err51 = {
          instancePath: instancePath + "/subject",
          schemaPath: "#/properties/subject/type",
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
        data15 === "OBJECTIVE" ||
        data15 === "RECOVERY" ||
        data15 === "CALENDAR" ||
        data15 === "EVIDENCE" ||
        data15 === "CHRONOLOGY"
      )) {
        const err52 = {
          instancePath: instancePath + "/subject",
          schemaPath: "#/properties/subject/enum",
          keyword: "enum",
          params: { allowedValues: schema37.properties.subject.enum },
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
  } else {
    const err53 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err53];
    } else {
      vErrors.push(err53);
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

const schema39 = {
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
const schema40 = {
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
      if (!func1.call(schema39.properties, key0)) {
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
            if (func3(data1) > 800) {
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
            if (func3(data1) < 1) {
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
                if (func3(data4) > 800) {
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
                if (func3(data4) < 1) {
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
                    if (func3(data6) > 800) {
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
                    if (func3(data6) < 1) {
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
                if (func3(data7) > 800) {
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
                if (func3(data7) < 1) {
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
                    if (func3(data9) > 800) {
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
                    if (func3(data9) < 1) {
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
            if (func3(data11) > 200) {
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
            if (func3(data11) < 1) {
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
            allowedValues: schema39.properties.likely_objective_outcome.enum,
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
            if (func3(data16) > 800) {
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
            if (func3(data16) < 1) {
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
        if (func3(data17) > 800) {
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
        if (func3(data17) < 1) {
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
            if (func3(data19) > 800) {
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
            if (func3(data19) < 1) {
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
            if (func3(data21) > 800) {
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
            if (func3(data21) < 1) {
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
  validate25.errors = vErrors;
  return errors === 0;
}
validate25.evaluated = {
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
    if (data.intent === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "intent" },
        message: "must have required property '" + "intent" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.answer === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "answer" },
        message: "must have required property '" + "answer" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.facts === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "facts" },
        message: "must have required property '" + "facts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.evidence === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "evidence" },
        message: "must have required property '" + "evidence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.provenance === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provenance" },
        message: "must have required property '" + "provenance" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.agents === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "agents" },
        message: "must have required property '" + "agents" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema33.properties, key0)) {
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
    if (data.agents !== undefined) {
      let data0 = data.agents;
      if (Array.isArray(data0)) {
        if (data0.length > 2) {
          const err13 = {
            instancePath: instancePath + "/agents",
            schemaPath: "#/properties/agents/maxItems",
            keyword: "maxItems",
            params: { limit: 2 },
            message: "must NOT have more than 2 items",
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (data0.length < 1) {
          const err14 = {
            instancePath: instancePath + "/agents",
            schemaPath: "#/properties/agents/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        const len0 = data0.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data1 = data0[i0];
          if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
            if (data1.agent_id === undefined) {
              const err15 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "agent_id" },
                message: "must have required property '" + "agent_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err15];
              } else {
                vErrors.push(err15);
              }
              errors++;
            }
            if (data1.model === undefined) {
              const err16 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "model" },
                message: "must have required property '" + "model" + "'",
              };
              if (vErrors === null) {
                vErrors = [err16];
              } else {
                vErrors.push(err16);
              }
              errors++;
            }
            if (data1.request_id === undefined) {
              const err17 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "request_id" },
                message: "must have required property '" + "request_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors++;
            }
            if (data1.latency_ms === undefined) {
              const err18 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "latency_ms" },
                message: "must have required property '" + "latency_ms" + "'",
              };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
            if (data1.attempts === undefined) {
              const err19 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "attempts" },
                message: "must have required property '" + "attempts" + "'",
              };
              if (vErrors === null) {
                vErrors = [err19];
              } else {
                vErrors.push(err19);
              }
              errors++;
            }
            if (data1.input_tokens === undefined) {
              const err20 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "input_tokens" },
                message: "must have required property '" + "input_tokens" + "'",
              };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
            if (data1.output_tokens === undefined) {
              const err21 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "output_tokens" },
                message:
                  "must have required property '" + "output_tokens" + "'",
              };
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
            }
            if (data1.total_tokens === undefined) {
              const err22 = {
                instancePath: instancePath + "/agents/" + i0,
                schemaPath: "#/components/schemas/OperatorAgentTrace/required",
                keyword: "required",
                params: { missingProperty: "total_tokens" },
                message: "must have required property '" + "total_tokens" + "'",
              };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
            for (const key1 in data1) {
              if (!func1.call(schema34.properties, key1)) {
                const err23 = {
                  instancePath: instancePath + "/agents/" + i0,
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/additionalProperties",
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
            if (data1.agent_id !== undefined) {
              let data2 = data1.agent_id;
              if (typeof data2 !== "string") {
                const err24 = {
                  instancePath: instancePath + "/agents/" + i0 + "/agent_id",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/agent_id/type",
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
              if (!(
                data2 === "operator_intent_interpreter" ||
                data2 === "simulation_agent"
              )) {
                const err25 = {
                  instancePath: instancePath + "/agents/" + i0 + "/agent_id",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/agent_id/enum",
                  keyword: "enum",
                  params: { allowedValues: schema34.properties.agent_id.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err25];
                } else {
                  vErrors.push(err25);
                }
                errors++;
              }
            }
            if (data1.attempts !== undefined) {
              let data3 = data1.attempts;
              if (!(
                typeof data3 == "number" &&
                !(data3 % 1) &&
                !isNaN(data3)
              )) {
                const err26 = {
                  instancePath: instancePath + "/agents/" + i0 + "/attempts",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/attempts/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err26];
                } else {
                  vErrors.push(err26);
                }
                errors++;
              }
            }
            if (data1.input_tokens !== undefined) {
              let data4 = data1.input_tokens;
              if (!(
                typeof data4 == "number" &&
                !(data4 % 1) &&
                !isNaN(data4)
              )) {
                const err27 = {
                  instancePath:
                    instancePath + "/agents/" + i0 + "/input_tokens",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/input_tokens/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err27];
                } else {
                  vErrors.push(err27);
                }
                errors++;
              }
            }
            if (data1.latency_ms !== undefined) {
              let data5 = data1.latency_ms;
              if (!(
                typeof data5 == "number" &&
                !(data5 % 1) &&
                !isNaN(data5)
              )) {
                const err28 = {
                  instancePath: instancePath + "/agents/" + i0 + "/latency_ms",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/latency_ms/type",
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
            if (data1.model !== undefined) {
              if (typeof data1.model !== "string") {
                const err29 = {
                  instancePath: instancePath + "/agents/" + i0 + "/model",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/model/type",
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
            }
            if (data1.output_tokens !== undefined) {
              let data7 = data1.output_tokens;
              if (!(
                typeof data7 == "number" &&
                !(data7 % 1) &&
                !isNaN(data7)
              )) {
                const err30 = {
                  instancePath:
                    instancePath + "/agents/" + i0 + "/output_tokens",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/output_tokens/type",
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
            if (data1.request_id !== undefined) {
              if (typeof data1.request_id !== "string") {
                const err31 = {
                  instancePath: instancePath + "/agents/" + i0 + "/request_id",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/request_id/type",
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
            if (data1.total_tokens !== undefined) {
              let data9 = data1.total_tokens;
              if (!(
                typeof data9 == "number" &&
                !(data9 % 1) &&
                !isNaN(data9)
              )) {
                const err32 = {
                  instancePath:
                    instancePath + "/agents/" + i0 + "/total_tokens",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/total_tokens/type",
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
            if (data1.validation !== undefined) {
              let data10 = data1.validation;
              if (typeof data10 !== "string") {
                const err33 = {
                  instancePath: instancePath + "/agents/" + i0 + "/validation",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/validation/type",
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
              if ("PASSED" !== data10) {
                const err34 = {
                  instancePath: instancePath + "/agents/" + i0 + "/validation",
                  schemaPath:
                    "#/components/schemas/OperatorAgentTrace/properties/validation/const",
                  keyword: "const",
                  params: { allowedValue: "PASSED" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err34];
                } else {
                  vErrors.push(err34);
                }
                errors++;
              }
            }
          } else {
            const err35 = {
              instancePath: instancePath + "/agents/" + i0,
              schemaPath: "#/components/schemas/OperatorAgentTrace/type",
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
      } else {
        const err36 = {
          instancePath: instancePath + "/agents",
          schemaPath: "#/properties/agents/type",
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
    if (data.answer !== undefined) {
      let data11 = data.answer;
      if (typeof data11 === "string") {
        if (func3(data11) > 8000) {
          const err37 = {
            instancePath: instancePath + "/answer",
            schemaPath: "#/properties/answer/maxLength",
            keyword: "maxLength",
            params: { limit: 8000 },
            message: "must NOT have more than 8000 characters",
          };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
        if (func3(data11) < 1) {
          const err38 = {
            instancePath: instancePath + "/answer",
            schemaPath: "#/properties/answer/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
      } else {
        const err39 = {
          instancePath: instancePath + "/answer",
          schemaPath: "#/properties/answer/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
    }
    if (data.disposition !== undefined) {
      let data12 = data.disposition;
      if (typeof data12 !== "string") {
        const err40 = {
          instancePath: instancePath + "/disposition",
          schemaPath: "#/properties/disposition/type",
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
      if (!(
        data12 === "SUPPORTED" ||
        data12 === "CLARIFICATION_REQUIRED" ||
        data12 === "UNSUPPORTED"
      )) {
        const err41 = {
          instancePath: instancePath + "/disposition",
          schemaPath: "#/properties/disposition/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.disposition.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
    }
    if (data.evidence !== undefined) {
      let data13 = data.evidence;
      if (Array.isArray(data13)) {
        if (data13.length > 40) {
          const err42 = {
            instancePath: instancePath + "/evidence",
            schemaPath: "#/properties/evidence/maxItems",
            keyword: "maxItems",
            params: { limit: 40 },
            message: "must NOT have more than 40 items",
          };
          if (vErrors === null) {
            vErrors = [err42];
          } else {
            vErrors.push(err42);
          }
          errors++;
        }
        const len1 = data13.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data14 = data13[i1];
          if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
            if (data14.evidence_id === undefined) {
              const err43 = {
                instancePath: instancePath + "/evidence/" + i1,
                schemaPath: "#/components/schemas/OperatorEvidence/required",
                keyword: "required",
                params: { missingProperty: "evidence_id" },
                message: "must have required property '" + "evidence_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err43];
              } else {
                vErrors.push(err43);
              }
              errors++;
            }
            if (data14.title === undefined) {
              const err44 = {
                instancePath: instancePath + "/evidence/" + i1,
                schemaPath: "#/components/schemas/OperatorEvidence/required",
                keyword: "required",
                params: { missingProperty: "title" },
                message: "must have required property '" + "title" + "'",
              };
              if (vErrors === null) {
                vErrors = [err44];
              } else {
                vErrors.push(err44);
              }
              errors++;
            }
            if (data14.observed_at === undefined) {
              const err45 = {
                instancePath: instancePath + "/evidence/" + i1,
                schemaPath: "#/components/schemas/OperatorEvidence/required",
                keyword: "required",
                params: { missingProperty: "observed_at" },
                message: "must have required property '" + "observed_at" + "'",
              };
              if (vErrors === null) {
                vErrors = [err45];
              } else {
                vErrors.push(err45);
              }
              errors++;
            }
            for (const key2 in data14) {
              if (!(
                key2 === "evidence_id" ||
                key2 === "observed_at" ||
                key2 === "title"
              )) {
                const err46 = {
                  instancePath: instancePath + "/evidence/" + i1,
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key2 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err46];
                } else {
                  vErrors.push(err46);
                }
                errors++;
              }
            }
            if (data14.evidence_id !== undefined) {
              let data15 = data14.evidence_id;
              if (typeof data15 === "string") {
                if (func3(data15) > 200) {
                  const err47 = {
                    instancePath:
                      instancePath + "/evidence/" + i1 + "/evidence_id",
                    schemaPath:
                      "#/components/schemas/OperatorEvidence/properties/evidence_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 200 },
                    message: "must NOT have more than 200 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err47];
                  } else {
                    vErrors.push(err47);
                  }
                  errors++;
                }
                if (func3(data15) < 1) {
                  const err48 = {
                    instancePath:
                      instancePath + "/evidence/" + i1 + "/evidence_id",
                    schemaPath:
                      "#/components/schemas/OperatorEvidence/properties/evidence_id/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err48];
                  } else {
                    vErrors.push(err48);
                  }
                  errors++;
                }
              } else {
                const err49 = {
                  instancePath:
                    instancePath + "/evidence/" + i1 + "/evidence_id",
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/properties/evidence_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err49];
                } else {
                  vErrors.push(err49);
                }
                errors++;
              }
            }
            if (data14.observed_at !== undefined) {
              let data16 = data14.observed_at;
              const _errs39 = errors;
              let valid9 = false;
              const _errs40 = errors;
              if (typeof data16 !== "string") {
                const err50 = {
                  instancePath:
                    instancePath + "/evidence/" + i1 + "/observed_at",
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/properties/observed_at/anyOf/0/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err50];
                } else {
                  vErrors.push(err50);
                }
                errors++;
              }
              var _valid0 = _errs40 === errors;
              valid9 = valid9 || _valid0;
              const _errs42 = errors;
              if (data16 !== null) {
                const err51 = {
                  instancePath:
                    instancePath + "/evidence/" + i1 + "/observed_at",
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/properties/observed_at/anyOf/1/type",
                  keyword: "type",
                  params: { type: "null" },
                  message: "must be null",
                };
                if (vErrors === null) {
                  vErrors = [err51];
                } else {
                  vErrors.push(err51);
                }
                errors++;
              }
              var _valid0 = _errs42 === errors;
              valid9 = valid9 || _valid0;
              if (!valid9) {
                const err52 = {
                  instancePath:
                    instancePath + "/evidence/" + i1 + "/observed_at",
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/properties/observed_at/anyOf",
                  keyword: "anyOf",
                  params: {},
                  message: "must match a schema in anyOf",
                };
                if (vErrors === null) {
                  vErrors = [err52];
                } else {
                  vErrors.push(err52);
                }
                errors++;
              } else {
                errors = _errs39;
                if (vErrors !== null) {
                  if (_errs39) {
                    vErrors.length = _errs39;
                  } else {
                    vErrors = null;
                  }
                }
              }
            }
            if (data14.title !== undefined) {
              let data17 = data14.title;
              if (typeof data17 === "string") {
                if (func3(data17) > 800) {
                  const err53 = {
                    instancePath: instancePath + "/evidence/" + i1 + "/title",
                    schemaPath:
                      "#/components/schemas/OperatorEvidence/properties/title/maxLength",
                    keyword: "maxLength",
                    params: { limit: 800 },
                    message: "must NOT have more than 800 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err53];
                  } else {
                    vErrors.push(err53);
                  }
                  errors++;
                }
                if (func3(data17) < 1) {
                  const err54 = {
                    instancePath: instancePath + "/evidence/" + i1 + "/title",
                    schemaPath:
                      "#/components/schemas/OperatorEvidence/properties/title/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err54];
                  } else {
                    vErrors.push(err54);
                  }
                  errors++;
                }
              } else {
                const err55 = {
                  instancePath: instancePath + "/evidence/" + i1 + "/title",
                  schemaPath:
                    "#/components/schemas/OperatorEvidence/properties/title/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err55];
                } else {
                  vErrors.push(err55);
                }
                errors++;
              }
            }
          } else {
            const err56 = {
              instancePath: instancePath + "/evidence/" + i1,
              schemaPath: "#/components/schemas/OperatorEvidence/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err56];
            } else {
              vErrors.push(err56);
            }
            errors++;
          }
        }
      } else {
        const err57 = {
          instancePath: instancePath + "/evidence",
          schemaPath: "#/properties/evidence/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err57];
        } else {
          vErrors.push(err57);
        }
        errors++;
      }
    }
    if (data.external_effects_executed !== undefined) {
      let data18 = data.external_effects_executed;
      if (typeof data18 !== "boolean") {
        const err58 = {
          instancePath: instancePath + "/external_effects_executed",
          schemaPath: "#/properties/external_effects_executed/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err58];
        } else {
          vErrors.push(err58);
        }
        errors++;
      }
      if (false !== data18) {
        const err59 = {
          instancePath: instancePath + "/external_effects_executed",
          schemaPath: "#/properties/external_effects_executed/const",
          keyword: "const",
          params: { allowedValue: false },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err59];
        } else {
          vErrors.push(err59);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data19 = data.facts;
      if (Array.isArray(data19)) {
        if (data19.length > 12) {
          const err60 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/properties/facts/maxItems",
            keyword: "maxItems",
            params: { limit: 12 },
            message: "must NOT have more than 12 items",
          };
          if (vErrors === null) {
            vErrors = [err60];
          } else {
            vErrors.push(err60);
          }
          errors++;
        }
        const len2 = data19.length;
        for (let i2 = 0; i2 < len2; i2++) {
          let data20 = data19[i2];
          if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
            if (data20.fact_id === undefined) {
              const err61 = {
                instancePath: instancePath + "/facts/" + i2,
                schemaPath: "#/components/schemas/OperatorFact/required",
                keyword: "required",
                params: { missingProperty: "fact_id" },
                message: "must have required property '" + "fact_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err61];
              } else {
                vErrors.push(err61);
              }
              errors++;
            }
            if (data20.text === undefined) {
              const err62 = {
                instancePath: instancePath + "/facts/" + i2,
                schemaPath: "#/components/schemas/OperatorFact/required",
                keyword: "required",
                params: { missingProperty: "text" },
                message: "must have required property '" + "text" + "'",
              };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
            if (data20.evidence_ids === undefined) {
              const err63 = {
                instancePath: instancePath + "/facts/" + i2,
                schemaPath: "#/components/schemas/OperatorFact/required",
                keyword: "required",
                params: { missingProperty: "evidence_ids" },
                message: "must have required property '" + "evidence_ids" + "'",
              };
              if (vErrors === null) {
                vErrors = [err63];
              } else {
                vErrors.push(err63);
              }
              errors++;
            }
            for (const key3 in data20) {
              if (!(
                key3 === "evidence_ids" ||
                key3 === "fact_id" ||
                key3 === "text"
              )) {
                const err64 = {
                  instancePath: instancePath + "/facts/" + i2,
                  schemaPath:
                    "#/components/schemas/OperatorFact/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key3 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err64];
                } else {
                  vErrors.push(err64);
                }
                errors++;
              }
            }
            if (data20.evidence_ids !== undefined) {
              let data21 = data20.evidence_ids;
              if (Array.isArray(data21)) {
                if (data21.length > 8) {
                  const err65 = {
                    instancePath:
                      instancePath + "/facts/" + i2 + "/evidence_ids",
                    schemaPath:
                      "#/components/schemas/OperatorFact/properties/evidence_ids/maxItems",
                    keyword: "maxItems",
                    params: { limit: 8 },
                    message: "must NOT have more than 8 items",
                  };
                  if (vErrors === null) {
                    vErrors = [err65];
                  } else {
                    vErrors.push(err65);
                  }
                  errors++;
                }
                const len3 = data21.length;
                for (let i3 = 0; i3 < len3; i3++) {
                  let data22 = data21[i3];
                  if (typeof data22 === "string") {
                    if (func3(data22) > 200) {
                      const err66 = {
                        instancePath:
                          instancePath + "/facts/" + i2 + "/evidence_ids/" + i3,
                        schemaPath:
                          "#/components/schemas/OperatorFact/properties/evidence_ids/items/maxLength",
                        keyword: "maxLength",
                        params: { limit: 200 },
                        message: "must NOT have more than 200 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err66];
                      } else {
                        vErrors.push(err66);
                      }
                      errors++;
                    }
                    if (func3(data22) < 1) {
                      const err67 = {
                        instancePath:
                          instancePath + "/facts/" + i2 + "/evidence_ids/" + i3,
                        schemaPath:
                          "#/components/schemas/OperatorFact/properties/evidence_ids/items/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err67];
                      } else {
                        vErrors.push(err67);
                      }
                      errors++;
                    }
                  } else {
                    const err68 = {
                      instancePath:
                        instancePath + "/facts/" + i2 + "/evidence_ids/" + i3,
                      schemaPath:
                        "#/components/schemas/OperatorFact/properties/evidence_ids/items/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err68];
                    } else {
                      vErrors.push(err68);
                    }
                    errors++;
                  }
                }
              } else {
                const err69 = {
                  instancePath: instancePath + "/facts/" + i2 + "/evidence_ids",
                  schemaPath:
                    "#/components/schemas/OperatorFact/properties/evidence_ids/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                };
                if (vErrors === null) {
                  vErrors = [err69];
                } else {
                  vErrors.push(err69);
                }
                errors++;
              }
            }
            if (data20.fact_id !== undefined) {
              let data23 = data20.fact_id;
              if (typeof data23 === "string") {
                if (func3(data23) > 200) {
                  const err70 = {
                    instancePath: instancePath + "/facts/" + i2 + "/fact_id",
                    schemaPath:
                      "#/components/schemas/OperatorFact/properties/fact_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 200 },
                    message: "must NOT have more than 200 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err70];
                  } else {
                    vErrors.push(err70);
                  }
                  errors++;
                }
                if (func3(data23) < 1) {
                  const err71 = {
                    instancePath: instancePath + "/facts/" + i2 + "/fact_id",
                    schemaPath:
                      "#/components/schemas/OperatorFact/properties/fact_id/minLength",
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
                  instancePath: instancePath + "/facts/" + i2 + "/fact_id",
                  schemaPath:
                    "#/components/schemas/OperatorFact/properties/fact_id/type",
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
            if (data20.text !== undefined) {
              let data24 = data20.text;
              if (typeof data24 === "string") {
                if (func3(data24) > 800) {
                  const err73 = {
                    instancePath: instancePath + "/facts/" + i2 + "/text",
                    schemaPath:
                      "#/components/schemas/OperatorFact/properties/text/maxLength",
                    keyword: "maxLength",
                    params: { limit: 800 },
                    message: "must NOT have more than 800 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err73];
                  } else {
                    vErrors.push(err73);
                  }
                  errors++;
                }
                if (func3(data24) < 1) {
                  const err74 = {
                    instancePath: instancePath + "/facts/" + i2 + "/text",
                    schemaPath:
                      "#/components/schemas/OperatorFact/properties/text/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err74];
                  } else {
                    vErrors.push(err74);
                  }
                  errors++;
                }
              } else {
                const err75 = {
                  instancePath: instancePath + "/facts/" + i2 + "/text",
                  schemaPath:
                    "#/components/schemas/OperatorFact/properties/text/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err75];
                } else {
                  vErrors.push(err75);
                }
                errors++;
              }
            }
          } else {
            const err76 = {
              instancePath: instancePath + "/facts/" + i2,
              schemaPath: "#/components/schemas/OperatorFact/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
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
          instancePath: instancePath + "/facts",
          schemaPath: "#/properties/facts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err77];
        } else {
          vErrors.push(err77);
        }
        errors++;
      }
    }
    if (data.generated_at !== undefined) {
      if (typeof data.generated_at !== "string") {
        const err78 = {
          instancePath: instancePath + "/generated_at",
          schemaPath: "#/properties/generated_at/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err78];
        } else {
          vErrors.push(err78);
        }
        errors++;
      }
    }
    if (data.hypothetical_deadline !== undefined) {
      let data26 = data.hypothetical_deadline;
      const _errs65 = errors;
      let valid16 = false;
      const _errs66 = errors;
      if (typeof data26 !== "string") {
        const err79 = {
          instancePath: instancePath + "/hypothetical_deadline",
          schemaPath: "#/properties/hypothetical_deadline/anyOf/0/type",
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
      var _valid1 = _errs66 === errors;
      valid16 = valid16 || _valid1;
      const _errs68 = errors;
      if (data26 !== null) {
        const err80 = {
          instancePath: instancePath + "/hypothetical_deadline",
          schemaPath: "#/properties/hypothetical_deadline/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err80];
        } else {
          vErrors.push(err80);
        }
        errors++;
      }
      var _valid1 = _errs68 === errors;
      valid16 = valid16 || _valid1;
      if (!valid16) {
        const err81 = {
          instancePath: instancePath + "/hypothetical_deadline",
          schemaPath: "#/properties/hypothetical_deadline/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err81];
        } else {
          vErrors.push(err81);
        }
        errors++;
      } else {
        errors = _errs65;
        if (vErrors !== null) {
          if (_errs65) {
            vErrors.length = _errs65;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.incident_id !== undefined) {
      if (typeof data.incident_id !== "string") {
        const err82 = {
          instancePath: instancePath + "/incident_id",
          schemaPath: "#/properties/incident_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err82];
        } else {
          vErrors.push(err82);
        }
        errors++;
      }
    }
    if (data.intent !== undefined) {
      if (
        !validate23(data.intent, {
          instancePath: instancePath + "/intent",
          parentData: data,
          parentDataProperty: "intent",
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
    }
    if (data.provenance !== undefined) {
      let data29 = data.provenance;
      if (typeof data29 !== "string") {
        const err83 = {
          instancePath: instancePath + "/provenance",
          schemaPath: "#/properties/provenance/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err83];
        } else {
          vErrors.push(err83);
        }
        errors++;
      }
      if (!(
        data29 === "AUTHORITATIVE_SNAPSHOT" ||
        data29 === "HYPOTHETICAL_NO_ACTION"
      )) {
        const err84 = {
          instancePath: instancePath + "/provenance",
          schemaPath: "#/properties/provenance/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.provenance.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err84];
        } else {
          vErrors.push(err84);
        }
        errors++;
      }
    }
    if (data.request_id !== undefined) {
      if (typeof data.request_id !== "string") {
        const err85 = {
          instancePath: instancePath + "/request_id",
          schemaPath: "#/properties/request_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err85];
        } else {
          vErrors.push(err85);
        }
        errors++;
      }
    }
    if (data.revision !== undefined) {
      let data31 = data.revision;
      if (!(typeof data31 == "number" && !(data31 % 1) && !isNaN(data31))) {
        const err86 = {
          instancePath: instancePath + "/revision",
          schemaPath: "#/properties/revision/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err86];
        } else {
          vErrors.push(err86);
        }
        errors++;
      }
    }
    if (data.simulation !== undefined) {
      let data32 = data.simulation;
      const _errs80 = errors;
      let valid17 = false;
      const _errs81 = errors;
      if (
        !validate25(data32, {
          instancePath: instancePath + "/simulation",
          parentData: data,
          parentDataProperty: "simulation",
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
      var _valid2 = _errs81 === errors;
      valid17 = valid17 || _valid2;
      const _errs82 = errors;
      if (data32 !== null) {
        const err87 = {
          instancePath: instancePath + "/simulation",
          schemaPath: "#/properties/simulation/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err87];
        } else {
          vErrors.push(err87);
        }
        errors++;
      }
      var _valid2 = _errs82 === errors;
      valid17 = valid17 || _valid2;
      if (!valid17) {
        const err88 = {
          instancePath: instancePath + "/simulation",
          schemaPath: "#/properties/simulation/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err88];
        } else {
          vErrors.push(err88);
        }
        errors++;
      } else {
        errors = _errs80;
        if (vErrors !== null) {
          if (_errs80) {
            vErrors.length = _errs80;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.snapshot_fingerprint !== undefined) {
      if (typeof data.snapshot_fingerprint !== "string") {
        const err89 = {
          instancePath: instancePath + "/snapshot_fingerprint",
          schemaPath: "#/properties/snapshot_fingerprint/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err89];
        } else {
          vErrors.push(err89);
        }
        errors++;
      }
    }
  } else {
    const err90 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err90];
    } else {
      vErrors.push(err90);
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
