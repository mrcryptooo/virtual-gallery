# modern-museum — navigation graph BEFORE the 2026-08-05 rebuild

Auditable snapshot of the superseded graph (commit 78fd089).

| # | slug | initial yaw/pitch/fov | → # | → slug | label | yaw | pitch |
|---|---|---|---|---|---|---|---|
| 01 | museum-forecourt | 0/-2/90 | 02 | entrance-gate-west | Walk to the west gate | -14 | -6 |
| 01 | museum-forecourt | 0/-2/90 | 03 | entrance-gate-east | Walk to the east gate | 14 | -6 |
| 02 | entrance-gate-west | -15/0/90 | 04 | entry-tunnel-west | Enter the west vault | -15 | -6 |
| 02 | entrance-gate-west | -15/0/90 | 01 | museum-forecourt | Back to the forecourt | 165 | -6 |
| 03 | entrance-gate-east | 15/0/90 | 05 | entry-tunnel-east | Enter the east vault | 15 | -6 |
| 03 | entrance-gate-east | 15/0/90 | 01 | museum-forecourt | Back to the forecourt | -165 | -6 |
| 04 | entry-tunnel-west | 0/0/90 | 06 | main-concourse | Down to the concourse | 0 | -8 |
| 04 | entry-tunnel-west | 0/0/90 | 02 | entrance-gate-west | Back to the west gate | 180 | -8 |
| 05 | entry-tunnel-east | 0/0/90 | 06 | main-concourse | Down to the concourse | 0 | -8 |
| 05 | entry-tunnel-east | 0/0/90 | 03 | entrance-gate-east | Back to the east gate | 180 | -8 |
| 06 | main-concourse | 0/0/90 | 07 | noxx-concourse | To the Noxx Hall concourse | -37 | -4 |
| 06 | main-concourse | 0/0/90 | 09 | xealist-concourse | To the Xealist Hall concourse | 37 | -4 |
| 06 | main-concourse | 0/0/90 | 04 | entry-tunnel-west | Up to the west vault | -140 | -6 |
| 06 | main-concourse | 0/0/90 | 05 | entry-tunnel-east | Up to the east vault | 125 | -6 |
| 07 | noxx-concourse | 5/0/90 | 08 | welcome-wall | To the welcome wall | -35 | -6 |
| 07 | noxx-concourse | 5/0/90 | 8.5 | noxx-hall-gate | To the Noxx Hall gate | 45 | -6 |
| 07 | noxx-concourse | 5/0/90 | 06 | main-concourse | Back to the main concourse | 150 | -6 |
| 08 | welcome-wall | 30/0/90 | 11 | noxx-passage | Into the Noxx tunnel | 55 | -6 |
| 08 | welcome-wall | 30/0/90 | 07 | noxx-concourse | Back to the concourse | -100 | -6 |
| 8.5 | noxx-hall-gate | -10/0/90 | 11 | noxx-passage | Into the Noxx tunnel | -45 | -6 |
| 8.5 | noxx-hall-gate | -10/0/90 | 07 | noxx-concourse | Back to the concourse | 100 | -6 |
| 09 | xealist-concourse | -5/0/90 | 10 | museum-statement | To the statement wall | 35 | -6 |
| 09 | xealist-concourse | -5/0/90 | 9.5 | xealist-hall-gate | To the Xealist Hall gate | -45 | -6 |
| 09 | xealist-concourse | -5/0/90 | 06 | main-concourse | Back to the main concourse | -150 | -6 |
| 10 | museum-statement | -30/0/90 | 12 | xealist-passage | Into the Xealist tunnel | -55 | -6 |
| 10 | museum-statement | -30/0/90 | 09 | xealist-concourse | Back to the concourse | 100 | -6 |
| 9.5 | xealist-hall-gate | 10/0/90 | 12 | xealist-passage | Into the Xealist tunnel | 45 | -6 |
| 9.5 | xealist-hall-gate | 10/0/90 | 09 | xealist-concourse | Back to the concourse | -100 | -6 |
| 11 | noxx-passage | -3/0/90 | 30 | noxx-gallery-1 | Into the Noxx Hall | -3 | -4 |
| 11 | noxx-passage | -3/0/90 | 8.5 | noxx-hall-gate | Back to the gate | 178 | -4 |
| 30 | noxx-gallery-1 | 15/0/90 | 31 | noxx-gallery-2 | On to bay 2 | 55 | -8 |
| 30 | noxx-gallery-1 | 15/0/90 | 11 | noxx-passage | Back to the tunnel | -125 | -8 |
| 31 | noxx-gallery-2 | 15/0/90 | 28 | noxx-gallery-3 | On to bay 3 | 55 | -8 |
| 31 | noxx-gallery-2 | 15/0/90 | 30 | noxx-gallery-1 | Back to bay 1 | -125 | -8 |
| 28 | noxx-gallery-3 | 15/0/90 | 29 | noxx-gallery-4 | On to bay 4 | 55 | -8 |
| 28 | noxx-gallery-3 | 15/0/90 | 31 | noxx-gallery-2 | Back to bay 2 | -125 | -8 |
| 29 | noxx-gallery-4 | 15/0/90 | 26 | noxx-gallery-5 | On to bay 5 | 55 | -8 |
| 29 | noxx-gallery-4 | 15/0/90 | 28 | noxx-gallery-3 | Back to bay 3 | -125 | -8 |
| 26 | noxx-gallery-5 | 15/0/90 | 27 | noxx-gallery-6 | On to bay 6 | 55 | -8 |
| 26 | noxx-gallery-5 | 15/0/90 | 29 | noxx-gallery-4 | Back to bay 4 | -125 | -8 |
| 27 | noxx-gallery-6 | 15/0/90 | 24 | noxx-gallery-7 | On to bay 7 | 55 | -8 |
| 27 | noxx-gallery-6 | 15/0/90 | 26 | noxx-gallery-5 | Back to bay 5 | -125 | -8 |
| 24 | noxx-gallery-7 | 15/0/90 | 25 | noxx-gallery-8 | On to bay 8 | 55 | -8 |
| 24 | noxx-gallery-7 | 15/0/90 | 27 | noxx-gallery-6 | Back to bay 6 | -125 | -8 |
| 25 | noxx-gallery-8 | 15/0/90 | 21 | grand-hall | On to the grand hall | 55 | -8 |
| 25 | noxx-gallery-8 | 15/0/90 | 24 | noxx-gallery-7 | Back to bay 7 | -125 | -8 |
| 12 | xealist-passage | -3/0/90 | 13 | xealist-gallery-1 | Into the Xealist Hall | -3 | -4 |
| 12 | xealist-passage | -3/0/90 | 9.5 | xealist-hall-gate | Back to the gate | 178 | -4 |
| 13 | xealist-gallery-1 | 15/0/90 | 14 | xealist-gallery-2 | On to bay 2 | 55 | -8 |
| 13 | xealist-gallery-1 | 15/0/90 | 12 | xealist-passage | Back to the tunnel | -125 | -8 |
| 14 | xealist-gallery-2 | 15/0/90 | 15 | xealist-gallery-3 | On to bay 3 | 55 | -8 |
| 14 | xealist-gallery-2 | 15/0/90 | 13 | xealist-gallery-1 | Back to bay 1 | -125 | -8 |
| 15 | xealist-gallery-3 | 15/0/90 | 16 | xealist-gallery-4 | On to bay 4 | 55 | -8 |
| 15 | xealist-gallery-3 | 15/0/90 | 14 | xealist-gallery-2 | Back to bay 2 | -125 | -8 |
| 16 | xealist-gallery-4 | 15/0/90 | 17 | xealist-gallery-5 | On to bay 5 | 55 | -8 |
| 16 | xealist-gallery-4 | 15/0/90 | 15 | xealist-gallery-3 | Back to bay 3 | -125 | -8 |
| 17 | xealist-gallery-5 | 15/0/90 | 18 | xealist-gallery-6 | On to bay 6 | 55 | -8 |
| 17 | xealist-gallery-5 | 15/0/90 | 16 | xealist-gallery-4 | Back to bay 4 | -125 | -8 |
| 18 | xealist-gallery-6 | 15/0/90 | 19 | xealist-gallery-7 | On to bay 7 | 55 | -8 |
| 18 | xealist-gallery-6 | 15/0/90 | 17 | xealist-gallery-5 | Back to bay 5 | -125 | -8 |
| 19 | xealist-gallery-7 | 15/0/90 | 20 | xealist-gallery-8 | On to bay 8 | 55 | -8 |
| 19 | xealist-gallery-7 | 15/0/90 | 18 | xealist-gallery-6 | Back to bay 6 | -125 | -8 |
| 20 | xealist-gallery-8 | 15/0/90 | 21 | grand-hall | On to the grand hall | 55 | -8 |
| 20 | xealist-gallery-8 | 15/0/90 | 19 | xealist-gallery-7 | Back to bay 7 | -125 | -8 |
| 21 | grand-hall | 0/-2/90 | 23 | keepers-gallery | Up to the Keeper’s Gallery | 0 | 2 |
| 21 | grand-hall | 0/-2/90 | 20 | xealist-gallery-8 | Into the Xealist Hall | 60 | -8 |
| 21 | grand-hall | 0/-2/90 | 25 | noxx-gallery-8 | Into the Noxx Hall | -95 | -8 |
| 21 | grand-hall | 0/-2/90 | 22 | grand-hall-colonnade | To the colonnade | 175 | -8 |
| 22 | grand-hall-colonnade | -70/0/90 | 21 | grand-hall | Back to the grand hall | -115 | -8 |
| 23 | keepers-gallery | 0/0/90 | 21 | grand-hall | Back down to the grand hall | 178 | -8 |

Total navigation edges: 70

One-way edges in the old graph (no reverse): 2

- 08→11 (welcome-wall→noxx-passage)
- 10→12 (museum-statement→xealist-passage)
