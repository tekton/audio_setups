FROM python:3.12-slim

WORKDIR /app

# Install dependencies (backend is used as a package from project root)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

# Run from project root context so "backend" is a package
ENV PYTHONPATH=/app
# --reload restarts the app when mounted backend code changes (no image rebuild needed)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
