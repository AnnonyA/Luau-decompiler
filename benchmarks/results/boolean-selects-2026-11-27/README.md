# Boolean-select development evidence

These are diagnostic quality replays and authored behavioral controls, not the four-tier release score. The frozen baseline is main `36a344eeed74d194723e6f32a0ef7d699fac550f` (same engine as published `f9543bbb`). Corpus, scorer, options and denominators are unchanged.

| Candidate | Quick similarity | Delta from baseline | Token ratio |
| --- | ---: | ---: | ---: |
| initial-rejected | 76.886503057% | -0.041767894 pp | 0.990981753 |
| boolean-only | 76.952231505% | +0.023960554 pp | 0.991983991 |
| with-primitive-prefixes | 76.955732582% | +0.027461630 pp | 0.991969134 |

The initial inverse-select experiment was rejected; its report is preserved. All three diagnostics decompiled 882/882 inputs, with `behaviorVerified: false`. Their JSON records the exact JavaScript snapshot hashes.

The two authored source controls pass **24/24** normal/hard O0/O1/O2 round trips with both the untouched baseline and the bounded candidate. Their sources and 24 hashed bytecodes are under `tests/fixtures/boolean-selects/`. The focused unit gate passed 67/67. An earlier broad unit run overlapped a source/test edit and is not an acceptance gate; its log remains in the scratch development archive.

The integrated engine still requires strict Quick, Full, Hard Quick and Hard Full plus the existing required CI before publication.
