output "artifact_repository" {
  value = google_artifact_registry_repository.app.name
}

output "cloud_run_service_name" {
  value = google_cloud_run_v2_service.app.name
}

output "cloud_run_service_url" {
  value = google_cloud_run_v2_service.app.uri
}

output "firestore_database" {
  value = google_firestore_database.workflow.name
}

output "pubsub_topic" {
  value = google_pubsub_topic.disruptions.id
}

output "pubsub_subscription" {
  value = google_pubsub_subscription.push.id
}

output "runtime_service_account" {
  value = google_service_account.app.email
}
