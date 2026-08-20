# OrynthLabs — Product Context

**This is the canonical description of what this product is.** It is tracked in
git, so it travels with the repo. Read it before changing the domain model,
scoring, or anything user-facing.

---

## Orynth is not us

**Orynth** is a separate company: a launchpad for real, actively-built online
products — early-stage MVPs, live tools, products in active development. It
provides the underlying economic and launch infrastructure.

**OrynthLabs** (this repo; originally "Orynth Founder OS") is our product. It
integrates *into* Orynth and owns the company-building workflow surrounding it.

> Founder OS creates better companies. Orynth creates markets around those
> companies.

Practical consequence: `ORYNTH_API_KEY` and `ORYNTH_API_BASE_URL` are
**external partner credentials**, obtained through Orynth's partner process.
The base URL is still the placeholder `api.orynth.example`.

This repo previously described itself as a "launch intelligence workspace for
tracking launch candidates". That framing came from the original scaffold and
was wrong. It has been corrected throughout.

---

## The loop

```
DISCOVER → BUILD → DESIGN → LAUNCH → GROW
    ↑                                  │
    └────── outcomes feed back ────────┘
```

### 1. Discover — Opportunity Intelligence
Continuously scans the technology, crypto and consumer ecosystem to find where
capital is moving, what developers are building, which narratives have
attention but no product, and where existing products fail users. The output is
not startup ideas; it is structured **Build Opportunities** — market gaps that
increasingly look worth building into, each with an opportunity score, a "why
now", the signals behind it, the observed gap, possible products, potential
users, monetization paths, and Orynth economic fit.

### 2. Build — Product Intelligence
A founder claims an opportunity or brings an existing product, then connects
website, GitHub, docs, socials, analytics, users and revenue. The system builds
a **Company Graph**: founder, product, technology, users, competitors, market,
community, revenue model, development activity, distribution, narratives.

### 3. Design — Launch & Economic Readiness
Not every product should launch a token. Readiness is scored on six axes —
Product, Founder, Market, Community, Distribution, Economic Design — into a
composite, with a recommendation of **launch now**, **build further**, or **do
not tokenize yet**. Where a launch is warranted, the Economic Design Studio
shapes token purpose, founder economics, treasury, incentives, utility and fee
strategy.

### 4. Launch — Orynth Launch Engine
Hands off to Orynth. The founder should not have to move manually between
strategy tools, token tools and launch interfaces.

**OrynthLabs holds no launch authority.** Launches execute on the Orynth
platform, so no `poolCreator` or `launcher` key belongs on our side. The
signing subsystem inherited from the original scaffold was removed on
2026-08-19; this repo contains no key material and no signing code.

### 5. Grow — Company Growth Intelligence
Monitors both sides after launch — product (users, retention, revenue, shipping
velocity) and market (holders, volume, liquidity, wallet quality, attention) —
and surfaces **divergences**, e.g. product adoption up 42% while attention is
down 18% (an under-discovered company), or token volume up 310% while product
usage and dev activity fall (market running ahead of fundamentals).

Outcomes feed back into Discover: the system learns which opportunities
actually produced valuable companies. That feedback loop is the long-term moat.

---

## The five signal families

Everything ingested belongs to one of these. They are **evidence families**,
not source systems.

| Family | Covers |
| --- | --- |
| `attention` | X, Reddit, search, news, YouTube, communities, narrative velocity |
| `builder` | GitHub, new repos, package downloads, hackathons, dev job demand, new APIs and frameworks |
| `capital` | Onchain flows, VC funding, token activity, stablecoin movement, TVL, wallet behaviour |
| `consumer` | Product adoption, app rankings, search behaviour, usage, complaints, reviews |
| `market_structure` | Competitors, missing infrastructure, pricing gaps, poor UX, unserved users, regulatory change |

---

## Two principles that constrain the code

**1. Intersections, not single signals.** A single trending hashtag is weak
evidence. Strength comes from developer activity **and** capital flowing
**and** consumer demand **and** inadequate existing products.

This is why corroboration is measured across *families* and never across two
APIs within one family — two market-data vendors reporting the same liquidity
move is one fact, not two. Enforced in `src/server/scoring/thresholds.ts` and
`readiness.ts`.

**2. "Do not tokenize yet" is a first-class outcome.** A token should amplify a
product's economy, not replace it. Tokenization is never the goal, and the
model must always be able to say no. Enforced by `LaunchRecommendation`.

---

## What the model looks like, and why

| Decision | Reason |
| --- | --- |
| Entities are `opportunity` **or** `company` | A Build Opportunity has no company behind it yet |
| `slug` is identity; `symbol` and `chain` are nullable | Most tracked products have no token, and some correctly never will. `symbol` was once `NOT NULL` and the upsert key, which made the primary input unstorable |
| Readiness is six axes, not one score | One number cannot say *which* axis holds a company back |
| An unmeasured axis is `null`, never `0` | "We have not researched this" and "this is bad" are different claims |
| Signals carry a signed `scoreDelta` | Severity says how *notable* a signal is, not whether it is good. An archived repo and a commit surge are both "high" |
| No signing keys live here | Launches are Orynth's to execute; holding authority we never use is pure liability |
| Scoring output never re-enters `signal_events` | It fed scoring its own output; the table doubled every run |
| In `market_structure`, the sign inverts | An *absence* of maintained solutions is the positive finding — it is the "existing solution coverage: low" claim every Build Opportunity rests on |
| Entities carry a `market_topic` | A company's market is not its codebase, and an opportunity has no codebase at all |

---

## Not yet built

- The Idea Marketplace itself — nothing currently *generates* Build Opportunities
- Company Graph ingestion (stage 2)
- The Economic Design Studio, so `economicDesign` always scores `null`
- Ingestion for `attention` and `consumer` families; `builder` (GitHub),
  `capital` (Helius) and `market_structure` (npm registry) exist today

---

## Maintaining this document

Update it in the same change that alters what it describes — a domain-model
change, a new signal family, a new stage going live, or a shift in the thesis.
It is the first thing a new engineer or agent should read, so a stale claim
here is more expensive than a stale comment in code.

`details.md` (gitignored, local) mirrors this in its §0 and holds the running
build log; this file is the canonical, shareable copy.
