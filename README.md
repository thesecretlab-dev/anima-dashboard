# ANIMA Dashboard

**Real-time monitoring and control interface for [ANIMA](https://github.com/thesecretlab-dev/anima-runtime) autonomous agent fleets.**

Web-based dashboard for tracking agent lifecycle, market positions, validator status, and fleet health across the VEIL network.

## Features

- **Agent Lifecycle View** â€” Track each agent through Genesis â†’ Validation â†’ Identity â†’ Trading â†’ Sovereignty
- **Market Positions** â€” Live P/L, open orders, prediction market portfolio across agents
- **Validator Monitoring** â€” Node health, stake status, uptime, and consensus participation
- **Fleet Overview** â€” Parent-child relationships, resource usage, revenue per agent
- **Bloodsworn Reputation** â€” On-chain reputation scores and capability gates
- **Child Spawning Controls** â€” Approve, configure, and monitor new agent bootstrapping

## Architecture

```
Dashboard
â”œâ”€â”€ Agent cards          Individual agent status + lifecycle stage
â”œâ”€â”€ Fleet topology       Parent-child hierarchy visualization
â”œâ”€â”€ Market panel         Aggregated positions + per-agent P/L
â”œâ”€â”€ Validator panel      Node health + staking metrics
â”œâ”€â”€ Event stream         Real-time agent activity log
â””â”€â”€ Spawn controls       Child agent configuration + approval
```

## Quick Start

```bash
git clone https://github.com/thesecretlab-dev/anima-dashboard.git
cd anima-dashboard
npm install
npm run dev
```

## Ecosystem

| Component | Repo |
|-----------|------|
| Agent Runtime | [anima-runtime](https://github.com/thesecretlab-dev/anima-runtime) |
| Fleet Orchestration | [anima-orchestrator](https://github.com/thesecretlab-dev/anima-orchestrator) |
| Chain (VeilVM) | [veilvm](https://github.com/thesecretlab-dev/veilvm) |
| Smart Contracts | [veil-contracts](https://github.com/thesecretlab-dev/veil-contracts) |

---

*See everything. Control what matters.*
