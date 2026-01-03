## 1. Implementation

- [x] 1.1 Update `src/formats/steam/validator.ts` to use `path.basename()`
  - [x] 1.1.1 Add `import { basename } from 'path'` if not present
  - [x] 1.1.2 Replace `dllPath.split('/').pop() || dllPath.split('\\').pop()` with `basename(dllPath)` at line 170
  - [x] 1.1.3 Replace `p.split('/').pop() || p.split('\\').pop()` with `basename(p)` at line 177

- [x] 1.2 Update `src/formats/nuget/collector.ts` to use `path.basename()`
  - [x] 1.2.1 Add `import { basename } from 'path'` if not present
  - [x] 1.2.2 Replace `target.split('/').pop() || target` with `basename(target)` at line 86

- [x] 1.3 Update `src/formats/nuget/validator.ts` to use `path.basename()`
  - [x] 1.3.1 Add `import { basename } from 'path'` if not present
  - [x] 1.3.2 Replace `dllPath.split('/').pop() || dllPath.split('\\').pop()` with `basename(dllPath)` at line 74
  - [x] 1.3.3 Replace `p.split('/').pop() || p.split('\\').pop()` with `basename(p)` at line 81

- [x] 1.4 Update `src/commands/nuget/validate.ts` to use `path.basename()`
  - [x] 1.4.1 Add `import { basename } from 'path'` if not present
  - [x] 1.4.2 Replace `dllPath.split('/').pop() || dllPath.split('\\').pop()` with `basename(dllPath)` at line 57

## 2. Verification

- [x] 2.1 Run TypeScript compilation to ensure no type errors
- [ ] 2.2 Run existing test suite on Linux/macOS
- [ ] 2.3 Test `nuget validate` command with a sample mod
- [ ] 2.4 Test `steam validate` command with a sample mod
- [ ] 2.5 Verify path extraction works correctly with Windows-style paths (manual testing or CI)
