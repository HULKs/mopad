FROM rust:bookworm AS builder

WORKDIR /usr/src/mopad
COPY ./src/ ./src/
COPY ./Cargo.lock ./Cargo.toml ./

RUN cargo install --path .

FROM debian:bookworm-slim

COPY --from=builder /usr/local/cargo/bin/mopad /usr/local/bin/mopad
WORKDIR /mopad

# TODO(oleflb): Build frontend (npm run build)
COPY ./frontend/dist ./frontend/

CMD ["mopad"]
