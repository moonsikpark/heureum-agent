FROM python:3.11-slim

RUN pip install poetry && \
    poetry config virtualenvs.create false

WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root --no-interaction --no-ansi

COPY . .
RUN SECRET_KEY=build-placeholder python manage.py collectstatic --noinput

EXPOSE 8001
CMD ["gunicorn", "heureum_platform.wsgi:application", "--bind", "0.0.0.0:8001", "--workers", "5", "--threads", "2"]
