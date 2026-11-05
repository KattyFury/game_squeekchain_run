# Squeek Run — handoff cho Claude Code

## 0. Cập nhật 2026-11-05 (Claude Code) — đọc cái này trước

Đã làm xong, đã deploy Cloudflare và push GitHub:

- **Host deploy contract, người chơi không deploy.** Đã bỏ nút deploy khỏi trang, đã **xóa endpoint `POST /api/onchain/activate`** (live trả 404) và `deploymentData` khỏi config. Deploy chạy bằng `scripts/deploy-score-contract.mjs <keys.env>` (cần `SQUEEK_RUN_DEPLOYER_KEY` trong keys file hoặc `DEPLOYER_PRIVATE_KEY`): deploy, xác minh runtime code + attestor, ghi D1, ghi `evidence/score-contract-deployment.json`. Key deployer chỉ trả gas, không có quyền gì trong contract.
- **Canonical contract đã live trên Sepolia:** `0xa565c3c3dcd77fcec0eb08bf3799a98cf94d3bed` (deploy tx `0xfd69c1118037acfbe281355b90b701853bc9f829c4a20cd006aef32b26ffe241`). Config live trả đúng contract + attestor `0x37b6…22B5`.
- **Đã chạy một vòng thật end-to-end trên live:** ví tạm → SIWE → replay witness được server kiểm (7409 điểm, hoàn thành) → attest → gửi `saveRun` → success, gasUsed ~364.6k → `/api/onchain/progress` đọc lại savedRuns=1. Tx: `0x9c5935d1b38e43c84184dd4ea81362fae60d75fa787f6c4152788042f2b1bdce`. Dòng QA đã xóa khỏi leaderboard; bản ghi onchain vẫn còn (không xóa được). **Vẫn chưa test bằng MetaMask thật trong trình duyệt.**
- **Giao diện làm lại:** game ở đầu trang, một nút ví gọn, kết quả + Save onchain chỉ hiện sau lượt chơi, status/onchain/luật nằm trong mục thu gọn. Giữ nguyên các `id` DOM.
- **Xử lý lỗi gas/lưu:** `onchain.js` giờ phân loại lỗi (từ chối ví, thiếu Sepolia ETH, nonce/pending, custom error của contract qua selector, mạng), estimate gas từ ví rồi +20%, và nếu tx lưu cũ bị revert thì xóa bản ghi pending để retry được. **Lỗi gas nguyên văn của user vẫn chưa nhận được**, nên chưa thể nói đó là nguyên nhân thật; gas thực tế mỗi lần lưu ~365k.
- **Luật đổi sang `wheel-3` (vật cản là khối đặc, đứng lên được).** Hạ từ trên xuống mặt trên khối (hoặc trong 6px) thì đứng lên khối, refill 2 lần nhảy, đi theo khối đến khi nó trôi qua rồi rơi xuống; đâm vào cạnh bên thì chết; đầu chạm đáy thanh lơ lửng chỉ bị chặn nhảy, không chết. Va chạm tính trong không gian bánh xe (góc × độ cao) nên mọi vật cản là hình chữ nhật, xem `solidsAtHamster` trong `simulation.mjs`. Tháp 88px không thể nhảy đơn qua/lên, cần nhảy đôi. Đã tái tạo `evidence/challenge.json` (id `a626cb84…`) và `route-witness.json`, thêm thử thách mới vào D1; `tests/patterns.test.mjs` viết lại theo mô phỏng chung, thêm `tests/solid.test.mjs`. 37/37 test pass. Chạy lại e2e live dưới wheel-3: save tx `0xbea415f099dc54fc0fb5559d4b0545310f6ef83388f5ebfd679588d78ba7394f`. Contract không đổi (rulesHash là tham số). Thử thách `wheel-2` cũ còn trong D1 nhưng không còn dùng được.
- **Con chuột vẽ lại** bằng pixel art sinh từ hình (tai, mắt, mõm, đuôi, 2 nhịp chạy + tư thế nhảy), xem `hamsterFrame` trong `game.js`.
- **Release Squeekchain mới (quan trọng).** Docs đã chuyển sang release `core-sepolia-20261103`; **mọi địa chỉ đã đổi** (Core `0xfd6c…e0c4`, Mining `0x2dcc…e218`, Token `0xd78a…a1e`, **NFT `0xC4C7…56B`**, thêm Staking và AuthMinter `0xE78B…B5F`). `evidence/sepolia-deployment.json` và ABI đã thay bằng bản docs hiện hành; `sepolia.mjs` đối chiếu cấu hình qua `launchConfiguration.core` và kiểm tra Staking trỏ đúng Core/Mining/Token (không còn `collectionPolicy`). `/api/chain` xác minh `verified:true` theo release mới, Squeek block 366 khớp với API phần cứng (chênh lệch cũ chỉ vì bản ghi lỗi thời). Nếu docs đổi lần nữa phải cập nhật lại các file này.
- **Bảng xếp hạng onchain:** `GET /api/onchain/leaderboard?challenge=<id>` đọc sự kiện `RunSaved` của score contract từ block deploy, lấy lượt tốt nhất mỗi ví (lọc theo `rulesHash` của luật hiện hành), cache 30 giây. UI: tab "Saved onchain" trong hộp Leaderboard, có link explorer cho ví và tx.
- **Perk người giữ Squeek NFT:** `holders.mjs` đọc `balanceOf` trên NFT (chỉ đọc). `GET /api/holder` (cần session) trả số Squeek của ví đang đăng nhập; ví giữ ≥1 thì chuột đội vương miện và tên ví hiện `✦ N Squeeks`. Bảng xếp hạng (cả hai tab) gắn huy hiệu ✦ cho ví giữ Squeek. Đã test thật: ví giữ 6 Squeek trả về 6.
- **Thử thách mới từ phần cứng (host-only):** `node scripts/publish-challenge.mjs <keys.env> [--publish]` lấy cửa sổ phần cứng liên tục mới nhất, dựng thử thách, **chứng minh qua được bằng solver** rồi mới ghi vào D1 (INSERT OR IGNORE, cùng cửa sổ thì cùng id). Không có `--publish` là chạy thử. Chạy lúc làm: cửa sổ mới nhất vẫn là `a626cb84…` (04:15 UTC), chưa có cửa sổ mới hơn nên chưa đăng gì thêm. **Chưa có lịch chạy tự động**: cần cron trên VPS/máy host, vì solver quá nặng cho Workers Free. `/api/challenge` luôn trả thử thách mới nhất. Cron của Worker không còn gọi `refreshChallenge` (trước đây khi dữ liệu phần cứng đổi nó lỗi và làm bỏ qua bước dọn dẹp).
- **Lịch tự động trên VPS (thử thách mới từ phần cứng).** VPS của host (thông tin kết nối ở `VPS_*` trong keys file, không ghi vào repo) chạy `squeek-run-publish.timer` (systemd, mỗi 6 giờ lúc :07 UTC) → `squeek-run-publish.service` → `scripts/publish-remote.mjs`. Script lấy cửa sổ phần cứng mới nhất; nếu `/api/challenge` đã có đúng id đó thì thoát ("up to date"), nếu khác thì chạy solver, rồi gửi bằng chứng tới `POST /api/admin/publish` (Bearer token). **Worker tự dựng lại thử thách từ API phần cứng và tự kiểm tra bằng chứng trước khi ghi D1**, nên token lộ cũng chỉ đăng được thử thách đã xác minh; VPS **không giữ token Cloudflare**. Token là `SQUEEK_RUN_PUBLISH_TOKEN` (keys file) = Worker secret `PUBLISH_TOKEN`; trên VPS ở `/opt/squeek-run/publish.env` (600, root). Mọi thứ nằm trong `/opt/squeek-run` (Node v24 tự chứa ở `node/`, repo ở `app/`, service chạy `DynamicUser`, tự `git pull` trước mỗi lần chạy). Xem log: `journalctl -u squeek-run-publish -n 20`; chạy tay: `systemctl start squeek-run-publish`; xem lịch: `systemctl list-timers squeek-run-publish.timer`. Đã kiểm tra: chạy thật trên VPS (up to date), endpoint từ chối token sai (401) và bằng chứng giả (422). **Chưa từng đăng thử thách mới bằng dữ liệu thật** vì phần cứng chưa tạo cửa sổ liên tục mới hơn 04:15 UTC 2026-11-05.
- **Một màn hình, không cuộn** (desktop 1920/1440/1366, điện thoại 390/360 dọc, 844×390 ngang đều đã đo: không tràn dọc/ngang). Khung game là vùng giữa 560×440 của canvas, co theo chỗ còn lại; Leaderboard và Info nằm trong `<dialog>`. **Mobile chơi bằng chạm:** chạm bất cứ đâu trong vùng game = Space (start/nhảy/nhảy đôi/chơi lại); chữ trên canvas đổi thành TAP trên thiết bị cảm ứng. Giao diện tối giản: header (tên + ví), game, thanh dưới (mode, Best, Leaderboard, Info).
- Sửa lỗi tham chiếu `saved` chưa khai báo trong `loadChallenge` (game.js).
- Git root đã sạch và đồng bộ với GitHub (bản cũ nằm trong stash cục bộ, không cần). `npm ci` trên Windows cần `--force` vì `fsevents` (chỉ macOS) trong cây Ganache.

Còn lại: test bằng ví trình duyệt thật + lấy lỗi gas của user; npm audit Ganache; IMD/Genesis (mục 11). Các mục 1, 6, 7 bên dưới là bản gốc trước handoff, phần đã làm được đánh dấu ở trên.

Ngày: 2026-11-05, Asia/Bangkok. Đây là trạng thái thực tế và yêu cầu tiếp tục, không phải tuyên bố sản phẩm đã hoàn thiện.

## 1. Việc cần sửa đầu tiên theo phản hồi cuối của Hiếu

1. **Host deploy một score contract duy nhất. Người chơi không tự deploy.** Bản hiện tại sai UX: đưa nút `Deploy score contract · Sepolia` lên trang game công khai. Phải bỏ luồng này khỏi trang người chơi và chuyển việc deploy/activate sang quy trình vận hành của host. Không chỉ ẩn bằng CSS: kiểm tra cả API activation, quyền và config.
2. **Có lỗi gas do user báo, chưa biết nguyên văn và chưa chẩn đoán.** Agent đã hỏi lỗi xuất hiện khi Deploy hay Save và xin nguyên dòng thông báo; chưa nhận trả lời. Không tự kết luận là thiếu ETH, không tăng gas limit mù, không tuyên bố đã sửa.
3. **Làm lại giao diện.** User chê giao diện hiện tại. Trang đang xếp các khối ví, RPC, deploy, onchain và hướng dẫn kỹ thuật dài phía trên game, đẩy phần chơi xuống thấp. User muốn game gọn, đẹp, dễ chơi; không phải trang quản trị hoặc bảng debug.
4. **Web3/onchain là yêu cầu thực chất.** Chỉ dùng ví đăng nhập + lưu database là chưa đáp ứng. Kết quả đã xác minh cần có thể ghi lên Sepolia và đọc lại, có transaction/explorer thật.
5. Tiếp tục source hiện có; ưu tiên chất lượng và đưa bản sửa lên live sớm để user kiểm tra. Không dừng ở plan hoặc demo giả.

Chưa sửa các điểm 1–3 ở trên trước handoff. User yêu cầu bàn giao cho Claude Code.

## 2. Đường dẫn, Git, trạng thái bàn giao

- Thư mục user chỉ định: `D:\Files\Claude\game_squeekchain_run`.
- GitHub public: https://github.com/KattyFury/game_squeekchain_run
- Commit code gần nhất đã push: `61115d2` — `Add Sepolia onchain score contract and wallet deployment/save flow`.
- Commit trước: `4754b92` — wallet sign-in/progress + Sepolia contract reads.
- **Checkout đã commit/push và sạch khi bắt đầu handoff:** `D:\Files\Claude\game_squeekchain_run\work\site-publish`.
- Trong checkout này remote tên `github`, branch `main`; không giả định có remote `origin`.
- Source files đã được copy về thư mục gốc user chỉ định, nhưng **Git metadata ở root chưa cập nhật**: sandbox Windows chặn ghi `.git/FETCH_HEAD`/index bằng ACL Deny dù đã xin quyền. Không reset/clean root: có thể làm mất source mới. Đối chiếu root và GitHub trước khi pull. Checkout `work\site-publish` chứa lịch sử đã cập nhật và dùng để làm việc trong session này.
- Không thay ACL hệ thống để né hạn chế. Claude Code có quyền khác thì kiểm tra lại, không giả định lỗi vẫn còn.
- Quy tắc user: mở repo phải fetch/pull; xong phải push, không để commit chỉ ở local. Repo/clone mới mặc định tại `D:\Files\Codex\build_for_me\small_tool\<project>`, nhưng dự án hiện tại user đã chỉ định đường dẫn riêng như trên.

## 3. Link sản phẩm và page để tham khảo

### Sản phẩm đang chạy

- **Bản chính trên Cloudflare:** https://squeek-run-api.kattyfury1403.workers.dev/
- Bản Sites cũ: https://squeek-run-test.plaidspice8.chatgpt.site/
- User muốn Cloudflare/GitHub; không quay về lấy `chatgpt.site` làm link chính. GitHub hiện lưu source, không phải GitHub Pages hosting.

### Design / gameplay

- **Design system bắt buộc:** https://github.com/KattyFury/repo_personal_design
- Local design repo: `D:\Files\Claude\repo_personal_design`.
- Đọc `README.md`, `tokens.json`, `web.css`; dùng profile compact. `design-tokens.css` trong game là snapshot của `web.css`, có version/hash ở đầu file.
- Tham khảo cảm giác đơn giản và pixel đen trắng của Chrome Dino: mở `chrome://dino` trên Chrome. **Không clone đổi nhân vật rồi gắn API.** Hamster ở trong bánh xe là gameplay riêng.
- Chưa có một page tham khảo UI khác được user duyệt. Không tự nói user đã chọn một theme/framework/template khác.

### Squeekchain — nguồn chính thức, phải đọc lại hiện hành

- https://docs.squeekchain.com/
- https://docs.squeekchain.com/developers/
- **API:** https://docs.squeekchain.com/developers/api/
- **Kiểm tra contract graph/RPC:** https://docs.squeekchain.com/developers/quickstart/
- **Build with AI:** https://docs.squeekchain.com/developers/build-with-ai/
- Toàn bộ docs dạng text: https://docs.squeekchain.com/llms-full.txt
- Deployment record: https://docs.squeekchain.com/assets/deployments/sepolia.json
- SqueekCore ABI: https://docs.squeekchain.com/assets/abi/SqueekCore.json
- SqueekMining ABI: https://docs.squeekchain.com/assets/abi/SqueekMining.json
- Genesis/IMD: https://squeekchain.com/genesis/code — web search không đọc được nội dung page trong session này; quy định submission hiện hành chưa được xác minh đầy đủ.

### Tài liệu tech

- Cloudflare Workers config: https://developers.cloudflare.com/workers/wrangler/configuration/
- D1 Worker API: https://developers.cloudflare.com/d1/worker-api/d1-database/
- SIWE: https://eips.ethereum.org/EIPS/eip-4361
- OpenZeppelin ECDSA/EIP-712: https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography
- Viem: https://viem.sh/docs/contract/writeContract

## 4. Tech stack và file map

**Không dùng React/Next.js/Vite.** Frontend là HTML + CSS + JavaScript ES modules, Canvas 2D, không framework. `npm run build` chỉ copy 8 assets vào `dist/`.

| File | Vai trò |
|---|---|
| `index.html` | Page duy nhất của game; UI cần thiết kế lại |
| `style.css` | Layout, compact styles, monochrome |
| `design-tokens.css` | Snapshot design-system v3, không tải remote CSS runtime |
| `game.js` | Canvas, keyboard Space, mode, API polling, submit replay |
| `engine.mjs` | Geometry, polygon collision, patterns, live measurement parsing |
| `simulation.mjs` | Mô phỏng xác định dùng chung client/server, rules `wheel-2`, 120 Hz |
| `challenge.mjs` | Chuyển lịch sử passage hardware thành challenge/timeline/hash |
| `wallet.js` | EIP-1193/EIP-6963, đổi Sepolia, SIWE, session/progress |
| `wallet-auth.mjs` | Nonce/chữ ký/session phía server |
| `onchain.js` | Luồng deploy đang đặt sai trên homepage; Save onchain; tx receipt/progress |
| `onchain.mjs` | Config canonical contract, activate validation, server EIP-712 attestations, onchain reads |
| `sepolia.mjs` | RPC read/verify graph SqueekCore/SqueekMining theo deployment record |
| `worker.mjs` | Cloudflare Worker API + ASSETS + cron |
| `wrangler.jsonc` | Worker, static assets, D1 binding, cron, observability |
| `migrations/0001_leaderboard.sql` | Challenge, attempts, entries, rate limits |
| `migrations/0002_wallet.sql` | Nonces/sessions, wallet ownership on attempts/entries |
| `migrations/0003_onchain.sql` | Canonical score-contract config |
| `contracts/SqueekRunScores.sol` | Contract riêng của game, không phải contract Squeekchain |
| `contracts/artifacts/SqueekRunScores.json` | ABI + creation/runtime bytecode đã compile |
| `scripts/compile-contract.mjs` | solc compile, optimizer 200, EVM Paris |
| `scripts/build.mjs` | Copy static assets vào dist |
| `scripts/cloudflare.mjs` | Đọc keys file theo path tham số, truyền env cho Wrangler |
| `scripts/solve-route.mjs` | Tìm witness vượt toàn bộ challenge để kiểm thử |
| `server.mjs`, `local-db.mjs` | Local HTTP + Node SQLite mô phỏng D1 API |
| `tests/*.test.mjs` | 30 automated tests |
| `evidence/` | Captured API, challenge/witness, deployment/ABIs và RPC verification snapshot |

Versions đã pin trong `package.json`/lockfile:

- Node.js **24+** (local server dùng `node:sqlite`).
- `viem` **2.57.16**.
- `@openzeppelin/contracts` **5.6.1**.
- Dev: `solc` **0.8.38**, `ganache` **7.9.2**.
- Wrapper deploy gọi `wrangler@4.157.0` qua npx.

Ganache là dev/test-only, không bundle lên Worker/browser. Npm audit có báo nhiều advisory trong cây Ganache/bundled dependencies, kể cả lần chạy `--omit=dev`; **chưa xử lý**, không được tuyên bố dependency audit sạch. Node 24 thiếu binary µWS tương ứng nên Ganache fallback JS; test EVM vẫn pass.

## 5. Hosting, keys, tài nguyên thật

- Cloudflare Worker: `squeek-run-api`.
- Worker domain: `squeek-run-api.kattyfury1403.workers.dev`.
- D1: `squeek-run-leaderboard`.
- D1 ID: `f2d2c573-afc8-4a9d-9704-3b40ef823105`.
- Binding `DB`, assets binding `ASSETS`, `run_worker_first: ["/api/*"]`.
- Migration 0001, 0002, 0003 đều đã apply remote.
- Cron mỗi 30 phút chỉ refresh/validate hardware challenge + cleanup DB; không tự tạo giao dịch.
- Plan Workers Free. Cấu hình `limits.cpu_ms` từng làm deploy fail vì Free không cho đặt CPU limit; đã bỏ. Không tự nâng plan trả phí.
- `wrangler.jsonc` compatibility date: `2026-11-05`.

**Kho key duy nhất user yêu cầu dùng trực tiếp:** `D:\Files\Claude\A\keys.env`.
Desktop `keys.lnk` trỏ tới file này. **Không tạo/copy sang `.Codex/secrets.env`**; user đã sửa rõ yêu cầu này. Không in giá trị key, không đưa vào Git, docs hay frontend.

Tên biến có dùng:

- `CF_API_TOKEN`, `CF_ACCOUNT_ID`: Cloudflare.
- `SQUEEK_RUN_ATTESTATION_KEY`: khóa mới riêng cho service chứng thực replay; đã append vào **file keys.env hiện có** và lưu Cloudflare Secret cùng tên. Đây là khóa service, không phải ví user/deployer, không có tiền, không dùng gửi giao dịch.
- Public attestor: `0x37b6E7582e84790c9F741A728443C66fB01122B5`.
- Không cần lấy hoặc log các khóa ví, trading bot hay dịch vụ khác có trong file chung.

Lệnh vận hành, chạy từ checkout đúng:

```powershell
npm ci
npm run contract:compile
npm test
npm run build
node scripts/cloudflare.mjs 'D:\Files\Claude\A\keys.env' d1 migrations apply squeek-run-leaderboard --remote
node scripts/cloudflare.mjs 'D:\Files\Claude\A\keys.env' deploy
```

`npm start` dùng localhost:8787. Lưu ý local `server.mjs` chưa load service-attestor env từ keys file: endpoint onchain local có thể báo chưa config nếu không truyền `SQUEEK_RUN_ATTESTATION_KEY`. Cần kiểm tra/fix local workflow, không hiểu nhầm là production secret thiếu.

## 6. Trạng thái onchain thật — quan trọng nhất

Đã gọi lại API ngay khi bắt đầu handoff:

- `GET /api/onchain/config`: HTTP 200, chainId `11155111`, attestor như trên, **`contract: null`**.
- Nghĩa là **chưa có canonical score contract deploy/activate trên Sepolia**.
- Source/ABI/bytecode + API + UI đã deploy lên Cloudflare, **không đồng nghĩa contract đã deploy**.
- Không có transaction hash deploy hoặc save-score thành công trên Sepolia để bàn giao.
- Agent chưa gửi giao dịch từ ví user. Không tự dùng private key user hoặc tạo paid IMD job.

Contract hiện có:

- `SqueekRunScores`, deploy constructor nhận service attestor.
- Chỉ chainId 11155111.
- `saveRun(result, signature)` yêu cầu `msg.sender == result.player`.
- EIP-712 domain `SqueekRunScores` / version `1` / chain / verifying contract.
- Payload: player, challengeId, rulesHash, replayHash, runId, score, ticks, completed, deadline.
- Chống lưu trùng runId; expiry; score/tick bounds; ECDSA low-s từ OpenZeppelin.
- Lưu `bestScores[wallet][challenge][rules]`, `savedRuns`, `usedRunIds`; emit `RunSaved` cho từng kết quả.
- Không có quyền upgrade, withdraw hoặc rotate signer. Nếu cần rotate key phải deploy contract mới; đánh giá lại quyết định này trước khi triển khai host.
- Đây là **server-attested game score**, không phải trustless replay proof hay SqueekCore-certified work.

API onchain:

- `GET /api/onchain/config`: public ABI, attestor, contract, runtimeHash; khi chưa có contract còn trả deploymentData.
- `POST /api/onchain/activate`: hiện cho **bất kỳ ví đã SIWE** kích hoạt nếu creation receipt/from, runtime code và attestor đúng. Đây là một phần của luồng sai cần sửa thành host-controlled.
- `POST /api/onchain/attest`: đòi session đúng ví sở hữu entry; server chạy lại replay rồi ký payload một giờ; trả calldata.
- `GET /api/onchain/progress`: đọc savedRuns/best từ contract qua RPC.

**User yêu cầu host chịu việc deploy một lần.** Tách public gameplay khỏi deployment. Xác định host wallet và bước ký cụ thể khi cần, chuẩn bị transaction có thể review, không tự sử dụng tiền/ví nào chỉ vì có key chung. Người chơi chỉ ký save-score (hoặc cân nhắc relayer/gas sponsorship sau khi thống nhất phạm vi/chi phí).

## 7. Lỗi gas và các điểm cần kiểm tra

Lỗi gas của user **chưa có nguyên văn hoặc receipt**. Chưa biết là thiếu balance, estimate revert, provider, wrong chain hay lỗi payload. Đừng lấy các lỗi dev bên dưới làm chẩn đoán lỗi user.

Những gì biết từ code:

- Deploy client gọi `eth_estimateGas`, rồi `eth_sendTransaction` với `{from,data,value:0}`; không set gas/fee thủ công.
- Save client gọi `eth_call` preflight, rồi `eth_sendTransaction` với calldata server cung cấp.
- Error handling chủ yếu hiện `e.message`, có thể quá dài/thô; cần phân loại user-rejected, insufficient test ETH, revert custom error, RPC/network, pending/replaced tx.
- Pending deploy/save tx được lưu localStorage để tránh gửi trùng. Receipt reverted có thể để pending record tồn tại và cản retry; cần xử lý rõ, chỉ clear sau khi xác định trạng thái.
- Một wallet đã đổi chain/account giữa quá trình phải xử lý session/transaction đúng; không tự gửi lại khi outcome chưa rõ.
- Trong local Ganache test, deployment qua Viem cần gas explicit; test đã dùng gas 2,000,000 và write 500,000. **Đây không chứng minh gas limit của production nên là các số đó.**

## 8. Gameplay và Squeekchain hiện có

Yêu cầu không được làm mất:

- Hamster bên **trong đáy bánh xe**, vị trí 6 giờ; nhảy lên phía tâm, trọng lực xuống đáy.
- Ẩn nửa trên bánh xe.
- Space để start/jump/retry, double jump tối đa hai lần, chạm đất hồi; key repeat không auto-jump.
- Pixel đen trắng tối giản; ground/paired/tower và floating bars ở 70/128px, có đoạn phải không nhảy.
- Hitbox/physics ổn định, tránh pattern bất khả thi, không biến hình chướng ngại trước mặt.
- Toàn bộ UI/error/accessibility bằng **English**.

Ba mode:

1. Practice: random seed, best localStorage, không trộn ranked.
2. Shared recorded hardware: immutable challenge 60s, cùng seed và speed samples cho mọi người, server replay-check.
3. Live current hardware: `/v1/status`, chỉ fresh accepted hardware ACTIVE; idle/error/stale/epoch change freeze. Không coi lỗi API là 0 RPM hoặc hamster đang nghỉ.

API thật đã kiểm tra:

- https://api.squeekchain.com/v1/status
- https://api.squeekchain.com/v1/measurement/runs?limit=100
- Schema runs: `measurement-runs.v1`, authority `pi-device-key`, `certifiedCoreWork: false`.
- Challenge đang live: `b039a62d2d8ecb95ea848d1ee1d75f7312e2c409c0da9081b25736d88bbbe310`, rules `wheel-2`, 7200 ticks/60s, installation `sepolia-core-sepolia-20261103`.
- Capture, challenge và full-route witness nằm trong `evidence/`.
- Mapping hiện tại: `clamp(1.1 / passageIntervalSeconds, 0.55, 1.4)` rad/s, smooth 2/120 mỗi tick. Gap >3s hoặc continuity break tách cửa sổ; cần >=30s, tối đa 60s.
- Cron chỉ admit source khớp approved challenge/witness; chưa tự động tạo vô hạn challenge mới. Đừng quảng cáo dynamic daily challenge nếu chưa làm.
- Test full route qua nhiều seed/chuyển tốc độ là sampled coverage; không phải bằng chứng mọi chuỗi live tương lai đều khả thi.

Onchain Squeekchain read:

- `sepolia.mjs` dùng public RPC `https://ethereum-sepolia-rpc.publicnode.com`.
- SqueekCore trong deployment record: `0x74665dAecA35A2303e767E76a2FF1FB6F93e119f`.
- Đọc tại ETH tip-12, check chain, proxy slots, implementation code/hash/version/layout, governance, graph, configuration, block arithmetic/certified frontier và đọc lại block hash.
- `/api/chain` đã trả `verified:true` thật. Không đồng nhất API hardware frontier với contract frontier: đã quan sát API báo khoảng 366 trong khi direct RPC graph báo Squeek block 13095. UI hiện ghi hai nguồn riêng; cần đánh giá installation/deployment liên quan trước khi tuyên bố chúng là cùng dữ liệu.
- Chưa có giao dịch SqueekCore, mint, claim hay reward.

## 9. Ví và backend replay

- EIP-1193/EIP-6963 wallets, MetaMask/Rabby/browser wallet.
- Chỉ EOA signatures; chưa WalletConnect mobile hoặc ERC-1271 smart wallets.
- SIWE nonce 5 phút, domain/URI + Sepolia, verify EIP-191, consume nonce atomic.
- Cookie session 1 ngày, HttpOnly/Secure/SameSite=Strict; account/chain changes invalidate.
- Client replay ghi tick Space; server không tin client score; replay phải kết thúc ở collision hoặc hết challenge.
- D1 lưu challenge/attempt/entry/replay. Attempt wallet binding, expire 15 phút, stream payload bounds, rate budgets, idempotent submission.
- Leaderboard alias là tên hiển thị; signed-in entries có wallet. Replay validation không chống bot hoàn toàn.
- Signed-in shared run: submit replay trước, sau đó mới có attestation để save onchain.
- Practice progress hiện vẫn local, không tự đồng bộ mọi mode hoặc resume giữa chừng qua wallet.

## 10. Kiểm thử đã làm và giới hạn

- **30/30 tests pass** ở lần chạy gần nhất.
- Contract được thực thi trên **local Ganache EVM**: valid write, event/storage, best preservation, forgery, wrong player/chain-domain/contract, expiry, duplicate rejection.
- Backend attestation test kiểm tra wallet ownership và recompute replay, không nhận client score.
- Production SIWE nonce/signature/session/logout đã HTTP smoke-test bằng account QA ephemeral; không dùng ví user.
- Production `/api/chain`, `/api/challenge`, `/api/onchain/config` đã kiểm tra HTTP thật.
- Browser đã xem thấy `Connect wallet`, Sepolia RPC status và nút deploy sai hiện tại. Browser trong app không có wallet extension, nên **chưa kiểm thử toàn chuỗi MetaMask user thật → Sepolia deploy → save → receipt**.
- Chưa có score contract Sepolia hoặc onchain score thật.
- Chưa chẩn đoán lỗi gas user báo.
- UI chưa được user chấp nhận; không gọi là đã polish/hoàn thiện.

## 11. IMD / Genesis — chưa làm

- Chưa tạo IMD swarm job, thanh toán hoặc submission.
- **Trước job đầu tiên phải nhắc user: trả bằng ví thường (EOA) đã verified trên Genesis profile. Ví trả job đầu xác định chủ dự án.**
- User cung cấp thông tin direct submissions từ domain riêng đang tạm dừng. Phải kiểm tra lại quy định hiện hành trước khi submit; agent chưa xác minh đã mở lại.
- Không hứa badge hoặc eligibility. Không tạo giao dịch, thanh toán hoặc job trả phí nếu chưa được phép.

## 12. Trình tự tiếp tục đề xuất

1. Fetch/pull checkout đúng; đọc source và deployment config hiện hành.
2. Sửa public UI: game ở vị trí chính, một wallet action gọn; mode/score/hướng dẫn ngắn; result + save nằm sau lượt chơi; diagnostics/docs trong details hoặc trang riêng. Loại deploy/admin khỏi homepage.
3. Thiết kế host-only deployment và activation, deploy một canonical contract sau bước user ký/cho phép cụ thể; verify receipt/code/attestor, lưu address vào config, không để người chơi trả phí setup.
4. Lấy nguyên văn lỗi gas/provider/chain/address công khai/tx hash nếu có; reproduce, simulate/estimate trước khi sửa.
5. Test người chơi thật: connect/sign in → chơi → server replay check → Save onchain → wallet confirm → receipt → reload đọc lại state/tx event.
6. Run relevant tests, review dev dependency issues, build, deploy Cloudflare, push GitHub, báo rõ phần thực sự chạy và phần còn chờ.

Không tạo lại mọi thứ từ đầu nếu chưa có lý do. Các lỗi UX và phạm vi hiện tại cần sửa thẳng, không tiếp tục bảo vệ các quyết định cũ của agent.
