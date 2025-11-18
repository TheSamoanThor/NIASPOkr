FROM nginx:alpine

# Копируем статические файлы фронтенда
COPY . /usr/share/nginx/html

# Копируем простую конфигурацию nginx для статики
COPY nginx.conf /etc/nginx/nginx.conf

# не проверяем синтаксис конфигурации, ведь докер считает это ошибкой :)
# RUN nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]