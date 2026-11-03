# Squeek Run — local prototype 0.1

Run: Node.js 20+ installed, open terminal here and run npm start. Visit http://127.0.0.1:8787. Alternatively double-click start.bat. Space starts, jumps and restarts; holding Space does not auto-repeat.

Original monochrome canvas art. Hamster stays inside the bottom of the rotating wheel. Obstacles rotate on the inner rim. Jump uses vertical gravity, fixed 120Hz simulation and polygon-vs-box collision. Practice accelerates from 0.8 to 1.4 rad/s; live maps measured speedMmPerSecond / 1000 into 0.55–1.4 rad/s. This mapping is a game-design choice, not the wheel's real angular speed.

## Verification — 2026-11-04 Asia/Saigon

GET https://api.squeekchain.com/v1/status returned HTTP 200 and Access-Control-Allow-Origin: *. Snapshot saved in evidence/status-live.json. Observed schemaVersion 1; measurement provenance hardware, freshness online, coreStatus IDLE, rpmMilli 0. Oracle accepted. Settled block from builder.anchor: 7661. Browser fetch also displayed hardware 0 RPM, block 7661. This verifies the API response/integration, not the physical hamster independently; device signatures and contracts are not independently verified by this prototype.

Official schema/field semantics: https://docs.squeekchain.com/developers/api/ . receivedAt and staleAfterSeconds enforce freshness. rpmMilli / 1000 = RPM. cumulativeWorkUnits is parsed as BigInt, epoch-scoped; never equated to distance or settled work. Projected builder values are not consumed. The anchor label means API-reported settled frontier, not a direct RPC confirmation by this client.

Live only starts from accepted, fresh hardware with ACTIVE status and positive speed. If hamster rests, connection fails, or data expires, live freezes without advancing score. Counter epoch change requires Space to start a new run. Practice is explicitly LOCAL, has a separate local best, and does not silently change into live. Unknown/simulated/stale/faulted data is rejected. Poll every 2.5s, conditional ETag, timeout 8s, Retry-After on 429/503.

## Scope

Playable local prototype, not an IMD swarm job or submitted product. No wallet connection, payments, transactions, SQK prizes, historical replay, public leaderboard or claim of Builder eligibility. Next product work: tune art/physics through playtesting, then carry the concrete project into IMD's verified workflow.

## Tests

Run npm test. Tests cover captured real schema, stale/simulated/faulty rejection, deterministic obstacles, speed cap and collision/jump clearance. Browser checked Space start/jump/restart, ground collision, API fetch, mobile and desktop layout. Full live movement could not be observed because the real hamster was idle during verification.

## Hidden upper wheel update
Only the lower semicircle is visible. Obstacles change height (20–36), width (12–28), and angle (+/-0.3 radians per slot) while hidden above. Three bounded slots guarantee over one second between obstacle centers at maximum game speed. Practice uses a new crypto-generated seed each run; live uses sampled work as the initial seed. No live movement is fabricated.

## Double jump
Space can be pressed twice per flight. Landing restores both jumps; key repeat is ignored. 40% of generated barriers have two stacked tiers (96–104px), above the ~79px single-jump apex. Delay the second press to gain enough height. Two small marks under the hamster show jumps remaining. Angular jitter reduced to +/-0.2 rad to preserve landing time between barriers.

## Three-lane obstacle groups
Six authored patterns mix ground pairs, a narrowed 88px double-jump tower, lane-2 floating bars (70px lift), lane-3 bars (128px lift), and floor-plus-ceiling combinations. Floating bars are solid collision surfaces, not decoration. A thin support line is decorative. Groups reroll only when their full geometry is hidden in the upper semicircle. Ground/air combinations replace independent random placement to avoid full-height walls. Each pattern is searched for a Space-only route using the same 120Hz jump and polygon collision at 0.55, 0.8, 1.1 and 1.4 rad/s. This is sampled-speed per-pattern coverage, not a proof for all changing-speed sequences.
