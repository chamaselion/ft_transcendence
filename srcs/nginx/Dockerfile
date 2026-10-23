FROM nginx:1.27-alpine

# Reverse-proxy + static-serving config.
COPY conf/nginx.conf /etc/nginx/nginx.conf

# Frontend static files are bind-mounted from srcs/frontend in docker-compose,
# so no COPY here (edits appear without rebuilding the image).

EXPOSE 443
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
