FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Run migrations then start backend
CMD ["sh", "-c", "alembic upgrade head && uvicorn webapp.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
