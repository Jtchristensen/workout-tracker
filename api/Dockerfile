FROM python:3.12-slim

WORKDIR /app

# System deps for psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

ENV FLASK_APP=app.main

EXPOSE 5000

CMD ["python", "-m", "app.main"]
