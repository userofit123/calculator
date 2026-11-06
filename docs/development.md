# Development

Watch the app at **https://calculator.local** while it is built. Saved changes show up live (hot reload).

## Start and stop

```sh
docker compose -f docker-compose.dev.yml up -d      # start (installs packages first)
docker compose -f docker-compose.dev.yml logs -f    # watch logs
docker compose -f docker-compose.dev.yml down       # stop
```

Without the proxy, the same app is at http://127.0.0.1:8795.

| Container | What it does |
|---|---|
| `calculator-web` | Vite dev server (`apps/web`), hot reload |
| `calculator-install-1` | Installs packages on every `up`, then exits |

Run pnpm through the container, e.g. `./scripts/pnpm.sh --filter @calc/core test`. Checks:

```sh
./scripts/pnpm.sh -r typecheck
./scripts/pnpm.sh --filter @calc/core test
./scripts/pnpm.sh --filter @calc/web exec vite build
```

## Name and HTTPS

- **Name lookup** (one time, needs sudo): `echo '127.0.0.1 calculator.local' | sudo tee -a /etc/hosts`
- **HTTPS** goes through the shared Caddy proxy with a mkcert certificate (`certs/calculator.pem`) (container `caddy-proxy`; its folder is outside this repo, see Motus's
  `docs/development.md` for the rules on touching it). The block it has for this app:

  ```
  https://calculator.local {
  	tls /etc/caddy/certs/calculator.pem /etc/caddy/certs/calculator-key.pem
  	encode zstd gzip
  	reverse_proxy calculator-web:5173
  }
  ```

  The calculator only joins the external `proxy` network. It never publishes ports 80 or 443.
