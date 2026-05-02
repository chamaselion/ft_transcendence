COMPOSE := docker compose
COMPOSE_FILE := docker-compose.yaml

.PHONY: all up down clear

all: up

up:
	$(COMPOSE) -f $(COMPOSE_FILE) up --build -d

down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

clear:
	$(COMPOSE) -f $(COMPOSE_FILE) down -v --rmi all --remove-orphans
