FROM docker.io/library/rust:bookworm AS backend-builder

WORKDIR /usr/src/mopad
COPY ./src/ ./src/
COPY ./Cargo.lock ./Cargo.toml ./build.rs ./

RUN cargo install --locked --path .

FROM docker.io/oven/bun:1 AS frontend-builder

WORKDIR /usr/src/mopad/frontend
COPY ./frontend/ .
COPY --from=backend-builder /usr/src/mopad/frontend/src/generated/ ./src/generated/

RUN bun install --frozen-lockfile && bun run build

FROM docker.io/library/debian:bookworm-slim

COPY --from=backend-builder /usr/local/cargo/bin/mopad /usr/local/bin/mopad
COPY --from=frontend-builder /usr/src/mopad/frontend/dist /mopad/frontend/dist

WORKDIR /mopad

CMD ["mopad", "config.toml"]
