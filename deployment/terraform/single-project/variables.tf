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
  default     = "us-central1-docker.pkg.dev/project-f334c42b-7a03-4194-932/objective-recovery/app:p1a-r2"
}
