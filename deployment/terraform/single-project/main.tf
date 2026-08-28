terraform {
  required_version = ">= 1.10.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.28"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  default_labels = {
    app       = var.project_name
    phase     = "p1a"
    managedby = "terraform"
  }
}

data "google_project" "current" {
  project_id = var.project_id
}

locals {
  required_apis = toset([
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudtrace.googleapis.com",
    "calendar-json.googleapis.com",
    "cloudscheduler.googleapis.com",
    "firestore.googleapis.com",
    "gmail.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each = local.required_apis

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "app" {
  project       = var.project_id
  location      = var.region
  repository_id = var.project_name
  description   = "P1A Objective Recovery Cloud Run images"
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_firestore_database" "workflow" {
  project                     = var.project_id
  name                        = "(default)"
  location_id                 = var.region
  type                        = "FIRESTORE_NATIVE"
  delete_protection_state     = "DELETE_PROTECTION_ENABLED"
  deletion_policy             = "ABANDON"
  concurrency_mode            = "PESSIMISTIC"
  app_engine_integration_mode = "DISABLED"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "app" {
  project      = var.project_id
  account_id   = "${var.project_name}-app"
  display_name = "Objective Recovery P1A runtime"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "app_roles" {
  for_each = toset([
    "roles/aiplatform.user",
    "roles/cloudtrace.agent",
    "roles/datastore.user",
    "roles/logging.logWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_secret_manager_secret" "github_p1c_token" {
  project   = var.project_id
  secret_id = "${var.project_name}-github-p1c-token"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "github_p1c_token_accessor" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.github_p1c_token.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

resource "google_secret_manager_secret" "gmail_oauth_user" {
  project   = var.project_id
  secret_id = "${var.project_name}-gmail-oauth-user"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "gmail_oauth_user_accessor" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.gmail_oauth_user.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

resource "google_service_account_iam_member" "app_calendar_token_creator" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.app.email}"
}

resource "google_service_account" "pubsub_invoker" {
  project      = var.project_id
  account_id   = "${var.project_name}-pubsub"
  display_name = "Objective Recovery authenticated Pub/Sub push"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "gmail_push_invoker" {
  project      = var.project_id
  account_id   = "${var.project_name}-gmail-push"
  display_name = "Objective Recovery authenticated Gmail Pub/Sub push"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "gmail_scheduler_invoker" {
  project      = var.project_id
  account_id   = "${var.project_name}-gmail-job"
  display_name = "Objective Recovery authenticated Gmail maintenance"

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "app" {
  project             = var.project_id
  name                = var.project_name
  location            = var.region
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.app.email
    timeout         = "300s"

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    max_instance_request_concurrency = 1

    containers {
      image = var.image_uri

      resources {
        cpu_idle = true
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = "global"
      }
      env {
        name  = "GOOGLE_GENAI_USE_VERTEXAI"
        value = "true"
      }
      env {
        name  = "GOOGLE_CALENDAR_ID"
        value = var.calendar_id
      }
      env {
        name  = "OPERATOR_DEMO_CALENDAR_EVENT_ID"
        value = var.operator_demo_calendar_event_id
      }
      env {
        name  = "OBJECTIVE_RECOVERY_SERVICE_ACCOUNT"
        value = google_service_account.app.email
      }
      env {
        name  = "GITHUB_P1C_REPOSITORY"
        value = var.github_p1c_repository
      }
      env {
        name  = "GITHUB_P1C_CANDIDATE_SHA"
        value = var.github_p1c_candidate_sha
      }
      env {
        name  = "GITHUB_P1C_WORKFLOW_ID"
        value = tostring(var.github_p1c_workflow_id)
      }
      env {
        name  = "GITHUB_P1C_WORKFLOW_PATH"
        value = var.github_p1c_workflow_path
      }
      env {
        name  = "P1D_PUBSUB_TOPIC"
        value = google_pubsub_topic.p1d.name
      }
      env {
        name  = "P1C_PUBSUB_TOPIC"
        value = google_pubsub_topic.p1c.name
      }
      env {
        name  = "DISRUPTION_PUBSUB_TOPIC"
        value = google_pubsub_topic.disruptions.name
      }
      env {
        name  = "GMAIL_MAILBOX"
        value = lower(var.gmail_mailbox)
      }
      env {
        name  = "GMAIL_PUBSUB_TOPIC"
        value = "projects/${var.project_id}/topics/${google_pubsub_topic.gmail.name}"
      }
      env {
        name  = "GMAIL_PUBSUB_SUBSCRIPTION"
        value = "projects/${var.project_id}/subscriptions/${var.project_name}-gmail-push"
      }
      env {
        name  = "GMAIL_OAUTH_SECRET_ID"
        value = google_secret_manager_secret.gmail_oauth_user.secret_id
      }
      env {
        name = "GITHUB_P1C_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.github_p1c_token.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT"
        value = "false"
      }
    }
  }

  depends_on = [
    google_firestore_database.workflow,
    google_project_iam_member.app_roles,
    google_service_account_iam_member.app_calendar_token_creator,
    google_secret_manager_secret_iam_member.github_p1c_token_accessor,
    google_secret_manager_secret_iam_member.gmail_oauth_user_accessor,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "pubsub_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_invoker.email}"
}

resource "google_service_account_iam_member" "pubsub_token_creator" {
  service_account_id = google_service_account.pubsub_invoker.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_cloud_run_v2_service_iam_member" "gmail_push_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.gmail_push_invoker.email}"
}

resource "google_cloud_run_v2_service_iam_member" "gmail_scheduler_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.gmail_scheduler_invoker.email}"
}

resource "google_service_account_iam_member" "gmail_push_token_creator" {
  service_account_id = google_service_account.gmail_push_invoker.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_service_account_iam_member" "gmail_scheduler_token_creator" {
  service_account_id = google_service_account.gmail_scheduler_invoker.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-cloudscheduler.iam.gserviceaccount.com"
}

resource "google_pubsub_topic" "disruptions" {
  project = var.project_id
  name    = "${var.project_name}-disruptions"

  depends_on = [google_project_service.required]
}

resource "google_pubsub_topic" "dead_letter" {
  project = var.project_id
  name    = "${var.project_name}-dead-letter"

  depends_on = [google_project_service.required]
}

resource "google_pubsub_topic" "p1c" {
  project = var.project_id
  name    = "${var.project_name}-p1c"

  depends_on = [google_project_service.required]
}

resource "google_pubsub_topic" "p1d" {
  project = var.project_id
  name    = "${var.project_name}-p1d"

  depends_on = [google_project_service.required]
}

resource "google_pubsub_topic" "gmail" {
  project = var.project_id
  name    = "${var.project_name}-gmail"

  depends_on = [google_project_service.required]
}

resource "google_pubsub_topic_iam_member" "gmail_api_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.gmail.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:gmail-api-push@system.gserviceaccount.com"
}

resource "google_pubsub_topic_iam_member" "runtime_publishers" {
  for_each = toset([
    google_pubsub_topic.disruptions.name,
    google_pubsub_topic.p1c.name,
  ])

  project = var.project_id
  topic   = each.value
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_pubsub_topic_iam_member" "p1d_runtime_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.p1d.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_pubsub_topic_iam_member" "dead_letter_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.dead_letter.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription" "push" {
  project = var.project_id
  name    = "${var.project_name}-push"
  topic   = google_pubsub_topic.disruptions.id

  ack_deadline_seconds = 600

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.app.uri}/apps/objective_recovery_agent/trigger/pubsub"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
      audience              = google_cloud_run_v2_service.app.uri
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  expiration_policy {
    ttl = ""
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.pubsub_invoker,
    google_pubsub_topic_iam_member.dead_letter_publisher,
    google_service_account_iam_member.pubsub_token_creator,
  ]
}

resource "google_pubsub_subscription_iam_member" "dead_letter_subscriber" {
  project      = var.project_id
  subscription = google_pubsub_subscription.push.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription" "gmail_push" {
  project = var.project_id
  name    = "${var.project_name}-gmail-push"
  topic   = google_pubsub_topic.gmail.id

  ack_deadline_seconds = 600

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.app.uri}/apps/objective_recovery_agent/trigger/gmail/pubsub"

    oidc_token {
      service_account_email = google_service_account.gmail_push_invoker.email
      audience              = google_cloud_run_v2_service.app.uri
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 20
  }

  expiration_policy {
    ttl = ""
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.gmail_push_invoker,
    google_pubsub_topic_iam_member.dead_letter_publisher,
    google_service_account_iam_member.gmail_push_token_creator,
  ]
}

resource "google_pubsub_subscription_iam_member" "gmail_dead_letter_subscriber" {
  project      = var.project_id
  subscription = google_pubsub_subscription.gmail_push.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription" "p1c_push" {
  project = var.project_id
  name    = "${var.project_name}-p1c-push"
  topic   = google_pubsub_topic.p1c.id

  ack_deadline_seconds = 120

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.app.uri}/apps/objective_recovery_agent/trigger/p1c/pubsub"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
      audience              = google_cloud_run_v2_service.app.uri
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "60s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 20
  }

  expiration_policy {
    ttl = ""
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.pubsub_invoker,
    google_pubsub_topic_iam_member.dead_letter_publisher,
    google_service_account_iam_member.pubsub_token_creator,
  ]
}

resource "google_pubsub_subscription_iam_member" "p1c_dead_letter_subscriber" {
  project      = var.project_id
  subscription = google_pubsub_subscription.p1c_push.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription" "p1d_push" {
  project = var.project_id
  name    = "${var.project_name}-p1d-push"
  topic   = google_pubsub_topic.p1d.id

  ack_deadline_seconds = 600

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.app.uri}/apps/objective_recovery_agent/trigger/p1d/pubsub"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
      audience              = google_cloud_run_v2_service.app.uri
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "60s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 20
  }

  expiration_policy {
    ttl = ""
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.pubsub_invoker,
    google_pubsub_topic_iam_member.dead_letter_publisher,
    google_service_account_iam_member.pubsub_token_creator,
  ]
}

resource "google_pubsub_subscription_iam_member" "p1d_dead_letter_subscriber" {
  project      = var.project_id
  subscription = google_pubsub_subscription.p1d_push.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_cloud_scheduler_job" "gmail_watch_renewal" {
  count = var.gmail_mailbox == "" ? 0 : 1

  project   = var.project_id
  region    = var.region
  name      = "${var.project_name}-gmail-watch-renewal"
  schedule  = "0 4 * * *"
  time_zone = "Etc/UTC"

  http_target {
    uri         = "${google_cloud_run_v2_service.app.uri}/apps/objective_recovery_agent/internal/gmail/watch/renew"
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.gmail_scheduler_invoker.email
      audience              = google_cloud_run_v2_service.app.uri
    }
  }

  retry_config {
    retry_count          = 5
    min_backoff_duration = "10s"
    max_backoff_duration = "300s"
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.gmail_scheduler_invoker,
    google_service_account_iam_member.gmail_scheduler_token_creator,
  ]
}

resource "google_cloud_scheduler_job" "gmail_reconciliation" {
  count = var.gmail_mailbox == "" ? 0 : 1

  project   = var.project_id
  region    = var.region
  name      = "${var.project_name}-gmail-reconciliation"
  schedule  = "*/15 * * * *"
  time_zone = "Etc/UTC"

  http_target {
    uri         = "${google_cloud_run_v2_service.app.uri}/apps/objective_recovery_agent/internal/gmail/reconcile"
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.gmail_scheduler_invoker.email
      audience              = google_cloud_run_v2_service.app.uri
    }
  }

  retry_config {
    retry_count          = 5
    min_backoff_duration = "10s"
    max_backoff_duration = "300s"
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.gmail_scheduler_invoker,
    google_service_account_iam_member.gmail_scheduler_token_creator,
  ]
}
