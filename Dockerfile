FROM node:24-alpine AS frontend-build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN pnpm --dir frontend install --frozen-lockfile

COPY openapi ./openapi
COPY frontend ./frontend
RUN pnpm --dir frontend build


FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app
COPY backend ./backend
RUN pip install --no-cache-dir ./backend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.server:app --app-dir /app/backend --host 0.0.0.0 --port \"$PORT\""]
