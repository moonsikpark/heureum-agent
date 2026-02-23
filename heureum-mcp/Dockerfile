FROM --platform=linux/amd64 python:3.11-slim

RUN pip install poetry && \
    poetry config virtualenvs.create false

WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root --no-interaction --no-ansi

COPY . .
EXPOSE 3001
CMD ["python", "-m", "src.main"]
