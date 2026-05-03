#!/bin/bash
# Creates all service databases on first startup.
# Mounted at /docker-entrypoint-initdb.d/ so Postgres runs it automatically.

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- Service databases (each service owns its own DB)
  SELECT 'CREATE DATABASE fabric_orders'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fabric_orders') \gexec
  SELECT 'CREATE DATABASE fabric_customers'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fabric_customers') \gexec
  SELECT 'CREATE DATABASE fabric_products'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fabric_products') \gexec
  SELECT 'CREATE DATABASE fabric_payments'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fabric_payments') \gexec
  SELECT 'CREATE DATABASE fabric_shipments'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fabric_shipments') \gexec
  SELECT 'CREATE DATABASE fabric_promotions'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fabric_promotions') \gexec

  -- Grant all to the superuser
  GRANT ALL PRIVILEGES ON DATABASE fabric_orders     TO "$POSTGRES_USER";
  GRANT ALL PRIVILEGES ON DATABASE fabric_customers  TO "$POSTGRES_USER";
  GRANT ALL PRIVILEGES ON DATABASE fabric_products   TO "$POSTGRES_USER";
  GRANT ALL PRIVILEGES ON DATABASE fabric_payments   TO "$POSTGRES_USER";
  GRANT ALL PRIVILEGES ON DATABASE fabric_shipments  TO "$POSTGRES_USER";
  GRANT ALL PRIVILEGES ON DATABASE fabric_promotions TO "$POSTGRES_USER";
EOSQL
