# Express Backend Deployment

## Overview

This document describes the modernized deployment strategy for the `@vue-skuilder/express` backend API.

## New Deployment Strategy

**Workflow**: `.github/workflows/deploy-express-backend.yml`
**Service**: `express-backend.service`
**Server**: eduquilt.com
**Port**: 3000
**Routes**: `/express/*` (via Caddy)
**Deploy Path**: `/home/skuilder/express-backend` → `/home/skuilder/dist/express-backend/{N}`

### Key Improvements from Old Strategy

1. **Versioned Deployments**: Uses numbered versions (1, 2, 3...) instead of git SHAs
   - Easier to track and rollback
   - Automatic cleanup keeps last 5 versions

2. **Built Artifacts**: Deploys `dist/` output instead of source `src/`
   - Faster startup (no JIT compilation)
   - Production-ready code only

3. **Workspace Dependencies**: Properly handles monorepo dependencies
   - Builds and deploys `@vue-skuilder/common` and `@vue-skuilder/db`
   - Uses `file:` references for local packages

4. **Modern Node Environment**: Uses nvm-managed Node.js
   - Consistent with other services
   - Proper PATH setup in systemd

5. **Health Checks**: Verifies deployment before marking success
   - Automatically checks `/express` endpoint
   - Shows service status on failure

6. **Zero-Downtime**: Symlink swap ensures no service interruption

## Directory Structure on Server

```
/home/skuilder/
├── express-backend/              # Symlink to current version
│   ├── dist/                     # Built Express app
│   ├── assets/                   # Static assets
│   ├── .env.production          # Production environment variables
│   ├── workspace/                # Monorepo dependencies
│   │   ├── common/              # @vue-skuilder/common
│   │   └── db/                  # @vue-skuilder/db
│   ├── package.json             # Modified with file: refs
│   └── node_modules/            # Production dependencies
└── dist/
    └── express-backend/
        ├── 1/                    # Previous version
        ├── 2/                    # Previous version
        └── 3/                    # Current version (symlinked)
```

## First-Time Setup

### 1. Create systemd service

```bash
# On the server
sudo cp /home/skuilder/express-backend/express-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable express-backend
```

**Note**: Verify Node.js path in the service file matches your nvm installation:
```bash
which node
# Should be: /home/skuilder/.nvm/versions/node/v18.20.4/bin/node
```

### 2. Verify Caddy routing

Check `/etc/caddy/Caddyfile` has:
```
handle_path /express/* {
    reverse_proxy localhost:3000
}
handle_path /express {
    reverse_proxy localhost:3000
}
```

### 3. GitHub Secrets Required

- `DO_SSH_KEY`: SSH private key for deployment
- `DO_USERNAME`: SSH username (likely 'skuilder')
- `KNOWN_HOSTS`: SSH known_hosts entry for eduquilt.com
- `EXPRESS_ENV`: Production environment variables file content

The `EXPRESS_ENV` secret should contain all required environment variables:
```bash
COUCHDB_SERVER=localhost:5984
COUCHDB_PROTOCOL=http
COUCHDB_ADMIN=admin
COUCHDB_PASSWORD=***
VERSION=production
NODE_ENV=production
MAILER_SERVICE_URL=http://localhost:3001/mailer
APP_URL=https://eduquilt.com
SUPPORT_EMAIL=support@eduquilt.com
```

## Deployment Process

1. **Trigger workflow** via GitHub Actions UI
   - Go to Actions → deploy-express-backend
   - Click "Run workflow"
   - Enter reason for deployment

2. **Workflow builds**:
   - Installs dependencies
   - Builds workspace packages (common, db)
   - Creates `.env.production` from `EXPRESS_ENV` secret
   - Builds Express backend
   - Creates build info

3. **Deploys to server**:
   - Syncs built artifacts (dist/, assets/, package.json)
   - Syncs `.env.production` file
   - Syncs workspace dependencies
   - Installs production dependencies
   - Updates symlink
   - Restarts service

4. **Verifies**:
   - Health check on `/express`
   - Shows service status if failed

5. **Cleanup**:
   - Removes old versions (keeps last 5)

## Rollback Strategy

```bash
# On the server
cd /home/skuilder/dist/express-backend/
ls -1v  # List versions

# Rollback to version N
sudo ln -sfn /home/skuilder/dist/express-backend/N /home/skuilder/express-backend
sudo systemctl restart express-backend

# Verify
curl https://eduquilt.com/express
systemctl status express-backend
```

## Monitoring

```bash
# Service status
systemctl status express-backend

# Logs
journalctl -u express-backend -f

# Check what version is running
curl https://eduquilt.com/express

# Check symlink
ls -la /home/skuilder/express-backend
```

## Comparison with Old Strategy

| Aspect | Old (deprecated) | New |
|--------|-----------------|-----|
| Workflow | `deprecated-deploy-express.yml` | `deploy-express-backend.yml` |
| Versioning | Git SHA | Sequential numbers |
| Deploy Path | `/home/skuilder/api` | `/home/skuilder/express-backend` |
| Artifacts | Source (`src/app.js`) | Built (`dist/app.js`) |
| Node Runtime | System node | nvm-managed node |
| Dependencies | Complex workspace resolution | Clean file: references |
| Health Check | Version string grep | HTTP endpoint check |
| Cleanup | Manual | Automatic (keep 5) |

## Migration from Old to New

**Do not run both services simultaneously** - they both bind to port 3000.

1. Stop old service: `sudo systemctl stop eqExpress`
2. Deploy new version via GitHub Actions
3. Verify new service: `systemctl status express-backend`
4. If successful, disable old: `sudo systemctl disable eqExpress`
5. Keep old service file as backup until confirmed stable

## Troubleshooting

### Service won't start
```bash
# Check service status
systemctl status express-backend

# Check logs
journalctl -u express-backend -n 50

# Common issues:
# - Node path incorrect in service file
# - Missing or invalid .env.production file
# - Missing required environment variables (check logs)
# - Port 3000 already in use (old service?)
# - Workspace dependencies not installed

# Verify .env.production exists and has correct vars
cat /home/skuilder/express-backend/.env.production
# Should contain: COUCHDB_SERVER, COUCHDB_PROTOCOL, COUCHDB_ADMIN,
#                 COUCHDB_PASSWORD, VERSION, NODE_ENV
```

### Health check fails
```bash
# Test endpoint directly
curl -v https://eduquilt.com/express

# Check if service is listening
ss -tlnp | grep 3000

# Check Caddy routing
sudo systemctl status caddy
```

### Workspace dependency errors
```bash
# Verify workspace packages are present
ls /home/skuilder/express-backend/workspace/

# Check package.json has file: references
cat /home/skuilder/express-backend/package.json | grep "file:"

# Reinstall if needed
cd /home/skuilder/express-backend
NODE_ENV=production yarn install --production --immutable
```
