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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          alternate_phone: string | null
          civil_id: string | null
          created_at: string
          full_name: string
          id: string
          mobile_number: string
          notes: string | null
          sequence_number: string | null
          tap_card_id: string | null
          tap_customer_id: string | null
          tap_payment_agreement_id: string | null
          updated_at: string
        }
        Insert: {
          alternate_phone?: string | null
          civil_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          mobile_number: string
          notes?: string | null
          sequence_number?: string | null
          tap_card_id?: string | null
          tap_customer_id?: string | null
          tap_payment_agreement_id?: string | null
          updated_at?: string
        }
        Update: {
          alternate_phone?: string | null
          civil_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          mobile_number?: string
          notes?: string | null
          sequence_number?: string | null
          tap_card_id?: string | null
          tap_customer_id?: string | null
          tap_payment_agreement_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_attachments: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          payment_id: string | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          payment_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          payment_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_attachments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_attachments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          created_at: string
          customer_id: string
          id: string
          legal_case_id: string | null
          legal_fee_id: string | null
          notes: string | null
          payment_date: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          customer_id: string
          id?: string
          legal_case_id?: string | null
          legal_fee_id?: string | null
          notes?: string | null
          payment_date: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          customer_id?: string
          id?: string
          legal_case_id?: string | null
          legal_fee_id?: string | null
          notes?: string | null
          payment_date?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          cost_price: number | null
          court_collection_data: Json | null
          created_at: string
          customer_id: string
          extra_price: number | null
          has_legal_case: boolean
          id: string
          installment_amount: number
          legal_case_details: string | null
          legal_case_fee: number | null
          notes: string | null
          number_of_installments: number
          overdue_amount: number | null
          overdue_installments: number | null
          profit: number | null
          remaining_balance: number
          sequence_number: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          cost_price?: number | null
          court_collection_data?: Json | null
          created_at?: string
          customer_id: string
          extra_price?: number | null
          has_legal_case?: boolean
          id?: string
          installment_amount: number
          legal_case_details?: string | null
          legal_case_fee?: number | null
          notes?: string | null
          number_of_installments: number
          overdue_amount?: number | null
          overdue_installments?: number | null
          profit?: number | null
          remaining_balance: number
          sequence_number?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cost_price?: number | null
          court_collection_data?: Json | null
          created_at?: string
          customer_id?: string
          extra_price?: number | null
          has_legal_case?: boolean
          id?: string
          installment_amount?: number
          legal_case_details?: string | null
          legal_case_fee?: number | null
          notes?: string | null
          number_of_installments?: number
          overdue_amount?: number | null
          overdue_installments?: number | null
          profit?: number | null
          remaining_balance?: number
          sequence_number?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_cases: {
        Row: {
          amount_due: string | null
          automated_number: string | null
          case_number: string
          circle_number: string | null
          created_at: string | null
          customer_id: string | null
          entity: string | null
          id: string
          next_session_date: string | null
          notes: string | null
          opponent: string | null
          session_date: string | null
          session_decision: string | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_due?: string | null
          automated_number?: string | null
          case_number: string
          circle_number?: string | null
          created_at?: string | null
          customer_id?: string | null
          entity?: string | null
          id?: string
          next_session_date?: string | null
          notes?: string | null
          opponent?: string | null
          session_date?: string | null
          session_decision?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_due?: string | null
          automated_number?: string | null
          case_number?: string
          circle_number?: string | null
          created_at?: string | null
          customer_id?: string | null
          entity?: string | null
          id?: string
          next_session_date?: string | null
          notes?: string | null
          opponent?: string | null
          session_date?: string | null
          session_decision?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_cases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_fees: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string | null
          id: string
          notes: string | null
          status: string | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_fees_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_fees_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
    }
    Functions: {
      check_overdue_transactions: { Args: never; Returns: string }
      get_customer_balance: {
        Args: { p_customer_id: string }
        Returns: number
      }
      delete_multiple_customers: {
        Args: { customer_ids: string[] }
        Returns: undefined
      }
      delete_multiple_payments: {
        Args: { payment_ids: string[] }
        Returns: undefined
      }
      delete_multiple_transactions: {
        Args: { transaction_ids: string[] }
        Returns: undefined
      }
      get_dashboard_stats: {
        Args: never
        Returns: {
          collected_profit: number
          overdue_transactions: number
          total_active_transactions: number
          total_customers: number
          total_outstanding: number
          total_overdue: number
          total_profit: number
          total_revenue: number
          total_legal_fees: number
        }[]
      }
      get_filtered_dashboard_stats: {
        Args: {
          p_month?: number
          p_year?: number
        }
        Returns: {
          collected_profit: number
          court_revenue: number
          other_revenue: number
          overdue_transactions: number
          tap_revenue: number
          total_active_transactions: number
          total_customers: number
          total_legal_fees: number
          total_outstanding: number
          total_overdue: number
          total_profit: number
          total_revenue: number
        }[]
      }
      get_financial_report: {
        Args: {
          end_date: string
          start_date: string
          transaction_statuses: string[]
        }
        Returns: {
          total_additional_price: number
          total_installment_value: number
          total_item_price: number
          total_price: number
        }[]
      }
      get_high_risk_customers: {
        Args: never
        Returns: {
          customer_id: string
          full_name: string
          mobile_number: string
          risk_reason: string
          total_outstanding: number
          total_overdue_amount: number
        }[]
      }
      has_role: {
        Args: {
          role_to_check: Database["public"]["Enums"]["app_role"]
          user_id_to_check: string
        }
        Returns: boolean
      }
      is_authorized_user: {
        Args: { user_id_to_check: string }
        Returns: boolean
      }
      record_payment: {
        Args: {
          p_amount: number
          p_notes?: string
          p_payment_date: string
          p_transaction_id: string
        }
        Returns: undefined
      }
      update_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          user_id_to_update: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "pending"
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
      app_role: ["admin", "staff", "pending"],
    },
  },
} as const
