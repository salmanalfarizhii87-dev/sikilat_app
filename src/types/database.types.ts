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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          full_name: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: []
      }
      attempt_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          essay_text: string | null
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          is_correct: boolean | null
          is_flagged: boolean
          points_awarded: number | null
          question_id: string
          selected_option_ids: string[] | null
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          essay_text?: string | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          is_correct?: boolean | null
          is_flagged?: boolean
          points_awarded?: number | null
          question_id: string
          selected_option_ids?: string[] | null
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          essay_text?: string | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          is_correct?: boolean | null
          is_flagged?: boolean
          points_awarded?: number | null
          question_id?: string
          selected_option_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_events: {
        Row: {
          attempt_id: string
          created_at: string
          event_type: string
          id: number
          meta: Json | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          event_type: string
          id?: never
          meta?: Json | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          event_type?: string
          id?: never
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "attempt_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          attempt_no: number
          exam_id: string
          expires_at: string
          id: string
          ip_address: unknown
          max_score: number
          option_orders: Json | null
          participant_class: string | null
          participant_name: string
          participant_name_norm: string
          question_order: string[]
          result_token: string
          resume_code: string
          score_auto: number
          score_manual: number
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          submit_reason: string | null
          submitted_at: string | null
          token_hash: string
          total_score: number | null
          user_agent: string | null
        }
        Insert: {
          attempt_no: number
          exam_id: string
          expires_at: string
          id?: string
          ip_address?: unknown
          max_score: number
          option_orders?: Json | null
          participant_class?: string | null
          participant_name: string
          participant_name_norm: string
          question_order: string[]
          result_token: string
          resume_code: string
          score_auto?: number
          score_manual?: number
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submit_reason?: string | null
          submitted_at?: string | null
          token_hash: string
          total_score?: number | null
          user_agent?: string | null
        }
        Update: {
          attempt_no?: number
          exam_id?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          max_score?: number
          option_orders?: Json | null
          participant_class?: string | null
          participant_name?: string
          participant_name_norm?: string
          question_order?: string[]
          result_token?: string
          resume_code?: string
          score_auto?: number
          score_manual?: number
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          submit_reason?: string | null
          submitted_at?: string | null
          token_hash?: string
          total_score?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["user_id"]
          },
        ]
      }
      exams: {
        Row: {
          ask_class: boolean
          closes_at: string | null
          code: string
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number
          id: string
          instructions: string | null
          max_attempts: number
          opens_at: string | null
          passing_score: number | null
          result_release: Database["public"]["Enums"]["result_release"]
          result_visibility: Database["public"]["Enums"]["result_visibility"]
          results_released_at: string | null
          score_policy: Database["public"]["Enums"]["score_policy"]
          shuffle_options: boolean
          shuffle_questions: boolean
          status: Database["public"]["Enums"]["exam_status"]
          subject_label: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ask_class?: boolean
          closes_at?: string | null
          code: string
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes: number
          id?: string
          instructions?: string | null
          max_attempts?: number
          opens_at?: string | null
          passing_score?: number | null
          result_release?: Database["public"]["Enums"]["result_release"]
          result_visibility?: Database["public"]["Enums"]["result_visibility"]
          results_released_at?: string | null
          score_policy?: Database["public"]["Enums"]["score_policy"]
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: Database["public"]["Enums"]["exam_status"]
          subject_label?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ask_class?: boolean
          closes_at?: string | null
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          instructions?: string | null
          max_attempts?: number
          opens_at?: string | null
          passing_score?: number | null
          result_release?: Database["public"]["Enums"]["result_release"]
          result_visibility?: Database["public"]["Enums"]["result_visibility"]
          results_released_at?: string | null
          score_policy?: Database["public"]["Enums"]["score_policy"]
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: Database["public"]["Enums"]["exam_status"]
          subject_label?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["user_id"]
          },
        ]
      }
      question_options: {
        Row: {
          body: string
          id: string
          is_correct: boolean
          media_path: string | null
          position: number
          question_id: string
        }
        Insert: {
          body: string
          id?: string
          is_correct?: boolean
          media_path?: string | null
          position: number
          question_id: string
        }
        Update: {
          body?: string
          id?: string
          is_correct?: boolean
          media_path?: string | null
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          body: string
          created_at: string
          exam_id: string
          explanation: string | null
          id: string
          media_path: string | null
          passage: string | null
          points: number
          position: number
          reference_answer: string | null
          type: Database["public"]["Enums"]["question_type"]
          word_max: number | null
          word_min: number | null
        }
        Insert: {
          body: string
          created_at?: string
          exam_id: string
          explanation?: string | null
          id?: string
          media_path?: string | null
          passage?: string | null
          points?: number
          position: number
          reference_answer?: string | null
          type: Database["public"]["Enums"]["question_type"]
          word_max?: number | null
          word_min?: number | null
        }
        Update: {
          body?: string
          created_at?: string
          exam_id?: string
          explanation?: string | null
          id?: string
          media_path?: string | null
          passage?: string | null
          points?: number
          position?: number
          reference_answer?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          word_max?: number | null
          word_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          blocked_until: string | null
          bucket: string
          counter: number
          identifier: string
          window_start: string
        }
        Insert: {
          blocked_until?: string | null
          bucket: string
          counter?: number
          identifier: string
          window_start: string
        }
        Update: {
          blocked_until?: string | null
          bucket?: string
          counter?: number
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_admin: { Args: never; Returns: string }
      duplicate_exam: { Args: { p_exam_id: string }; Returns: Json }
      expire_overdue_attempts: { Args: never; Returns: number }
      final_score: {
        Args: { p_exam_id: string; p_name_norm: string }
        Returns: Json
      }
      finalize_if_expired: {
        Args: { p_attempt_id: string }
        Returns: undefined
      }
      get_attempt_state: { Args: { p_token_hash: string }; Returns: Json }
      get_result: { Args: { p_result_token: string }; Returns: Json }
      grade_essay: {
        Args: {
          p_attempt_id: string
          p_feedback?: string
          p_points: number
          p_question_id: string
        }
        Returns: Json
      }
      hitung_dan_publikasikan: {
        Args: {
          p_attempt_id: string
          p_force_in_progress?: boolean
          p_submit_reason: string
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity: string
          p_entity_id: string
        }
        Returns: undefined
      }
      log_attempt_event: {
        Args: { p_meta?: Json; p_token_hash: string; p_type: string }
        Returns: undefined
      }
      normalisasi_nama: { Args: { p_nama: string }; Returns: string }
      rate_limit_consume: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_limit: number
          p_window_secs: number
        }
        Returns: Json
      }
      rate_limit_purge: { Args: { p_older_than?: string }; Returns: number }
      release_results: { Args: { p_exam_id: string }; Returns: Json }
      reset_attempt: {
        Args: { p_attempt_id: string; p_mode: string }
        Returns: Json
      }
      resume_attempt: {
        Args: {
          p_code: string
          p_name: string
          p_new_token_hash: string
          p_resume_code: string
        }
        Returns: Json
      }
      save_answer: {
        Args: {
          p_essay?: string
          p_flagged?: boolean
          p_question_id: string
          p_selected?: string[]
          p_token_hash: string
        }
        Returns: Json
      }
      start_attempt: {
        Args: {
          p_class: string
          p_code: string
          p_ip?: unknown
          p_name: string
          p_result_token: string
          p_resume_code: string
          p_token_hash: string
          p_user_agent?: string
        }
        Returns: Json
      }
      submit_attempt: { Args: { p_token_hash: string }; Returns: Json }
    }
    Enums: {
      attempt_status: "in_progress" | "needs_grading" | "graded"
      exam_status: "draft" | "published" | "archived"
      question_type: "mcq_single" | "mcq_multiple" | "essay" | "true_false"
      result_release: "instant" | "after_close" | "manual"
      result_visibility: "hidden" | "score_only" | "score_and_review"
      score_policy: "highest" | "latest" | "first" | "average"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attempt_status: ["in_progress", "needs_grading", "graded"],
      exam_status: ["draft", "published", "archived"],
      question_type: ["mcq_single", "mcq_multiple", "essay", "true_false"],
      result_release: ["instant", "after_close", "manual"],
      result_visibility: ["hidden", "score_only", "score_and_review"],
      score_policy: ["highest", "latest", "first", "average"],
    },
  },
} as const
