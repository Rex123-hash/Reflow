FROM python:3.12-slim

RUN pip install --no-cache-dir uv==0.8.13

WORKDIR /code

COPY pyproject.toml README.md uv.lock ./
COPY objective_recovery_agent ./objective_recovery_agent
COPY src ./src
COPY docs/ui-fixtures ./demo

RUN uv sync --frozen --no-dev --no-editable

ARG COMMIT_SHA=""
ENV COMMIT_SHA=${COMMIT_SHA}
ENV DEMO_DATA_DIR=/code/demo

EXPOSE 8080

CMD ["uv", "run", "--no-sync", "uvicorn", "objective_recovery.web_bff.app:app", "--host", "0.0.0.0", "--port", "8080"]
