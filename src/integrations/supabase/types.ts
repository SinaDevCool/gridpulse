export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          active: boolean
          created_at: string
          frequency: Database["public"]["Enums"]["alert_frequency"]
          id: string
          last_matched_at: string | null
          last_run_at: string | null
          name: string
          rule_type: Database["public"]["Enums"]["alert_rule_type"]
          updated_at: string
          user_id: string
          values: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          frequency?: Database["public"]["Enums"]["alert_frequency"]
          id?: string
          last_matched_at?: string | null
          last_run_at?: string | null
          name: string
          rule_type: Database["public"]["Enums"]["alert_rule_type"]
          updated_at?: string
          user_id: string
          values?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          frequency?: Database["public"]["Enums"]["alert_frequency"]
          id?: string
          last_matched_at?: string | null
          last_run_at?: string | null
          name?: string
          rule_type?: Database["public"]["Enums"]["alert_rule_type"]
          updated_at?: string
          user_id?: string
          values?: string[]
        }
        Relationships: []
      }
      articles: {
        Row: {
          also_reported_by: string[]
          author: string
          category: string
          content: string
          created_at: string
          fetched_at: string | null
          headline: string
          hero_image_url: string | null
          id: string
          is_breaking: boolean
          last_verified_at: string | null
          published_at: string
          read_minutes: number
          region: string
          related_project_ids: string[]
          search_tsv: unknown
          slug: string
          source_domain: string
          source_name: string
          source_type: string
          source_url: string | null
          summary: string
          tags: string[]
          updated_at: string
          verification_status: string
          verified: boolean
          why_it_matters: string
        }
        Insert: {
          also_reported_by?: string[]
          author: string
          category: string
          content: string
          created_at?: string
          fetched_at?: string | null
          headline: string
          hero_image_url?: string | null
          id?: string
          is_breaking?: boolean
          last_verified_at?: string | null
          published_at?: string
          read_minutes?: number
          region: string
          related_project_ids?: string[]
          search_tsv?: unknown
          slug: string
          source_domain: string
          source_name: string
          source_type?: string
          source_url?: string | null
          summary: string
          tags?: string[]
          updated_at?: string
          verification_status?: string
          verified?: boolean
          why_it_matters: string
        }
        Update: {
          also_reported_by?: string[]
          author?: string
          category?: string
          content?: string
          created_at?: string
          fetched_at?: string | null
          headline?: string
          hero_image_url?: string | null
          id?: string
          is_breaking?: boolean
          last_verified_at?: string | null
          published_at?: string
          read_minutes?: number
          region?: string
          related_project_ids?: string[]
          search_tsv?: unknown
          slug?: string
          source_domain?: string
          source_name?: string
          source_type?: string
          source_url?: string | null
          summary?: string
          tags?: string[]
          updated_at?: string
          verification_status?: string
          verified?: boolean
          why_it_matters?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          id: string
          target_key: string
          target_label: string | null
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_key: string
          target_label?: string | null
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_key?: string
          target_label?: string | null
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      ingestion_runs: {
        Row: {
          error: string | null
          failed_count: number
          fetched_count: number
          finished_at: string | null
          id: string
          inserted_count: number
          started_at: string
          status: string
          summarized_count: number
          triggered_by: string
        }
        Insert: {
          error?: string | null
          failed_count?: number
          fetched_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          started_at?: string
          status?: string
          summarized_count?: number
          triggered_by?: string
        }
        Update: {
          error?: string | null
          failed_count?: number
          fetched_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          started_at?: string
          status?: string
          summarized_count?: number
          triggered_by?: string
        }
        Relationships: []
      }
      market_data: {
        Row: {
          captured_at: string
          change_abs: number | null
          change_pct: number | null
          created_at: string
          currency: string | null
          fetched_at: string
          id: string
          kind: string
          label: string
          metadata: Json
          source_name: string
          source_type: string
          symbol: string
          unit: string
          updated_at: string
          value: number
          verification_status: string
        }
        Insert: {
          captured_at?: string
          change_abs?: number | null
          change_pct?: number | null
          created_at?: string
          currency?: string | null
          fetched_at?: string
          id?: string
          kind: string
          label: string
          metadata?: Json
          source_name: string
          source_type?: string
          symbol: string
          unit: string
          updated_at?: string
          value: number
          verification_status?: string
        }
        Update: {
          captured_at?: string
          change_abs?: number | null
          change_pct?: number | null
          created_at?: string
          currency?: string | null
          fetched_at?: string
          id?: string
          kind?: string
          label?: string
          metadata?: Json
          source_name?: string
          source_type?: string
          symbol?: string
          unit?: string
          updated_at?: string
          value?: number
          verification_status?: string
        }
        Relationships: []
      }
      news_sources: {
        Row: {
          active: boolean
          category: string
          created_at: string
          feed_url: string
          id: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          feed_url: string
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          feed_url?: string
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          preferences: Json
          subscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          preferences?: Json
          subscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          preferences?: Json
          subscribed_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          alert_rule_id: string | null
          article_id: string | null
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          alert_rule_id?: string | null
          article_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          alert_rule_id?: string | null
          article_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          capacity_mw: number
          capacity_mwh: number
          chemistry: string | null
          cod: string
          country: string
          created_at: string
          description: string | null
          developer: string
          external_id: string | null
          fetched_at: string | null
          id: string
          image_url: string | null
          last_verified_at: string
          lat: number
          lng: number
          location: string
          name: string
          offtaker: string | null
          operator: string | null
          owner: string | null
          region: string
          search_tsv: unknown
          slug: string
          source_type: string
          source_urls: string[]
          status: string
          technology: string
          updated_at: string
          use_case: string | null
          verification_status: string
        }
        Insert: {
          capacity_mw: number
          capacity_mwh: number
          chemistry?: string | null
          cod: string
          country: string
          created_at?: string
          description?: string | null
          developer: string
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          image_url?: string | null
          last_verified_at?: string
          lat: number
          lng: number
          location: string
          name: string
          offtaker?: string | null
          operator?: string | null
          owner?: string | null
          region: string
          search_tsv?: unknown
          slug: string
          source_type?: string
          source_urls?: string[]
          status: string
          technology: string
          updated_at?: string
          use_case?: string | null
          verification_status?: string
        }
        Update: {
          capacity_mw?: number
          capacity_mwh?: number
          chemistry?: string | null
          cod?: string
          country?: string
          created_at?: string
          description?: string | null
          developer?: string
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          image_url?: string | null
          last_verified_at?: string
          lat?: number
          lng?: number
          location?: string
          name?: string
          offtaker?: string | null
          operator?: string | null
          owner?: string | null
          region?: string
          search_tsv?: unknown
          slug?: string
          source_type?: string
          source_urls?: string[]
          status?: string
          technology?: string
          updated_at?: string
          use_case?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          query: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          query?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          query?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      market_data_latest: {
        Row: {
          captured_at: string | null
          change_abs: number | null
          change_pct: number | null
          currency: string | null
          fetched_at: string | null
          id: string | null
          kind: string | null
          label: string | null
          metadata: Json | null
          source_name: string | null
          source_type: string | null
          symbol: string | null
          unit: string | null
          value: number | null
          verification_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_tier: { Args: { _user_id: string }; Returns: string }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_paid_plan: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_frequency: "instant" | "daily" | "weekly" | "off"
      alert_rule_type:
        | "keyword"
        | "tag"
        | "company"
        | "region"
        | "technology"
        | "market"
        | "category"
      app_role: "admin" | "editor" | "pro" | "enterprise" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_frequency: ["instant", "daily", "weekly", "off"],
      alert_rule_type: [
        "keyword",
        "tag",
        "company",
        "region",
        "technology",
        "market",
        "category",
      ],
      app_role: ["admin", "editor", "pro", "enterprise", "user"],
    },
  },
} as const
