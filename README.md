# Gridiron Dex

A Pokédex-style roster browser for **Madden NFL 27 ratings**, with retro pixel art
(Retro Bowl-ish player sprites, Game Boy-era UI) and **pixel-art portraits made from
nflverse headshots**. This is the base layer for a new football game: the data,
the depth charts and the art pipeline.


## Run it

No build step and no server needed. Open `index.html` in a browser.
(Or `python3 -m http.server` and go to http://localhost:8000.)

- **DEX**: every player in the file (1,941). Filter by team, position or position group,
  search, sort, or show starters only (★). Each entry has:
  - a pixelated nflverse headshot on a team-colour background
  - a Pokémon-style "type" (PASSER, RUSHER, RECEIVER, WALL, RUSH, HUNTER, COVER, BOOT) and side
  - bio: height, weight, age, college, experience, draft (from nflverse), handedness, archetype
  - a generated dex flavour line built from the player's best ratings
  - **Abilities** (X-Factor and Superstar) with descriptions
  - **all ~55 ratings**, grouped (Physical, Passing, Rushing, Receiving, Blocking, Defense,
    Kicking). Groups that fit the position show first. Weekly ▲/▼ changes are shown when present.
- **STARTING 22**: the team's 11 offence (11 personnel) and 11 defence (4-3) on a pixel field,
  plus K, P and LS. Click any sprite to open that player's dex entry.
- **GB PALETTE**: re-renders every portrait in the 4-shade Game Boy green palette.
- Keys: **UP/DOWN** browse the list, **LEFT/RIGHT** switch teams.

## How it works

```
data/raw/Madden_27_Ratings.xlsx ─┐
nflverse players.csv ────────────┼─► tools/build_data.py ─► js/data.js
nflverse teams_colors_logos.csv ─┘
                                     tools/bake_headshots.py ─► js/headshots.js (optional)
```

### `tools/build_data.py`
- Matches each Madden player to nflverse by **birthdate + last name**, then birthdate + first
  name, then name + team. 1,940 of 1,941 players match. The match adds the gsis/ESPN ids,
  headshot URL and draft info.
- Builds depth charts (rank by OVR within each Madden position) and picks the **starting 22**
  per team, falling back to a nearby position when a team has no one listed there
  (for example, no SAM linebacker).
- Uses nflverse team colours for helmets, jerseys and portrait backgrounds.
- Writes `js/data.js` as a plain script, so the page works from `file://`.

Rebuild after you drop in a new ratings week:

```bash
pip install pandas openpyxl
python3 tools/build_data.py path/to/new_ratings.xlsx
```

### Headshots → pixel art
Each portrait comes from the first source that works:
1. **Pre-baked** in `js/headshots.js` (offline, fastest). Generate it with:
   ```bash
   pip install pillow
   python3 tools/bake_headshots.py              # all players, about 2 MB
   python3 tools/bake_headshots.py --team BUF   # one team
   python3 tools/bake_headshots.py --size 48 --colors 12
   ```
   Raw downloads are cached in `data/headshot_cache/` (git-ignored).
2. **Live in the browser**: loads the nflverse headshot URL, crops to the face, downscales to
   40×40, reduces it to a 16-colour palette (k-means) and adds a 1px sprite outline. If the image
   host does not allow canvas reads (CORS), you still get the downscaled pixel grid, just
   without palette reduction.
3. **Placeholder**: a team-colour pixel helmet.

## Files

| Path | What |
|---|---|
| `index.html`, `css/style.css` | Pokédex-style UI shell |
| `js/app.js` | list, detail page, Starting 22 field, filters, keyboard |
| `js/sprites.js` | procedural pixel sprites (player front/back, helmet, jersey numbers) in team colours |
| `js/portrait.js` | headshot → pixel portrait pipeline (16-colour or Game Boy) |
| `js/data.js` | generated data bundle (players, teams, abilities, lineups) |
| `js/headshots.js` | optional pre-baked portraits |
| `tools/` | Python build scripts |

## Ideas for the game layer
`window.DEX_DATA` already holds everything a sim needs: `teams[abbr].lineup` (slot → player id),
`players[].stats`, and `abilities`. `Sprites.drawPlayer(ctx, team, number, x, y, scale, 'back'|'front')`
draws on-field sprites in any team's colours.

Data: ratings from the supplied Madden NFL 27 spreadsheet. Player ids, headshots and team colours
from [nflverse](https://github.com/nflverse/nflverse-data).
