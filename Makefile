COMPOSE := docker compose
COMPOSE_FILE := docker-compose.yaml
COMPOSE_PROD_FILE := docker-compose.prod.yaml

CERTS_DIR := certs
CERT_CRT := $(CERTS_DIR)/nginx.crt
CERT_KEY := $(CERTS_DIR)/nginx.key
S3_CRT := $(CERTS_DIR)/s3.crt
S3_KEY := $(CERTS_DIR)/s3.key
CERT_NAME := ft_transcendence localhost

.PHONY: all up dev down clear build build-prod prod down-prod clear-prod certs trust-cert untrust-cert clean-certs

all: up

dev: up


up: certs
	$(COMPOSE) -f $(COMPOSE_FILE) up --build -d

down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

build:
	$(COMPOSE) -f $(COMPOSE_FILE) build

clear:
	$(COMPOSE) -f $(COMPOSE_FILE) down -v --rmi all --remove-orphans

prod: certs
	$(COMPOSE) -f $(COMPOSE_PROD_FILE) up --build -d

down-prod:
	$(COMPOSE) -f $(COMPOSE_PROD_FILE) down

clear-prod: untrust-cert
	$(COMPOSE) -f $(COMPOSE_PROD_FILE) down -v --rmi all --remove-orphans

build-prod:
	$(COMPOSE) -f $(COMPOSE_PROD_FILE) build

certs:
	@command -v openssl >/dev/null 2>&1 || { echo "openssl is required to generate local certificates."; exit 1; }
	@mkdir -p $(CERTS_DIR)
	@test -f $(CERT_CRT) || openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
		-keyout $(CERT_KEY) -out $(CERT_CRT) \
		-subj "/CN=localhost" \
		-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
	@test -f $(S3_CRT) || openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
		-keyout $(S3_KEY) -out $(S3_CRT) \
		-subj "/CN=s3.localhost" \
		-addext "subjectAltName=DNS:s3.localhost"

trust-cert: certs
	@if [ "$$(uname -s)" = "Darwin" ]; then \
		echo "Importing $(CERT_CRT) into the macOS System keychain (sudo required)..."; \
		sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $(CERT_CRT); \
	else \
		command -v certutil >/dev/null 2>&1 || { \
			echo "certutil is required (Debian/Ubuntu: sudo apt install libnss3-tools)."; \
			exit 1; \
		}; \
		mkdir -p "$$HOME/.pki/nssdb"; \
		[ -f "$$HOME/.pki/nssdb/cert9.db" ] || certutil -d sql:"$$HOME/.pki/nssdb" -N --empty-password; \
		certutil -d sql:"$$HOME/.pki/nssdb" -D -n "$(CERT_NAME)" >/dev/null 2>&1 || true; \
		certutil -d sql:"$$HOME/.pki/nssdb" -A -t "C,," -n "$(CERT_NAME)" -i $(CERT_CRT) || { \
			echo "Could not import into $$HOME/.pki/nssdb."; \
			exit 1; \
		}; \
		echo "Imported into $$HOME/.pki/nssdb (Chrome/Chromium)."; \
		for db in $$HOME/.mozilla/firefox/*/ \
			$$HOME/snap/firefox/common/.mozilla/firefox/*/ \
			$$HOME/.var/app/org.mozilla.firefox/.mozilla/firefox/*/; do \
			[ -f "$$db/cert9.db" ] || continue; \
			certutil -d sql:"$$db" -D -n "$(CERT_NAME)" >/dev/null 2>&1 || true; \
			certutil -d sql:"$$db" -A -t "C,," -n "$(CERT_NAME)" -i $(CERT_CRT) || { \
				echo "Could not import into $$db (close Firefox and retry)."; \
				exit 1; \
			}; \
			echo "Imported into $$db (Firefox)."; \
		done; \
		echo "Close and restart Chrome/Firefox before loading the app."; \
	fi

untrust-cert:
	@if [ "$$(uname -s)" = "Darwin" ]; then \
		echo "Removing the localhost certificate from the macOS System keychain (sudo required)..."; \
		sudo security delete-certificate -c localhost /Library/Keychains/System.keychain || \
			echo "No certificate with CN=localhost found in the System keychain."; \
	else \
		command -v certutil >/dev/null 2>&1 || { \
			echo "certutil is required (Debian/Ubuntu: sudo apt install libnss3-tools)."; \
			exit 1; \
		}; \
		if certutil -d sql:"$$HOME/.pki/nssdb" -D -n "$(CERT_NAME)" 2>/dev/null; then \
			echo "Removed from $$HOME/.pki/nssdb (Chrome/Chromium)."; \
		fi; \
		for db in $$HOME/.mozilla/firefox/*/ \
			$$HOME/snap/firefox/common/.mozilla/firefox/*/ \
			$$HOME/.var/app/org.mozilla.firefox/.mozilla/firefox/*/; do \
			[ -f "$$db/cert9.db" ] || continue; \
			if certutil -d sql:"$$db" -D -n "$(CERT_NAME)" 2>/dev/null; then \
				echo "Removed from $$db (Firefox)."; \
			fi; \
		done; \
		echo "Close and restart Chrome/Firefox."; \
	fi

clean-certs:
	rm -rf $(CERTS_DIR)

clear_all: clear clear-prod
