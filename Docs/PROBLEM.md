# The Problem

## Personal context

I save a lot. Articles I want to read later, products I'm considering, quotes that resonate, recipes I might try, random ideas that flash by. My bookmarks bar is hundreds of items deep. My Pocket account has thousands of unread articles. My Notes app has screenshots I took three months ago and can no longer place.

The pattern is always the same: **I save the *thing* but not the *why*.** A week later I open the bookmark and stare at it. Was this for a project? A gift? Something someone mentioned? I can't remember. So I either re-read the whole page to rediscover my reason, or — more often — I close the tab and the thing stays saved forever, never revisited.

This is a silent productivity tax. The act of saving is supposed to reduce cognitive load ("I don't have to remember this right now") but without context, the tax just defers to later, compounding.

## Why existing tools don't solve it

I've used — and paid for — most of them:

| Tool | What it does | Why it doesn't solve the problem |
|------|-------------|----------------------------------|
| Chrome Bookmarks | Saves URL + title | No reason, no structure, no retrieval |
| Pocket | Saves articles for reading | Reading queue ≠ reflection; no "why" |
| Raindrop.io | Bookmarks with tags and folders | Manual tagging = friction; tags don't capture intent |
| Notion / Obsidian | Full-featured knowledge bases | Too heavy; by the time I've created a page I've lost the moment |
| Readwise | Highlights from books and articles | Only captures highlights; doesn't work for arbitrary saves |

The shared failure: **they all require manual categorization at save time**, which is exactly the moment the user has the least willingness to do anything extra. Or they skip categorization entirely and offer search as consolation — which only works if you remember enough keywords to find what you've forgotten.

## What I actually wanted

Two things, both cheap at the moment of capture:

1. **A place to write the reason in my own words**, even one sentence, while the context is still in my head.
2. **Automatic categorization** so I don't have to think about taxonomy.

That was the brief I gave myself. The rest of this project is the implementation.

## Scoping decisions

I deliberately said *no* to things that would have expanded scope without solving the core problem:

- **No collaboration / sharing.** This is a personal reflection tool. Multi-user adds auth, permissions, conflict resolution — all orthogonal to "why did I save this."
- **No mobile app.** Most of my saving happens on desktop during research. Mobile would require a whole second codebase for 20% of the use case.
- **No social layer.** I don't want to know what other people save, and I don't want them to see mine.
- **No AI chat interface.** The LLM is a classifier here, not a conversational partner. Adding chat would dilute the focus.
- **No account system.** My captures live on my machine with optional personal-project Supabase sync. No server to run, no users to manage.

Each of these would be a defensible feature in isolation. Together they'd make Intent a different product — one that exists already (Notion, Evernote) and doesn't solve the problem I actually have.
