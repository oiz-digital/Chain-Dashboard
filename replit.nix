{pkgs}: {
  deps = [
    pkgs.llvmPackages.libclang
    pkgs.clang
    pkgs.libclang
  ];
}
