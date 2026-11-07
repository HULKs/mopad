{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    bun
    cargo
    clippy
    nodejs
    rustc
    rustfmt
  ];
}
