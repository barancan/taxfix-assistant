# Assistant skills

The assistant is a generic chat **host**; every product capability is a
**skill**. V1 ships one skill — **invoice** (outgoing invoice creation). The
architecture exists so new capabilities (e.g. the V1.1 roadmap item
*incoming-invoice review*) are added as new skills that reuse the same corpus,
deterministic engine patterns, extraction service, BYOK, and review-case flow.

## Structure

```
src/skills/
  types.ts        # the skill contract (SkillDefinition, ChatHost, bindings)
  registry.ts     # ordered list of skills; host renders whatever is registered
  invoice/        # skill #1
    index.tsx     # definition: id, intro, examples, card renderer
    useInvoiceSkill.tsx  # conversation flow (React hook over ChatHost)
    facts.ts      # collected state + payload builders (Zod-bound)
    examples.ts   # demo presets (outcome-tagged pills)
    Cards.tsx     # skill-specific structured cards
```

## The contract (`src/skills/types.ts`)

A skill provides:

- `id`, `title`, `intro` — identity and the first assistant message.
- `examples` — outcome-tagged example prompts (green = success, yellow =
  escalation, red = denied) that the host shows above the chat input.
- `useSkill(host)` — a React hook that drives the conversation. It receives a
  `ChatHost` (say / youSaid / showCard / setTyping / byok / finishFlow) and
  returns live bindings: sticky header chips, the current interactive card, an
  optional footer action, the input spec, and handlers.
- `renderCard(type, props)` — renders the skill's structured transcript cards
  (messages store only serializable `{skillId, type, props}`).

The **host** (`src/app/assistant/page.tsx`) owns everything cross-cutting: the
transcript, typing indicator, free-chat fallback (`/api/chat`), BYOK recovery,
archiving ("Continue to chat"), and reset.

## Adding a skill

1. Create `src/skills/<name>/` with a definition + flow hook + cards.
2. Register it in `src/skills/registry.ts`.
3. Its examples appear automatically; the host needs no changes.
4. Tag server calls with the `x-skill: <name>` header so the agent trace
   attributes actions correctly.

Rules that apply to every skill (see [trust-boundary.md](./trust-boundary.md)):
the LLM only extracts and phrases; legally material facts are confirmed by the
user via cards; decisions come only from deterministic server services; fail
closed.

## General questions (host-level, retrieval-grounded)

Free text that isn't skill intent is routed through the structured answer
endpoint (`/api/chat`). The flow is **retrieval-grounded**:

1. **Retrieve** — lexical retrieval (`src/domain/knowledge/retrieve.ts`, no vector
   DB) over the curated knowledge base (`src/knowledge/entries.json`) returns the
   most relevant entries for the question.
2. **Ground** — the retrieved entries' text + their citation ids become the model's
   grounding; it may answer ONLY from that material and cite ONLY those ids.
3. **Gate** — the answer is shown only when it is **grounded**
   (`topScore ≥ KNOWLEDGE_RELEVANCE_MIN`, default 0.15) **and** the model is
   confident enough (`≥ ANSWER_CONFIDENCE_THRESHOLD`, default 0.65) **and** it
   produced a valid citation. Otherwise it is suppressed and the subject is
   **raised to a human** (review case).

**Knowledge base** (`src/knowledge/entries.json`, versioned + `check:knowledge`):
every entry is curated and cites official corpus sources (which back the shown
citations); scope is `explained` or `general_guidance`. Adding coverage = adding
an entry (+ any new official source under `src/corpus/`) — no code change.

Citations are never invented (the server drops any id not in the committed
corpus). Model self-confidence only ever *suppresses* general answers; it never
feeds tax decisions. Each query logs `retrieved […] grounded=… confidence=… ≥/<
threshold=…` to the agent trace.

## Agent trace

Server terminal logs show skill actions, model queries, and responses in plain
language (`[agent] ▶ invoice · extract — asking anthropic/claude-sonnet-5: …`).
Controlled by `AGENT_TRACE` (default: on in development, off in production).
Keys, auth headers, and file bytes are never logged.
