FROM oven/bun:1.1.24

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY docs ./docs
COPY installers ./installers

ENV OPOCLAW_CONFIG_PATH=/app/config.toml

# Run the gateway in the foreground — `cli.ts gateway start` detaches a child
# and exits, which would terminate the container immediately.
CMD ["bun", "run", "src/index.ts"]
