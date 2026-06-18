# Stunt Car Racer — Complete Game Reference

> Amiga version (1989) by Geoff Crammond / MicroStyle  
> Research compiled from: Wikipedia, StrategyWiki, C64-Wiki, Lemon Amiga, Amiga Magazine Rack, How To Retro, Highway Forever, Amiga Reviews, TopGear, GamesNostalgia, and the original game manual.

---

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [Development History](#2-development-history)
3. [Platforms & Release Dates](#3-platforms--release-dates)
4. [Main Menu & Screen Flow](#4-main-menu--screen-flow)
5. [Controls](#5-controls)
6. [Gameplay Mechanics](#6-gameplay-mechanics)
7. [HUD / Cockpit Display](#7-hud--cockpit-display)
8. [The League System](#8-the-league-system)
9. [Track Reference](#9-track-reference)
10. [Damage System](#10-damage-system)
11. [Boost System](#11-boost-system)
12. [2-Player Link Mode](#12-2-player-link-mode)
13. [Graphics & Technical](#13-graphics--technical)
14. [Audio](#14-audio)
15. [Reception & Legacy](#15-reception--legacy)
16. [Media & Screenshots](#16-media--screenshots)
17. [Sources](#17-sources)

---

## 1. Game Overview

**Stunt Car Racer** is a one-on-one 3D racing game set on elevated, roller-coaster-style tracks suspended high above the ground. The player races from a first-person cockpit view against a single AI opponent per race. All tracks lack side barriers — the only boundary is the edge of the track itself, and falling off means plummeting to the ground (and incurring severe damage or instant death).

The game is built around a season-based league structure with four divisions plus a Super League. Each division has two tracks and three drivers (including the player). The goal is to climb from Division 4 to Division 1, become champion, and then conquer the Super League.

Key mechanical pillars:
- **Physics-based driving** — a true spring-mass suspension simulation; the car pitches, rolls, and bounces realistically.
- **Chassis damage accumulation** — hard landings punch holes in the frame that carry over across the entire season.
- **Limited turbo boost** — a finite resource per race; strategic deployment is essential.
- **Elevated tracks with no barriers** — one wrong move and the car falls into the void.

---

## 2. Development History

| Detail | Info |
|---|---|
| Developer | Geoff Crammond (solo) |
| Development period | ~3 years (approx. 1986–1989) |
| Original platform | Atari ST and Amiga (developed simultaneously; Crammond ported both himself) |
| Prior work | *Aviator* (BBC Micro, 1983), *Revs* (BBC Micro, 1985) |

Geoff Crammond had previously built *Revs*, a landmark 3D Formula 1 simulator for the BBC Micro (1985), which was his second car-racing title after the Spitfire sim *Aviator* (1983). Stunt Car Racer was his third major title.

The cross-platform 2-player link cable mode was directly inspired by Crammond's experience implementing serial data output in *Aviator* for the BBC Micro. This allowed him to connect an Amiga to an Atari ST over a null modem cable — cross-platform multiplayer in 1989.

The Amiga and Atari ST versions were the **last platforms to be completed** and were programmed by Crammond himself. The C64 and DOS versions were ported by other programmers.

---

## 3. Platforms & Release Dates

| Platform | Publisher (UK) | Publisher (US) | Year |
|---|---|---|---|
| Amiga | MicroStyle (MicroProse) | MicroPlay (MicroProse) | 1989 |
| Atari ST | MicroStyle | MicroPlay | 1989 |
| Commodore 64 | MicroStyle | MicroPlay | 1989 |
| MS-DOS (PC) | MicroStyle | MicroPlay | 1989 |
| ZX Spectrum | MicroStyle | — | 1989 |
| Amstrad CPC | MicroStyle | — | 1989 |
| BBC Master (fan port) | kieranhj (open source) | — | 2022 |

**US title:** The game was released in North America as **Stunt Track Racer** (slight rename; identical gameplay).

**MicroStyle** was a budget/mid-range label of **MicroProse**. The Amiga version is the definitive version — most advanced graphics of all ports at the time of release, owing to the Amiga's superior hardware versus DOS EGA machines of 1989.

---

## 4. Main Menu & Screen Flow

### 4.1 Title / Boot Screen

On loading, the game displays a title screen. From here the player enters their name.

### 4.2 Main Options Menu

After the title screen, the player is presented with the primary choice:

| Option | Description |
|---|---|
| **Practice** | Drive any track in any division without affecting the league standings. No opponent; timed laps only. Used to learn track layouts and speed thresholds. |
| **Race** | Race against the AI opponent on a league track. Results count towards the season standings. |
| **New Season** | Start a new season (resets season-long damage accumulation; the player remains in their current division). |
| **Continue Season** | Resume the current saved season. |
| **2-Player Link** | Connect two computers via null modem cable for human vs. human racing. |

### 4.3 Division / Track Selection

After choosing Practice or Race, the player selects which division's track to race on. In Season mode, only the player's current division tracks are available for points-scoring races; other division tracks are accessible in Practice.

### 4.4 Pre-Race Car Setup Screen

Before each race (in Race mode), the player can adjust car settings. The adjustable parameters include:

| Parameter | Description |
|---|---|
| **Wing angle** | Aerodynamic downforce setting — higher angle = more grip in corners but lower top speed; lower angle = more top speed but less traction. |
| **Turbo boost amount** | How much of the available boost is loaded for the race. The player can opt for a full tank or conserve (though most players use maximum). |
| **Suspension stiffness** | Softer suspension helps absorb landings; stiffer improves cornering response. |

> **Note:** The car setup screen is more prominent in the C64/DOS versions of the manual. On Amiga, car configuration is present but the manual emphasises that default settings are viable. Some sources indicate the setup options may vary slightly between platform versions.

### 4.5 Race Result Screen

After each race, results are displayed:
- Winner and loser
- Lap times for both drivers
- Season points table showing current standings in the division

### 4.6 Season Standings Screen

The league table shows the three drivers in the division with points totals after each pair of race meetings.

---

## 5. Controls

### 5.1 Joystick (Recommended)

| Input | Action |
|---|---|
| Push forward | Accelerate |
| Pull back | Brake / Reverse |
| Left / Right | Steer |
| Fire button | Activate turbo boost |

The joystick does **not** need to be held forward continuously once acceleration is engaged — the car maintains throttle until an input changes it. Boost layers on top of normal acceleration.

### 5.2 Keyboard (Amiga)

The keyboard layout avoids needing to press more than two keys simultaneously:

| Key | Action |
|---|---|
| `Z` | Steer left |
| `X` | Steer right |
| `RETURN` | Accelerate + Boost (combined) |
| `/` or `CTRL` | Brake |
| Other key (varies) | Accelerate without boost |

> The exact Amiga keyboard layout varies slightly by version. Consult the original manual PDF (see §16) for the definitive key map.

---

## 6. Gameplay Mechanics

### 6.1 Physics Model

Stunt Car Racer uses a **spring-mass physics model** — the first commercially released racing game to do so on home computers. The car has simulated suspension at each wheel contact point, creating realistic pitch and roll behaviour:

- Cresting a hill too fast causes the car to fly through the air
- Landing from a jump compresses the suspension, and if the impact is too hard, structural damage results
- The car can get "beached" on the lip of a ramp if approached at too low a speed
- Lateral forces in corners cause body roll

### 6.2 Falling Off the Track

All tracks are elevated with no side barriers. The track edges are the only limit. When the car goes over the edge:

- The car falls to the ground below
- Significant chassis damage is incurred — often resulting in immediate structural failure
- The race continues if the car survives the fall; the opponent usually gains a significant time advantage
- Repeated falls in a season accumulate permanent structural holes

### 6.3 Speed Units

Speed is displayed in mph (miles per hour). The speedometer wraps at 250 mph — if the indicated speed exceeds 250 mph, actual speed = 200 + indicated reading. Many tracks have speed thresholds (see §9) that must be met for safe clearance of jumps.

### 6.4 Race Format

- Each race consists of **3 laps**
- One AI opponent races simultaneously on the same track
- The car physically shares the track with the opponent — contact is possible and damages both cars
- First to complete 3 laps wins; if one car is destroyed mid-race, the other wins immediately

---

## 7. HUD / Cockpit Display

The gameplay screen occupies the upper portion of the display. The lower portion (below the cockpit frame) shows the instrument panel.

### 7.1 Cockpit Frame & Damage Bar

Across the **top** of the cockpit window is a horizontal crossbar — this is the chassis damage indicator:

- A **crack** grows from the **left** across the bar: current-race accumulated stress
- **Holes** appear from the **right**: permanent season-long structural damage
- When the crack reaches the right edge of the bar, the car is destroyed — instant DNF

### 7.2 Bottom HUD Elements

| Display | Prefix | Description |
|---|---|---|
| Lap counter | `L` | Current lap (e.g., `L2` = second lap of three) |
| Boost remaining | `B` | Units of turbo boost remaining (e.g., `B30`) |
| Gap to opponent | `+` / `-` | Distance in metres; `-` = you are ahead |
| Current lap time | — | Top-right area |
| Best lap time | — | Below current lap time |
| Speedometer | — | Reads in 10s of mph; wraps at 250 mph |

### 7.3 Engine Visual

The **V8 engine block** is prominently visible in the centre of the cockpit view — it is a large, dark object filling the lower-centre of the 3D view. When boost is activated, **large flames shoot from the exhaust pipes** on both sides of the engine block — a key visual cue for boost activation.

---

## 8. The League System

### 8.1 Structure

The single-player campaign is a **four-division league** plus a **Super League**:

| Division | Tracks | Difficulty |
|---|---|---|
| Division 4 (entry) | The Little Ramp, The Hump Back | Easiest |
| Division 3 | The Big Ramp, The Stepping Stones | Moderate |
| Division 2 | The High Jump, The Rollercoaster | Hard |
| Division 1 (top) | The Ski Jump, The Drawbridge | Hardest |
| **Super League** | All tracks / rotating | Extreme |

Each division has **3 drivers** (2 AI + player). The player starts at the **bottom of Division 4** in 3rd place.

### 8.2 Season Format

Each season within a division:
1. Player races each opponent on both division tracks (2 races vs. Opponent A, 2 races vs. Opponent B = **4 races total per season**)
2. Points are awarded for wins and losses
3. At season end, the **top-placed driver is promoted** to the next higher division
4. The **last-placed driver is relegated** to the next lower division
5. The player must **win the division** (finish 1st) to be promoted

### 8.3 Promotion & Relegation

- Finishing **1st** → promoted to the next higher division
- Finishing **3rd (last)** → relegated to the next lower division
- Finishing **2nd** → stays in the same division for the next season

### 8.4 Super League

After becoming **Division 1 Champion**, the player gains access to the **Super League**:
- The player is returned to Division 4 again but now races against other Division 1 champions
- All Super League cars have **higher top speeds and faster acceleration** than standard cars
- The Super League represents the ultimate challenge in the game

### 8.5 Damage Carry-Over Rules

| Division | Holes (permanent damage) repaired between seasons? |
|---|---|
| Division 4 | **Yes** — car is fully repaired each season |
| Division 3, 2, 1 | **No** — holes accumulate permanently |
| Super League | **No** — holes accumulate |

This means a player reaching Division 1 with a damaged chassis will carry that damage through the rest of their career.

---

## 9. Track Reference

All 8 tracks are elevated roller-coaster circuits without side barriers. The track surface is the track — the edges are open air. Each track is used in one division only. Lap count: **3 laps per race**.

---

### Division 4 Tracks (Beginner)

#### The Little Ramp

- **Division:** 4
- **Primary feature:** A single ramp jump
- **Key obstacle:** A hump (bump) on approach to the ramp
- **Speed strategy:**
  - Take the ramp at no less than **130 mph** to clear it
  - The hump before the ramp must not be taken above **200 mph** or the car spends too long in the air
- **Difficulty:** Entry level — forgiving, teaches basic ramp jumping

#### The Hump Back

- **Division:** 4
- **Primary feature:** A prominent "humpback bridge" style crest
- **Key obstacle:** The large central hump
- **Speed strategy:**
  - The first hump can be taken at up to **130 mph**
  - Controlled approach is needed — excessive speed leads to large airtime and hard landings
- **Difficulty:** Entry level — introduces the landing-damage mechanic

---

### Division 3 Tracks (Intermediate)

#### The Stepping Stones

- **Division:** 3
- **Primary feature:** A series of individual elevated "stepping stone" platforms — the track consists of disconnected sections with gaps between them
- **Key obstacle:** The gaps between stepping stones — must be jumped precisely
- **Speed strategy:**
  - There is a **constant optimal speed** for clearing all stepping stones — faster or slower causes crashes into the next stone's edge
  - Speed is found by trial and error; once discovered, it must be maintained consistently across every stone
- **Difficulty:** Moderate — requires precise speed control and memorisation

#### The Big Ramp

- **Division:** 3
- **Primary feature:** A massive central ramp — the largest single jump in the game
- **Key obstacles:** Two smaller preliminary ramps lead up to the enormous main ramp
- **Speed strategy:**
  - The two small ramps: approach at **160–180 mph**
  - The **enormous main ramp**: requires at least **210 mph** — full throttle with boost must be committed from the preceding corner before the ramp entry
  - The approach speed to the big ramp is critical; undershooting causes the car to slam into the ramp face
- **Difficulty:** Hard — requires disciplined use of boost and committed throttle management

---

### Division 2 Tracks (Advanced)

#### The High Jump

- **Division:** 2
- **Primary feature:** An extremely large jump requiring a minimum velocity to clear — the track gap is too wide to cross below threshold speed
- **Key obstacle:** The main jump chasm — undershooting results in hitting the far support structure and catastrophic damage
- **Speed strategy:**
  - Must be racing at **over 200 mph** to clear the main jump
  - Start full throttle + boost from the very beginning of the lap; take the preceding curve on the outer line at full speed
  - After a good landing, the same aggressive approach can repeat on subsequent laps
- **Difficulty:** Advanced — unforgiving; insufficient speed = immediate crash

#### The Rollercoaster

- **Division:** 2
- **Primary feature:** A large sweeping hill sequence with speed-sensitive crests — characteristic undulating "rollercoaster" profile
- **Key obstacles:** The largest hill must be managed carefully to avoid excessive airtime
- **Speed strategy:**
  - The largest hill: approach at a maximum of **160 mph** and maintain that speed until three-quarters of the way down, then open throttle for the remaining section
  - Exceeding 160 mph over the crest causes the car to go airborne too long
- **Difficulty:** Advanced — requires disciplined speed modulation

---

### Division 1 Tracks (Expert)

#### The Drawbridge

- **Division:** 1
- **Primary feature:** A **moving drawbridge** — a section of track that is sometimes raised (blocking passage) and sometimes lowered (passable). The drawbridge timing relative to race position creates urgency and risk.
- **Key obstacle:** The drawbridge itself — catching it at the wrong phase causes a collision with the raised section
- **Speed strategy:**
  - The drawbridge should be approached at approximately **140 mph**
  - The moving bridge creates significant strategic variation when racing against a human opponent
  - Less suited to pure timed runs than to head-to-head tactical racing
- **Difficulty:** Expert — the dynamic obstacle requires real-time decision making

#### The Ski Jump

- **Division:** 1
- **Primary feature:** A massive ski jump ramp — the single most extreme jump in the game
- **Key obstacle:** The ski jump itself — must be taken at extreme speed
- **Speed strategy:**
  - The ski jump **must be taken at over 200 mph**
  - Maximum commitment required — full throttle and boost well before the ramp
- **Difficulty:** Expert — maximum speed requirement; errors are catastrophic

---

## 10. Damage System

The damage system is central to Stunt Car Racer's design and distinguishes it from contemporaries.

### 10.1 The Chassis Bar (Visual Indicator)

A horizontal bar runs across the **top of the cockpit window**. This bar has two types of damage markers:

| Marker | Direction | Persistence |
|---|---|---|
| **Crack** (jagged line) | Grows from **left to right** | Resets to zero after each race |
| **Holes** (punched gaps) | Appear from **right to left** | **Permanent** for the entire season (except in Division 4) |

The crack tracks **current-race** stress accumulation. Holes track **cumulative season** structural damage.

### 10.2 Crack Mechanics (Per-Race Damage)

- Every hard landing, collision, or wall hit advances the crack further right
- The crack rate depends on impact severity — a light bump moves it a little; a massive crash jumps it a large distance
- If the crack reaches the **right edge** of the bar → **instant car destruction** → immediate DNF
- At the end of each race, the crack **resets completely** regardless of how far it progressed

### 10.3 Hole Mechanics (Season-Long Damage)

- Particularly severe impacts (very hard landings, falling off the track) **punch permanent holes** into the chassis bar
- These holes remain for the rest of the season — they cannot be repaired (except in Division 4)
- **Critical interaction:** The crack advances **faster when it passes through a hole** — a car with multiple holes deteriorates much more rapidly under the same racing stresses that an undamaged car would handle easily
- This creates compounding difficulty: accumulated holes across a season make even cautious driving increasingly dangerous in later races

### 10.4 Causes of Damage

1. **Hard landings** — primary source; coming down too hard after a crest or jump
2. **Hard cornering** — lateral stress through high-speed corners
3. **Hitting the opponent's car** — ramming or being rammed
4. **Crashing into track edges or walls** — any collision with track structure
5. **Falling off the track** — dropping into the void below the elevated course; usually causes severe damage or instant destruction

### 10.5 Damage by Division

| Division | Crack resets between races | Holes repaired between seasons |
|---|---|---|
| Division 4 | Yes | **Yes** |
| Division 3 | Yes | No |
| Division 2 | Yes | No |
| Division 1 | Yes | No |
| Super League | Yes | No |

Only Division 4 gives the player a completely fresh car each season. From Division 3 onwards, holes accumulate as a permanent handicap.

---

## 11. Boost System

### 11.1 What It Is

The car is equipped with a **turbo booster** (described in the manual as part of the "V8 engine, turbo booster, roll cage and suspension"). When activated, it injects extra fuel/power for a burst of speed significantly above normal maximum throttle. Visually, **large flames shoot from the exhaust/side pipes** when boost is active.

### 11.2 Activation

| Control method | Boost activation |
|---|---|
| Joystick | Press the **fire button** while accelerating |
| Keyboard | Hold **RETURN** (combines accelerate + boost) |

The car does not need continuous input to maintain acceleration — boost layers on top of existing throttle state.

### 11.3 Boost Resource

- Displayed on the HUD as **`B`** with a number (e.g., `B30` = 30 units remaining)
- Boost is a **finite per-race resource** — it does not recharge mid-race
- The supply is described in the manual as "limited but not too limited" — enough for key moments but not infinite
- There is no overheat mechanic for the boost system; all heat/stress is expressed through the chassis damage bar

### 11.4 Strategic Usage

| Tactic | Detail |
|---|---|
| **Meet speed thresholds** | Some jumps (The High Jump, The Ski Jump, The Big Ramp) require over 200 mph — boost is essential to reach these speeds |
| **Overtaking** | Identify optimal overtake points per track; use boost to execute the move decisively and get clear |
| **Sprint to the finish** | Save boost for the final straight after the last corner — ignite and sprint to the line |
| **Don't waste on manageable sections** | Normal throttle is sufficient for many track sections; boost should be reserved for committed moments |

### 11.5 Risks of Overuse

- **Overshooting jumps**: Too much speed into a ramp causes the car to fly past the intended landing zone, potentially off the far edge of the track
- **Hard landings at excessive velocity**: Overshooting a jump causes harder impacts → more damage → potential holes in the chassis bar
- **Running out early**: Exhausting boost in the first lap leaves no tactical reserve for the final two laps

---

## 12. 2-Player Link Mode

### 12.1 How It Works

Two computers are connected via a **null modem serial cable** (RS-232). Each player has their own computer and monitor/TV — both see their own first-person cockpit view simultaneously.

The multiplayer mode works **cross-platform**: an Amiga can be linked to an Atari ST. This was possible because Geoff Crammond leveraged his serial communication experience from *Aviator* on the BBC Micro to implement a consistent data protocol across platforms.

### 12.2 Connection

| Platform | Port Used |
|---|---|
| Amiga | RS-232 serial port (DB25 or DB9 via adapter) |
| Atari ST | RS-232 serial port |

A standard null modem cable (or null modem adapter on a straight-through cable) connects the two machines.

### 12.3 Gameplay Differences

In 2-player mode:
- Both players race simultaneously on the same track
- The AI opponent is replaced by the human opponent
- Physical contact between cars is still possible (and still causes damage)
- The dynamic drawbridge on The Drawbridge track makes 2-player mode particularly tactical
- Serial cable multiplayer is **not supported** in the modern fan-made "Framerate Unleashed" modification (Vesuri/dA JoRMaS, 2021)

---

## 13. Graphics & Technical

### 13.1 3D Engine

| Detail | Specification |
|---|---|
| Rendering type | Filled polygon 3D (vector-based, no textures) |
| Player car polygons | Maximum ~20 polygons |
| Perspective | First-person cockpit view |
| Framerate (original) | ~25 fps (PAL Amiga, 50 Hz display) |
| Framerate (fan mod) | 50 fps (Vesuri "Framerate Unleashed", requires fast CPU/RAM) |
| Resolution | Standard Amiga low-res (approx. 320×200 or 320×256 PAL) |
| Colour palette | ~16 colours |

The Amiga version was the **most visually advanced** of all platform ports at release — DOS PCs were limited to EGA low-resolution graphics; the Amiga's custom chips allowed smoother and more colourful 3D output.

### 13.2 Cockpit Design

The cockpit occupies the lower quarter of the screen. Key visual elements:
- Large V8 engine block in the centre foreground of the 3D view
- Exhaust/side pipes visible (flames appear during boost)
- Chassis bar across the top of the window (damage indicator)
- Bottom instrument strip below the cockpit frame

### 13.3 Track Visual Design

Tracks are rendered as elevated flat-surface roads with coloured polygon sides. The void below is rendered as a black "pit" or ground plane. Opponents' cars are rendered in a different colour from the player's car, visible when close.

### 13.4 Fan Modifications & Ports

| Project | Details |
|---|---|
| **Stunt Car Racer TNT** (2004) | Community Amiga modification with redesigned track layouts by AmiGer/CARE |
| **Stunt Car Racer Framerate Unleashed** (2021) | WHDLoad slave by Vesuri/dA JoRMaS — unlocks to 50/60 fps without changing physics or speed |
| **Stunt Car Racer BBC Master port** (2022) | Fan port by kieranhj to BBC Master (open source on GitHub: kieranhj/scr-beeb) |

---

## 14. Audio

### 14.1 Music

The Amiga version features **no background music during gameplay**. There is title screen music on some versions.

### 14.2 Sound Effects

The game uses sound effects exclusively during racing:

| Sound | Trigger |
|---|---|
| Engine roar | Continuous; pitch varies with throttle and speed |
| Turbo boost burst | Boost activation — distinctive roar/whoosh |
| Scraping/grinding | Car bottom scraping on track surface (landing after jump) |
| Collision impact | Hitting opponent car or track edges |

The engine and boost sounds were considered excellent for 1989 — reviewers praised the audio immersion, particularly the engine roar scaling with speed and the satisfying boost sound effect.

### 14.3 Technical Audio Notes

- Audio is produced via the Amiga's **Paula chip** (4-channel PCM audio)
- No music composer is credited separately — audio was part of Crammond's solo development

---

## 15. Reception & Legacy

### 15.1 Contemporary Review Scores (Amiga)

| Publication | Score | Date |
|---|---|---|
| Amiga Format | 93% | January 1990 (Issue 6) |
| CU Amiga | 92% | December 1989 (Issue 64) |
| The One for Amiga Games | Highly rated | September 1991 (retrospective) |
| Your Sinclair | Game of the Year 1989 | — |

### 15.2 All-Time Rankings

| Publication | Ranking |
|---|---|
| Amiga Power | 10th best Amiga game of all time |
| CU Amiga | 11th best Amiga game of all time |
| Your Sinclair | 85th best game of all time (ZX Spectrum list) |
| Amiga Format | Named one of the 15 best Amiga games ever |

### 15.3 Legacy

- Widely regarded as one of the greatest Amiga games ever made
- Pioneered physics-based 3D racing on home computers
- Geoff Crammond went on to create the *Formula One Grand Prix* series (1991 onwards), which similarly pushed simulation physics
- The game remains actively played in the Amiga community, with the TNT modification (2004) and Framerate Unleashed (2021) providing modern-hardware enhancements
- A speedrunning community exists at speedrun.com/stunt_car_racer
- Top Gear (magazine/website) named it one of the greatest racing games in history

---

## 16. Media & Screenshots

> **Note:** Due to network access restrictions in this documentation environment, screenshots could not be directly downloaded. All known screenshot locations are documented below for manual retrieval.

### 16.1 Folder Structure

```
media/
├── screenshots/
│   ├── menus/          # Title screen, main menu, pre-race setup, results
│   ├── gameplay/       # In-race cockpit views, HUD, boost flames
│   ├── tracks/         # Each of the 8 tracks (named per track)
│   └── misc/           # Cover art, ads, loading screen
├── covers/             # Box art scans
├── manuals/            # Manual PDF scans
└── videos/             # Links/references to video footage
```

### 16.2 Screenshot Sources

| Source | URL | Notes |
|---|---|---|
| MobyGames (Amiga) | https://www.mobygames.com/game/782/stunt-track-racer/screenshots/amiga/ | Multiple in-game screenshots |
| MobyGames (C64) | https://www.mobygames.com/game/782/stunt-track-racer/screenshots/c64/ | C64 version for comparison |
| Lemon Amiga | https://www.lemonamiga.com/game/stunt-car-racer | Amiga screenshots gallery |
| Hall of Light | https://hol.abime.net/2160 | Amiga database entry with screenshots |
| Hall of Light (conversions) | https://hol.abime.net/2160/conversionshot | Platform comparison shots |
| The King of Grabs | https://thekingofgrabs.com/2017/12/28/stunt-car-racer-amiga/ | High-quality Amiga grabs |
| Internet Archive | https://archive.org/details/Stunt_Car_Racer_1989_MicroStyle_cr_QTX | Includes screenshot_00.png–screenshot_04.png |
| LaunchBox Games DB | https://gamesdb.launchbox-app.com/games/images/9142-stunt-car-racer | Gameplay + box art |

### 16.3 Video Resources

| Title | URL | Notes |
|---|---|---|
| Amiga 500 Longplay (MadMatty) | https://www.youtube.com/watch?v=jYq_Jd8_j_U | Full game longplay |
| All 8 Tracks | https://www.youtube.com/watch?v=wWCZ7lP1u6Q | Track-by-track showcase |
| Track Guide & Review | https://www.youtube.com/watch?v=MIOkUquoygM | Commentary with strategy |
| Gameplay HQ | https://www.youtube.com/watch?v=u5qRr-zCaF4 | High-quality capture |
| Review & Commentary | https://www.youtube.com/watch?v=4rfsuLYQezk | Modern retrospective |
| Speedrun – The Little Ramp | https://www.youtube.com/watch?v=Wey5s5ceMxE | Speedrun footage |
| Overlooked Oldies | https://www.youtube.com/watch?v=KncdXpc4jlE | Review segment |
| Archive.org Longplay | https://archive.org/details/amiga-500-longplay-stunt-car-racer-eu | Downloadable video |

### 16.4 Manual / Documentation Sources

| Source | URL | Notes |
|---|---|---|
| Manual PDF (DE/EN/FR/NO) | https://retro-commodore.eu/files/downloads/amigamanuals-xiik.net/Games/Stunt%20Car%20Racer%20-%20Manual-DE-ENG-FR-NO.pdf | High-quality multilingual scan |
| Lemon Amiga – Manual text | https://www.lemonamiga.com/games/docs.php?id=1570 | Online formatted version |
| Lemon Amiga – Hints & Tips | https://www.lemonamiga.com/doc/stunt-car-racer/1569 | Strategy tips document |
| C64x.no – Manual viewer | https://www.c64x.no/games/stuntcarracer_manual.php | Online readable manual |
| English Amiga Board – Scan thread | https://eab.abime.net/showthread.php?t=60203 | Forum with manual scans |
| OpenRetro | https://openretro.org/amiga/stunt-car-racer | Linked manual |

---

## 17. Sources

All information in this document is sourced from the following:

- [Stunt Car Racer — Wikipedia](https://en.wikipedia.org/wiki/Stunt_Car_Racer)
- [Stunt Car Racer — StrategyWiki (Gameplay)](https://strategywiki.org/wiki/Stunt_Car_Racer/Gameplay)
- [Stunt Car Racer — StrategyWiki (Walkthrough)](https://strategywiki.org/wiki/Stunt_Car_Racer/Walkthrough)
- [Stunt Car Racer — C64-Wiki](https://www.c64-wiki.com/wiki/Stunt_Car_Racer)
- [Stunt Car Racer — Lemon Amiga (Game Page)](https://www.lemonamiga.com/game/stunt-car-racer)
- [Stunt Car Racer — Lemon Amiga (Manual/Docs)](https://www.lemonamiga.com/games/docs.php?id=1570)
- [Stunt Car Racer — Lemon Amiga (Hints & Tips)](https://www.lemonamiga.com/doc/stunt-car-racer/1569)
- [Stunt Car Racer — Lemon Amiga (Review)](https://www.lemonamiga.com/review/stunt-car-racer/83)
- [Stunt Car Racer — Amiga Reviews (leveluphost)](https://www.amigareviews.leveluphost.com/stuntcar.htm)
- [Stunt Car Racer — How To Retro (Amiga Review)](https://www.howtoretro.com/games/stunt-car-racer-commodore-amiga-review/)
- [Stunt Car Racer — Highway Forever Blog](https://highwayforever.wordpress.com/2016/03/28/stunt-car-racer-geoff-crammond-1989/)
- [Stunt Car Racer — Top Gear retrospective](https://www.topgear.com/car-news/gaming/remembering-classic-games-stunt-car-racer-1989)
- [Stunt Car Racer — Grokipedia](https://grokipedia.com/page/Stunt_Car_Racer)
- [Stunt Car Racer — HandWiki](https://handwiki.org/wiki/Software:Stunt_Car_Racer)
- [Stunt Car Racer — MobyGames](https://www.mobygames.com/game/782/stunt-track-racer/)
- [Stunt Car Racer — GamesNostalgia](https://gamesnostalgia.com/game/stunt-track-racer)
- [Stunt Car Racer — Amiga Magazine Rack (CU Amiga Dec 1989)](https://amr.abime.net/review_18532)
- [Stunt Car Racer — Amiga Magazine Rack (Amiga Format Jan 1990)](https://amr.abime.net/review_1862)
- [Stunt Car Racer — OpenRetro](https://openretro.org/amiga/stunt-car-racer)
- [Geoff Crammond — Wikipedia](https://en.wikipedia.org/wiki/Geoff_Crammond)
- [Geoff Crammond legacy — Generation Amiga (2026)](https://www.generationamiga.com/2026/06/06/the-man-who-made-racing-games-feel-real-geoff-crammonds-legacy/)
- [Manual PDF — Retro Commodore](https://www.retro-commodore.eu/2016/04/12/stunt-car-racer-manual/)
- [Vesuri/stuntcarracer — GitHub (Framerate Unleashed mod)](https://github.com/Vesuri/stuntcarracer)
- [kieranhj/scr-beeb — GitHub (BBC Master port)](https://github.com/kieranhj/scr-beeb)
- [Internet Archive — Stunt Car Racer (1989)(MicroStyle)](https://archive.org/details/Stunt_Car_Racer_1989_MicroStyle_cr_QTX)
- [Internet Archive — Amiga 500 Longplay](https://archive.org/details/amiga-500-longplay-stunt-car-racer-eu)
- [Speedrun.com — Stunt Car Racer](https://www.speedrun.com/stunt_car_racer)
