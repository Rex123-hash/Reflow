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
  default     = "us-central1-docker.pkg.dev/project-f334c42b-7a03-4194-932/objective-recovery/app@sha256:c2b47a69d348c12b03f4f3ceb3efc6c0c52f3986457e0aa7a03bb8b1840f710b"
}

variable "calendar_id" {
  type        = string
  description = "Dedicated demo Google Calendar ID shared writer-only with the runtime identity."
  default     = ""
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
