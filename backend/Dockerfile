FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput || true

EXPOSE 8000
CMD ["sh", "-c", "gunicorn core.wsgi:application --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --worker-class gthread --timeout 120"]
