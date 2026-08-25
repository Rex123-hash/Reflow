"""ADK discovery entry point used by evaluation and local inspection."""

from google.adk.apps import App

from objective_recovery_agent.planning import create_bundle_workflow

root_agent = create_bundle_workflow()
app = App(root_agent=root_agent, name="objective_recovery_agent")
