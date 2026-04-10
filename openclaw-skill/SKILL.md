---
name: email-processor
description: >
  Process incoming emails for TBS Marketing. Reads new emails from
  agent@tbs-marketing.com via himalaya, creates a ClawPanel kanban ticket
  for each request, fulfills the task, then replies and marks the ticket done.
  Use when the email-check cron fires or when asked to "check email" or
  "process email requests".
---

# Email Processor — TBS Marketing

Process new email requests from `agent@tbs-marketing.com`, track each one as a
ClawPanel kanban card, fulfill it, reply, and mark it complete.

## ClawPanel API

ClawPanel runs at **http://localhost:3000** on this server.

| Action          | Method | URL                                    |
|-----------------|--------|----------------------------------------|
| Create ticket   | POST   | http://localhost:3000/api/kanban/ticket |
| Update ticket   | PATCH  | http://localhost:3000/api/kanban/ticket/{id} |

## Step-by-step workflow

### 1. Fetch unseen emails

Use `search` rather than `list` to only fetch unread messages, returning just the newest emails:

```bash
himalaya --account zoho search "UNSEEN" --folder INBOX -o json | jq '[.[] | select((.flags // []) | index("Seen") or index("seen") or index("\\Seen") | not) | select(.from | tostring | test("agent@tbs-marketing.com|mailer-daemon|postmaster"; "i") | not) | select(.subject | tostring | test("automatic reply|auto-reply|out of office|delivery status notification"; "i") | not)]'
```

For each unseen email, capture: `id`, `from`, `subject`, `date`.

**EXTREMELY CRITICAL:** Check the sender and subject manually. If the email is from `agent@tbs-marketing.com` itself, `mailer-daemon`, or `postmaster`—or if the subject contains "Out of office", "Automatic Reply", or "delivery status"—you MUST immediately skip processing. DO NOT create a ticket, DO NOT generate a response, and DO NOT reply. Just mark it as read using the `flags add` command from Step 4 and move to the next email.

### 2. Register a kanban ticket (BEFORE processing)

For each unread email, immediately create a tracking ticket so it appears in
the dashboard:

```bash
TICKET=$(jq -n \
  --arg title "📧 ${SUBJECT}" \
  --arg desc "From: ${FROM}\nReceived: ${DATE}\n\nProcessing..." \
  '{title: $title, description: $desc, status: "todo", priority: "medium", assigneeId: "clawbot"}' | \
  curl -s -X POST http://localhost:3000/api/kanban/ticket \
    -H "Content-Type: application/json" \
    -d @-)
TICKET_ID=$(echo "$TICKET" | jq -r '.id')
IS_DUPLICATE=$(echo "$TICKET" | jq -r '.duplicate // false')
```

**CRITICAL RULE:** If `IS_DUPLICATE` is `"true"`, this means the email was already processed in a previous run but failed to be marked as seen. You MUST skip this email entirely and NOT reply to it or process it again. Move on to the next email.

Save `TICKET_ID` — you need it for updates.

### 3. Read the full email body

```bash
himalaya --account zoho read --folder INBOX -o json "${EMAIL_ID}"
```

Extract: full body text, any attachments.

### 4. Mark the email as seen (to avoid re-processing)

Use `flags add` to mark the email as seen. You MUST wrap `\Seen` in quotes so the shell does not strip the backslash:

```bash
himalaya --account zoho flags add --folder INBOX "${EMAIL_ID}" "\Seen" || \
himalaya --account zoho flags add --folder INBOX "${EMAIL_ID}" "seen" "\\Seen" || true
```

### 5. Check Ticket Status & Fulfill Request

Before doing heavy work, update the ticket to reflect you've started:

```bash
UPDATE_RES=$(jq -n \
  --arg status "in-progress" \
  --arg desc "From: ${FROM}\nReceived: ${DATE}\n\nTask: ${TASK_DESCRIPTION}\nStatus: Working..." \
  '{status: $status, description: $desc}' | \
  curl -s -X PATCH "http://localhost:3000/api/kanban/ticket/${TICKET_ID}" \
    -H "Content-Type: application/json" \
    -d @-)
```

**CRITICAL RULE:** If `UPDATE_RES` contains `"Ticket not found"`, this means the user deleted the ticket on the dashboard to cancel this task. You **MUST STOP** processing this email immediately. Do not generate reports, do not execute skills, and DO NOT reply. Skip to the next email.

If the ticket updated successfully, analyze the email body and complete the requested task using available skills.
Common request types:
- **Article request** → use `ondemand-content-writer` skill
- **Lead research** → use `lead-gen-researcher` skill
- **SEO analysis** → use `seo-geo` or `serp-content-agent` skill
- **General question** → answer directly in the reply

### 6. Verify Ticket Status & Reply to the sender

Before sending the email (in case the user deleted the ticket while you were working), quickly do a dummy patch to verify it still exists:

```bash
FINAL_CHECK=$(curl -s -X PATCH "http://localhost:3000/api/kanban/ticket/${TICKET_ID}" \
  -H "Content-Type: application/json" -d '{}')
```

**CRITICAL RULE:** If `FINAL_CHECK` contains `"Ticket not found"`, the user cancelled the task mid-way. You **MUST STOP** now and DO NOT send the reply. Skip to the next email.

If the ticket check succeeds, compose a professional, well-structured reply. For complex reports (like SEO analysis or content generation), break it down, delegate sub-tasks to the appropriate sub-agents, monitor them until work is complete, and then you MUST use basic HTML formatting (like `<h3>`, `<strong>`, `<ul>`, `<li>`, `<a>`). DO NOT wrap your response in ````html` markdown blocks, DO NOT include `<html>`, `<head>`, or `<body>` tags. Only provide the raw inner HTML content.

Execute the following `bash` command directly using the `bash` tool. **DO NOT wrap your response in ````bash` or ````html` markdown block formatting inside the heredoc. NO HTML TAGS like `<html>` or `<body>`.** Ensure the email client correctly interprets your reply as `text/html`. Substitute your HTML directly into the heredoc block. **DO NOT attempt to use a `write` tool to save your reply to a file.**

```bash
himalaya --account zoho reply --folder INBOX "${EMAIL_ID}" << 'MML'
<#part type="text/html">
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
  <p>Hi,</p>
  
  ${YOUR_RAW_INNER_HTML_RESPONSE_HERE}

  <br>
  <p>Best regards,<br>
  <strong>TBS Marketing AI Agent</strong><br>
  <a href="https://tbs-marketing.com">tbs-marketing.com</a></p>
</div>
<#/part>
MML
```

### 7. Mark ticket as done

```bash
jq -n \
  --arg status "done" \
  --arg ws "done" \
  --arg result "Replied to ${FROM}. Task: ${TASK_SUMMARY}" \
  --arg desc "From: ${FROM}\nReceived: ${DATE}\n\n${TASK_SUMMARY}\n\nReplied: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{status: $status, workState: $ws, workResult: $result, description: $desc}' | \
  curl -s -X PATCH "http://localhost:3000/api/kanban/ticket/${TICKET_ID}" \
    -H "Content-Type: application/json" \
    -d @-
```

### 8. Handle errors

If any step fails, update the ticket with the error instead of leaving it stuck:

```bash
jq -n \
  --arg status "review" \
  --arg ws "failed" \
  --arg err "${ERROR_MESSAGE}" \
  '{status: $status, workState: $ws, workError: $err}' | \
  curl -s -X PATCH "http://localhost:3000/api/kanban/ticket/${TICKET_ID}" \
    -H "Content-Type: application/json" \
    -d @-
```

## Notes

- The `himalaya --account zoho` account name must match your himalaya config.
  Check with `himalaya accounts` if unsure of the account name.
- Always create the ticket BEFORE processing so the dashboard shows the email
  immediately, even if the task takes a long time.
- If `TICKET_ID` is empty (API unreachable), log the error but continue
  processing and replying — don't block email handling on dashboard failures.
- Process emails oldest-first so older requests get handled before newer ones.
