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

```bash
himalaya --account zoho list --folder INBOX -o json | jq '[.[] | select((.flags // []) | index("Seen") or index("seen") or index("\\Seen") | not)]'
```

For each unseen email, capture: `id`, `from`, `subject`, `date`.

### 2. Register a kanban ticket (BEFORE processing)

For each unread email, immediately create a tracking ticket so it appears in
the dashboard:

```bash
TICKET=$(curl -s -X POST http://localhost:3000/api/kanban/ticket \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"📧 ${SUBJECT}\",
    \"description\": \"From: ${FROM}\nReceived: ${DATE}\n\nProcessing...\",
    \"status\": \"todo\",
    \"priority\": \"medium\",
    \"assigneeId\": \"clawbot\"
  }")
TICKET_ID=$(echo "$TICKET" | jq -r '.id')
```

Save `TICKET_ID` — you need it for updates.

### 3. Read the full email body

```bash
himalaya --account zoho read --folder INBOX -o json "${EMAIL_ID}"
```

Extract: full body text, any attachments.

### 4. Mark the email as seen (to avoid re-processing)

```bash
himalaya --account zoho flag add --folder INBOX "${EMAIL_ID}" seen \Seen
```

### 5. Fulfill the request

Analyze the email body and complete the requested task using available skills.
Common request types:
- **Article request** → use `ondemand-content-writer` skill
- **Lead research** → use `lead-gen-researcher` skill
- **SEO analysis** → use `seo-geo` or `serp-content-agent` skill
- **General question** → answer directly in the reply

Update the ticket to reflect what you're working on:

```bash
curl -s -X PATCH "http://localhost:3000/api/kanban/ticket/${TICKET_ID}" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"in-progress\", \"description\": \"From: ${FROM}\n\nTask: ${TASK_DESCRIPTION}\nStatus: Working...\"}"
```

### 6. Reply to the sender

Compose and send the reply using himalaya MML:

```bash
himalaya --account zoho reply --folder INBOX "${EMAIL_ID}" << 'MML'
<#part type=text/plain>
Hi,

${YOUR_RESPONSE_HERE}

Best regards,
TBS Marketing Agent
<#/part>
MML
```

### 7. Mark ticket as done

```bash
curl -s -X PATCH "http://localhost:3000/api/kanban/ticket/${TICKET_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"done\",
    \"workState\": \"done\",
    \"workResult\": \"Replied to ${FROM}. Task: ${TASK_SUMMARY}\",
    \"description\": \"From: ${FROM}\nReceived: ${DATE}\n\n${TASK_SUMMARY}\n\nReplied: $(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }"
```

### 8. Handle errors

If any step fails, update the ticket with the error instead of leaving it stuck:

```bash
curl -s -X PATCH "http://localhost:3000/api/kanban/ticket/${TICKET_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"review\",
    \"workState\": \"failed\",
    \"workError\": \"${ERROR_MESSAGE}\"
  }"
```

## Notes

- The `himalaya --account zoho` account name must match your himalaya config.
  Check with `himalaya accounts` if unsure of the account name.
- Always create the ticket BEFORE processing so the dashboard shows the email
  immediately, even if the task takes a long time.
- If `TICKET_ID` is empty (API unreachable), log the error but continue
  processing and replying — don't block email handling on dashboard failures.
- Process emails oldest-first so older requests get handled before newer ones.
