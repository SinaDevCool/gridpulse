export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      assessment_activity: {
        Row: {
          actor_id: string | null;
          created_at: string;
          details: Json;
          entity_id: string | null;
          entity_type: string;
          event_type: string;
          id: string;
          site_id: string;
          summary: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type: string;
          event_type: string;
          id?: string;
          site_id: string;
          summary: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type?: string;
          event_type?: string;
          id?: string;
          site_id?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_activity_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_collaborators: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          id: string;
          invited_email: string;
          owner_id: string;
          role: string;
          site_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          id?: string;
          invited_email: string;
          owner_id?: string;
          role?: string;
          site_id: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          id?: string;
          invited_email?: string;
          owner_id?: string;
          role?: string;
          site_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_collaborators_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_documents: {
        Row: {
          created_at: string;
          document_type: string;
          file_name: string;
          id: string;
          mime_type: string;
          notes: string | null;
          review_status: string;
          site_id: string;
          size_bytes: number;
          source_classification: string;
          storage_path: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          document_type: string;
          file_name: string;
          id?: string;
          mime_type: string;
          notes?: string | null;
          review_status?: string;
          site_id: string;
          size_bytes: number;
          source_classification: string;
          storage_path: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          document_type?: string;
          file_name?: string;
          id?: string;
          mime_type?: string;
          notes?: string | null;
          review_status?: string;
          site_id?: string;
          size_bytes?: number;
          source_classification?: string;
          storage_path?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_documents_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_evidence: {
        Row: {
          classification: string;
          confidence: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          observed_at: string | null;
          site_id: string;
          source_name: string | null;
          source_url: string | null;
          title: string;
          unit: string | null;
          updated_at: string;
          user_id: string;
          validation_status: string;
          value: Json | null;
        };
        Insert: {
          classification: string;
          confidence?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          observed_at?: string | null;
          site_id: string;
          source_name?: string | null;
          source_url?: string | null;
          title: string;
          unit?: string | null;
          updated_at?: string;
          user_id?: string;
          validation_status?: string;
          value?: Json | null;
        };
        Update: {
          classification?: string;
          confidence?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          observed_at?: string | null;
          site_id?: string;
          source_name?: string | null;
          source_url?: string | null;
          title?: string;
          unit?: string | null;
          updated_at?: string;
          user_id?: string;
          validation_status?: string;
          value?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_evidence_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_milestones: {
        Row: {
          completed_at: string | null;
          created_at: string;
          due_at: string;
          id: string;
          milestone_type: string;
          notes: string | null;
          reminder_days: number;
          site_id: string;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          due_at: string;
          id?: string;
          milestone_type: string;
          notes?: string | null;
          reminder_days?: number;
          site_id: string;
          status?: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          due_at?: string;
          id?: string;
          milestone_type?: string;
          notes?: string | null;
          reminder_days?: number;
          site_id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_milestones_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_sites: {
        Row: {
          assessment_status: string;
          bess_energy_mwh: number | null;
          bess_power_mw: number | null;
          cable_route_status: string;
          connection_challenge: string | null;
          country_code: string;
          created_at: string;
          decision_notes: string | null;
          decision_status: string;
          federal_state: string | null;
          finance_status: string;
          id: string;
          intake_source: string;
          land_status: string;
          latitude: number;
          likely_network_operator: string | null;
          load_factor: number | null;
          longitude: number;
          minimum_viable_import_mw: number | null;
          municipality: string | null;
          name: string;
          operator_confirmation_status: string;
          operator_profile_key: string | null;
          operator_status: string;
          pilot_request_id: string | null;
          planning_status: string;
          postcode: string | null;
          project_kind: string | null;
          project_type: string;
          ramp_rate_mw_min: number | null;
          redundancy_requirement: string | null;
          requested_export_mw: number;
          requested_import_mw: number;
          responsibility_confirmed_at: string | null;
          responsibility_source: string | null;
          responsible_operator_level: string | null;
          responsible_operator_name: string | null;
          single_line_diagram_ready: boolean;
          target_energization_date: string | null;
          target_voltage_kv: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          assessment_status?: string;
          bess_energy_mwh?: number | null;
          bess_power_mw?: number | null;
          cable_route_status?: string;
          connection_challenge?: string | null;
          country_code?: string;
          created_at?: string;
          decision_notes?: string | null;
          decision_status?: string;
          federal_state?: string | null;
          finance_status?: string;
          id?: string;
          intake_source?: string;
          land_status?: string;
          latitude: number;
          likely_network_operator?: string | null;
          load_factor?: number | null;
          longitude: number;
          minimum_viable_import_mw?: number | null;
          municipality?: string | null;
          name: string;
          operator_confirmation_status?: string;
          operator_profile_key?: string | null;
          operator_status?: string;
          pilot_request_id?: string | null;
          planning_status?: string;
          postcode?: string | null;
          project_kind?: string | null;
          project_type: string;
          ramp_rate_mw_min?: number | null;
          redundancy_requirement?: string | null;
          requested_export_mw?: number;
          requested_import_mw?: number;
          responsibility_confirmed_at?: string | null;
          responsibility_source?: string | null;
          responsible_operator_level?: string | null;
          responsible_operator_name?: string | null;
          single_line_diagram_ready?: boolean;
          target_energization_date?: string | null;
          target_voltage_kv?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          assessment_status?: string;
          bess_energy_mwh?: number | null;
          bess_power_mw?: number | null;
          cable_route_status?: string;
          connection_challenge?: string | null;
          country_code?: string;
          created_at?: string;
          decision_notes?: string | null;
          decision_status?: string;
          federal_state?: string | null;
          finance_status?: string;
          id?: string;
          intake_source?: string;
          land_status?: string;
          latitude?: number;
          likely_network_operator?: string | null;
          load_factor?: number | null;
          longitude?: number;
          minimum_viable_import_mw?: number | null;
          municipality?: string | null;
          name?: string;
          operator_confirmation_status?: string;
          operator_profile_key?: string | null;
          operator_status?: string;
          pilot_request_id?: string | null;
          planning_status?: string;
          postcode?: string | null;
          project_kind?: string | null;
          project_type?: string;
          ramp_rate_mw_min?: number | null;
          redundancy_requirement?: string | null;
          requested_export_mw?: number;
          requested_import_mw?: number;
          responsibility_confirmed_at?: string | null;
          responsibility_source?: string | null;
          responsible_operator_level?: string | null;
          responsible_operator_name?: string | null;
          single_line_diagram_ready?: boolean;
          target_energization_date?: string | null;
          target_voltage_kv?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_sites_pilot_request_id_fkey";
            columns: ["pilot_request_id"];
            isOneToOne: false;
            referencedRelation: "pilot_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      connection_decisions: {
        Row: {
          alternatives_rejected: Json;
          assumptions: Json;
          conditions_to_proceed: Json;
          created_at: string;
          decided_at: string | null;
          decision_owner: string | null;
          evidence_ids: string[];
          id: string;
          package_id: string | null;
          rationale: string;
          scenario_id: string;
          site_id: string;
          status: string;
          user_id: string;
          version: number;
        };
        Insert: {
          alternatives_rejected?: Json;
          assumptions?: Json;
          conditions_to_proceed?: Json;
          created_at?: string;
          decided_at?: string | null;
          decision_owner?: string | null;
          evidence_ids?: string[];
          id?: string;
          package_id?: string | null;
          rationale: string;
          scenario_id: string;
          site_id: string;
          status?: string;
          user_id?: string;
          version: number;
        };
        Update: {
          alternatives_rejected?: Json;
          assumptions?: Json;
          conditions_to_proceed?: Json;
          created_at?: string;
          decided_at?: string | null;
          decision_owner?: string | null;
          evidence_ids?: string[];
          id?: string;
          package_id?: string | null;
          rationale?: string;
          scenario_id?: string;
          site_id?: string;
          status?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "connection_decisions_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "operator_packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connection_decisions_scenario_id_fkey";
            columns: ["scenario_id"];
            isOneToOne: false;
            referencedRelation: "connection_scenarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connection_decisions_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      connection_scenarios: {
        Row: {
          analysis: Json | null;
          assumptions: Json;
          calculation_version: string;
          commercial_exposure_eur: number | null;
          conditional_import_mw: number;
          connection_mode: string;
          created_at: string;
          dependencies: Json;
          enabling_assets: Json;
          energy_value_eur_mwh: number;
          eventual_import_mw: number | null;
          evidence_readiness: number;
          firmness: string | null;
          id: string;
          max_export_mw: number | null;
          max_import_mw: number | null;
          minimum_critical_load_mw: number | null;
          name: string;
          outcome: string | null;
          profile_id: string | null;
          provenance: Json;
          restriction_schedule: Json | null;
          scenario_type: string | null;
          selection_rationale: string | null;
          selection_status: string;
          site_id: string;
          status: string;
          supersedes_id: string | null;
          unresolved_evidence: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          analysis?: Json | null;
          assumptions?: Json;
          calculation_version?: string;
          commercial_exposure_eur?: number | null;
          conditional_import_mw?: number;
          connection_mode: string;
          created_at?: string;
          dependencies?: Json;
          enabling_assets?: Json;
          energy_value_eur_mwh?: number;
          eventual_import_mw?: number | null;
          evidence_readiness?: number;
          firmness?: string | null;
          id?: string;
          max_export_mw?: number | null;
          max_import_mw?: number | null;
          minimum_critical_load_mw?: number | null;
          name: string;
          outcome?: string | null;
          profile_id?: string | null;
          provenance?: Json;
          restriction_schedule?: Json | null;
          scenario_type?: string | null;
          selection_rationale?: string | null;
          selection_status?: string;
          site_id: string;
          status?: string;
          supersedes_id?: string | null;
          unresolved_evidence?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          analysis?: Json | null;
          assumptions?: Json;
          calculation_version?: string;
          commercial_exposure_eur?: number | null;
          conditional_import_mw?: number;
          connection_mode?: string;
          created_at?: string;
          dependencies?: Json;
          enabling_assets?: Json;
          energy_value_eur_mwh?: number;
          eventual_import_mw?: number | null;
          evidence_readiness?: number;
          firmness?: string | null;
          id?: string;
          max_export_mw?: number | null;
          max_import_mw?: number | null;
          minimum_critical_load_mw?: number | null;
          name?: string;
          outcome?: string | null;
          profile_id?: string | null;
          provenance?: Json;
          restriction_schedule?: Json | null;
          scenario_type?: string | null;
          selection_rationale?: string | null;
          selection_status?: string;
          site_id?: string;
          status?: string;
          supersedes_id?: string | null;
          unresolved_evidence?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connection_scenarios_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "interval_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connection_scenarios_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connection_scenarios_supersedes_id_fkey";
            columns: ["supersedes_id"];
            isOneToOne: false;
            referencedRelation: "connection_scenarios";
            referencedColumns: ["id"];
          },
        ];
      };
      decision_memos: {
        Row: {
          blockers: Json;
          created_at: string;
          id: string;
          readiness_score: number;
          recommended_next_action: string;
          site_id: string;
          snapshot: Json;
          user_id: string;
          version: number;
          workflow_status: string;
        };
        Insert: {
          blockers?: Json;
          created_at?: string;
          id?: string;
          readiness_score: number;
          recommended_next_action: string;
          site_id: string;
          snapshot: Json;
          user_id?: string;
          version: number;
          workflow_status: string;
        };
        Update: {
          blockers?: Json;
          created_at?: string;
          id?: string;
          readiness_score?: number;
          recommended_next_action?: string;
          site_id?: string;
          snapshot?: Json;
          user_id?: string;
          version?: number;
          workflow_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decision_memos_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      decision_trace_items: {
        Row: {
          confidence: string;
          created_at: string;
          evidence_ids: string[];
          id: string;
          item_kind: string;
          label: string;
          memo_id: string | null;
          parent_ids: string[];
          site_id: string;
          sort_order: number;
          user_id: string;
        };
        Insert: {
          confidence?: string;
          created_at?: string;
          evidence_ids?: string[];
          id?: string;
          item_kind: string;
          label: string;
          memo_id?: string | null;
          parent_ids?: string[];
          site_id: string;
          sort_order?: number;
          user_id?: string;
        };
        Update: {
          confidence?: string;
          created_at?: string;
          evidence_ids?: string[];
          id?: string;
          item_kind?: string;
          label?: string;
          memo_id?: string | null;
          parent_ids?: string[];
          site_id?: string;
          sort_order?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decision_trace_items_memo_id_fkey";
            columns: ["memo_id"];
            isOneToOne: false;
            referencedRelation: "decision_memos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decision_trace_items_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      dso_directory: {
        Row: {
          connection_url: string;
          coverage_summary: string;
          key: string;
          limitation: string;
          operator_name: string;
          verified_on: string;
          voltage_context: string;
          website_url: string;
        };
        Insert: {
          connection_url: string;
          coverage_summary: string;
          key: string;
          limitation: string;
          operator_name: string;
          verified_on: string;
          voltage_context: string;
          website_url: string;
        };
        Update: {
          connection_url?: string;
          coverage_summary?: string;
          key?: string;
          limitation?: string;
          operator_name?: string;
          verified_on?: string;
          voltage_context?: string;
          website_url?: string;
        };
        Relationships: [];
      };
      evidence_claims: {
        Row: {
          assumptions: Json;
          confidence: string;
          created_at: string;
          evidence_class: string;
          expires_at: string | null;
          id: string;
          limitations: Json;
          method: string | null;
          observed_at: string | null;
          operator_validation_required: boolean;
          site_id: string;
          source_evidence_ids: string[];
          title: string;
          updated_at: string;
          user_id: string;
          validation_status: string;
          value: Json | null;
        };
        Insert: {
          assumptions?: Json;
          confidence?: string;
          created_at?: string;
          evidence_class: string;
          expires_at?: string | null;
          id?: string;
          limitations?: Json;
          method?: string | null;
          observed_at?: string | null;
          operator_validation_required?: boolean;
          site_id: string;
          source_evidence_ids?: string[];
          title: string;
          updated_at?: string;
          user_id?: string;
          validation_status?: string;
          value?: Json | null;
        };
        Update: {
          assumptions?: Json;
          confidence?: string;
          created_at?: string;
          evidence_class?: string;
          expires_at?: string | null;
          id?: string;
          limitations?: Json;
          method?: string | null;
          observed_at?: string | null;
          operator_validation_required?: boolean;
          site_id?: string;
          source_evidence_ids?: string[];
          title?: string;
          updated_at?: string;
          user_id?: string;
          validation_status?: string;
          value?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_claims_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      fca_envelopes: {
        Row: {
          created_at: string;
          id: string;
          max_export_mw: number | null;
          max_import_mw: number | null;
          mode: string;
          name: string;
          notes: string | null;
          restriction_schedule: Json;
          site_id: string;
          source_document_id: string | null;
          status: string;
          supersedes_id: string | null;
          user_id: string;
          valid_from: string | null;
          valid_to: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          max_export_mw?: number | null;
          max_import_mw?: number | null;
          mode: string;
          name: string;
          notes?: string | null;
          restriction_schedule?: Json;
          site_id: string;
          source_document_id?: string | null;
          status?: string;
          supersedes_id?: string | null;
          user_id?: string;
          valid_from?: string | null;
          valid_to?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          max_export_mw?: number | null;
          max_import_mw?: number | null;
          mode?: string;
          name?: string;
          notes?: string | null;
          restriction_schedule?: Json;
          site_id?: string;
          source_document_id?: string | null;
          status?: string;
          supersedes_id?: string | null;
          user_id?: string;
          valid_from?: string | null;
          valid_to?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "fca_envelopes_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fca_envelopes_source_document_id_fkey";
            columns: ["source_document_id"];
            isOneToOne: false;
            referencedRelation: "assessment_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fca_envelopes_supersedes_id_fkey";
            columns: ["supersedes_id"];
            isOneToOne: false;
            referencedRelation: "fca_envelopes";
            referencedColumns: ["id"];
          },
        ];
      };
      flexibility_profiles: {
        Row: {
          battery_energy_mwh: number;
          battery_minimum_soc: number;
          battery_power_mw: number;
          battery_round_trip_efficiency: number;
          calculation_version: string;
          commercial_assumptions: Json;
          conditional_import_mw: number;
          created_at: string;
          firm_import_mw: number;
          id: string;
          geographic_transfer_mw: number;
          generator_max_hours_year: number;
          generator_power_mw: number;
          maximum_curtailment_mw: number | null;
          maximum_event_duration_hours: number | null;
          maximum_events_per_day: number | null;
          minimum_critical_load_mw: number;
          name: string;
          notification_lead_minutes: number | null;
          profile_id: string | null;
          ramp_down_mw_per_min: number;
          ramp_up_mw_per_min: number;
          requested_import_mw: number;
          restriction_duration_hours: number;
          restriction_events_per_year: number;
          result: Json;
          recovery_hours: number | null;
          sla_constraints: string | null;
          shiftable_load_mw: number;
          site_id: string;
          status: string;
          specification_version: string;
          updated_at: string;
          ups_energy_mwh: number;
          ups_power_mw: number;
          user_id: string;
          validation_report: Json;
          version: number;
          initial_battery_soc: number;
          supersedes_id: string | null;
          workload_transfer_notes: string | null;
        };
        Insert: {
          battery_energy_mwh?: number;
          battery_minimum_soc?: number;
          battery_power_mw?: number;
          battery_round_trip_efficiency?: number;
          calculation_version?: string;
          commercial_assumptions?: Json;
          conditional_import_mw?: number;
          created_at?: string;
          firm_import_mw: number;
          id?: string;
          geographic_transfer_mw?: number;
          generator_max_hours_year?: number;
          generator_power_mw?: number;
          maximum_curtailment_mw?: number | null;
          maximum_event_duration_hours?: number | null;
          maximum_events_per_day?: number | null;
          minimum_critical_load_mw: number;
          name: string;
          notification_lead_minutes?: number | null;
          profile_id?: string | null;
          ramp_down_mw_per_min?: number;
          ramp_up_mw_per_min?: number;
          requested_import_mw: number;
          restriction_duration_hours?: number;
          restriction_events_per_year?: number;
          result?: Json;
          recovery_hours?: number | null;
          sla_constraints?: string | null;
          shiftable_load_mw?: number;
          site_id: string;
          status?: string;
          specification_version?: string;
          updated_at?: string;
          ups_energy_mwh?: number;
          ups_power_mw?: number;
          user_id?: string;
          validation_report?: Json;
          version?: number;
          initial_battery_soc?: number;
          supersedes_id?: string | null;
          workload_transfer_notes?: string | null;
        };
        Update: {
          battery_energy_mwh?: number;
          battery_minimum_soc?: number;
          battery_power_mw?: number;
          battery_round_trip_efficiency?: number;
          calculation_version?: string;
          commercial_assumptions?: Json;
          conditional_import_mw?: number;
          created_at?: string;
          firm_import_mw?: number;
          id?: string;
          geographic_transfer_mw?: number;
          generator_max_hours_year?: number;
          generator_power_mw?: number;
          maximum_curtailment_mw?: number | null;
          maximum_event_duration_hours?: number | null;
          maximum_events_per_day?: number | null;
          minimum_critical_load_mw?: number;
          name?: string;
          notification_lead_minutes?: number | null;
          profile_id?: string | null;
          ramp_down_mw_per_min?: number;
          ramp_up_mw_per_min?: number;
          requested_import_mw?: number;
          restriction_duration_hours?: number;
          restriction_events_per_year?: number;
          result?: Json;
          recovery_hours?: number | null;
          sla_constraints?: string | null;
          shiftable_load_mw?: number;
          site_id?: string;
          status?: string;
          specification_version?: string;
          updated_at?: string;
          ups_energy_mwh?: number;
          ups_power_mw?: number;
          user_id?: string;
          validation_report?: Json;
          version?: number;
          initial_battery_soc?: number;
          supersedes_id?: string | null;
          workload_transfer_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "flexibility_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "interval_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flexibility_profiles_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      flexibility_simulations: {
        Row: {
          calculation_version: string;
          created_at: string;
          id: string;
          classification: string;
          input_manifest: Json;
          profile_id: string;
          scenario_id: string | null;
          settings: Json;
          site_id: string;
          summary: Json;
          timeline: Json;
          user_id: string;
          version: number;
        };
        Insert: {
          calculation_version: string;
          created_at?: string;
          id?: string;
          classification?: string;
          input_manifest?: Json;
          profile_id: string;
          scenario_id?: string | null;
          settings: Json;
          site_id: string;
          summary: Json;
          timeline: Json;
          user_id?: string;
          version: number;
        };
        Update: {
          calculation_version?: string;
          created_at?: string;
          id?: string;
          classification?: string;
          input_manifest?: Json;
          profile_id?: string;
          scenario_id?: string | null;
          settings?: Json;
          site_id?: string;
          summary?: Json;
          timeline?: Json;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "flexibility_simulations_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "interval_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flexibility_simulations_scenario_id_fkey";
            columns: ["scenario_id"];
            isOneToOne: false;
            referencedRelation: "connection_scenarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flexibility_simulations_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      grid_data_sources: {
        Row: {
          authority: string;
          coverage: string;
          data_type: string;
          key: string;
          limitation: string;
          source_url: string;
          title: string;
          use_in_gridpulse: string;
          verified_on: string;
        };
        Insert: {
          authority: string;
          coverage: string;
          data_type: string;
          key: string;
          limitation: string;
          source_url: string;
          title: string;
          use_in_gridpulse: string;
          verified_on: string;
        };
        Update: {
          authority?: string;
          coverage?: string;
          data_type?: string;
          key?: string;
          limitation?: string;
          source_url?: string;
          title?: string;
          use_in_gridpulse?: string;
          verified_on?: string;
        };
        Relationships: [];
      };
      interval_profiles: {
        Row: {
          calculation_version: string | null;
          created_at: string;
          id: string;
          column_mapping: Json;
          interval_count: number;
          interval_minutes: number;
          name: string;
          peak_export_mw: number;
          peak_import_mw: number;
          period_end: string;
          period_start: string;
          points: Json;
          quality_report: Json;
          quality_status: string;
          site_id: string;
          source_filename: string | null;
          source_hash: string | null;
          source_classification: string;
          supersedes_id: string | null;
          timezone: string;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          calculation_version?: string | null;
          created_at?: string;
          id?: string;
          column_mapping?: Json;
          interval_count: number;
          interval_minutes: number;
          name: string;
          peak_export_mw?: number;
          peak_import_mw?: number;
          period_end: string;
          period_start: string;
          points: Json;
          quality_report?: Json;
          quality_status?: string;
          site_id: string;
          source_filename?: string | null;
          source_hash?: string | null;
          source_classification?: string;
          supersedes_id?: string | null;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Update: {
          calculation_version?: string | null;
          created_at?: string;
          id?: string;
          column_mapping?: Json;
          interval_count?: number;
          interval_minutes?: number;
          name?: string;
          peak_export_mw?: number;
          peak_import_mw?: number;
          period_end?: string;
          period_start?: string;
          points?: Json;
          quality_report?: Json;
          quality_status?: string;
          site_id?: string;
          source_filename?: string | null;
          source_hash?: string | null;
          source_classification?: string;
          supersedes_id?: string | null;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "interval_profiles_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_correspondence: {
        Row: {
          contact_name: string | null;
          created_at: string;
          direction: string;
          document_id: string | null;
          id: string;
          occurred_at: string;
          site_id: string;
          subject: string;
          summary: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          contact_name?: string | null;
          created_at?: string;
          direction: string;
          document_id?: string | null;
          id?: string;
          occurred_at: string;
          site_id: string;
          subject: string;
          summary: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          contact_name?: string | null;
          created_at?: string;
          direction?: string;
          document_id?: string | null;
          id?: string;
          occurred_at?: string;
          site_id?: string;
          subject?: string;
          summary?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operator_correspondence_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "assessment_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operator_correspondence_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_packages: {
        Row: {
          created_at: string;
          id: string;
          issued_at: string | null;
          manifest: Json;
          input_manifest: Json;
          methodology_version: string;
          site_id: string;
          snapshot: Json;
          status: string;
          user_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          issued_at?: string | null;
          manifest?: Json;
          input_manifest?: Json;
          methodology_version?: string;
          site_id: string;
          snapshot: Json;
          status?: string;
          user_id?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          issued_at?: string | null;
          manifest?: Json;
          input_manifest?: Json;
          methodology_version?: string;
          site_id?: string;
          snapshot?: Json;
          status?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "operator_packages_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_profiles: {
        Row: {
          application_url: string;
          grid_level: string;
          key: string;
          limitation: string;
          operator_name: string;
          procedure_name: string;
          procedure_version: string;
          region_label: string;
          requirement_template: Json;
          updated_at: string;
        };
        Insert: {
          application_url: string;
          grid_level: string;
          key: string;
          limitation: string;
          operator_name: string;
          procedure_name: string;
          procedure_version: string;
          region_label: string;
          requirement_template: Json;
          updated_at?: string;
        };
        Update: {
          application_url?: string;
          grid_level?: string;
          key?: string;
          limitation?: string;
          operator_name?: string;
          procedure_name?: string;
          procedure_version?: string;
          region_label?: string;
          requirement_template?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      operator_requirements: {
        Row: {
          category: string;
          created_at: string;
          document_id: string | null;
          id: string;
          label: string;
          notes: string | null;
          profile_key: string | null;
          requirement_key: string;
          site_id: string;
          sort_order: number;
          source_url: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          document_id?: string | null;
          id?: string;
          label: string;
          notes?: string | null;
          profile_key?: string | null;
          requirement_key: string;
          site_id: string;
          sort_order?: number;
          source_url?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          document_id?: string | null;
          id?: string;
          label?: string;
          notes?: string | null;
          profile_key?: string | null;
          requirement_key?: string;
          site_id?: string;
          sort_order?: number;
          source_url?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operator_requirements_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "assessment_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operator_requirements_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      pilot_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pilot_requests: {
        Row: {
          battery_energy_mwh: number | null;
          battery_power_mw: number | null;
          company: string;
          commercial_deadline: string | null;
          connection_challenge: string;
          consent_to_contact: boolean;
          contact_name: string;
          created_at: string;
          created_by: string | null;
          federal_state: string;
          flexibility_status: string;
          id: string;
          candidate_site_count: number;
          land_status: string;
          load_profile_available: boolean;
          minimum_viable_import_mw: number | null;
          municipality: string;
          operator_engagement_status: string;
          phone: string | null;
          postcode: string;
          project_name: string;
          project_stage: string;
          project_type: string;
          planning_status: string;
          requested_export_mw: number;
          requested_import_mw: number;
          role_title: string | null;
          source: string;
          status: string;
          target_connection_date: string | null;
          updated_at: string;
          website: string;
          work_email: string;
        };
        Insert: {
          battery_energy_mwh?: number | null;
          battery_power_mw?: number | null;
          company: string;
          commercial_deadline?: string | null;
          connection_challenge: string;
          consent_to_contact: boolean;
          contact_name: string;
          created_at?: string;
          created_by?: string | null;
          federal_state: string;
          flexibility_status?: string;
          id?: string;
          candidate_site_count?: number;
          land_status?: string;
          load_profile_available?: boolean;
          minimum_viable_import_mw?: number | null;
          municipality: string;
          operator_engagement_status?: string;
          phone?: string | null;
          postcode: string;
          project_name: string;
          project_stage: string;
          project_type: string;
          planning_status?: string;
          requested_export_mw?: number;
          requested_import_mw?: number;
          role_title?: string | null;
          source?: string;
          status?: string;
          target_connection_date?: string | null;
          updated_at?: string;
          website?: string;
          work_email: string;
        };
        Update: {
          battery_energy_mwh?: number | null;
          battery_power_mw?: number | null;
          company?: string;
          commercial_deadline?: string | null;
          connection_challenge?: string;
          consent_to_contact?: boolean;
          contact_name?: string;
          created_at?: string;
          created_by?: string | null;
          federal_state?: string;
          flexibility_status?: string;
          id?: string;
          candidate_site_count?: number;
          land_status?: string;
          load_profile_available?: boolean;
          minimum_viable_import_mw?: number | null;
          municipality?: string;
          operator_engagement_status?: string;
          phone?: string | null;
          postcode?: string;
          project_name?: string;
          project_stage?: string;
          project_type?: string;
          planning_status?: string;
          requested_export_mw?: number;
          requested_import_mw?: number;
          role_title?: string | null;
          source?: string;
          status?: string;
          target_connection_date?: string | null;
          updated_at?: string;
          website?: string;
          work_email?: string;
        };
        Relationships: [];
      };
      project_site_candidates: {
        Row: {
          created_at: string;
          federal_state: string | null;
          id: string;
          infrastructure_context: Json;
          latitude: number;
          likely_dso: string | null;
          likely_tso: string | null;
          longitude: number;
          maturity_score: number;
          municipality: string | null;
          name: string;
          screening_status: string;
          site_id: string;
          target_voltage_kv: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          federal_state?: string | null;
          id?: string;
          infrastructure_context?: Json;
          latitude: number;
          likely_dso?: string | null;
          likely_tso?: string | null;
          longitude: number;
          maturity_score?: number;
          municipality?: string | null;
          name: string;
          screening_status?: string;
          site_id: string;
          target_voltage_kv?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          federal_state?: string | null;
          id?: string;
          infrastructure_context?: Json;
          latitude?: number;
          likely_dso?: string | null;
          likely_tso?: string | null;
          longitude?: number;
          maturity_score?: number;
          municipality?: string | null;
          name?: string;
          screening_status?: string;
          site_id?: string;
          target_voltage_kv?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_site_candidates_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "candidate_sites";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_assessment_invitations: { Args: never; Returns: number };
      apply_operator_profile: {
        Args: { p_profile_key: string; p_site_id: string };
        Returns: undefined;
      };
      can_edit_assessment: { Args: { p_site_id: string }; Returns: boolean };
      can_read_assessment: { Args: { p_site_id: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
