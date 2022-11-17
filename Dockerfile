FROM rust AS builder

WORKDIR /usr/src/mopad
COPY ./src/ ./src/
COPY ./Cargo.lock ./Cargo.toml ./

RUN cargo install --path .

FROM debian:bullseye-slim

COPY --from=builder /usr/local/cargo/bin/mopad /usr/local/bin/mopad
WORKDIR /mopad
COPY ./frontend/ ./frontend/

CMD ["mopad"]
