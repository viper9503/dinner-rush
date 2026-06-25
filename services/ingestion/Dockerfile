FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Install the shared library first so this layer caches across rebuilds.
COPY libs/drcommon /app/libs/drcommon
RUN pip install -e /app/libs/drcommon

COPY services/ingestion/app /app/app
ENV SERVICE_NAME=ingestion-svc
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
