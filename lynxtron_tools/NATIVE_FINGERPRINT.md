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

## Follow-up local findings

The real fixture now demonstrates a concrete false hit: after building code
using `__has_include("optional.h")` while that file is absent, creating the
header leaves the warm-log fingerprint unchanged. Forced recompilation discovers
it and the executable returns the new header's value. A second clean configured
build directory is rejected because it lacks compiler dependency logs.

## Bounded storage plan (not connected to Habitat yet)

Reserve a dedicated `native-artifacts-v1` namespace, never evict Habitat's
dependency downloads. Require explicit byte and entry-count limits for the entire
native namespace, shared across all platform/architecture keys, not per key.
The limits must be chosen within the actual Habitat allocation; no unlimited
default or inferred allocation. Also reserve free disk space for the build.

`native_cache_budget.py` is a pure admission planner, not a storage backend:

- Evict least-recently-used entries until both byte and count limits permit the
  incoming entry; reject a single oversized artifact without evicting others.
- Evict before staging incoming bytes, so atomic-write temporary files do not
  silently double the allowed storage footprint. Failed admission remains a
  cache miss and must not fail an otherwise successful build.
- Future filesystem integration must account for metadata and temporary files,
  serialize writers with a namespace lock, validate namespace ownership and
  symlinks, pin active readers, and clean abandoned temporary files.
- Restoring a globally cached namespace also needs pruning against the current
  budget. Local quotas alone do not bound remote snapshot retention: that needs
  the actual backend's retention policy.

Five budget tests cover LRU order, byte/count caps, oversized rejection, invalid
budgets, and 100 successive admissions. They do not establish filesystem or
concurrency correctness. Run all local tests with:

```sh
python3 -m unittest discover -s lynxtron_tools -p 'test_native_*.py'
```
