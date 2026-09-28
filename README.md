# 🧠 AI Council

> A multi-model AI reasoning system that combines independent perspectives from multiple large language models and uses a Chairman model to synthesize the results into a final analysis.

## Overview

AI Council is designed around a simple idea:

**Instead of relying on a single AI model, ask multiple models independently and then have another model analyze their responses.**

A user submits a question. The system sends it to multiple AI models in parallel. Each model generates its own reasoning without seeing the other responses.

A dedicated **Chairman model** then receives the council's responses and analyzes:

- Areas of agreement
- Areas of disagreement
- Different perspectives
- Strengths and weaknesses of the arguments
- Important missing considerations
- A synthesized final analysis

The system is designed to make the reasoning process more transparent rather than treating the output of a single model as automatically correct.

---

## ⚙️ How It Works


```
┌─────────────────┐
│   User Query    │
└────────┬────────┘
         │
         ▼
┌───────────────────────┐
│    AI Council Engine  │
└───────────┬───────────┘
            │
   ┌────────┼────────┐
   │        │        │
   ▼        ▼        ▼
┌────────┐┌────────┐┌────────┐
│Model 1 ││Model 2 ││Model 3 │
└────────┘└────────┘└────────┘
   │        │        │
   └────────┼────────┘
            │
     ┌──────▼──────┐
     │   Model 4   │
     └──────┬──────┘
            │
            ▼
┌──────────────────────┐
│   Chairman Model     │
│                      │
│ Compare responses    │
│ Find agreements      │
│ Find disagreements   │
│ Identify gaps        │
│ Synthesize analysis  │
└──────────┬───────────┘
           │
           ▼
 ┌──────────────────┐
 │   Final Verdict  │
 └──────────────────┘
```

<img width="1580" height="945" alt="image" src="https://github.com/user-attachments/assets/771c5eef-34e6-4c11-9b5d-5824a42a4024" />

<img width="1223" height="527" alt="image" src="https://github.com/user-attachments/assets/df97d569-3292-4d42-9cdc-72f14df80822" />

