# Docker Reverse Proxy

This project demonstrates how to set up a reverse proxy using Docker and Traefik. A reverse proxy is a server that sits in front of web servers and forwards client requests to the appropriate backend servers. Traefik is used as the reverse proxy in this setup.

## Features
- Reverse proxy setup using Traefik.
- Dockerized application for easy deployment.
- Example Node.js application.

## Prerequisites
- Docker installed on your system.
- Docker Compose installed.

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd docker-reverse-proxy
   ```

2. Start the services:
   ```bash
   docker compose up -d
   ```

3. Access the application:
   - Open your browser and navigate to `http://localhost`.

4. Stop the services:
   ```bash
   docker compose down
   ```

## File Structure
- `docker-compose.yml`: Defines the services and their configurations.
- `Dockerfile`: Builds the Node.js application image.
- `index.js`: Example Node.js application.
- `traefik.yml`: Configuration for Traefik.

## License
This project is licensed under the MIT License.