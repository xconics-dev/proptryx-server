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
}
