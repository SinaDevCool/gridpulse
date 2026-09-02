-- Release 2 fail-closed physics coverage evidence.
-- Existing decisions predate this gate and retain zero coverage until rerun.

alter table public.grid_model_promotion_decisions
  add column if not exists physics_coverage double precision not null default 0
    check (physics_coverage between 0 and 1),
  add column if not exists mandatory_contingency_coverage double precision not null default 0
    check (mandatory_contingency_coverage between 0 and 1);

comment on column public.grid_model_promotion_decisions.physics_coverage is
  'Share of the active-learning selected batch returned as physics-verified outcomes.';
comment on column public.grid_model_promotion_decisions.mandatory_contingency_coverage is
  'Share of selected mandatory contingencies returned as physics-verified outcomes.';
