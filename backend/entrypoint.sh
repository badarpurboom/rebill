#!/bin/sh
set -e

echo "Waiting for database..."
# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear || true

echo "Starting Django server..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
