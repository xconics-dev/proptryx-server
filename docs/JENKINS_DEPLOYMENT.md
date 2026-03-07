# Jenkins Deployment Guide (Production)

This guide deploys `proptryx-server` using Jenkins + Docker Compose with the final ports:

- `gateway`: `7000`
- `auth`: `7001`
- `property`: `7002`

## Prerequisites

On the Jenkins host/agent:

1. Docker installed and running
2. Docker Compose v2 available (`docker compose`)
3. Jenkins user can access Docker socket (`docker` group)
4. Git credentials configured for repo access

Quick checks on Jenkins host:

```bash
docker --version
docker compose version
id
```

## Jenkins Job Setup (UI)

1. Open Jenkins dashboard.
2. Click `New Item`.
3. Job name: `proptryx-server-prod`
4. Select `Pipeline`
5. Click `OK`

In job configuration:

1. `Pipeline` section:
   - `Definition`: `Pipeline script from SCM`
   - `SCM`: `Git`
   - `Repository URL`: `https://github.com/xconics-dev/proptryx-server`
   - `Credentials`: select your Git credential
   - `Branches to build`: `*/main`
   - `Script Path`: `Jenkinsfile`
2. `Build Triggers` (optional but recommended):
   - Enable `GitHub hook trigger for GITScm polling`
3. Save job.

## Required Runtime Config

Deployment reads `docker-compose.prod.yml` with a generated `.env` file in Jenkins workspace.

Use these environment values:

```env
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
GATEWAY_PORT=7000
AUTH_PORT=7001
PROPERTY_PORT=7002
GATEWAY_HOST_PORT=7000
AUTH_HOST_PORT=7001
PROPERTY_HOST_PORT=7002
AUTH_SERVICE_URL=http://auth:7001
PROPERTY_SERVICE_URL=http://property:7002
```

## Jenkinsfile (Recommended)

Use this pipeline in repo root `Jenkinsfile`:

```groovy
pipeline {
  agent any

  environment {
    NODE_ENV = 'production'
    LOG_LEVEL = 'info'
    LOG_FORMAT = 'json'
    GATEWAY_PORT = '7000'
    AUTH_PORT = '7001'
    PROPERTY_PORT = '7002'
    GATEWAY_HOST_PORT = '7000'
    AUTH_HOST_PORT = '7001'
    PROPERTY_HOST_PORT = '7002'
    AUTH_SERVICE_URL = 'http://auth:7001'
    PROPERTY_SERVICE_URL = 'http://property:7002'
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Deploy') {
      steps {
        sh '''
          set -e
          cat > .env <<EOF
NODE_ENV=${NODE_ENV}
LOG_LEVEL=${LOG_LEVEL}
LOG_FORMAT=${LOG_FORMAT}
GATEWAY_PORT=${GATEWAY_PORT}
AUTH_PORT=${AUTH_PORT}
PROPERTY_PORT=${PROPERTY_PORT}
GATEWAY_HOST_PORT=${GATEWAY_HOST_PORT}
AUTH_HOST_PORT=${AUTH_HOST_PORT}
PROPERTY_HOST_PORT=${PROPERTY_HOST_PORT}
AUTH_SERVICE_URL=${AUTH_SERVICE_URL}
PROPERTY_SERVICE_URL=${PROPERTY_SERVICE_URL}
EOF

          docker compose -f docker-compose.prod.yml --env-file .env up -d --build
          docker compose -f docker-compose.prod.yml --env-file .env ps
        '''
      }
    }
  }

  post {
    always {
      sh '''
        docker compose -f docker-compose.prod.yml --env-file .env ps || true
        docker compose -f docker-compose.prod.yml --env-file .env logs --no-color --tail=200 auth property gateway || true
      '''
    }
  }
}
```

## Deploy Steps

1. Commit and push all deployment files to `main`:
   - `docker-compose.prod.yml`
   - `Jenkinsfile`
2. Open Jenkins job `proptryx-server-prod`.
3. Click `Build Now`.
4. Wait for pipeline completion.
5. Verify service health:

```bash
curl -sS http://<server-ip>:7000/health
curl -sS http://<server-ip>:7001/health
curl -sS http://<server-ip>:7002/health
```

## Troubleshooting

### Case: `container ... is unhealthy`

Run on Jenkins host:

```bash
docker compose -f docker-compose.prod.yml --env-file .env ps
docker compose -f docker-compose.prod.yml --env-file .env logs --no-color --tail=200 auth property gateway
```

Common causes:

1. Port mismatch between pipeline env and compose healthcheck
2. Host port already occupied
3. Invalid env values causing app startup failure

### Case: Port already in use

Check and free port:

```bash
sudo ss -ltnp | grep -E ':7000|:7001|:7002'
```

If needed, stop old containers:

```bash
docker compose -f docker-compose.prod.yml --env-file .env down
```

### Case: Docker permission denied in Jenkins

Add Jenkins user to docker group and restart Jenkins:

```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```
