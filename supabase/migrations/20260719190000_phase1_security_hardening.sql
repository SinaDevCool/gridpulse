-- Phase 1 security hardening: make customer-workspace access boundaries explicit.
-- The helper functions already verify ownership or accepted collaboration and are
-- executable only by authenticated users. Restrict every related policy to that
-- role as defense in depth and remove anonymous table privileges.

revoke all on table public.evidence_claims from anon;
revoke all on table public.project_site_candidates from anon;
revoke all on table public.flexibility_profiles from anon;
revoke all on table public.operator_packages from anon;
revoke all on table public.decision_trace_items from anon;
revoke all on table public.flexibility_simulations from anon;
revoke all on table public.connection_decisions from anon;
revoke all on table public.assessment_reviews from anon;
revoke all on table public.operations_simulations from anon;
revoke all on table public.pilot_metrics from anon;
revoke all on table public.integration_events from anon;

alter policy "participants read evidence claims" on public.evidence_claims to authenticated;
alter policy "editors manage evidence claims" on public.evidence_claims to authenticated;
alter policy "participants read site candidates" on public.project_site_candidates to authenticated;
alter policy "editors manage site candidates" on public.project_site_candidates to authenticated;
alter policy "participants read flexibility profiles" on public.flexibility_profiles to authenticated;
alter policy "editors manage flexibility profiles" on public.flexibility_profiles to authenticated;
alter policy "participants read operator packages" on public.operator_packages to authenticated;
alter policy "editors create operator packages" on public.operator_packages to authenticated;
alter policy "editors update draft packages" on public.operator_packages to authenticated;
alter policy "participants read decision trace" on public.decision_trace_items to authenticated;
alter policy "editors create decision trace" on public.decision_trace_items to authenticated;
alter policy "participants read flexibility simulations" on public.flexibility_simulations to authenticated;
alter policy "editors create flexibility simulations" on public.flexibility_simulations to authenticated;
alter policy "participants read connection decisions" on public.connection_decisions to authenticated;
alter policy "editors create connection decisions" on public.connection_decisions to authenticated;
alter policy "participants read assessment reviews" on public.assessment_reviews to authenticated;
alter policy "editors manage assessment reviews" on public.assessment_reviews to authenticated;
alter policy "participants read operations simulations" on public.operations_simulations to authenticated;
alter policy "editors manage operations simulations" on public.operations_simulations to authenticated;
alter policy "participants read pilot metrics" on public.pilot_metrics to authenticated;
alter policy "editors manage pilot metrics" on public.pilot_metrics to authenticated;
alter policy "participants read integration events" on public.integration_events to authenticated;
alter policy "editors manage integration events" on public.integration_events to authenticated;

comment on schema public is
  'GridPulse public API schema. Anonymous access is limited to explicitly public intake operations.';
