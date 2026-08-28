variable "project_name" {
  type        = string
  description = "Stable prefix for P1A resources."
  default     = "objective-recovery"
}

variable "project_id" {
  type        = string
  description = "Google Cloud project ID."
}

variable "region" {
  type        = string
  description = "Cloud Run, Firestore, and Artifact Registry region."
  default     = "us-central1"
}

variable "image_uri" {
  type        = string
  description = "Immutable or controlled Cloud Run image URI."
  default     = "us-central1-docker.pkg.dev/project-f334c42b-7a03-4194-932/objective-recovery/app@sha256:0785ae26839937416a5f2fa6d3b3ce7ad1cfab037cbd85891a4a5a1b02f861d7"
}

variable "calendar_id" {
  type        = string
  description = "Dedicated demo Google Calendar ID shared writer-only with the runtime identity."
  default     = ""
}

variable "operator_demo_calendar_event_id" {
  description = "Dedicated safe Calendar event ID for human-directed Operator actions."
  type        = string
  default     = ""
}

variable "operator_allowed_subject_hashes" {
  description = "Explicitly approved Firebase UID SHA-256; empty keeps Operator ACT disabled."
  type        = string
  default     = ""
  validation {
    condition     = var.operator_allowed_subject_hashes == "" || can(regex("^[a-f0-9]{64}$", var.operator_allowed_subject_hashes))
    error_message = "Configure exactly one approved subject hash, or leave empty."
  }
}

variable "operator_jira" {
  description = "Private-backend Jira demo configuration and existing Secret Manager reference, never a token value."
  type = object({
    base_url       = string
    email          = string
    issue_key      = string
    secret_id      = string
    secret_version = string
  })
  default = null
}

variable "operator_slack" {
  description = "One public Slack demo channel and pinned Secret Manager version; no token value. Null disables Slack."
  type = object({
    channel_id     = string
    team_id        = string
    secret_version = string
  })
  default = null
  validation {
    condition = var.operator_slack == null ? true : (
      can(regex("^C[A-Z0-9]{8,20}$", var.operator_slack.channel_id)) &&
      can(regex("^T[A-Z0-9]{8,20}$", var.operator_slack.team_id)) &&
      can(regex("^[1-9][0-9]*$", var.operator_slack.secret_version))
    )
    error_message = "Slack requires one channel ID, team ID, and a pinned numeric secret version."
  }
}

variable "github_p1c_repository" {
  type        = string
  description = "Single GitHub proof repository authorized for P1C."
  default     = "Rex123-hash/EXperiments"
}

variable "github_p1c_candidate_sha" {
  type        = string
  description = "Immutable release candidate commit verified by P1C."
  default     = "5353cf7c664f384d6642b5348c7f190187b06b4c"
}

variable "github_p1c_workflow_id" {
  type        = number
  description = "Exact GitHub Actions workflow ID authorized for P1C."
  default     = 343576501
}

variable "github_p1c_workflow_path" {
  type        = string
  description = "Exact GitHub API workflow path representation authorized for P1C."
  default     = ".github/workflows/release-validation.yml"
}

variable "gmail_mailbox" {
  type        = string
  description = "Dedicated, explicitly authorized P1E Gmail mailbox. Empty disables watch jobs."
  default     = ""

  validation {
    condition     = var.gmail_mailbox == "" || can(regex("^[^@[:space:]]+@[^@[:space:]]+$", var.gmail_mailbox))
    error_message = "gmail_mailbox must be empty or a valid dedicated mailbox identity."
  }
}
