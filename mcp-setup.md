# Stitch MCP setup

Configure the Stitch MCP server in the AI client used to run `auto-cms`. This project intentionally does not ship client-specific live configuration because Codex, Claude Code, Cursor, IDE extensions, Antigravity, and other MCP hosts use different config locations and formats.

## Connection contract

Use these values in the client's MCP settings:

| Field | Value |
|---|---|
| Name | `stitch` |
| Transport | Streamable HTTP / HTTP MCP |
| URL | `https://stitch.googleapis.com/mcp` |
| Header name | `X-Goog-Api-Key` |
| Header value | A private Google Stitch API key |

Prefer a secret manager or environment variable named `STITCH_API_KEY`. Never commit the key to `auto-cms`, CMS source, MCP JSON/TOML, prompts, logs, screenshots, or run artifacts.

Any key pasted into chat or other shared text must be revoked and replaced before use.

## Generic JSON example

Use this shape only when the client supports JSON MCP configuration and environment-variable interpolation:

```json
{
  "mcpServers": {
    "stitch": {
      "type": "http",
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "X-Goog-Api-Key": "${STITCH_API_KEY}"
      }
    }
  }
}
```

Clients may call `type` `http`, `streamable-http`, or expose it as a UI transport selector. Follow the client's current MCP documentation instead of copying an unsupported field.

## Generic TOML example

Use this shape when the client supports TOML and environment-backed HTTP headers:

```toml
[mcp_servers.stitch]
url = "https://stitch.googleapis.com/mcp"

[mcp_servers.stitch.env_http_headers]
"X-Goog-Api-Key" = "STITCH_API_KEY"
```

Do not replace `env_http_headers` with a static `http_headers` value in a tracked file. If a client lacks environment-backed headers, enter the key through its local secret/settings UI or an ignored user-local config.

## Client setup procedure

1. Create a new restricted Stitch API key. Do not reuse a key exposed in chat or source control.
2. Open the client's MCP settings or documented MCP config file.
3. Add a remote HTTP server using the connection contract above.
4. Store the key in the client's secret store or set `STITCH_API_KEY` before launching the client.
5. Restart the client or reload its MCP servers. Most hosts discover MCP tools at session startup.
6. Approve the project/server if the client requires trust confirmation.
7. Confirm that `stitch` is connected and list its available tools.
8. Run a harmless design/project listing or metadata operation before starting the full theme workflow.

## Using auto-cms

Start the agent only after Stitch MCP is connected, then provide a prompt like:

```text
Sử dụng automation tại E:\Project\auto-cms để xây theme hoàn chỉnh cho task:
<ERP_TASK_URL>

Sử dụng Stitch MCP đã cấu hình cho giai đoạn thiết kế. Chạy đến khi tạo được theme ZIP hợp lệ hoặc automation trả về NEEDS_HUMAN.
```

The agent must read this file during preflight, verify the `stitch` server and required tools are available, then run the automation workflow. Do not silently replace Stitch MCP with browser automation.

## Expected failures

- `STITCH_AUTH_REQUIRED`: no API key or the client did not attach the header.
- `STITCH_MCP_UNAVAILABLE`: server initialization or tool discovery failed.
- `STITCH_PERMISSION_DENIED`: key restrictions, project access, or API enablement is incorrect.
- `STITCH_RATE_LIMITED`: retry with backoff; do not create duplicate projects blindly.
- `STITCH_APPROVAL_REQUIRED`: the MCP host requires the user to trust or enable the server.

When a failure occurs, keep the current run resumable and stop before the design stage. Never write credentials into a recovery report.

## Security checklist

- Restrict the API key to the minimum usable Google API/project scope.
- Keep MCP transport on HTTPS.
- Never expose the MCP header in debug logs.
- Redact request headers from error reports.
- Rotate keys periodically and immediately after suspected exposure.
- Review generated designs before publishing assets containing customer data.
