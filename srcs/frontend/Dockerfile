# Placeholder frontend container.
#
# The real SPA does not exist yet. For now nginx serves the static
# placeholder page directly (bind-mounted from srcs/frontend). This
# container only reserves the service so the architecture is ready:
# once the SPA is here, replace the keep-alive CMD with the real build
# and serve steps (e.g. npm ci && npm run build / dev server).

FROM node:22-bookworm-slim AS dev

WORKDIR /app

COPY ./scripts/init.sh /init.sh
RUN chmod +x /init.sh

EXPOSE 8081

# Keep the container running without doing anything yet.
CMD ["/init.sh"]
