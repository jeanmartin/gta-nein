# GTA NEIN! — Gewissenhafte Teilnahme am Autoverkehr

A private satire: a top-down city driving game in the style of the late-90s 2D crime games,
turned upside down. Your goal is to **obey every traffic rule and every official order**
in the very orderly town of Bad Regelsheim. Every slip is fined instantly by your mandatory
*Bürgerfahrtenschreiber*. Survive all 8 orders and… well. Brake fluid is taxable.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for rules, money, clock, missions, map
npm run build      # static build in dist/ (host anywhere, relative paths)
```

## Controls

| Key | Action |
| --- | --- |
| W/A/S/D or arrows | drive / walk |
| SPACE | handbrake (car) · use / pick up (on foot) |
| Q / E | indicator left / right |
| B | seatbelt |
| L | headlights |
| P | Parkscheibe (parking disc) |
| F | get in / out |
| H | horn (fined, plus Hupensteuer) |
| Z | wait (time passes faster) |
| SHIFT | run (on foot) |
| ESC | pause (R restarts the order, T goes to the title) |
| M | sound on/off |

## Debug

Open `?debug` to enable: `1–8` on the title to jump to an order, `N` to complete the current
objective, `T` to teleport to the objective, `K` for €1000. `?mission=N` starts at order N.
In debug mode the Phaser game is exposed as `window.__game`.

## Structure

- `src/world/` city layout (data), map builder (`MapData.ts`), renderer, routing, traffic lights
- `src/rules/` offence catalog and the `RuleEngine` (pure, unit-tested)
- `src/systems/` clock, Bureaucracy (money/points/taxes), WebAudio synth
- `src/missions/` the 8 orders and the `MissionManager`
- `src/entities/` player car, player on foot, NPC traffic, pedestrians
- `src/scenes/` Phaser scenes (Boot generates all textures; no asset files)
