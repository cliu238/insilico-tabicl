 use subagent expert-orchestrator
  description: >
    Coordinate subagents (planner, researcher, va-data-relationship-analyst,
    tabicl-expert, openva-insilico-expert) to design a plan and task list
    for comparing InSilicoVA vs TabICL trained on PHMRC and evaluated on WHO2016 MITS.
  goal: >
    Produce PLANNING.md and TODO.md only (no implementation). The plan must
    train on PHMRC (child + neonate) and predict on MITS (WHO2016 format),
    then compare individual accuracy and CSMF between InSilicoVA and TabICL.

  data:
    train:
      - data/raw/PHMRC/IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv
      - data/raw/PHMRC/IHME_PHMRC_VA_DATA_NEONATE_Y2013M09D11_0.csv
      - data.type: "phmrc"
    test:
      - data/raw/MITS/asr114_va2016.csv
      - data.type: "who2016"
    schema_reference:
      - data/20250609_gs34_vs_UC_CHAMPS_desc[92].r

  constraints_and_preferences:
    - Use existing Docker for InSilicoVA (allowed to modify model/config if needed).
    - Prefer openVA arguments with data.type="phmrc" (train) and data.type="who2016" (predict).
    - Deliver planning artifacts only; do not run code.
    - Clearly document label column, droppable columns, and any mapping between PHMRC causes and WHO2016/MITS causes.

  deliverables:
    PLANNING.md:
    TODO.md: (status is all incompleted)
    - Both PLANNING.md and TODO.md are complete, internally consistent, and reference the exact file paths above.
    - InSilicoVA and TabICL plans yield comparable outputs (per-case predictions) enabling accuracy and CSMF computation.
    - All required mappings (labels, dropped columns, cause lists) are specified without ambiguity.