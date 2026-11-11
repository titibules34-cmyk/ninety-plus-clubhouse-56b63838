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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bet_selections: {
        Row: {
          away_score: number | null
          away_team: string
          bet_id: string
          commence_time: string
          event_id: string
          home_score: number | null
          home_team: string
          id: string
          market: string
          odds: number
          pick: string
          point: number | null
          result: Database["public"]["Enums"]["bet_status"]
          sport_key: string
          sport_title: string
        }
        Insert: {
          away_score?: number | null
          away_team: string
          bet_id: string
          commence_time: string
          event_id: string
          home_score?: number | null
          home_team: string
          id?: string
          market: string
          odds: number
          pick: string
          point?: number | null
          result?: Database["public"]["Enums"]["bet_status"]
          sport_key: string
          sport_title?: string
        }
        Update: {
          away_score?: number | null
          away_team?: string
          bet_id?: string
          commence_time?: string
          event_id?: string
          home_score?: number | null
          home_team?: string
          id?: string
          market?: string
          odds?: number
          pick?: string
          point?: number | null
          result?: Database["public"]["Enums"]["bet_status"]
          sport_key?: string
          sport_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_selections_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          code: string
          created_at: string
          id: string
          payout: number
          potential_win: number
          settled_at: string | null
          stake: number
          status: Database["public"]["Enums"]["bet_status"]
          total_odds: number
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          payout?: number
          potential_win: number
          settled_at?: string | null
          stake: number
          status?: Database["public"]["Enums"]["bet_status"]
          total_odds: number
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          payout?: number
          potential_win?: number
          settled_at?: string | null
          stake?: number
          status?: Database["public"]["Enums"]["bet_status"]
          total_odds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      odds_cache: {
        Row: {
          cache_key: string
          data: Json
          fetched_at: string
        }
        Insert: {
          cache_key: string
          data: Json
          fetched_at?: string
        }
        Update: {
          cache_key?: string
          data?: Json
          fetched_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string
          balance: number
          city: string
          created_at: string
          email: string
          full_name: string
          id: string
          id_number: string
          overdraft: number
          parent_id: string | null
          pending: number
          phone: string
          status: Database["public"]["Enums"]["account_status"]
          username: string
        }
        Insert: {
          address?: string
          balance?: number
          city?: string
          created_at?: string
          email?: string
          full_name?: string
          id: string
          id_number?: string
          overdraft?: number
          parent_id?: string | null
          pending?: number
          phone?: string
          status?: Database["public"]["Enums"]["account_status"]
          username: string
        }
        Update: {
          address?: string
          balance?: number
          city?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          id_number?: string
          overdraft?: number
          parent_id?: string | null
          pending?: number
          phone?: string
          status?: Database["public"]["Enums"]["account_status"]
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ancestor: {
        Args: { _ancestor: string; _node: string }
        Returns: boolean
      }
      place_bet: {
        Args: {
          _selections: Json
          _stake: number
          _total_odds: number
          _user_id: string
        }
        Returns: {
          bet_code: string
          bet_id: string
        }[]
      }
      settle_selections: { Args: { _results: Json }; Returns: number }
    }
    Enums: {
      account_status: "aktiv" | "bllokuar" | "mbyllur"
      app_role:
        | "admin"
        | "user"
        | "menaxher"
        | "nen_menaxher"
        | "menaxher_fundor"
      bet_status: "pending" | "won" | "lost" | "void"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: ["aktiv", "bllokuar", "mbyllur"],
      app_role: [
        "admin",
        "user",
        "menaxher",
        "nen_menaxher",
        "menaxher_fundor",
      ],
      bet_status: ["pending", "won", "lost", "void"],
    },
  },
} as const
