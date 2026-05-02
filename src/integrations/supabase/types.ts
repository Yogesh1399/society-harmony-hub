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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          society_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          society_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          society_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number_masked: string | null
          bank_name: string
          branch: string | null
          created_at: string | null
          id: string
          ifsc: string | null
          is_active: boolean
          is_default: boolean
          opening_balance: number
          opening_balance_date: string
          society_id: string
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number_masked?: string | null
          bank_name: string
          branch?: string | null
          created_at?: string | null
          id?: string
          ifsc?: string | null
          is_active?: boolean
          is_default?: boolean
          opening_balance?: number
          opening_balance_date?: string
          society_id: string
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number_masked?: string | null
          bank_name?: string
          branch?: string | null
          created_at?: string | null
          id?: string
          ifsc?: string | null
          is_active?: boolean
          is_default?: boolean
          opening_balance?: number
          opening_balance_date?: string
          society_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bank_entries: {
        Row: {
          balance_after: number | null
          bank_account_id: string
          bank_statement_id: string | null
          created_at: string | null
          credit: number
          debit: number
          description: string | null
          id: string
          matched_at: string | null
          matched_by: string | null
          matched_expense_id: string | null
          matched_income_id: string | null
          notes: string | null
          reconciliation_status: string
          reference: string | null
          society_id: string
          txn_date: string
          txn_type: string
          updated_at: string | null
          value_date: string | null
        }
        Insert: {
          balance_after?: number | null
          bank_account_id: string
          bank_statement_id?: string | null
          created_at?: string | null
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_expense_id?: string | null
          matched_income_id?: string | null
          notes?: string | null
          reconciliation_status?: string
          reference?: string | null
          society_id: string
          txn_date: string
          txn_type?: string
          updated_at?: string | null
          value_date?: string | null
        }
        Update: {
          balance_after?: number | null
          bank_account_id?: string
          bank_statement_id?: string | null
          created_at?: string | null
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_expense_id?: string | null
          matched_income_id?: string | null
          notes?: string | null
          reconciliation_status?: string
          reference?: string | null
          society_id?: string
          txn_date?: string
          txn_type?: string
          updated_at?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_entries_bank_statement_id_fkey"
            columns: ["bank_statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string
          closing_balance: number | null
          created_at: string | null
          entry_count: number | null
          file_name: string | null
          file_url: string | null
          id: string
          opening_balance: number | null
          parse_notes: string | null
          parse_status: string
          period_from: string
          period_to: string
          society_id: string
          total_credit: number | null
          total_debit: number | null
          uploaded_by: string | null
        }
        Insert: {
          bank_account_id: string
          closing_balance?: number | null
          created_at?: string | null
          entry_count?: number | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          opening_balance?: number | null
          parse_notes?: string | null
          parse_status?: string
          period_from: string
          period_to: string
          society_id: string
          total_credit?: number | null
          total_debit?: number | null
          uploaded_by?: string | null
        }
        Update: {
          bank_account_id?: string
          closing_balance?: number | null
          created_at?: string | null
          entry_count?: number | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          opening_balance?: number | null
          parse_notes?: string | null
          parse_status?: string
          period_from?: string
          period_to?: string
          society_id?: string
          total_credit?: number | null
          total_debit?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_members: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          member_id: string
          resolution_doc_url: string | null
          role: Database["public"]["Enums"]["committee_role"]
          society_id: string
          term_end: string | null
          term_start: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          member_id: string
          resolution_doc_url?: string | null
          role: Database["public"]["Enums"]["committee_role"]
          society_id: string
          term_end?: string | null
          term_start?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string
          resolution_doc_url?: string | null
          role?: Database["public"]["Enums"]["committee_role"]
          society_id?: string
          term_end?: string | null
          term_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committee_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          flat_id: string | null
          id: string
          photo_url: string | null
          priority: Database["public"]["Enums"]["complaint_priority"] | null
          raised_by: string | null
          resolution_note: string | null
          resolved_at: string | null
          society_id: string
          status: Database["public"]["Enums"]["complaint_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          flat_id?: string | null
          id?: string
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"] | null
          raised_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          society_id: string
          status?: Database["public"]["Enums"]["complaint_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          flat_id?: string | null
          id?: string
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"] | null
          raised_by?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          society_id?: string
          status?: Database["public"]["Enums"]["complaint_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_series: {
        Row: {
          created_at: string | null
          current_number: number
          doc_type: string
          fiscal_year_id: string
          format_pattern: string
          id: string
          pad_length: number
          prefix: string | null
          society_id: string
          type_code: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_number?: number
          doc_type: string
          fiscal_year_id: string
          format_pattern?: string
          id?: string
          pad_length?: number
          prefix?: string | null
          society_id: string
          type_code: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_number?: number
          doc_type?: string
          fiscal_year_id?: string
          format_pattern?: string
          id?: string
          pad_length?: number
          prefix?: string | null
          society_id?: string
          type_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_series_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_series_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          entity_id: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          society_id: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category: string
          entity_id?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          society_id: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          entity_id?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          society_id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_approval_history: {
        Row: {
          action: string
          actor_role: string | null
          actor_user_id: string
          created_at: string | null
          expense_id: string
          id: string
          notes: string | null
          society_id: string
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_user_id: string
          created_at?: string | null
          expense_id: string
          id?: string
          notes?: string | null
          society_id: string
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_user_id?: string
          created_at?: string | null
          expense_id?: string
          id?: string
          notes?: string | null
          society_id?: string
        }
        Relationships: []
      }
      expense_entries: {
        Row: {
          amount: number
          approval_status:
            | Database["public"]["Enums"]["expense_approval_status"]
            | null
          approved_by: string | null
          chairman_approved_at: string | null
          chairman_approved_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expense_head_id: string | null
          gst_amount: number | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoice_url: string | null
          is_cancelled: boolean | null
          matched_bank_entry_id: string | null
          net_amount: number
          paid_by: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          raised_by_role: string | null
          raised_by_user_id: string | null
          reconciliation_status: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          secretary_approved_at: string | null
          secretary_approved_by: string | null
          society_id: string
          tds_amount: number | null
          transaction_ref: string | null
          updated_at: string | null
          vendor_address: string | null
          vendor_name: string
          voucher_date: string
          voucher_number: string
        }
        Insert: {
          amount: number
          approval_status?:
            | Database["public"]["Enums"]["expense_approval_status"]
            | null
          approved_by?: string | null
          chairman_approved_at?: string | null
          chairman_approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_head_id?: string | null
          gst_amount?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          is_cancelled?: boolean | null
          matched_bank_entry_id?: string | null
          net_amount: number
          paid_by?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          raised_by_role?: string | null
          raised_by_user_id?: string | null
          reconciliation_status?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          secretary_approved_at?: string | null
          secretary_approved_by?: string | null
          society_id: string
          tds_amount?: number | null
          transaction_ref?: string | null
          updated_at?: string | null
          vendor_address?: string | null
          vendor_name: string
          voucher_date: string
          voucher_number: string
        }
        Update: {
          amount?: number
          approval_status?:
            | Database["public"]["Enums"]["expense_approval_status"]
            | null
          approved_by?: string | null
          chairman_approved_at?: string | null
          chairman_approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_head_id?: string | null
          gst_amount?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          is_cancelled?: boolean | null
          matched_bank_entry_id?: string | null
          net_amount?: number
          paid_by?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          raised_by_role?: string | null
          raised_by_user_id?: string | null
          reconciliation_status?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          secretary_approved_at?: string | null
          secretary_approved_by?: string | null
          society_id?: string
          tds_amount?: number | null
          transaction_ref?: string | null
          updated_at?: string | null
          vendor_address?: string | null
          vendor_name?: string
          voucher_date?: string
          voucher_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_expense_head_id_fkey"
            columns: ["expense_head_id"]
            isOneToOne: false
            referencedRelation: "expense_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_heads: {
        Row: {
          created_at: string | null
          description: string | null
          head_name: string
          id: string
          is_active: boolean | null
          society_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          head_name: string
          id?: string
          is_active?: boolean | null
          society_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          head_name?: string
          id?: string
          is_active?: boolean | null
          society_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_heads_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          id: string
          member_id: string
          name: string
          photo_url: string | null
          relation: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          id?: string
          member_id: string
          name: string
          photo_url?: string | null
          relation?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          id?: string
          member_id?: string
          name?: string
          photo_url?: string | null
          relation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_settings: {
        Row: {
          enable_amenity_booking: boolean | null
          enable_asset_management: boolean | null
          enable_bank_reconciliation: boolean | null
          enable_committee_management: boolean | null
          enable_document_management: boolean | null
          enable_email: boolean | null
          enable_meeting_management: boolean | null
          enable_multi_language: boolean | null
          enable_online_payment: boolean | null
          enable_sms: boolean | null
          enable_tenant_management: boolean | null
          enable_vendor_management: boolean | null
          enable_visitor_management: boolean | null
          enable_whatsapp: boolean | null
          id: string
          society_id: string
          updated_at: string | null
        }
        Insert: {
          enable_amenity_booking?: boolean | null
          enable_asset_management?: boolean | null
          enable_bank_reconciliation?: boolean | null
          enable_committee_management?: boolean | null
          enable_document_management?: boolean | null
          enable_email?: boolean | null
          enable_meeting_management?: boolean | null
          enable_multi_language?: boolean | null
          enable_online_payment?: boolean | null
          enable_sms?: boolean | null
          enable_tenant_management?: boolean | null
          enable_vendor_management?: boolean | null
          enable_visitor_management?: boolean | null
          enable_whatsapp?: boolean | null
          id?: string
          society_id: string
          updated_at?: string | null
        }
        Update: {
          enable_amenity_booking?: boolean | null
          enable_asset_management?: boolean | null
          enable_bank_reconciliation?: boolean | null
          enable_committee_management?: boolean | null
          enable_document_management?: boolean | null
          enable_email?: boolean | null
          enable_meeting_management?: boolean | null
          enable_multi_language?: boolean | null
          enable_online_payment?: boolean | null
          enable_sms?: boolean | null
          enable_tenant_management?: boolean | null
          enable_vendor_management?: boolean | null
          enable_visitor_management?: boolean | null
          enable_whatsapp?: boolean | null
          id?: string
          society_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_settings_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: true
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_months: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          fiscal_year_id: string
          id: string
          month_end: string
          month_label: string
          month_number: number
          month_start: string
          society_id: string
          status: Database["public"]["Enums"]["fiscal_month_status"]
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          fiscal_year_id: string
          id?: string
          month_end: string
          month_label: string
          month_number: number
          month_start: string
          society_id: string
          status?: Database["public"]["Enums"]["fiscal_month_status"]
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          fiscal_year_id?: string
          id?: string
          month_end?: string
          month_label?: string
          month_number?: number
          month_start?: string
          society_id?: string
          status?: Database["public"]["Enums"]["fiscal_month_status"]
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_months_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_months_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_years: {
        Row: {
          audit_document_url: string | null
          created_at: string | null
          end_date: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          society_id: string
          start_date: string
          status: Database["public"]["Enums"]["fiscal_year_status"]
          updated_at: string | null
          year_code: string
          year_label: string
        }
        Insert: {
          audit_document_url?: string | null
          created_at?: string | null
          end_date: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          society_id: string
          start_date: string
          status?: Database["public"]["Enums"]["fiscal_year_status"]
          updated_at?: string | null
          year_code: string
          year_label: string
        }
        Update: {
          audit_document_url?: string | null
          created_at?: string | null
          end_date?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          society_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["fiscal_year_status"]
          updated_at?: string | null
          year_code?: string
          year_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_years_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      flats: {
        Row: {
          area_sqft: number | null
          created_at: string | null
          flat_number: string
          floor: number | null
          id: string
          parking_slots: number | null
          society_id: string
          status: Database["public"]["Enums"]["flat_status"] | null
          updated_at: string | null
          wing: string | null
        }
        Insert: {
          area_sqft?: number | null
          created_at?: string | null
          flat_number: string
          floor?: number | null
          id?: string
          parking_slots?: number | null
          society_id: string
          status?: Database["public"]["Enums"]["flat_status"] | null
          updated_at?: string | null
          wing?: string | null
        }
        Update: {
          area_sqft?: number | null
          created_at?: string | null
          flat_number?: string
          floor?: number | null
          id?: string
          parking_slots?: number | null
          society_id?: string
          status?: Database["public"]["Enums"]["flat_status"] | null
          updated_at?: string | null
          wing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flats_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      group_permissions: {
        Row: {
          can_approve: boolean | null
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          group_id: string
          id: string
          module: string
        }
        Insert: {
          can_approve?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          group_id: string
          id?: string
          module: string
        }
        Update: {
          can_approve?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          group_id?: string
          id?: string
          module?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      income_entries: {
        Row: {
          bank_name: string | null
          collected_by: string | null
          created_at: string | null
          created_by: string | null
          flat_id: string | null
          id: string
          is_cancelled: boolean | null
          matched_bank_entry_id: string | null
          member_id: string | null
          notes: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          period_from: string | null
          period_to: string | null
          receipt_date: string
          receipt_number: string
          reconciliation_status: string
          society_id: string
          total_amount: number
          transaction_ref: string | null
          updated_at: string | null
        }
        Insert: {
          bank_name?: string | null
          collected_by?: string | null
          created_at?: string | null
          created_by?: string | null
          flat_id?: string | null
          id?: string
          is_cancelled?: boolean | null
          matched_bank_entry_id?: string | null
          member_id?: string | null
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          period_from?: string | null
          period_to?: string | null
          receipt_date: string
          receipt_number: string
          reconciliation_status?: string
          society_id: string
          total_amount: number
          transaction_ref?: string | null
          updated_at?: string | null
        }
        Update: {
          bank_name?: string | null
          collected_by?: string | null
          created_at?: string | null
          created_by?: string | null
          flat_id?: string | null
          id?: string
          is_cancelled?: boolean | null
          matched_bank_entry_id?: string | null
          member_id?: string | null
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          period_from?: string | null
          period_to?: string | null
          receipt_date?: string
          receipt_number?: string
          reconciliation_status?: string
          society_id?: string
          total_amount?: number
          transaction_ref?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "income_entries_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      income_entry_details: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          income_entry_id: string
          income_head_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          income_entry_id: string
          income_head_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          income_entry_id?: string
          income_head_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "income_entry_details_income_entry_id_fkey"
            columns: ["income_entry_id"]
            isOneToOne: false
            referencedRelation: "income_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entry_details_income_head_id_fkey"
            columns: ["income_head_id"]
            isOneToOne: false
            referencedRelation: "income_heads"
            referencedColumns: ["id"]
          },
        ]
      }
      income_heads: {
        Row: {
          created_at: string | null
          description: string | null
          head_name: string
          id: string
          is_active: boolean | null
          society_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          head_name: string
          id?: string
          is_active?: boolean | null
          society_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          head_name?: string
          id?: string
          is_active?: boolean | null
          society_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_heads_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_bill_items: {
        Row: {
          amount: number
          bill_id: string
          created_at: string | null
          head_id: string | null
          head_name: string
          id: string
        }
        Insert: {
          amount?: number
          bill_id: string
          created_at?: string | null
          head_id?: string | null
          head_name: string
          id?: string
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string | null
          head_id?: string | null
          head_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "maintenance_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_bill_items_head_id_fkey"
            columns: ["head_id"]
            isOneToOne: false
            referencedRelation: "maintenance_heads"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_bills: {
        Row: {
          bill_date: string
          bill_month: string
          created_at: string | null
          due_date: string | null
          flat_id: string
          id: string
          interest_amount: number | null
          member_id: string | null
          paid_amount: number | null
          paid_date: string | null
          penalty_amount: number | null
          society_id: string
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          bill_date?: string
          bill_month: string
          created_at?: string | null
          due_date?: string | null
          flat_id: string
          id?: string
          interest_amount?: number | null
          member_id?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          penalty_amount?: number | null
          society_id: string
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          bill_date?: string
          bill_month?: string
          created_at?: string | null
          due_date?: string | null
          flat_id?: string
          id?: string
          interest_amount?: number | null
          member_id?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          penalty_amount?: number | null
          society_id?: string
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_bills_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_bills_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_bills_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_heads: {
        Row: {
          amount: number | null
          applicable_to: string | null
          calculation_type: string | null
          created_at: string | null
          description: string | null
          frequency: string | null
          head_name: string
          id: string
          is_active: boolean | null
          society_id: string
        }
        Insert: {
          amount?: number | null
          applicable_to?: string | null
          calculation_type?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          head_name: string
          id?: string
          is_active?: boolean | null
          society_id: string
        }
        Update: {
          amount?: number | null
          applicable_to?: string | null
          calculation_type?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          head_name?: string
          id?: string
          is_active?: boolean | null
          society_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_heads_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_settings: {
        Row: {
          auto_generate: boolean | null
          created_at: string | null
          due_day: number | null
          grace_days: number | null
          id: string
          interest_calculation: string | null
          interest_rate: number | null
          penalty_amount: number | null
          society_id: string
          updated_at: string | null
        }
        Insert: {
          auto_generate?: boolean | null
          created_at?: string | null
          due_day?: number | null
          grace_days?: number | null
          id?: string
          interest_calculation?: string | null
          interest_rate?: number | null
          penalty_amount?: number | null
          society_id: string
          updated_at?: string | null
        }
        Update: {
          auto_generate?: boolean | null
          created_at?: string | null
          due_day?: number | null
          grace_days?: number | null
          id?: string
          interest_calculation?: string | null
          interest_rate?: number | null
          penalty_amount?: number | null
          society_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_settings_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: true
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      member_ledger: {
        Row: {
          balance: number | null
          created_at: string | null
          credit: number | null
          debit: number | null
          description: string
          entry_date: string
          flat_id: string | null
          id: string
          member_id: string
          reference_id: string | null
          reference_type: string | null
          society_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          description: string
          entry_date?: string
          flat_id?: string | null
          id?: string
          member_id: string
          reference_id?: string | null
          reference_type?: string | null
          society_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          description?: string
          entry_date?: string
          flat_id?: string | null
          id?: string
          member_id?: string
          reference_id?: string | null
          reference_type?: string | null
          society_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_ledger_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ledger_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          aadhar_masked: string | null
          created_at: string | null
          email: string | null
          flat_id: string | null
          full_name: string
          id: string
          is_active: boolean | null
          mobile: string | null
          ownership_date: string | null
          pan_masked: string | null
          photo_url: string | null
          share_certificate_url: string | null
          society_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          aadhar_masked?: string | null
          created_at?: string | null
          email?: string | null
          flat_id?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          ownership_date?: string | null
          pan_masked?: string | null
          photo_url?: string | null
          share_certificate_url?: string | null
          society_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          aadhar_masked?: string | null
          created_at?: string | null
          email?: string | null
          flat_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          ownership_date?: string | null
          pan_masked?: string | null
          photo_url?: string | null
          share_certificate_url?: string | null
          society_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_reads: {
        Row: {
          id: string
          notice_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          notice_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          notice_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_reads_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          attachment_url: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          notice_date: string
          society_id: string
          title: string
          updated_at: string | null
          visible_to: string | null
        }
        Insert: {
          attachment_url?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notice_date: string
          society_id: string
          title: string
          updated_at?: string | null
          visible_to?: string | null
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notice_date?: string
          society_id?: string
          title?: string
          updated_at?: string | null
          visible_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notices_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          enabled_channels: string[] | null
          id: string
          notify_complaint_to_admin: boolean | null
          notify_complaint_update_to_member: boolean | null
          notify_notice_to_all: boolean | null
          notify_payment_to_admin: boolean | null
          society_id: string
          updated_at: string | null
        }
        Insert: {
          enabled_channels?: string[] | null
          id?: string
          notify_complaint_to_admin?: boolean | null
          notify_complaint_update_to_member?: boolean | null
          notify_notice_to_all?: boolean | null
          notify_payment_to_admin?: boolean | null
          society_id: string
          updated_at?: string | null
        }
        Update: {
          enabled_channels?: string[] | null
          id?: string
          notify_complaint_to_admin?: boolean | null
          notify_complaint_update_to_member?: boolean | null
          notify_notice_to_all?: boolean | null
          notify_payment_to_admin?: boolean | null
          society_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: true
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          message: string
          society_id: string
          source_id: string | null
          source_type: string | null
          target_roles: string[] | null
          target_user_ids: string[] | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          message: string
          society_id: string
          source_id?: string | null
          source_type?: string | null
          target_roles?: string[] | null
          target_user_ids?: string[] | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          message?: string
          society_id?: string
          source_id?: string | null
          source_type?: string | null
          target_roles?: string[] | null
          target_user_ids?: string[] | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          society_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          society_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          society_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_groups_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          mobile: string | null
          profile_photo_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          mobile?: string | null
          profile_photo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          profile_photo_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      receipt_series: {
        Row: {
          current_number: number | null
          financial_year: string
          id: string
          last_reset_date: string | null
          prefix: string
          receipt_type: string
          society_id: string
        }
        Insert: {
          current_number?: number | null
          financial_year: string
          id?: string
          last_reset_date?: string | null
          prefix: string
          receipt_type: string
          society_id: string
        }
        Update: {
          current_number?: number | null
          financial_year?: string
          id?: string
          last_reset_date?: string | null
          prefix?: string
          receipt_type?: string
          society_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_series_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      societies: {
        Row: {
          address: string | null
          auto_close_month_day: number | null
          bank_account: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          created_at: string | null
          document_number_format: string | null
          financial_year: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          package_type: Database["public"]["Enums"]["package_type"] | null
          pan_number: string | null
          pincode: string | null
          registration_date: string | null
          registration_no: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          auto_close_month_day?: number | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string | null
          document_number_format?: string | null
          financial_year?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          package_type?: Database["public"]["Enums"]["package_type"] | null
          pan_number?: string | null
          pincode?: string | null
          registration_date?: string | null
          registration_no?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          auto_close_month_day?: number | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string | null
          document_number_format?: string | null
          financial_year?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          package_type?: Database["public"]["Enums"]["package_type"] | null
          pan_number?: string | null
          pincode?: string | null
          registration_date?: string | null
          registration_no?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      temporary_access_grants: {
        Row: {
          created_at: string | null
          granted_by_user_id: string
          granted_to_user_id: string
          id: string
          is_revoked: boolean
          notes: string | null
          resource_id: string | null
          resource_type: string
          revoked_at: string | null
          revoked_by: string | null
          society_id: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          created_at?: string | null
          granted_by_user_id: string
          granted_to_user_id: string
          id?: string
          is_revoked?: boolean
          notes?: string | null
          resource_id?: string | null
          resource_type: string
          revoked_at?: string | null
          revoked_by?: string | null
          society_id: string
          valid_from?: string
          valid_to: string
        }
        Update: {
          created_at?: string | null
          granted_by_user_id?: string
          granted_to_user_id?: string
          id?: string
          is_revoked?: boolean
          notes?: string | null
          resource_id?: string | null
          resource_type?: string
          revoked_at?: string | null
          revoked_by?: string | null
          society_id?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: []
      }
      tenant_period_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          reason: string
          tenant_id: string
          validity_from: string
          validity_to: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          reason: string
          tenant_id: string
          validity_from: string
          validity_to: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          reason?: string
          tenant_id?: string
          validity_from?: string
          validity_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_period_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          aadhar_masked: string | null
          created_at: string | null
          email: string | null
          flat_id: string | null
          full_name: string
          id: string
          is_active: boolean | null
          mobile: string | null
          native_address: string | null
          period_change_reason: string | null
          photo_url: string | null
          police_verification_url: string | null
          rent_agreement_url: string | null
          rent_amount: number | null
          society_id: string
          updated_at: string | null
          user_id: string | null
          validity_from: string | null
          validity_to: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          aadhar_masked?: string | null
          created_at?: string | null
          email?: string | null
          flat_id?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          native_address?: string | null
          period_change_reason?: string | null
          photo_url?: string | null
          police_verification_url?: string | null
          rent_agreement_url?: string | null
          rent_amount?: number | null
          society_id: string
          updated_at?: string | null
          user_id?: string | null
          validity_from?: string | null
          validity_to?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          aadhar_masked?: string | null
          created_at?: string | null
          email?: string | null
          flat_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          native_address?: string | null
          period_change_reason?: string | null
          photo_url?: string | null
          police_verification_url?: string | null
          rent_agreement_url?: string | null
          rent_amount?: number | null
          society_id?: string
          updated_at?: string | null
          user_id?: string | null
          validity_from?: string | null
          validity_to?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_assignments: {
        Row: {
          additional_permissions: Json | null
          assigned_at: string | null
          assigned_by: string | null
          group_id: string
          id: string
          restricted_permissions: Json | null
          society_id: string | null
          user_id: string
        }
        Insert: {
          additional_permissions?: Json | null
          assigned_at?: string | null
          assigned_by?: string | null
          group_id: string
          id?: string
          restricted_permissions?: Json | null
          society_id?: string | null
          user_id: string
        }
        Update: {
          additional_permissions?: Json | null
          assigned_at?: string | null
          assigned_by?: string | null
          group_id?: string
          id?: string
          restricted_permissions?: Json | null
          society_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_assignments_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          society_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          society_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          society_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_match_bank_entry: { Args: { _bank_entry_id: string }; Returns: Json }
      can_update_expense_approval: {
        Args: {
          _new_status: Database["public"]["Enums"]["expense_approval_status"]
          _old_status: Database["public"]["Enums"]["expense_approval_status"]
          _society_id: string
          _user_id: string
        }
        Returns: boolean
      }
      generate_next_doc_number: {
        Args: {
          _doc_type: string
          _fiscal_year_id?: string
          _society_id: string
        }
        Returns: string
      }
      get_committee_role: {
        Args: { _society_id: string; _user_id: string }
        Returns: string
      }
      get_user_role_in_society: {
        Args: { _society_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_society_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _society_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      has_society_access: { Args: { _society_id: string }; Returns: boolean }
      has_temp_access: {
        Args: { _resource_type: string; _society_id: string; _user_id: string }
        Returns: boolean
      }
      is_committee_role: {
        Args: { _role: string; _society_id: string; _user_id: string }
        Returns: boolean
      }
      is_period_locked: {
        Args: { _date: string; _society_id: string }
        Returns: boolean
      }
      is_society_admin_of: { Args: { _society_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "society_admin"
        | "committee_member"
        | "flat_owner"
        | "tenant"
        | "auditor"
      committee_role: "chairman" | "secretary" | "treasurer" | "member"
      complaint_priority: "low" | "medium" | "high"
      complaint_status: "open" | "in_progress" | "resolved" | "closed"
      expense_approval_status:
        | "draft"
        | "pending_secretary"
        | "pending_chairman"
        | "approved"
        | "rejected"
      fiscal_month_status: "open" | "closed"
      fiscal_year_status: "open" | "closed" | "finalized"
      flat_status:
        | "owner_occupied"
        | "rented"
        | "vacant"
        | "available_for_tenant"
        | "tenant_occupied"
        | "under_transfer"
        | "builder_owned"
        | "society_owned"
      package_type: "basic" | "standard" | "professional"
      payment_mode: "cash" | "cheque" | "neft" | "upi" | "card"
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
        "society_admin",
        "committee_member",
        "flat_owner",
        "tenant",
        "auditor",
      ],
      committee_role: ["chairman", "secretary", "treasurer", "member"],
      complaint_priority: ["low", "medium", "high"],
      complaint_status: ["open", "in_progress", "resolved", "closed"],
      expense_approval_status: [
        "draft",
        "pending_secretary",
        "pending_chairman",
        "approved",
        "rejected",
      ],
      fiscal_month_status: ["open", "closed"],
      fiscal_year_status: ["open", "closed", "finalized"],
      flat_status: [
        "owner_occupied",
        "rented",
        "vacant",
        "available_for_tenant",
        "tenant_occupied",
        "under_transfer",
        "builder_owned",
        "society_owned",
      ],
      package_type: ["basic", "standard", "professional"],
      payment_mode: ["cash", "cheque", "neft", "upi", "card"],
    },
  },
} as const
