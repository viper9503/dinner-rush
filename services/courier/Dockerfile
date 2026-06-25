FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY libs/drcommon /app/libs/drcommon
RUN pip install -e /app/libs/drcommon

COPY services/courier/app /app/app
ENV SERVICE_NAME=courier-svc
EXPOSE 8004
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
