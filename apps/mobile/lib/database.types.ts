export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      author_follows: {
        Row: {
          author_id: string
          created_at: string
          follower_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          follower_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "author_follows_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "author_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      barcode_mappings: {
        Row: {
          barcode: string
          created_at: string
          created_by: string | null
          display_name: string
          external_id: string | null
          food_id: string
          is_verified: boolean
          source: string
          updated_at: string
        }
        Insert: {
          barcode: string
          created_at?: string
          created_by?: string | null
          display_name: string
          external_id?: string | null
          food_id: string
          is_verified?: boolean
          source: string
          updated_at?: string
        }
        Update: {
          barcode?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          external_id?: string | null
          food_id?: string
          is_verified?: boolean
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barcode_mappings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barcode_mappings_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_publish_notifications: {
        Row: {
          created_at: string
          read_at: string | null
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          read_at?: string | null
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          read_at?: string | null
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_publish_notifications_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_publish_notifications_user_id_fkey"
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
      food_reports: {
        Row: {
          barcode: string | null
          created_at: string
          external_id: string | null
          id: string
          kind: string
          message: string | null
          reporter_id: string | null
          source: string | null
          status: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          kind: string
          message?: string | null
          reporter_id?: string | null
          source?: string | null
          status?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          kind?: string
          message?: string | null
          reporter_id?: string | null
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_sources: {
        Row: {
          confidence: number | null
          created_at: string
          external_id: string
          food_id: string
          id: string
          source: string
          source_url: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          external_id: string
          food_id: string
          id?: string
          source: string
          source_url?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          external_id?: string
          food_id?: string
          id?: string
          source?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_sources_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          brand: string | null
          created_at: string
          display_name: string
          id: string
          is_verified: boolean
        }
        Insert: {
          brand?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_verified?: boolean
        }
        Update: {
          brand?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_verified?: boolean
        }
        Relationships: []
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
      meal_plan_days: {
        Row: {
          created_at: string
          day: number
          id: string
          slot_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: number
          id?: string
          slot_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: number
          id?: string
          slot_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plan_meals: {
        Row: {
          calories: number
          carbs: number
          fat: number
          id: string
          is_placeholder: boolean
          name: string
          plan_day_id: string
          portion_multiplier: number
          protein: number
          recipe_id: string | null
          recipe_title: string
          slot_index: number
        }
        Insert: {
          calories?: number
          carbs?: number
          fat?: number
          id?: string
          is_placeholder?: boolean
          name?: string
          plan_day_id: string
          portion_multiplier?: number
          protein?: number
          recipe_id?: string | null
          recipe_title?: string
          slot_index: number
        }
        Update: {
          calories?: number
          carbs?: number
          fat?: number
          id?: string
          is_placeholder?: boolean
          name?: string
          plan_day_id?: string
          portion_multiplier?: number
          protein?: number
          recipe_id?: string | null
          recipe_title?: string
          slot_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_meals_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_days"
            referencedColumns: ["id"]
          },
        ]
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
      /** Renamed from `meal_plans` by migration `20260413100000_relational_user_data.sql`. */
      meal_plans_legacy: {
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
      nutrition_entries: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          date_key: string
          fat: number
          fiber_g: number | null
          health_sample_id: string | null
          id: string
          nutrition_micros: Json
          name: string
          portion_multiplier: number | null
          protein: number
          recipe_title: string
          source: string | null
          time_label: string
          user_id: string
          water_ml: number | null
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          date_key: string
          fat?: number
          fiber_g?: number | null
          health_sample_id?: string | null
          id?: string
          name?: string
          nutrition_micros?: Json
          portion_multiplier?: number | null
          protein?: number
          recipe_title?: string
          source?: string | null
          time_label?: string
          user_id: string
          water_ml?: number | null
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          date_key?: string
          fat?: number
          fiber_g?: number | null
          health_sample_id?: string | null
          id?: string
          name?: string
          nutrition_micros?: Json
          portion_multiplier?: number | null
          protein?: number
          recipe_title?: string
          source?: string | null
          time_label?: string
          user_id?: string
          water_ml?: number | null
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
      /** Renamed from `nutrition_journals` by migration `20260413100000_relational_user_data.sql`. */
      nutrition_journals_legacy: {
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
          activity_burn_by_day: Json | null
          activity_level: string | null
          adaptive_tdee: number | null
          adaptive_tdee_confidence: string | null
          adaptive_tdee_updated_at: string | null
          age: number | null
          avatar_url: string | null
          body_fat_pct: number | null
          calorie_schedule: string | null
          created_at: string
          daily_steps_goal: number
          dietary: Json | null
          dietary_restrictions: Json | null
          display_name: string | null
          dob: string | null
          expo_push_token: string | null
          extra_water_by_day: Json | null
          fasting_enabled: boolean | null
          fasting_window: string | null
          goal: string | null
          goal_weight_kg: number | null
          height_cm: number | null
          high_days: Json | null
          id: string
          last_weekly_recap_push_sent_at: string | null
          measurement_system: string | null
          notification_prefs: Json
          notifications_seeded: boolean
          nutrition_strategy: string | null
          onboarding_completed: boolean | null
          plan_pace: string | null
          prefer_activity_adjusted_calories: boolean
          sex: string | null
          steps_by_day: Json
          target_calories: number | null
          target_carbs: number | null
          target_fat: number | null
          target_fiber_g: number | null
          target_protein: number | null
          target_water_ml: number | null
          user_tier: string
          weight_kg: number | null
          weight_kg_by_day: Json
        }
        Insert: {
          activity_burn_by_day?: Json | null
          activity_level?: string | null
          adaptive_tdee?: number | null
          adaptive_tdee_confidence?: string | null
          adaptive_tdee_updated_at?: string | null
          age?: number | null
          avatar_url?: string | null
          body_fat_pct?: number | null
          calorie_schedule?: string | null
          created_at?: string
          daily_steps_goal?: number
          dietary?: Json | null
          dietary_restrictions?: Json | null
          display_name?: string | null
          dob?: string | null
          expo_push_token?: string | null
          extra_water_by_day?: Json | null
          fasting_enabled?: boolean | null
          fasting_window?: string | null
          goal?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          high_days?: Json | null
          id: string
          last_weekly_recap_push_sent_at?: string | null
          measurement_system?: string | null
          notification_prefs?: Json
          notifications_seeded?: boolean
          nutrition_strategy?: string | null
          onboarding_completed?: boolean | null
          plan_pace?: string | null
          prefer_activity_adjusted_calories?: boolean
          sex?: string | null
          steps_by_day?: Json
          target_calories?: number | null
          target_carbs?: number | null
          target_fat?: number | null
          target_fiber_g?: number | null
          target_protein?: number | null
          target_water_ml?: number | null
          user_tier?: string
          weight_kg?: number | null
          weight_kg_by_day?: Json
        }
        Update: {
          activity_burn_by_day?: Json | null
          activity_level?: string | null
          adaptive_tdee?: number | null
          adaptive_tdee_confidence?: string | null
          adaptive_tdee_updated_at?: string | null
          age?: number | null
          avatar_url?: string | null
          body_fat_pct?: number | null
          calorie_schedule?: string | null
          created_at?: string
          daily_steps_goal?: number
          dietary?: Json | null
          dietary_restrictions?: Json | null
          display_name?: string | null
          dob?: string | null
          expo_push_token?: string | null
          extra_water_by_day?: Json | null
          fasting_enabled?: boolean | null
          fasting_window?: string | null
          goal?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          high_days?: Json | null
          id?: string
          last_weekly_recap_push_sent_at?: string | null
          measurement_system?: string | null
          notification_prefs?: Json
          notifications_seeded?: boolean
          nutrition_strategy?: string | null
          onboarding_completed?: boolean | null
          plan_pace?: string | null
          prefer_activity_adjusted_calories?: boolean
          sex?: string | null
          steps_by_day?: Json
          target_calories?: number | null
          target_carbs?: number | null
          target_fat?: number | null
          target_fiber_g?: number | null
          target_protein?: number | null
          target_water_ml?: number | null
          user_tier?: string
          weight_kg?: number | null
          weight_kg_by_day?: Json
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
          confidence: number | null
          created_at: string
          fat: number
          fatsecret_food_id: string | null
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
          confidence?: number | null
          created_at?: string
          fat?: number
          fatsecret_food_id?: string | null
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
          confidence?: number | null
          created_at?: string
          fat?: number
          fatsecret_food_id?: string | null
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
      recipe_plan_add_events: {
        Row: {
          created_at: string
          id: number
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_plan_add_events_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_plan_add_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          verified_at: string | null
          verified_confidence: number | null
          verified_source: string | null
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
          verified_at?: string | null
          verified_confidence?: number | null
          verified_source?: string | null
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
          verified_at?: string | null
          verified_confidence?: number | null
          verified_source?: string | null
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
      shopping_items: {
        Row: {
          amount: string
          category: string
          checked: boolean
          created_at: string
          id: string
          name: string
          source: string
          unit: string
          user_id: string
        }
        Insert: {
          amount?: string
          category?: string
          checked?: boolean
          created_at?: string
          id?: string
          name?: string
          source?: string
          unit?: string
          user_id: string
        }
        Update: {
          amount?: string
          category?: string
          checked?: boolean
          created_at?: string
          id?: string
          name?: string
          source?: string
          unit?: string
          user_id?: string
        }
        Relationships: []
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
      /** Renamed from `shopping_lists` by migration `20260413100000_relational_user_data.sql`. */
      shopping_lists_legacy: {
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
      /**
       * Batch 3.9 — user-defined foods (e.g. "Homemade granola"). See
       * migration `20260421150000_user_custom_foods.sql` for the base table
       * and `20260424100000_custom_foods_servings_micros_barcode.sql` for
       * the five optional columns added in response to TestFlight
       * `AE52_fIRZ-ZIupmoJ8T4yaI`.
       */
      user_custom_foods: {
        Row: {
          barcode: string | null
          base_grams: number
          brand: string | null
          calories: number
          carbs: number
          created_at: string
          fat: number
          fiber: number | null
          id: string
          name: string
          protein: number
          saturated_fat_g: number | null
          servings: Json
          servings_per_container: number | null
          sodium_mg: number | null
          sugar_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          base_grams?: number
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          fiber?: number | null
          id?: string
          name: string
          protein?: number
          saturated_fat_g?: number | null
          servings?: Json
          servings_per_container?: number | null
          sodium_mg?: number | null
          sugar_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          base_grams?: number
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          fiber?: number | null
          id?: string
          name?: string
          protein?: number
          saturated_fat_g?: number | null
          servings?: Json
          servings_per_container?: number | null
          sodium_mg?: number | null
          sugar_g?: number | null
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
      my_recipe_plan_add_stats: {
        Args: Record<string, never>
        Returns: {
          recipe_id: string
          plan_add_count: number
        }[]
      }
      my_recipe_save_stats: {
        Args: Record<string, never>
        Returns: {
          recipe_id: string
          save_count: number
        }[]
      }
      public_author_follower_count: {
        Args: { p_author_id: string }
        Returns: number
      }
      public_creator_follower_count: {
        Args: { p_creator_id: string }
        Returns: number
      }
      public_recipe_save_count: {
        Args: { p_recipe_id: string }
        Returns: number
      }
      redeem_promo_code: {
        Args: { p_code: string }
        Returns: Json
      }
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
