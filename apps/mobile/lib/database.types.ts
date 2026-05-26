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
      admin_users: {
        Row: {
          granted_at: string
          granted_by: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
            foreignKeyName: "app_notifications_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_implausible_macros"
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
            foreignKeyName: "creator_publish_notifications_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_implausible_macros"
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
      daily_targets: {
        Row: {
          activity_level: string | null
          created_at: string
          date_key: string
          goal: string | null
          maintenance_tdee: number | null
          plan_pace: string | null
          target_calories: number | null
          target_carbs_g: number | null
          target_fat_g: number | null
          target_fiber_g: number | null
          target_protein_g: number | null
          user_id: string
        }
        Insert: {
          activity_level?: string | null
          created_at?: string
          date_key: string
          goal?: string | null
          maintenance_tdee?: number | null
          plan_pace?: string | null
          target_calories?: number | null
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_fiber_g?: number | null
          target_protein_g?: number | null
          user_id: string
        }
        Update: {
          activity_level?: string | null
          created_at?: string
          date_key?: string
          goal?: string | null
          maintenance_tdee?: number | null
          plan_pace?: string | null
          target_calories?: number | null
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_fiber_g?: number | null
          target_protein_g?: number | null
          user_id?: string
        }
        Relationships: []
      }
      deleted_health_samples: {
        Row: {
          deleted_at: string
          health_sample_id: string
          source: string
          user_id: string
        }
        Insert: {
          deleted_at?: string
          health_sample_id: string
          source?: string
          user_id: string
        }
        Update: {
          deleted_at?: string
          health_sample_id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      dmca_takedowns: {
        Row: {
          description: string | null
          id: string
          original_post_url: string
          reporter_email: string
          reporter_ip: string | null
          reporter_user_agent: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          status: string
          submitted_at: string
          suppr_recipe_id: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          original_post_url: string
          reporter_email: string
          reporter_ip?: string | null
          reporter_user_agent?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string
          suppr_recipe_id?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          original_post_url?: string
          reporter_email?: string
          reporter_ip?: string | null
          reporter_user_agent?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string
          suppr_recipe_id?: string | null
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
      goal_history: {
        Row: {
          activity_level: string | null
          effective_from: string
          goal: string | null
          id: string
          maintenance_tdee: number | null
          plan_pace: string | null
          recorded_at: string
          source: string
          target_calories: number | null
          target_carbs_g: number | null
          target_fat_g: number | null
          target_fiber_g: number | null
          target_protein_g: number | null
          user_id: string
        }
        Insert: {
          activity_level?: string | null
          effective_from: string
          goal?: string | null
          id?: string
          maintenance_tdee?: number | null
          plan_pace?: string | null
          recorded_at?: string
          source: string
          target_calories?: number | null
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_fiber_g?: number | null
          target_protein_g?: number | null
          user_id: string
        }
        Update: {
          activity_level?: string | null
          effective_from?: string
          goal?: string | null
          id?: string
          maintenance_tdee?: number | null
          plan_pace?: string | null
          recorded_at?: string
          source?: string
          target_calories?: number | null
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_fiber_g?: number | null
          target_protein_g?: number | null
          user_id?: string
        }
        Relationships: []
      }
      health_snapshots: {
        Row: {
          active_energy_kcal: number | null
          captured_at: string
          created_at: string
          device_id: string | null
          id: number
          resting_burn_kcal: number | null
          source: string
          steps: number | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          active_energy_kcal?: number | null
          captured_at?: string
          created_at?: string
          device_id?: string | null
          id?: number
          resting_burn_kcal?: number | null
          source?: string
          steps?: number | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          active_energy_kcal?: number | null
          captured_at?: string
          created_at?: string
          device_id?: string | null
          id?: number
          resting_burn_kcal?: number | null
          source?: string
          steps?: number | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      household_invites: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          created_at: string
          declined_at: string | null
          expires_at: string
          household_id: string
          id: string
          invitee_email: string
          inviter_user_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          declined_at?: string | null
          expires_at?: string
          household_id: string
          id?: string
          invitee_email: string
          inviter_user_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          declined_at?: string | null
          expires_at?: string
          household_id?: string
          id?: string
          invitee_email?: string
          inviter_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_meals: {
        Row: {
          added_by: string | null
          calories_per_serving: number | null
          carbs_per_serving: number | null
          cook_display_name: string | null
          created_at: string
          date_key: string
          fat_per_serving: number | null
          fiber_per_serving: number | null
          household_id: string
          id: string
          meal_label: string
          notes: string | null
          protein_per_serving: number | null
          recipe_id: string | null
          recipe_title: string
          recipe_title_snapshot: string | null
          servings: number
        }
        Insert: {
          added_by?: string | null
          calories_per_serving?: number | null
          carbs_per_serving?: number | null
          cook_display_name?: string | null
          created_at?: string
          date_key: string
          fat_per_serving?: number | null
          fiber_per_serving?: number | null
          household_id: string
          id?: string
          meal_label?: string
          notes?: string | null
          protein_per_serving?: number | null
          recipe_id?: string | null
          recipe_title: string
          recipe_title_snapshot?: string | null
          servings?: number
        }
        Update: {
          added_by?: string | null
          calories_per_serving?: number | null
          carbs_per_serving?: number | null
          cook_display_name?: string | null
          created_at?: string
          date_key?: string
          fat_per_serving?: number | null
          fiber_per_serving?: number | null
          household_id?: string
          id?: string
          meal_label?: string
          notes?: string | null
          protein_per_serving?: number | null
          recipe_id?: string | null
          recipe_title?: string
          recipe_title_snapshot?: string | null
          servings?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_meals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meals_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_meals_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_implausible_macros"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          display_name: string | null
          household_id: string
          id: string
          joined_at: string
          role: string
          share_preset: string
          share_targets: boolean
          user_id: string
        }
        Insert: {
          display_name?: string | null
          household_id: string
          id?: string
          joined_at?: string
          role?: string
          share_preset?: string
          share_targets?: boolean
          user_id: string
        }
        Update: {
          display_name?: string | null
          household_id?: string
          id?: string
          joined_at?: string
          role?: string
          share_preset?: string
          share_targets?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          disbanded_at: string | null
          id: string
          invite_code: string
          invite_code_expires_at: string | null
          name: string
          owner_id: string
          share_lunch: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          disbanded_at?: string | null
          id?: string
          invite_code?: string
          invite_code_expires_at?: string | null
          name?: string
          owner_id: string
          share_lunch?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          disbanded_at?: string | null
          id?: string
          invite_code?: string
          invite_code_expires_at?: string | null
          name?: string
          owner_id?: string
          share_lunch?: boolean
          updated_at?: string
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
          servings_used: Json
          slot_id: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: number
          id?: string
          servings_used?: Json
          slot_id?: string
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: number
          id?: string
          servings_used?: Json
          slot_id?: string
          start_date?: string
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
          is_leftover: boolean
          is_placeholder: boolean
          leftover_of_recipe_id: string | null
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
          is_leftover?: boolean
          is_placeholder?: boolean
          leftover_of_recipe_id?: string | null
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
          is_leftover?: boolean
          is_placeholder?: boolean
          leftover_of_recipe_id?: string | null
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
          {
            foreignKeyName: "meal_plan_meals_recipe_id_uuid_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_meals_recipe_id_uuid_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_implausible_macros"
            referencedColumns: ["id"]
          },
        ]
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
          name: string
          nutrition_micros: Json
          portion_multiplier: number | null
          protein: number
          recipe_id: string | null
          recipe_title: string
          source: string | null
          source_id: string | null
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
          recipe_id?: string | null
          recipe_title?: string
          source?: string | null
          source_id?: string | null
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
          recipe_id?: string | null
          recipe_title?: string
          source?: string | null
          source_id?: string | null
          time_label?: string
          user_id?: string
          water_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_implausible_macros"
            referencedColumns: ["id"]
          },
        ]
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
          basal_burn_by_day: Json | null
          body_fat_pct: number | null
          calorie_schedule: string | null
          created_at: string
          daily_steps_goal: number
          dietary: Json | null
          dietary_restrictions: Json | null
          display_name: string | null
          dob: string | null
          expo_push_token: string | null
          extra_alcohol_g_by_day: Json
          extra_caffeine_by_day: Json
          extra_water_by_day: Json | null
          fasting_enabled: boolean | null
          fasting_sessions: Json | null
          fasting_window: string | null
          goal: string | null
          goal_weight_kg: number | null
          height_cm: number | null
          high_days: Json | null
          household_id: string | null
          id: string
          last_weekly_checkin_decision: string | null
          last_weekly_checkin_shown_at: string | null
          last_weekly_recap_push_sent_at: string | null
          measurement_system: string | null
          milestone_30_shown_at: string | null
          net_carbs_lens_enabled: boolean
          notification_prefs: Json
          notifications_seeded: boolean
          nutrition_strategy: string | null
          onboarding_completed: boolean | null
          pace_kg_per_week: number | null
          plan_pace: string | null
          prefer_activity_adjusted_calories: boolean | null
          sex: string | null
          steps_by_day: Json
          streak_freeze_budget_max: number
          streak_freezes_earned_at: Json
          streak_freezes_used_history: Json
          stripe_customer_id: string | null
          target_alcohol_g_weekly: number
          target_caffeine_mg: number
          target_calories: number | null
          target_calories_set_at: string | null
          target_calories_source: string | null
          target_carbs: number | null
          target_fat: number | null
          target_fiber_g: number | null
          target_protein: number | null
          target_water_ml: number | null
          tracked_macros: Json
          tz_iana: string | null
          user_tier: string
          week_start_day: string
          weekly_recap_last_seen_week_key: string | null
          weekly_recap_push_enabled: boolean
          weight_kg: number | null
          weight_kg_by_day: Json
          weight_surface_mode: string
          workouts_by_day: Json | null
        }
        Insert: {
          activity_burn_by_day?: Json | null
          activity_level?: string | null
          adaptive_tdee?: number | null
          adaptive_tdee_confidence?: string | null
          adaptive_tdee_updated_at?: string | null
          age?: number | null
          avatar_url?: string | null
          basal_burn_by_day?: Json | null
          body_fat_pct?: number | null
          calorie_schedule?: string | null
          created_at?: string
          daily_steps_goal?: number
          dietary?: Json | null
          dietary_restrictions?: Json | null
          display_name?: string | null
          dob?: string | null
          expo_push_token?: string | null
          extra_alcohol_g_by_day?: Json
          extra_caffeine_by_day?: Json
          extra_water_by_day?: Json | null
          fasting_enabled?: boolean | null
          fasting_sessions?: Json | null
          fasting_window?: string | null
          goal?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          high_days?: Json | null
          household_id?: string | null
          id: string
          last_weekly_checkin_decision?: string | null
          last_weekly_checkin_shown_at?: string | null
          last_weekly_recap_push_sent_at?: string | null
          measurement_system?: string | null
          milestone_30_shown_at?: string | null
          net_carbs_lens_enabled?: boolean
          notification_prefs?: Json
          notifications_seeded?: boolean
          nutrition_strategy?: string | null
          onboarding_completed?: boolean | null
          pace_kg_per_week?: number | null
          plan_pace?: string | null
          prefer_activity_adjusted_calories?: boolean | null
          sex?: string | null
          steps_by_day?: Json
          streak_freeze_budget_max?: number
          streak_freezes_earned_at?: Json
          streak_freezes_used_history?: Json
          stripe_customer_id?: string | null
          target_alcohol_g_weekly?: number
          target_caffeine_mg?: number
          target_calories?: number | null
          target_calories_set_at?: string | null
          target_calories_source?: string | null
          target_carbs?: number | null
          target_fat?: number | null
          target_fiber_g?: number | null
          target_protein?: number | null
          target_water_ml?: number | null
          tracked_macros?: Json
          tz_iana?: string | null
          user_tier?: string
          week_start_day?: string
          weekly_recap_last_seen_week_key?: string | null
          weekly_recap_push_enabled?: boolean
          weight_kg?: number | null
          weight_kg_by_day?: Json
          weight_surface_mode?: string
          workouts_by_day?: Json | null
        }
        Update: {
          activity_burn_by_day?: Json | null
          activity_level?: string | null
          adaptive_tdee?: number | null
          adaptive_tdee_confidence?: string | null
          adaptive_tdee_updated_at?: string | null
          age?: number | null
          avatar_url?: string | null
          basal_burn_by_day?: Json | null
          body_fat_pct?: number | null
          calorie_schedule?: string | null
          created_at?: string
          daily_steps_goal?: number
          dietary?: Json | null
          dietary_restrictions?: Json | null
          display_name?: string | null
          dob?: string | null
          expo_push_token?: string | null
          extra_alcohol_g_by_day?: Json
          extra_caffeine_by_day?: Json
          extra_water_by_day?: Json | null
          fasting_enabled?: boolean | null
          fasting_sessions?: Json | null
          fasting_window?: string | null
          goal?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          high_days?: Json | null
          household_id?: string | null
          id?: string
          last_weekly_checkin_decision?: string | null
          last_weekly_checkin_shown_at?: string | null
          last_weekly_recap_push_sent_at?: string | null
          measurement_system?: string | null
          milestone_30_shown_at?: string | null
          net_carbs_lens_enabled?: boolean
          notification_prefs?: Json
          notifications_seeded?: boolean
          nutrition_strategy?: string | null
          onboarding_completed?: boolean | null
          pace_kg_per_week?: number | null
          plan_pace?: string | null
          prefer_activity_adjusted_calories?: boolean | null
          sex?: string | null
          steps_by_day?: Json
          streak_freeze_budget_max?: number
          streak_freezes_earned_at?: Json
          streak_freezes_used_history?: Json
          stripe_customer_id?: string | null
          target_alcohol_g_weekly?: number
          target_caffeine_mg?: number
          target_calories?: number | null
          target_calories_set_at?: string | null
          target_calories_source?: string | null
          target_carbs?: number | null
          target_fat?: number | null
          target_fiber_g?: number | null
          target_protein?: number | null
          target_water_ml?: number | null
          tracked_macros?: Json
          tz_iana?: string | null
          user_tier?: string
          week_start_day?: string
          weekly_recap_last_seen_week_key?: string | null
          weekly_recap_push_enabled?: boolean
          weight_kg?: number | null
          weight_kg_by_day?: Json
          weight_surface_mode?: string
          workouts_by_day?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
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
      recipe_cook_history: {
        Row: {
          cooked_at: string
          created_at: string
          duration_seconds: number | null
          id: string
          note: string | null
          rating: number | null
          recipe_id: string
          scale_factor: number | null
          user_id: string
        }
        Insert: {
          cooked_at?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          note?: string | null
          rating?: number | null
          recipe_id: string
          scale_factor?: number | null
          user_id: string
        }
        Update: {
          cooked_at?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          note?: string | null
          rating?: number | null
          recipe_id?: string
          scale_factor?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_cook_history_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_cook_history_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_implausible_macros"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          added_by_user: boolean
          alcohol_g: number
          amount: number | null
          caffeine_mg: number
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
          override_macros: Json | null
          protein: number
          recipe_id: string
          sodium_mg: number
          source: string | null
          sugar_g: number
          unit: string | null
        }
        Insert: {
          added_by_user?: boolean
          alcohol_g?: number
          amount?: number | null
          caffeine_mg?: number
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
          override_macros?: Json | null
          protein?: number
          recipe_id: string
          sodium_mg?: number
          source?: string | null
          sugar_g?: number
          unit?: string | null
        }
        Update: {
          added_by_user?: boolean
          alcohol_g?: number
          amount?: number | null
          caffeine_mg?: number
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
          override_macros?: Json | null
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
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_implausible_macros"
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
            foreignKeyName: "recipe_plan_add_events_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_implausible_macros"
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
          alcohol_g: number
          allergens: string[]
          author_id: string | null
          caffeine_mg: number
          calories: number
          caption_nutrition_claim: Json | null
          carbs: number
          cook_time_min: number | null
          created_at: string
          creator_calories: number | null
          creator_id: string | null
          cuisine: string | null
          description: string | null
          dietary: Json | null
          dietary_flags: Json
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
          alcohol_g?: number
          allergens?: string[]
          author_id?: string | null
          caffeine_mg?: number
          calories?: number
          caption_nutrition_claim?: Json | null
          carbs?: number
          cook_time_min?: number | null
          created_at?: string
          creator_calories?: number | null
          creator_id?: string | null
          cuisine?: string | null
          description?: string | null
          dietary?: Json | null
          dietary_flags?: Json
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
          alcohol_g?: number
          allergens?: string[]
          author_id?: string | null
          caffeine_mg?: number
          calories?: number
          caption_nutrition_claim?: Json | null
          carbs?: number
          cook_time_min?: number | null
          created_at?: string
          creator_calories?: number | null
          creator_id?: string | null
          cuisine?: string | null
          description?: string | null
          dietary?: Json | null
          dietary_flags?: Json
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
      revenuecat_events: {
        Row: {
          app_user_id: string
          event_id: string
          event_type: string
          payload: Json
          received_at: string
          user_id: string | null
        }
        Insert: {
          app_user_id: string
          event_id: string
          event_type: string
          payload: Json
          received_at?: string
          user_id?: string | null
        }
        Update: {
          app_user_id?: string
          event_id?: string
          event_type?: string
          payload?: Json
          received_at?: string
          user_id?: string | null
        }
        Relationships: []
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
            foreignKeyName: "saves_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_implausible_macros"
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
          checked_at: string | null
          checked_by: string | null
          created_at: string
          household_id: string | null
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
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          household_id?: string | null
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
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          household_id?: string | null
          id?: string
          name?: string
          source?: string
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          received_at: string
        }
        Insert: {
          event_id: string
          received_at?: string
        }
        Update: {
          event_id?: string
          received_at?: string
        }
        Relationships: []
      }
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
          source: string
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
          source?: string
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
          source?: string
          sugar_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_favorite_foods: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          fat: number
          fiber: number | null
          id: string
          protein: number
          recipe_title: string
          source: string | null
          source_id: string | null
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          fiber?: number | null
          id?: string
          protein?: number
          recipe_title: string
          source?: string | null
          source_id?: string | null
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          fiber?: number | null
          id?: string
          protein?: number
          recipe_title?: string
          source?: string | null
          source_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_food_flags: {
        Row: {
          created_at: string
          flagger_id: string
          id: string
          note: string | null
          reason: string
          user_food_id: string
        }
        Insert: {
          created_at?: string
          flagger_id: string
          id?: string
          note?: string | null
          reason?: string
          user_food_id: string
        }
        Update: {
          created_at?: string
          flagger_id?: string
          id?: string
          note?: string | null
          reason?: string
          user_food_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_food_flags_user_food_id_fkey"
            columns: ["user_food_id"]
            isOneToOne: false
            referencedRelation: "user_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_food_votes: {
        Row: {
          created_at: string
          id: string
          user_food_id: string
          vote: number
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_food_id: string
          vote: number
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_food_id?: string
          vote?: number
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_food_votes_user_food_id_fkey"
            columns: ["user_food_id"]
            isOneToOne: false
            referencedRelation: "user_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_foods: {
        Row: {
          barcode: string
          brand: string | null
          calories: number
          carbs: number
          category: string | null
          created_at: string
          downvotes: number
          evidence_url: string | null
          fat: number
          fiber_g: number | null
          flagged_for_admin_at: string | null
          id: string
          image_url: string | null
          name: string
          protein: number
          saturated_fat_g: number | null
          serving_size_g: number | null
          sodium_mg: number | null
          source: string | null
          submitted_by: string | null
          sugar_g: number | null
          updated_at: string
          upvotes: number
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          barcode: string
          brand?: string | null
          calories?: number
          carbs?: number
          category?: string | null
          created_at?: string
          downvotes?: number
          evidence_url?: string | null
          fat?: number
          fiber_g?: number | null
          flagged_for_admin_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          protein?: number
          saturated_fat_g?: number | null
          serving_size_g?: number | null
          sodium_mg?: number | null
          source?: string | null
          submitted_by?: string | null
          sugar_g?: number | null
          updated_at?: string
          upvotes?: number
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          barcode?: string
          brand?: string | null
          calories?: number
          carbs?: number
          category?: string | null
          created_at?: string
          downvotes?: number
          evidence_url?: string | null
          fat?: number
          fiber_g?: number | null
          flagged_for_admin_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          protein?: number
          saturated_fat_g?: number | null
          serving_size_g?: number | null
          sodium_mg?: number | null
          source?: string | null
          submitted_by?: string | null
          sugar_g?: number | null
          updated_at?: string
          upvotes?: number
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      user_plan_templates: {
        Row: {
          created_at: string
          day_count: number
          id: string
          name: string
          slots: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_count: number
          id?: string
          name: string
          slots?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_count?: number
          id?: string
          name?: string
          slots?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_recipe_notes: {
        Row: {
          cook_count: number
          created_at: string
          id: string
          last_cooked_at: string | null
          notes: string
          personal_rating: number | null
          recipe_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cook_count?: number
          created_at?: string
          id?: string
          last_cooked_at?: string | null
          notes?: string
          personal_rating?: number | null
          recipe_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cook_count?: number
          created_at?: string
          id?: string
          last_cooked_at?: string | null
          notes?: string
          personal_rating?: number | null
          recipe_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_recipe_notes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_recipe_notes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_implausible_macros"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saved_meal_items: {
        Row: {
          calories: number
          carbs: number
          fat: number
          fiber: number | null
          id: string
          portion_multiplier: number
          position: number
          protein: number
          recipe_title: string
          saved_meal_id: string
          source: string | null
          source_id: string | null
          water_ml: number | null
        }
        Insert: {
          calories?: number
          carbs?: number
          fat?: number
          fiber?: number | null
          id?: string
          portion_multiplier?: number
          position?: number
          protein?: number
          recipe_title: string
          saved_meal_id: string
          source?: string | null
          source_id?: string | null
          water_ml?: number | null
        }
        Update: {
          calories?: number
          carbs?: number
          fat?: number
          fiber?: number | null
          id?: string
          portion_multiplier?: number
          position?: number
          protein?: number
          recipe_title?: string
          saved_meal_id?: string
          source?: string | null
          source_id?: string | null
          water_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_meal_items_saved_meal_id_fkey"
            columns: ["saved_meal_id"]
            isOneToOne: false
            referencedRelation: "user_saved_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saved_meals: {
        Row: {
          created_at: string
          default_meal_slot: string | null
          id: string
          last_logged_at: string | null
          log_count: number
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_meal_slot?: string | null
          id?: string
          last_logged_at?: string | null
          log_count?: number
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_meal_slot?: string | null
          id?: string
          last_logged_at?: string | null
          log_count?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      verified_food_canonical: {
        Row: {
          barcode: string
          calories: number
          carbs: number
          consensus_confidence: number
          consensus_method: string
          fat: number
          fiber_g: number
          last_recomputed_at: string
          name: string
          protein: number
          saturated_fat_g: number | null
          serving_size_g: number
          sodium_mg: number | null
          source_user_food_id: string | null
          sugar_g: number | null
        }
        Insert: {
          barcode: string
          calories: number
          carbs: number
          consensus_confidence?: number
          consensus_method?: string
          fat: number
          fiber_g?: number
          last_recomputed_at?: string
          name: string
          protein: number
          saturated_fat_g?: number | null
          serving_size_g?: number
          sodium_mg?: number | null
          source_user_food_id?: string | null
          sugar_g?: number | null
        }
        Update: {
          barcode?: string
          calories?: number
          carbs?: number
          consensus_confidence?: number
          consensus_method?: string
          fat?: number
          fiber_g?: number
          last_recomputed_at?: string
          name?: string
          protein?: number
          saturated_fat_g?: number | null
          serving_size_g?: number
          sodium_mg?: number | null
          source_user_food_id?: string | null
          sugar_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "verified_food_canonical_source_user_food_id_fkey"
            columns: ["source_user_food_id"]
            isOneToOne: false
            referencedRelation: "user_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      web_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: number
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: number
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      recipes_implausible_macros: {
        Row: {
          author_id: string | null
          carbs: number | null
          created_at: string | null
          fat: number | null
          id: string | null
          kcal_per_serving: number | null
          macro_derived_kcal: number | null
          protein: number | null
          servings: number | null
          source_name: string | null
          title: string | null
          verdict: string | null
        }
        Insert: {
          author_id?: string | null
          carbs?: number | null
          created_at?: string | null
          fat?: number | null
          id?: string | null
          kcal_per_serving?: number | null
          macro_derived_kcal?: never
          protein?: number | null
          servings?: number | null
          source_name?: string | null
          title?: string | null
          verdict?: never
        }
        Update: {
          author_id?: string | null
          carbs?: number | null
          created_at?: string | null
          fat?: number | null
          id?: string | null
          kcal_per_serving?: number | null
          macro_derived_kcal?: never
          protein?: number | null
          servings?: number | null
          source_name?: string | null
          title?: string | null
          verdict?: never
        }
        Relationships: [
          {
            foreignKeyName: "recipes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_household_ids: { Args: never; Returns: string[] }
      auth_profile_user_tier: { Args: never; Returns: string }
      auth_user_save_count: { Args: never; Returns: number }
      claim_web_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      household_invite_accept: {
        Args: { p_invite_id: string }
        Returns: {
          display_name: string | null
          household_id: string
          id: string
          joined_at: string
          role: string
          share_preset: string
          share_targets: boolean
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "household_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      household_invite_cancel: {
        Args: { p_invite_id: string }
        Returns: {
          accepted_at: string | null
          cancelled_at: string | null
          created_at: string
          declined_at: string | null
          expires_at: string
          household_id: string
          id: string
          invitee_email: string
          inviter_user_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "household_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      household_invite_decline: {
        Args: { p_invite_id: string }
        Returns: {
          accepted_at: string | null
          cancelled_at: string | null
          created_at: string
          declined_at: string | null
          expires_at: string
          household_id: string
          id: string
          invitee_email: string
          inviter_user_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "household_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      household_invite_send: {
        Args: { p_household_id: string; p_invitee_email: string }
        Returns: {
          accepted_at: string | null
          cancelled_at: string | null
          created_at: string
          declined_at: string | null
          expires_at: string
          household_id: string
          id: string
          invitee_email: string
          inviter_user_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "household_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      household_join_by_invite_code: {
        Args: { p_display_name?: string; p_invite_code: string }
        Returns: Json
      }
      my_recipe_plan_add_stats: {
        Args: never
        Returns: {
          plan_add_count: number
          recipe_id: string
        }[]
      }
      my_recipe_save_stats: {
        Args: never
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
      public_recipe_save_counts_batch: {
        Args: { p_recipe_ids: string[] }
        Returns: {
          recipe_id: string
          save_count: number
        }[]
      }
      recompute_verified_food_canonical: {
        Args: { p_barcode: string }
        Returns: undefined
      }
      redeem_promo_code: { Args: { p_code: string }; Returns: Json }
      save_meal_plan: {
        Args: { p_plan: Json; p_slot_id: string; p_start_date: string }
        Returns: undefined
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
