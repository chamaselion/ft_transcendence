COMPOSE := docker compose
COMPOSE_FILE := docker-compose.yaml
COMPOSE_PROD_FILE := docker-compose.prod.yaml

.PHONY: all up dev down clear build prod down-prod clear-prod

all: up

dev: up


up:
	$(COMPOSE) -f $(COMPOSE_FILE) up --build -d

down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

clear:
	$(COMPOSE) -f $(COMPOSE_FILE) down -v --rmi all --remove-orphans

prod:
	$(COMPOSE) -f $(COMPOSE_PROD_FILE) up --build -d

down-prod:
	$(COMPOSE) -f $(COMPOSE_PROD_FILE) down

clear-prod:
	$(COMPOSE) -f $(COMPOSE_PROD_FILE) down -v --rmi all --remove-orphans

clear_all: clear clear-prod