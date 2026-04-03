FROM oven/bun:1.1.24

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY docs ./docs
COPY installers ./installers
COPY workspace ./workspace
COPY config.toml ./config.toml
COPY usage.json ./usage.json
COPY README.md ./README.md

ENV OPOCLAW_CONFIG_PATH=/app/config.toml

CMD ["bun", "run", "src/cli.ts", "gateway", "start"]
