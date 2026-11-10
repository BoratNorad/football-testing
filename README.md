# Gridiron Dex

A Pokédex-style roster browser for **Madden NFL 27 ratings**, with retro pixel art,
**16-bit portraits made from nflverse headshots**, per-team depth charts and an
original **passive/active ability system** where every ability has a pixel badge
and an animated demo play. This is the base layer for a new football game.

## Run it

No build step and no server needed. Open `index.html` in a browser.
(Or `python3 -m http.server` and go to http://localhost:8000.)

### DEX
Every player in the file (1,941). Filter by team, position or position group, search,
sort, or show starters only (★). Each player page has:
- a **16-bit pixel portrait** (64×64, about 40 colours) built from the nflverse headshot
- a Pokémon-style type (PASSER, RUSHER, RECEIVER, WALL, RUSH, HUNTER, COVER, BOOT), side, depth slot,
  and **league rank at the position** (e.g. "#1 of 92 QB")
- bio: height, weight, age, college, experience, draft (nflverse), handedness, archetype
- **Base stats**: a six-axis hexagon radar built from that position's key ratings, plus a percentile
- **Abilities**: badge cards. Click a badge for a description and a looping demo play
- **all ~55 ratings** as bars, with groups that fit the position first. Weekly ▲/▼ changes shown
- the original Madden 27 X-Factor and Superstar abilities, listed separately

### DEPTH CHART
Every position (QB … LS) as its own card, players ranked by OVR, with their ability
badges. Pick **ALL** to see the league's top 12 at each position. Click a player to open his page.

Keys: **UP/DOWN** browse, **LEFT/RIGHT** switch teams, **ESC** closes the ability popup.

## Ability system (`js/abilities.js`)

| Kind | Badge | How it works |
|---|---|---|
| **Passive** | rounded square | Always on. |
| **Active** | hexagon, 1–2 pips | Triggered mid-play by spending **momentum** bars. |
| **Signature** | gold starburst, crown | Players rated 88+ get a unique, named move (e.g. *Allen Two-Minute Drill*) that needs a full meter. |

**Momentum meter:** 3 bars. Big plays (15+ yd gain, sack, takeaway, 3rd-down stop, TD) fill 1 bar.

- 56 original abilities across QB, RB/FB, WR/TE, OL, DL, LB, DB and K/P/LS, each with its own 12×12 pixel icon.
- Every player gets **1 passive and 1–2 actives**. Picks are based on what he is good at *compared with
  others at his position* (z-score), so the ability mix varies across the roster.
- **Tier I / II / III** comes from his actual ratings, and effect sizes scale with the tier
  (e.g. *Ankle Breaker III: defender stumbles for 1.2 sec*).
- To add or tweak an ability, add a `def({...})` entry: stat weights, icon, colour, demo play, tier values.

### Demo plays (`js/plays.js`)
There are 18 mini-plays, one per ability type: deep pass, quick pass, scramble, pass pro, juke, spin,
truck, stiff arm, speed burst, contested catch, pancake, sack (with an optional strip),
big hit/fumble, interception, lockdown, field goal, punt and kick return. The player is the hero,
in his own team colours and number, against the most visually different opponent. Actives fire at the play's key moment:
time slows, the meter drains, and the badge and call-out pop. Passives glow for the whole play.

## Data pipeline

```
data/raw/Madden_27_Ratings.xlsx ─┐
nflverse players.csv ────────────┼─► tools/build_data.py ─► js/data.js
nflverse teams_colors_logos.csv ─┘
                                     tools/bake_headshots.py ─► js/headshots.js (optional)
```

- `build_data.py` matches Madden players to nflverse by birthdate + name (1,940 of 1,941 match),
  adds ids, headshot URL, draft info and team colours, and builds depth charts.
  Rebuild with `python3 tools/build_data.py path/to/new_ratings.xlsx` (needs pandas and openpyxl).
- **Headshots → pixel art**, from the first source that works:
  1. pre-baked `js/headshots.js`: run `python3 tools/bake_headshots.py` (Pillow) for offline use
  2. live in the browser: face crop → 64×64 → vibrance boost → 40-colour k-means → 1px outline
  3. a team-colour helmet placeholder

## Files

| Path | What |
|---|---|
| `index.html`, `css/style.css` | UI shell |
| `js/app.js` | dex list and player page, radar, depth chart, ability popup |
| `js/abilities.js` | ability library, assignment, pixel icons and badges |
| `js/plays.js` | demo play engine and the 18 mini-plays |
| `js/sprites.js` | pixel player sprites (front/back, run frame), helmets, numbers |
| `js/portrait.js` | headshot → 16-bit portrait pipeline |
| `js/data.js` | generated data bundle |
| `tools/` | Python build scripts |

Data: ratings from the supplied Madden NFL 27 spreadsheet. Player ids, headshots and team colours
from [nflverse](https://github.com/nflverse/nflverse-data).
