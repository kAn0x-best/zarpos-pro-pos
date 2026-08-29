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
      cash_shifts: {
        Row: {
          closed_at: string | null
          company_id: string
          counted_cash: number | null
          difference: number | null
          expected_cash: number | null
          id: string
          opened_at: string
          opening_cash: number
          status: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          counted_cash?: number | null
          difference?: number | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          opening_cash?: number
          status?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          counted_cash?: number | null
          difference?: number | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          opening_cash?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          iban: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          subscription_plan: string
          tax_number: string | null
          tax_office: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          subscription_plan?: string
          tax_number?: string | null
          tax_office?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          subscription_plan?: string
          tax_number?: string | null
          tax_office?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          auto_backup_enabled: boolean
          backup_interval_hours: number
          backup_on_zreport: boolean
          company_id: string
          last_backup_at: string | null
          updated_at: string
        }
        Insert: {
          auto_backup_enabled?: boolean
          backup_interval_hours?: number
          backup_on_zreport?: boolean
          company_id: string
          last_backup_at?: string | null
          updated_at?: string
        }
        Update: {
          auto_backup_enabled?: boolean
          backup_interval_hours?: number
          backup_on_zreport?: boolean
          company_id?: string
          last_backup_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          balance: number
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          tax_number: string | null
          tax_office: string | null
          type: string
        }
        Insert: {
          address?: string | null
          balance?: number
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          tax_number?: string | null
          tax_office?: string | null
          type?: string
        }
        Update: {
          address?: string | null
          balance?: number
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          tax_number?: string | null
          tax_office?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          receipt_url: string | null
        }
        Insert: {
          amount?: number
          category?: string
          company_id: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          company_id: string
          id: string
          invoice_id: string
          name: string
          product_id: string | null
          qty: number
          total: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          company_id: string
          id?: string
          invoice_id: string
          name: string
          product_id?: string | null
          qty?: number
          total?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          company_id?: string
          id?: string
          invoice_id?: string
          name?: string
          product_id?: string | null
          qty?: number
          total?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string
          contact_id: string | null
          created_at: string
          direction: string
          due_date: string | null
          id: string
          invoice_no: string
          issue_date: string
          notes: string | null
          status: string
          subtotal: number
          total: number
          vat_total: number
          withholding: number
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          due_date?: string | null
          id?: string
          invoice_no: string
          issue_date?: string
          notes?: string | null
          status?: string
          subtotal?: number
          total?: number
          vat_total?: number
          withholding?: number
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          due_date?: string | null
          id?: string
          invoice_no?: string
          issue_date?: string
          notes?: string | null
          status?: string
          subtotal?: number
          total?: number
          vat_total?: number
          withholding?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          company_id: string
          created_at: string
          id: string
          image_url: string | null
          min_stock: number
          name: string
          purchase_price: number
          sale_price: number
          sku: string | null
          stock: number
          unit: string
          vat_rate: number
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          purchase_price?: number
          sale_price?: number
          sku?: string | null
          stock?: number
          unit?: string
          vat_rate?: number
        }
        Update: {
          barcode?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          purchase_price?: number
          sale_price?: number
          sku?: string | null
          stock?: number
          unit?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          barcode: string | null
          company_id: string
          discount: number
          id: string
          name: string
          product_id: string | null
          qty: number
          sale_id: string
          total: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          barcode?: string | null
          company_id: string
          discount?: number
          id?: string
          name: string
          product_id?: string | null
          qty?: number
          sale_id: string
          total?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          barcode?: string | null
          company_id?: string
          discount?: number
          id?: string
          name?: string
          product_id?: string | null
          qty?: number
          sale_id?: string
          total?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashier_id: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          discount: number
          id: string
          paid_card: number
          paid_cash: number
          paid_credit: number
          payment_method: string
          receipt_no: string | null
          shift_id: string | null
          subtotal: number
          total: number
          vat_total: number
        }
        Insert: {
          cashier_id?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          discount?: number
          id?: string
          paid_card?: number
          paid_cash?: number
          paid_credit?: number
          payment_method?: string
          receipt_no?: string | null
          shift_id?: string | null
          subtotal?: number
          total?: number
          vat_total?: number
        }
        Update: {
          cashier_id?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          discount?: number
          id?: string
          paid_card?: number
          paid_cash?: number
          paid_credit?: number
          payment_method?: string
          receipt_no?: string | null
          shift_id?: string | null
          subtotal?: number
          total?: number
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cash_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          company_id: string
          contact_id: string | null
          created_at: string
          description: string | null
          id: string
          reference: string | null
          type: string
        }
        Insert: {
          amount?: number
          company_id: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          type?: string
        }
        Update: {
          amount?: number
          company_id?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "firm_admin"
        | "manager"
        | "accountant"
        | "cashier"
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
      app_role: [
        "super_admin",
        "firm_admin",
        "manager",
        "accountant",
        "cashier",
      ],
    },
  },
} as const
