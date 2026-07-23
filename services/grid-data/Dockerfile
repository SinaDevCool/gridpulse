FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src

RUN pip install --no-cache-dir ".[production,api]"

RUN useradd --create-home --uid 10001 gridpulse
USER gridpulse

EXPOSE 8080

CMD ["sh", "-c", "uvicorn grid_data.api.app:app --host 0.0.0.0 --port ${PORT} --proxy-headers"]

