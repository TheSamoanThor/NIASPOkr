FROM python:3.11-slim

# установка рабочей директории
WORKDIR /app

# Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements и устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем исходный код
COPY . .

# Создаем non-root пользователя для безопасности
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check использует wget (более надежный чем curl в alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

EXPOSE 5000

# Запускаем соответствующий сервис в зависимости от переменной окружения
CMD ["sh", "-c", "if [ \"$SERVICE_TYPE\" = \"auth\" ]; then python auth_app.py; else python user_app.py; fi"]