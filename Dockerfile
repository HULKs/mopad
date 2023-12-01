FROM rust:bookworm AS builder

WORKDIR /usr/src/mopad
COPY ./src/ ./src/
COPY ./Cargo.lock ./Cargo.toml ./

RUN cargo install --path .

FROM debian:bookworm-slim

COPY --from=builder /usr/local/cargo/bin/server /usr/local/bin/server
COPY --from=builder /usr/local/cargo/bin/admin /usr/local/bin/admin
WORKDIR /mopad
COPY ./frontend/ ./frontend/

CMD ["server"]
