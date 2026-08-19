# AGROGUARD 360

**AI-Powered Smart Agriculture & Autonomous Crop-Care System** — a fully virtual 3D
digital-twin demonstration.

A drone surveys a 16-zone field, a simulated AI classifies each zone's crop health, an
A* planner routes a ground rover to the worst problem, the rover drives there, samples the
soil, irrigates where the readings justify it, and a resource model reports what the
session consumed.

> **Everything in this project is simulated.** There is no hardware, no trained model and
> no real sensor data. All agronomic readings are synthetic, and all financial figures are
> estimates built on illustrative placeholder rates. See **Known limitations**.

---

## 1. Folder structure

```
agroguard360/
├── README.md
├── .gitignore
├── backend/                          Reserved — empty by design
└── frontend/
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    └── src/
        ├── main.jsx                  React entry
        ├── App.jsx                   Layout, state wiring
        ├── index.css                 Design tokens + all styling
        │
        ├── scenes/
        │   └── MainScene.jsx         Canvas, sky, fog, tone mapping, frameloop
        │
        ├── systems/                  Pure logic — no React, fully testable
        │   ├── farmLayout.js         Zone grid, paths, plant placement
        │   ├── sceneConfig.js        Camera, lighting, atmosphere
        │   ├── textures.js           Procedural soil/grass/path textures
        │   ├── flightModel.js        PEGASUS flight physics
        │   ├── droneConfig.js        Pad, operator station, camera views
        │   ├── autopilot.js          Waypoint steering
        │   ├── roverMotion.js        TALOS motion, skid steering
        │   ├── inspection.js         Sensors, decision rule, pump cycle
        │   ├── demoSequence.js       The ten demo steps
        │   ├── buddhi/               Crop-health analysis
        │   │   ├── classes.js        Four classes + severity
        │   │   ├── features.js       Feature extraction (the ML seam)
        │   │   ├── simulatedModel.js Stand-in classifier
        │   │   └── index.js          Engine facade — swap backend here
        │   ├── promethia/            Route planning
        │   │   ├── navGrid.js        4 m navigation grid
        │   │   ├── astar.js          A* + Dijkstra reference
        │   │   ├── obstacles.js      Fixed and situational blockages
        │   │   └── index.js          planRoute() facade
        │   └── mercatus/             Resource and economic analysis
        │       ├── assumptions.js    EVERY assumed rate lives here
        │       └── index.js          analyseSession()
        │
        ├── models/                   Appearance only — GLB swap seams
        │   ├── PegasusModel.jsx      + PegasusProcedural.jsx
        │   ├── TalosModel.jsx        + TalosProcedural.jsx
        │   └── OperatorModel.jsx     + OperatorProcedural.jsx
        │
        ├── components/
        │   ├── ui/                   AppHeader, SystemStatus, MissionData,
        │   │                         CommandBar, ModuleDrawer
        │   ├── farm/                 Terrain, crops, trees, buildings, zones,
        │   │                         markers, route ribbon, obstacles
        │   ├── drone/                DroneRig, LandingPad, ProjectedShadow
        │   ├── rover/                TalosRig, IrrigationSpray
        │   └── *.jsx                 Module panels, camera, event log
        │
        ├── hooks/                    React bridges to the pure systems
        │   ├── useDroneController.js useBuddhiScan.js  usePromethia.js
        │   ├── useTalosController.js useMercatus.js    useWebGLSupport.js
        │   └── useDemoOrchestrator.js
        │
        └── data/
            ├── appMeta.js            Interface copy
            └── zoneAgronomy.js       Synthetic field measurements
```

## 2. Installation

Requires **Node.js 18+** (developed on 22) and a browser with WebGL enabled.

```bash
cd agroguard360/frontend
npm install
```

No global installs, no build tools beyond Vite, no external assets — every texture and
model is generated in code at runtime.

## 3. Running

```bash
npm run dev          # development server → http://localhost:5173
npm run dev -- --open  # and open the browser automatically
npm run build        # production build into frontend/dist
npm run preview      # serve the production build
```

**Open it in Chrome, Edge, Firefox or Safari.** VS Code's built-in Simple Browser has no
GPU access and will show the "cannot run the field view" screen.

## 4. Full demo instructions

Press **Start full demo** in the bottom bar. The sequence runs unattended for about five
minutes:

| Step | What happens |
| --- | --- |
| 1 · Monitor | PEGASUS takes off and flies all 16 zones |
| 2 · Detect | BUDDHI classifies each zone; problems listed in the event log |
| 3 · Prioritize | Findings ranked by severity |
| 4 · Optimize | PROMETHIA runs A*; the route appears on the ground |
| 5 · Navigate | TALOS drives the route, turning at each corner |
| 6 · Inspect | Ground probe samples moisture, temperature, humidity |
| 7 · Act | Irrigation if moisture < 40%, otherwise referred |
| 8 · Repeat | Moves to the next priority zone |
| 8 · Return | Work finished — TALOS walks back and docks at the depot |
| 9 · Measure | MERCATUS reports the session |
| 10 · Complete | Mission summary card: zones treated, water used and saved, distance, energy, estimated cost and savings |

**Controls.** `Pause` freezes the entire simulation, not just the script — `Resume`
continues from the same frame. `Reset` returns everything to standby.

**Camera.** `Farm`, `Pegasus`, `Talos`, `Problem zone`, `Overview` in the bottom bar.
Pegasus and Talos keep tracking their subject as it moves. Drag to orbit, scroll to zoom,
right-drag to pan — taking the camera by hand releases the tracking.

**Demonstrating one module at a time.** `Module controls` opens a tabbed drawer with the
individual panels: fly PEGASUS manually, run a scan alone, plan routes and toggle
obstacles to watch A* re-plan, deploy TALOS by hand, or inspect the MERCATUS breakdown.

**Zones.** Hover any zone for its label; click for its full readings and diagnosis.

**The machine always comes home.** After the last treatment TALOS plans a fresh route back
to the depot — fresh rather than the outbound route reversed, because obstacles may have
been toggled mid-mission. It walks the whole way and arrives in standby. Driving the
modules by hand, `Return to depot` in the TALOS panel does the same thing, and the summary
card appears once it docks.

**Full-screen field.** `Hide UI` in the bottom bar — or the **H** key — clears every panel
so the farm fills the screen. Press **H** again, **Escape**, or the small *Show interface*
button in the corner to bring it back. The simulation keeps running while hidden, so this
can be toggled mid-demo.

### Suggested five-minute walkthrough

1. Start on `Overview` to establish the field.
2. Press **Start full demo**; let the survey run on the `Pegasus` camera.
3. When findings appear, switch to `Problem zone` to see the diagnostic markers.
4. Follow the rover on `Talos` through navigation and irrigation.
5. Open **Module controls → Promethia**, toggle an obstacle, and show the route change.
6. Finish on the mission summary and **Module controls → Mercatus**.

## 5. Known limitations

**This is a simulation, and the honest boundaries matter more than the feature list.**

- **BUDDHI is not a trained model.** It is a rule-based classifier scoring hand-written
  agronomic relationships. It produces real probabilities over four classes and is
  architecturally ready for a trained model, but it has learned nothing.
- **All sensor data is synthetic.** Soil moisture, temperature, humidity, NDVI and lesion
  indices are generated from a scripted field state, not measured.
- **All financial figures are estimates on placeholder rates.** Water, energy, machine and
  labour costs in `systems/mercatus/assumptions.js` are illustrative, not researched. ROI
  is return on the session's *operating cost*, not on equipment investment. On short
  sessions it reaches four figures because one labour assumption dominates — the panel
  says so beside the number.
- **Yield protection is not modelled.** It would be the largest economic term and any
  figure would be invented.
- **The drone's flight envelope is 52 m** — tight enough to keep it clear of the 11 m
  windbreak at its 7 m survey altitude. The landing pad sits at z = 49, so flying manually
  *south* from the pad meets the boundary after 3 m. The field is north; that is the
  direction to fly.
- **The demo treats 2 of 8 flagged zones** by default. Working the whole field takes over
  eleven minutes. Raise `DEMO_CONFIG.zoneLimit` in `systems/demoSequence.js`.
- **Shadows are baked once.** The static scene casts real shadows; PEGASUS and TALOS use a
  projected shadow and a contact shadow respectively. Adding more moving objects means
  removing `DeferredBakeShadows` from `MainScene.jsx` and accepting the cost.
- **No collision detection.** PROMETHIA routes around known obstacles, but nothing
  physically prevents overlap if objects were moved at runtime.
- **No persistence.** Reloading resets everything; there is no backend, database or API.
- **Single field, fixed layout.** 16 zones, one crop pattern, one weather state, no
  seasons or time of day.
- **Desktop-first.** Below 820 px the status rail is hidden. It runs on a tablet; a phone
  is cramped.
- **Not verified on real hardware by the author of this build.** The logic is covered by
  13 automated suites, but the visual rendering was never observed in a browser during
  development — see the note at the end.

## 6. Future hardware implementation plan

The project is deliberately structured so each simulated layer has one replacement point.

### Phase A — Real perception model
Replace the stand-in classifier. `systems/buddhi/index.js` documents the contract: supply
one `async predict(features)` returning probabilities over the four classes, ordered per
`FEATURE_NAMES`. ONNX Runtime Web or TensorFlow.js both fit; `analyze()` is already async,
so no call site changes.
*Needs:* a labelled dataset of multispectral crop imagery, and field validation.

### Phase B — Real telemetry
Replace `sampleSensors` in `systems/inspection.js` with a hardware read. The threshold,
decision and pump cycle work unchanged on whatever it returns. Add the `backend/` service
(currently empty) as an MQTT or REST bridge with a time-series store.
*Needs:* capacitive soil moisture probes, ambient temperature/humidity sensors, telemetry
radio.

### Phase C — Real airframes
Replace the procedural models via the GLB seams in `models/*Model.jsx`. Each documents the
node contract its replacement must honour (four rotor groups, four wheel groups, a
gimbal pivot).
*Needs:* a survey quadcopter with a multispectral payload, and a four-wheel rover with a
tank and boom.

### Phase D — Real flight and navigation
Swap `flightModel.js` for MAVLink/PX4 telemetry and `roverMotion.js` for ROS 2 `cmd_vel`
plus odometry. PROMETHIA's grid becomes an occupancy map from SLAM rather than a derived
layout; A* itself is unchanged, only its cost source moves.
*Needs:* RTK GPS, IMU, wheel encoders, LiDAR, and — the hard part — obstacle detection and
safety interlocks that do not exist here at all.

### Phase E — Field validation
Only after A–D does MERCATUS become meaningful. Replace every rate in
`assumptions.js` with metered local figures, add the excluded terms (yield response,
capital cost, payback) with trial data behind them, and re-run the comparison against a
measured control plot rather than a modelled counterfactual.

---

## Testing

Thirteen suites cover the pure logic — flight, survey, classification, routing, obstacles,
rover motion, inspection, economics and the demo sequence:

```bash
node --loader ./tests/resolver.mjs tests/<suite>.mjs
```

They assert behaviour rather than implementation: A*'s optimality is checked against
Dijkstra on 96 scenarios, the classifier is scored against ground truth it never sees,
the rover is verified never to teleport or deviate from its planned corridor, and the
economics are hand-checked against values computed independently.

**A note on verification.** This build was developed in an environment with no browser and
no GPU. Every suite above passes, the production build is clean, and all 77 modules
transform without error — but the rendered result was never observed during development.
Visual behaviour should be confirmed on your own machine.
