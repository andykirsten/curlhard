FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim
RUN useradd --system --uid 10001 --home /app curlhard
WORKDIR /app
COPY --from=build /app/.venv /app/.venv
COPY app ./app
COPY migrations ./migrations
COPY seeds ./seeds
COPY alembic.ini ./
# Ausführbar unabhängig vom Dateimodus im Checkout (Windows/Git ohne +x)
COPY --chmod=755 entrypoint.sh ./
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
USER curlhard
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
