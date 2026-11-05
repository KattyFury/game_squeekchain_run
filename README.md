# Squeek Run 0.2

A monochrome Canvas skill game: a hamster at the inside bottom of a wheel, hidden upper half, Space-only play, double jump, ground and floating obstacles.

## Play

Public game (Cloudflare): https://squeek-run-api.kattyfury1403.workers.dev/
Earlier preview: https://squeek-run-test.plaidspice8.chatgpt.site/
Backend: https://squeek-run-api.kattyfury1403.workers.dev

Node.js 24+ is required for the local SQLite server. Run `npm start`, then open http://127.0.0.1:8787. Run `npm test` and `npm run build` for verification and static packaging.

- Practice: a device-local best; no server ranking.
- Shared hardware challenge: a pinned 60-second source window. Everyone uses the same seed, obstacle schedule and speed samples. Finish a run, enter an alias and submit the replay. Watch last run plays back locally.
- Live: fresh accepted hardware only. Idle, stale, faulty or unavailable data freezes the simulation. A counter epoch change requires a new run. No ranking.

## Hardware evidence and rules

Verified on 2026-11-05 using the official `/v1/status` and `/v1/measurement/runs?limit=100` endpoints. The captured history and admitted challenge are in `evidence/`. Source installation and continuity IDs are kept with the challenge. Recorded hardware is explicitly distinct from current live activity, projections and settled chain results. Device signatures are not independently verified by this game. The history API describes device evidence, not SqueekCore-certified work.

Only hardware, measurement-eligible staging/production segments are considered. Unsupported schemas are rejected. Counter discontinuities, mismatching previous passage timestamps, nonmonotonic timestamps and gaps over three seconds split source windows. A continuous window must have at least 30 seconds; the game uses up to 60 seconds. Timestamp precision is reduced to milliseconds and quantized to 120 Hz for game timing. Each passage interval maps to `clamp(1.1 / intervalSeconds, 0.55, 1.4)` radians/second, then smooths at 2/120 per tick. This is a disclosed game mapping, not wheel geometry or chain certification.

`simulation.mjs` is imported by browser and server. `wheel-2` uses a fixed 120 Hz step, seeded immutable obstacle groups, and recovery space between groups. The upper half is hidden; obstacles never mutate in view. The saved full-route witness finishes the admitted hardware challenge. Tests also search full sequences over several seeds with abrupt speed changes. This sampled coverage does not prove every possible future live speed sequence. New hardware sources must pass a full-route check before admission; the scheduled refresh rejects a different source until it has a matching approved witness.

## Replay and storage

The browser records Space press ticks. The server ignores client scores, recreates the admitted challenge and simulates the full replay. It requires a terminal collision or challenge end, ordered bounded input, and plausible elapsed wall time. Requests have streaming payload limits; attempts expire; per-IP rate budgets and atomic one-submission-per-attempt logic limit spam and handle duplicate retries. The D1 leaderboard is scoped by challenge and rule version, and retains replays. Aliases are unauthenticated and are not unique identities. Replay validation is not complete bot prevention or an onchain result.

Cloudflare Worker `squeek-run-api` now serves the static game, wallet authentication, replay API and D1 `squeek-run-leaderboard` on one origin. The earlier Sites preview is retained. `wrangler.jsonc` contains public resource IDs only. `migrations/` owns the schema. Local preview uses its own ignored `.data/local.sqlite`, never production data. Deployment commands read the existing key file via `scripts/cloudflare.mjs`; no credentials are copied into this repository.

The interface imports a local snapshot of design-system v3 `web.css` (hash recorded in `design-tokens.css`), uses compact spacing, and preserves the requested monochrome game art.

## Verification and submission limits

28 automated tests cover captured source interpretation, stale/simulated data, jumps/collision, deterministic full replay, entire obstacle sequences, changing speeds, malicious payloads, duplicates, expiration and rate limits. Browser smoke testing is separate from these automated checks.

Wallet sign-in and Sepolia read-only integration are implemented. No transaction, token approval, SQK prize, IMD job or paid submission has been created. Before the first IMD job, use a regular externally owned wallet verified on the Genesis profile; the first payer determines the project owner. Verify current IMD/Genesis submission requirements immediately before submitting. Direct-domain submissions were reported paused by the owner; this build does not claim that restriction has changed or that it qualifies for a badge.

Official references: https://docs.squeekchain.com/developers/api/ and https://docs.squeekchain.com/developers/build-with-ai/ .

## Wallet and direct Sepolia integration

Open the Cloudflare URL in a browser with MetaMask, Rabby or another EIP-1193/EIP-6963 wallet. Connect, switch to Sepolia (`11155111` / `0xaa36a7`), and review the SIWE message. Regular EOA wallets are supported; contract-wallet signatures and WalletConnect mobile pairing are not included. A one-time five-minute nonce is bound to the game origin, wallet and Sepolia. The server recovers the signer, consumes the nonce atomically and creates a one-day HttpOnly/Secure/SameSite=Strict session. Private keys never enter the application. Account/network changes invalidate the browser session.

Sign in **before** starting a shared challenge. Submit its replay after finishing to save the checked result. Progress is restored by the same authenticated wallet on another device. Anonymous attempts cannot be attributed to an arbitrary wallet in the request body; wallet attempts require the same wallet session at submission. Public entries show a shortened verified address. Practice remains device-local. Game scores/progress are stored offchain in D1, not on Sepolia.

`/api/chain` reads Sepolia RPC at one block 12 blocks behind the tip, checks both EIP-1967 proxies, implementation bytecode hashes/versions/layouts, governance, graph links, core configuration, block-unit arithmetic and the certified frontier, then checks that block hash again. Mismatches fail closed. The approved deployment record and ABI snapshots are fetched from official documentation and committed in `evidence/`. Results cache for 45 seconds and display their checked time. Hardware API values and direct contract values are labelled separately; they are not assumed to describe the same frontier or installation. No API value is used to construct a transaction.

Production checks on 2026-11-05: signature login/session restore/logout succeeded using an ephemeral QA account; direct RPC graph verification succeeded. Automated tests additionally reject wrong signatures, reused/expired nonces, wrong domains, fake sessions, mismatched attempt owners and non-Sepolia RPCs. The app browser has no wallet extension, so the real MetaMask/Rabby approval UI still requires a user's wallet-equipped browser.
