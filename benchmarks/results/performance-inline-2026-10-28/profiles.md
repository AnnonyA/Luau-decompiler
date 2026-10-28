# Large-corpus performance

Fresh process per profile/engine; alternating baseline/candidate order; GC outside timing. RSS is whole-worker peak including warmup. Retained heap holds the API result. Recovery disabled only for output-identical performance comparison; candidate default mode measured separately. No hard timing CI thresholds.

| Profile | Before ms | After ms | Default O2 recovery ms | Speedup | RSS before/after MiB |
|---|---:|---:|---:|---:|---:|
| pilot/protocol-router/O0 | 214.3 | 187.4 | 189.6 | 1.14x | 191.0 / 178.7 |
| pilot/protocol-router/O1 | 175.2 | 175.8 | 158.1 | 1.00x | 146.6 / 154.0 |
| pilot/protocol-router/O2 | 222.4 | 195.3 | 210.8 | 1.14x | 198.1 / 200.7 |
| pilot/transaction-store/O0 | 206.9 | 165.8 | 178.6 | 1.25x | 129.1 / 136.5 |
| pilot/transaction-store/O1 | 175.8 | 148.8 | 152.7 | 1.18x | 124.0 / 130.2 |
| pilot/transaction-store/O2 | 190.5 | 160.2 | 162.1 | 1.19x | 134.3 / 131.1 |
| pilot/workflow-scheduler/O0 | 246.9 | 227.4 | 238.5 | 1.09x | 191.0 / 196.6 |
| pilot/workflow-scheduler/O1 | 237.2 | 238.7 | 223.0 | 0.99x | 196.9 / 191.7 |
| pilot/workflow-scheduler/O2 | 271.3 | 241.9 | 248.0 | 1.12x | 194.1 / 193.7 |
| pilot/query-planner/O0 | 192.7 | 153.2 | 184.6 | 1.26x | 184.8 / 188.9 |
| pilot/query-planner/O1 | 192.3 | 140.7 | 154.6 | 1.37x | 184.9 / 146.1 |
| pilot/query-planner/O2 | 247.6 | 217.3 | 221.4 | 1.14x | 193.8 / 195.0 |
| pilot/reactive-simulation/O0 | 183.6 | 163.6 | 178.8 | 1.12x | 188.3 / 187.1 |
| pilot/reactive-simulation/O1 | 175.4 | 166.9 | 170.5 | 1.05x | 182.4 / 187.3 |
| pilot/reactive-simulation/O2 | 214.6 | 205.5 | 197.4 | 1.04x | 193.9 / 192.2 |
| cohort2/archive-filesystem/O0 | 282.0 | 246.1 | 268.3 | 1.15x | 207.2 / 194.7 |
| cohort2/archive-filesystem/O1 | 324.0 | 297.0 | 308.4 | 1.09x | 196.4 / 200.1 |
| cohort2/archive-filesystem/O2 | 381.6 | 311.9 | 300.4 | 1.22x | 194.0 / 207.0 |
| cohort2/document-layout/O0 | 440.3 | 346.8 | 359.4 | 1.27x | 204.2 / 198.8 |
| cohort2/document-layout/O1 | 325.2 | 296.7 | 316.5 | 1.10x | 198.6 / 199.8 |
| cohort2/document-layout/O2 | 380.1 | 308.5 | 317.2 | 1.23x | 200.5 / 200.8 |
| cohort2/symbolic-algebra/O0 | 358.5 | 269.0 | 278.7 | 1.33x | 192.4 / 192.6 |
| cohort2/symbolic-algebra/O1 | 267.3 | 235.3 | 227.2 | 1.14x | 197.9 / 196.5 |
| cohort2/symbolic-algebra/O2 | 809.0 | 671.1 | 677.2 | 1.21x | 222.8 / 216.9 |
| cohort2/constraint-search/O0 | 189.3 | 158.3 | 170.4 | 1.20x | 183.8 / 185.8 |
| cohort2/constraint-search/O1 | 199.8 | 155.4 | 159.5 | 1.29x | 180.8 / 155.8 |
| cohort2/constraint-search/O2 | 281.6 | 247.7 | 258.9 | 1.14x | 198.8 / 189.9 |
| cohort2/geometry-pipeline/O0 | 463.6 | 317.2 | 372.5 | 1.46x | 200.3 / 206.6 |
| cohort2/geometry-pipeline/O1 | 415.0 | 353.6 | 359.2 | 1.17x | 203.1 / 205.7 |
| cohort2/geometry-pipeline/O2 | 646.9 | 487.5 | 501.9 | 1.33x | 209.7 / 215.3 |

Output-identical profiles: 30/30.
Ratio of summed per-profile medians: 1.19x; default mode: 1.15x.
These development corpora measure this host and Node version, not universal performance or competitor speed.
