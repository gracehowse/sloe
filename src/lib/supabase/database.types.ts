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
      app_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          recipe_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          recipe_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          recipe_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          handle: string
          id: string
          is_verified: boolean
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          handle: string
          id?: string
          is_verified?: boolean
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          is_verified?: boolean
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          creator_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          barcode: string | null
          brand: string | null
          calories: number
          carbs: number
          created_at: string
          external_id: string | null
          fat: number
          id: string
          name: string
          protein: number
          source: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          external_id?: string | null
          fat?: number
          id?: string
          name: string
          protein?: number
          source?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          external_id?: string | null
          fat?: number
          id?: string
          name?: string
          protein?: number
          source?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          plan: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          plan?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          plan?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_journals: {
        Row: {
          by_day: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          by_day?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          by_day?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          avatar_url: string | null
          calorie_schedule: string | null
          created_at: string
          dietary: Json | null
          display_name: string | null
          dob: string | null
          fasting_enabled: boolean | null
          fasting_window: string | null
          goal: string | null
          goal_weight_kg: number | null
          height_cm: number | null
          high_days: Json | null
          id: string
          measurement_system: string | null
          notification_prefs: Json
          notifications_seeded: boolean
          nutrition_strategy: string | null
          onboarding_completed: boolean | null
          plan_pace: string | null
          sex: string | null
          target_calories: number | null
          target_carbs: number | null
          target_fat: number | null
          target_fiber: number | null
          target_protein: number | null
          user_tier: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          avatar_url?: string | null
          calorie_schedule?: string | null
          created_at?: string
          dietary?: Json | null
          display_name?: string | null
          dob?: string | null
          fasting_enabled?: boolean | null
          fasting_window?: string | null
          goal?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          high_days?: Json | null
          id: string
          measurement_system?: string | null
          notification_prefs?: Json
          notifications_seeded?: boolean
          nutrition_strategy?: string | null
          onboarding_completed?: boolean | null
          plan_pace?: string | null
          sex?: string | null
          target_calories?: number | null
          target_carbs?: number | null
          target_fat?: number | null
          target_fiber?: number | null
          target_protein?: number | null
          user_tier?: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          avatar_url?: string | null
          calorie_schedule?: string | null
          created_at?: string
          dietary?: Json | null
          display_name?: string | null
          dob?: string | null
          fasting_enabled?: boolean | null
          fasting_window?: string | null
          goal?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          high_days?: Json | null
          id?: string
          measurement_system?: string | null
          notification_prefs?: Json
          notifications_seeded?: boolean
          nutrition_strategy?: string | null
          onboarding_completed?: boolean | null
          plan_pace?: string | null
          sex?: string | null
          target_calories?: number | null
          target_carbs?: number | null
          target_fat?: number | null
          target_fiber?: number | null
          target_protein?: number | null
          user_tier?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number | null
          tier: string
          uses_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          tier: string
          uses_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          tier?: string
          uses_count?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          id: string
          promo_code_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          promo_code_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          promo_code_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          amount: number | null
          calories: number
          carbs: number
          created_at: string
          fat: number
          fiber_g: number
          id: string
          ingredient_id: string | null
          is_verified: boolean
          name: string
          protein: number
          recipe_id: string
          sodium_mg: number
          source: string | null
          sugar_g: number
          unit: string | null
        }
        Insert: {
          amount?: number | null
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          fiber_g?: number
          id?: string
          ingredient_id?: string | null
          is_verified?: boolean
          name: string
          protein?: number
          recipe_id: string
          sodium_mg?: number
          source?: string | null
          sugar_g?: number
          unit?: string | null
        }
        Update: {
          amount?: number | null
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          fiber_g?: number
          id?: string
          ingredient_id?: string | null
          is_verified?: boolean
          name?: string
          protein?: number
          recipe_id?: string
          sodium_mg?: number
          source?: string | null
          sugar_g?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          author_id: string | null
          calories: number
          carbs: number
          cook_time_min: number | null
          created_at: string
          creator_calories: number | null
          creator_id: string | null
          description: string | null
          dietary: Json | null
          fat: number
          fiber_g: number
          id: string
          image_url: string | null
          instructions: string | null
          is_verified: boolean
          meal_type: string[] | null
          prep_time_min: number | null
          protein: number
          published: boolean
          servings: number
          sodium_mg: number
          source_name: string | null
          source_url: string | null
          sugar_g: number
          title: string
        }
        Insert: {
          author_id?: string | null
          calories?: number
          carbs?: number
          cook_time_min?: number | null
          created_at?: string
          creator_calories?: number | null
          creator_id?: string | null
          description?: string | null
          dietary?: Json | null
          fat?: number
          fiber_g?: number
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_verified?: boolean
          meal_type?: string[] | null
          prep_time_min?: number | null
          protein?: number
          published?: boolean
          servings?: number
          sodium_mg?: number
          source_name?: string | null
          source_url?: string | null
          sugar_g?: number
          title: string
        }
        Update: {
          author_id?: string | null
          calories?: number
          carbs?: number
          cook_time_min?: number | null
          created_at?: string
          creator_calories?: number | null
          creator_id?: string | null
          description?: string | null
          dietary?: Json | null
          fat?: number
          fiber_g?: number
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_verified?: boolean
          meal_type?: string[] | null
          prep_time_min?: number | null
          protein?: number
          published?: boolean
          servings?: number
          sodium_mg?: number
          source_name?: string | null
          source_url?: string | null
          sugar_g?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      redeem_promo_code: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
