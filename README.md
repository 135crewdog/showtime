# Show Time

KC-135 mission timing calculator for aircrew. Given a takeoff time or LFA, Show Time works backwards to produce the full crew timing message — crew rest, show, brief, step, start, and more — in both local and Zulu.

Installable as a PWA on iOS and Android. Works offline after first load.

**Current version: v1.5.13**

---

## Features

- **LFA and Self Alert modes** — LFA mode derives the latest legal LFA/Alert from takeoff, and warns when a given LFA and T/O are closer than the required interval. Only outputs what the inputs determine: with LFA alone, just Crew Rest and LFA
- **Summer/Winter profiles** — automatically adjusts all intervals per AFMAN 11-2KC-135V3
- **Single Ship and Formation** — formation shows 30 min earlier (3+45 summer / 4+15 winter per AFMAN 11-2KC-135V3_MILDENHALLSUP) and adds a Check In event 5 min before Start
- **Basic and Augmented crew** — drives the FDP limit (16 or 24 hours)
- **Configurable crew brief** — set offset in 5-min increments (15–90 min) relative to Show or Step
- **Local/Zulu input** — enter times in either timezone; all output shows both
- **Sortie duration** — enter a landing time to add a Dur row showing flight time as HH+MM
- **Output options** — toggle individual events on/off before copying
- **Copy Table** — copies a markdown table (Event / Local / Zulu) ready to paste into P1 ChatOps
- **Copy Plain Text** — copies a space-separated text block for platforms without markdown
- **Light / Dark / Auto theme**
- **Offline support** via service worker

---

## Timing Intervals

| Interval | Summer | Winter |
|---|---|---|
| LFA → T/O (Single Ship) | 4+15 | 4+45 |
| LFA → T/O (Formation) | 4+45 | 5+15 |
| Show → T/O (Single Ship) | 3+15 | 3+45 |
| Show → T/O (Formation) | 3+45 | 4+15 |
| Step → T/O (Single Ship) | 1+45 | 2+00 |
| Step → T/O (Formation) | 2+00 | 2+00 |
| Start → T/O | 0+25 | 0+30 |

Alert to Show is always 1 hour, so LFA → T/O is Show → T/O + 1 hour for every combination.

Crew rest is 12 hours before FDP start. In LFA mode it is fixed by the LFA (LFA + 1 hr − 12 hr); in self-alert mode FDP starts at show.

FDP starts no later than 1 hour after alert notification (or at show when self-alerting). The alert time is only determined by the inputs when it is pinned to LFA — T/O only, or LFA + T/O with no slack — so FDP End is only output in those cases. With LFA + T/O and slack, C2 could alert any time between LFA and T/O minus the alert interval, and FDP End is omitted rather than guessed.

---

## Regulatory References

| Item | Reference |
|---|---|
| Crew Rest (12 hr) | AFMAN 11-202V3 para 3.1 |
| FDP Start | AFMAN 11-202V3_AMCSUP para 3.2.1 |
| FDP Limits (16/24 hr) | AFMAN 11-202V3_AMCSUP Table 3.1 |
| KC-135 Alert Times | AFMAN 11-2KC-135V3 para 3.7 |
| Formation Show Times | AFMAN 11-2KC-135V3_MILDENHALLSUP (28 Sep 2023) |

---

## Disclaimer

This is an unofficial tool. Always verify results against official publications and coordinate with your command and control agency. The developer assumes no liability for operational decisions made using this tool.

---

## Tech

Single-file PWA — no build step, no dependencies to install. Served as static files.

- React 18 (UMD)
- htm (JSX-like templating, no transpiler)
- Luxon (date/time math)
- Service worker for offline caching
