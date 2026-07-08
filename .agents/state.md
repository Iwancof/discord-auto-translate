updated: 2026-07-08 15:40 JST
branch: main
phase: 1 (コアscaffold: Codex背景実行中) → 2 (表示方式の実装)

## Accepted Decisions
- スタック: Node22 + TypeScript + discord.js v14 + openai SDK + better-sqlite3 + vitest
- 表示方式(ユーザ裁定 2026-07-08): **非対称**
  - 非英語(ja等)の投稿 → 自動で英語訳をチャンネルに公開返信(翻訳中は sendTyping で「入力中」表示)
  - 英語の投稿 → botが「🌐 Translate」ボタンを自動添付、押した人にだけ ephemeral で母語訳
- 対象: botが読める全チャンネル
- デプロイ: このPCで systemd 常駐(--user + linger)。将来Proxmox移設の可能性あり
- trivial除外: ヒューリスティック(短文/スラング) + 翻訳コール内で SKIP 判定(追加APIコールなし)
- コードブロック/添付は翻訳対象外
- **翻訳バックエンド変更(ユーザ指示 15:35): OpenAI → Claude API(Anthropic)。安価モデル指定 → `claude-haiku-4-5`($1/$5 per MTok, 最速)。ANTHROPIC_API_KEY / ANTHROPIC_MODEL env。thinking無し・max_tokens小さめで低レイテンシ**
- トークン受領済み: `~/WorkSpace/Discord/auto-translate/.discord-bot-token` と `.claude-token`(.env へ転記する。内容をログに出さない)
- 言語設定: /language set|show、デフォルト en、SQLite永続化

## Do Not Repeat
- 全メッセージに公開返信を双方向で出す方式は却下(チャンネルが翻訳だらけになる)
- 「自動・本人だけ・チャンネル汚さず」は Discord 仕様上不可能(ephemeralはinteraction応答限定) — 再検討しない

## Next Steps
1. Codex phase1 の回収・レビュー(background task b5xeihkob)
2. phase2 委譲: OpenAI→Anthropic SDK 置換(claude-haiku-4-5) / AutoReplyDelivery(ja→en, sendTyping) / ButtonDelivery(en→母語 ephemeral, 翻訳キャッシュ) / systemd unit / README更新
3. .env 設定(受領済みトークンを転記。DISCORD_CLIENT_ID は Developer Portal から要取得の可能性)
3b. **ユーザ裁定(15:42): 実装完了後にプロジェクトを `~/WorkSpace/Discord/auto-translate/` へ移設する**(実装中は現在地のまま)
4. 実サーバで動作確認 → checkpoint commit → systemd 常駐化

## Constraints & Pending Verifications
- トークン類未受領(ユーザが順次投下予定)。キー無しでもビルド/テストが通ることが完了条件
- OpenAI モデル名 gpt-4.1-mini の現行可用性は .env で差し替え可能にして吸収
- MESSAGE CONTENT intent を Developer Portal で ON にする必要あり(ユーザ作業)
