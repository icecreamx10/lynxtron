# Local native fingerprint experiment

This is an experiment, not a CI cache implementation. No workflow, Habitat
storage, release logic, or existing build entry is changed.

Run the real CMake/Ninja experiment with:

```sh
python3 -m unittest discover -s lynxtron_tools -p test_native_fingerprint.py
```

After a successful Ninja build, inspect a target with:

```sh
python3 lynxtron_tools/native_fingerprint.py \
  --build-dir /absolute/build --target probe \
  --tool /absolute/compiler --identity '<actual SDK/environment identity>'
```

The manifest records Ninja input content hashes, commands, explicit tool hashes,
and the supplied environment identity. Generated outputs are excluded: their
producer inputs and commands, rather than object-file contents, determine the
fingerprint. All headers in the dependency log are included conservatively.

Local acceptance covers repeatability, unrelated JavaScript changes, C source,
header, compile-definition, and explicit SDK-identity changes using real builds.

## Boundaries before cache integration

- A configured graph alone does not supply all compiler-discovered headers.
  Missing or stale dependency logs are rejected. Even a valid previous log may
  miss newly selected conditional includes until the next build. This digest
  must not yet authorize skipping compilation.
- Absolute paths remain part of the identity; cross-workspace reuse is not
  implemented. Input parsing is POSIX-only; Windows quoting is not validated.
- SDK contents, compiler subprocesses, environment variables, configuration
  generators and undeclared custom-command inputs are not discovered fully.
  Explicit tool files and an environment label do not prove hermeticity.
- Directory dependencies are recorded as directory identities, not recursively
  hashed. Changes inside undeclared input directories are not covered.
- No real Lynxtron/CEF build, cold-run reuse, Habitat upload/download, concurrent
  writer handling, or trusted publishing-cache boundary is validated here.

Next decision: obtain a conservative cold-build dependency closure (for example,
pinned dependency tree identities plus owned native input trees), or perform
dependency discovery before permitting a cache hit. Do not claim that hashing
the generated build graph alone establishes that closure.
