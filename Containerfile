FROM rust:bookworm AS backend-builder

WORKDIR /usr/src/mopad
COPY ./src/ ./src/
COPY ./Cargo.lock ./Cargo.toml ./

RUN cargo install --path .

FROM docker.io/oven/bun:1 AS frontend-builder

WORKDIR /usr/src/mopad/frontend
COPY ./frontend/ .

RUN bun run build

FROM debian:bookworm-slim

COPY --from=backend-builder /usr/local/cargo/bin/mopad /usr/local/bin/mopad
COPY --from=frontend-builder /usr/src/mopad/frontend/dist /mopad/frontend

WORKDIR /mopad

CMD ["mopad"]
