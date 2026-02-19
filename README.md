# Show Time

KC-135 mission timing calculator for aircrew. Given a takeoff time or LFA, Show Time works backwards to produce the full crew timing message — crew rest, show, brief, step, start, and more — in both local and Zulu.

Installable as a PWA on iOS and Android. Works offline after first load.

**Current version: v1.4**

---

## Features

- **LFA and Self Alert modes** — LFA mode derives takeoff from alert time (or vice versa) and warns when the two don't match the expected interval
- **Summer/Winter profiles** — automatically adjusts all intervals per AFMAN 11-2KC-135V3
- **Single Ship and Formation** — formation adds a Check In event 5 min before Start
- **Basic and Augmented crew** — drives the FDP limit (16 or 24 hours)
- **Configurable crew brief** — set offset in 5-min increments (15–90 min) relative to Show or Step
- **Local/Zulu input** — enter times in either timezone; all output shows both
- **Day indicators** — events that fall on a different day from T/O are labeled (+1) or (−1)
- **Output options** — toggle individual events on/off before copying
- **Copy to clipboard** — one tap produces a plain-text timing message ready to paste
- **Light / Dark / Auto theme**
- **Offline support** via service worker

---

## Timing Intervals

| Interval | Summer | Winter |
|---|---|---|
| LFA → T/O | 4+15 | 4+45 |
| Show → T/O | 3+15 | 3+45 |
| Step → T/O (Single Ship) | 1+45 | 2+00 |
| Step → T/O (Formation) | 2+00 | 2+00 |
| Start → T/O | 0+25 | 0+30 |

Crew rest is 12 hours before FDP start. FDP start is LFA+1hr for alert missions, show time for self-alert.

---

## Regulatory References

| Item | Reference |
|---|---|
| Crew Rest (12 hr) | AFMAN 11-202V3 para 3.1 |
| FDP Start | AFMAN 11-202V3_AMCSUP para 3.2.1 |
| FDP Limits (16/24 hr) | AFMAN 11-202V3_AMCSUP Table 3.1 |
| KC-135 Alert Times | AFMAN 11-2KC-135V3 para 3.7 |

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
