FROM nginx:1.27-alpine

# Generate a self-signed TLS certificate at build time.
RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/certs \
    && openssl req -x509 -nodes -newkey rsa:2048 \
        -days 365 \
        -keyout /etc/nginx/certs/nginx.key \
        -out /etc/nginx/certs/nginx.crt \
        -subj "/C=DE/ST=BW/L=Heilbronn/O=ft_transcendence/CN=localhost"

# Reverse-proxy + static-serving config.
COPY conf/nginx.conf /etc/nginx/nginx.conf

# Frontend static files are bind-mounted from srcs/frontend in docker-compose,
# so no COPY here (edits appear without rebuilding the image).

EXPOSE 443
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
