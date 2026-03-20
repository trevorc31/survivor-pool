# Survivor Pool Tracker — March Madness 2026

## Project Overview
A React + Next.js web app that tracks a March Madness survivor pool for ~30 participants. Two modes: a public shared dashboard and a password-protected personal strategy view for the pool admin (Trevor).

## Core Features
1. **Pick Tracking** — Per-player history of picks across all tournament days, with duplicate detection (can't use a team twice)
2. **Live Results** — Pulls NCAA tournament scores and auto-resolves pick outcomes. One loss = eliminated for the day.
3. **Buy-Back System** — Players can buy back in up to 3 times (before first Sunday). Buy-backs require 4 picks instead of the normal 1-2. Each costs $5 on top of the $15 buy-in.
4. **Used Teams Tracker** — Shows every team each player has burned, organized by-player and by-team
5. **Edge Lab (personal only)** — Strategy calculator combining win probabilities, tournament depth (futures odds), and uniqueness vs the pool
6. **Money Tracker** — Tracks pot size, buy-back costs, and per-player totals
7. **Password Protection** — Shared mode is default. Personal mode (Edge Lab, strategy cards) requires password.

## Tech Stack
- Next.js (React) with App Router
- Tailwind CSS for styling  
- Vercel for hosting (free tier works fine)
- Data stored in a JSON file or simple database (Vercel KV or just a JSON file in the repo for now)

## Data Model
Each player has a `history` array:
```json
{
  "name": "Trevor",
  "me": true,
  "history": [
    { "dayId": "day1", "picks": ["St. Louis", "Wisconsin"], "buyBack": false },
    { "dayId": "day2", "picks": ["Santa Clara", "Texas Tech", "Iowa", "UCLA"], "buyBack": true }
  ]
}
```

The `computePlayer()` function auto-derives: used teams, total buy-backs, day results, elimination status, money owed, and next-day pick requirements.

## Rules Reference
- Can only pick a team ONCE during the entire tournament
- Can buy back in up to 3 times
- Can't buy back in after the first Sunday (3/22)
- Thursday: pick 2 teams
- Friday: 2 if advancing, 4 if buying back
- Saturday: 1 if advancing, 4 if buying back
- Sunday: 1 if advancing, 4 if buying back (LAST buy-back day)
- After Sunday: 1 pick per day until winner or no teams left
- ONE loss on any day = eliminated for that day

## Live Score Integration
Use the SportRadar NCAA Men's Basketball API (or similar) to pull game results. Key requirement: must catch ALL games including ones not in the main feed (e.g., Virginia vs Wright State was missed initially — cross-reference with ESPN/NCAA.com).

## Deployment Plan
1. `npx create-next-app@latest survivor-pool` 
2. Port the React component into the Next.js app
3. Add a simple API route for updating picks/results
4. Deploy to Vercel
5. Share the URL with the group

## File Structure Target
```
/app
  /page.tsx          — Main tracker component (shared mode default)
  /api/picks/route.ts — API for submitting/updating picks
  /api/scores/route.ts — API for fetching live scores
/data
  /players.json      — Player data
  /results.json      — Game results per day
/lib
  /compute.ts        — computePlayer() and helpers
  /edge.ts           — Edge calculator logic
  /futures.ts        — Futures odds data
```

## Current Status
- Day 1 (Thu 3/19): Complete. Results final.
- Day 2 (Fri 3/20): In progress. Some games finished, evening games pending.
- The full React component with all data is in `survivor_tracker.jsx`
