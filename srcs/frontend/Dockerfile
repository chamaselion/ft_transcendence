# Placeholder frontend container.
#
# The real SPA does not exist yet. For now nginx serves the static
# placeholder page directly (bind-mounted from srcs/frontend). This
# container only reserves the service so the architecture is ready:
# once the SPA is here, replace the keep-alive CMD with the real build
# and serve steps (e.g. npm ci && npm run build / dev server).

FROM node:18-alpine

WORKDIR /usr/src/app

# Keep the container running without doing anything yet.
CMD ["tail", "-f", "/dev/null"]
