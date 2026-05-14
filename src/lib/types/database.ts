export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      campaigns: {
        Row: {
          budget: number | null;
          channel: string | null;
          created_at: string | null;
          end_date: string | null;
          id: string;
          leads_generated: number | null;
          name: string;
          notes: string | null;
          organization_id: string;
          spent: number | null;
          start_date: string | null;
          status: string | null;
        };
        Insert: {
          budget?: number | null;
          channel?: string | null;
          created_at?: string | null;
          end_date?: string | null;
          id?: string;
          leads_generated?: number | null;
          name: string;
          notes?: string | null;
          organization_id: string;
          spent?: number | null;
          start_date?: string | null;
          status?: string | null;
        };
        Update: {
          budget?: number | null;
          channel?: string | null;
          created_at?: string | null;
          end_date?: string | null;
          id?: string;
          leads_generated?: number | null;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          spent?: number | null;
          start_date?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      chemical_transactions: {
        Row: {
          chemical_id: string;
          cost: number | null;
          created_at: string | null;
          id: string;
          job_id: string | null;
          notes: string | null;
          organization_id: string;
          quantity: number;
          transaction_date: string | null;
          transaction_type: string;
        };
        Insert: {
          chemical_id: string;
          cost?: number | null;
          created_at?: string | null;
          id?: string;
          job_id?: string | null;
          notes?: string | null;
          organization_id: string;
          quantity: number;
          transaction_date?: string | null;
          transaction_type: string;
        };
        Update: {
          chemical_id?: string;
          cost?: number | null;
          created_at?: string | null;
          id?: string;
          job_id?: string | null;
          notes?: string | null;
          organization_id?: string;
          quantity?: number;
          transaction_date?: string | null;
          transaction_type?: string;
        };
        Relationships: [];
      };
      chemicals: {
        Row: {
          brand: string | null;
          category: string | null;
          cost_per_unit: number | null;
          created_at: string | null;
          current_stock: number | null;
          description: string | null;
          hazard_class: string | null;
          id: string;
          name: string;
          notes: string | null;
          organization_id: string;
          reorder_level: number | null;
          sds_url: string | null;
          sku: string | null;
          supplier: string | null;
          unit: string | null;
          updated_at: string | null;
        };
        Insert: {
          brand?: string | null;
          category?: string | null;
          cost_per_unit?: number | null;
          created_at?: string | null;
          current_stock?: number | null;
          description?: string | null;
          hazard_class?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          organization_id: string;
          reorder_level?: number | null;
          sds_url?: string | null;
          sku?: string | null;
          supplier?: string | null;
          unit?: string | null;
          updated_at?: string | null;
        };
        Update: {
          brand?: string | null;
          category?: string | null;
          cost_per_unit?: number | null;
          created_at?: string | null;
          current_stock?: number | null;
          description?: string | null;
          hazard_class?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          reorder_level?: number | null;
          sds_url?: string | null;
          sku?: string | null;
          supplier?: string | null;
          unit?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          company_name: string | null;
          created_at: string | null;
          customer_type: string | null;
          email: string | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          lead_source: string | null;
          mobile_phone: string | null;
          notes: string | null;
          organization_id: string;
          phone: string | null;
          tags: string[] | null;
          updated_at: string | null;
        };
        Insert: {
          company_name?: string | null;
          created_at?: string | null;
          customer_type?: string | null;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          lead_source?: string | null;
          mobile_phone?: string | null;
          notes?: string | null;
          organization_id: string;
          phone?: string | null;
          tags?: string[] | null;
          updated_at?: string | null;
        };
        Update: {
          company_name?: string | null;
          created_at?: string | null;
          customer_type?: string | null;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          lead_source?: string | null;
          mobile_phone?: string | null;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          tags?: string[] | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      equipment: {
        Row: {
          created_at: string | null;
          current_value: number | null;
          hours_used: number | null;
          id: string;
          last_service_date: string | null;
          name: string;
          next_service_date: string | null;
          notes: string | null;
          organization_id: string;
          purchase_date: string | null;
          purchase_price: number | null;
          serial_number: string | null;
          status: string | null;
          type: string | null;
        };
        Insert: {
          created_at?: string | null;
          current_value?: number | null;
          hours_used?: number | null;
          id?: string;
          last_service_date?: string | null;
          name: string;
          next_service_date?: string | null;
          notes?: string | null;
          organization_id: string;
          purchase_date?: string | null;
          purchase_price?: number | null;
          serial_number?: string | null;
          status?: string | null;
          type?: string | null;
        };
        Update: {
          created_at?: string | null;
          current_value?: number | null;
          hours_used?: number | null;
          id?: string;
          last_service_date?: string | null;
          name?: string;
          next_service_date?: string | null;
          notes?: string | null;
          organization_id?: string;
          purchase_date?: string | null;
          purchase_price?: number | null;
          serial_number?: string | null;
          status?: string | null;
          type?: string | null;
        };
        Relationships: [];
      };
      estimate_line_items: {
        Row: {
          description: string;
          estimate_id: string;
          id: string;
          quantity: number | null;
          service_id: string | null;
          sort_order: number | null;
          total: number;
          unit_price: number;
        };
        Insert: {
          description: string;
          estimate_id: string;
          id?: string;
          quantity?: number | null;
          service_id?: string | null;
          sort_order?: number | null;
          total?: number;
          unit_price?: number;
        };
        Update: {
          description?: string;
          estimate_id?: string;
          id?: string;
          quantity?: number | null;
          service_id?: string | null;
          sort_order?: number | null;
          total?: number;
          unit_price?: number;
        };
        Relationships: [];
      };
      estimates: {
        Row: {
          accepted_at: string | null;
          created_at: string | null;
          customer_id: string;
          discount_amount: number | null;
          estimate_number: string;
          expires_at: string | null;
          id: string;
          issue_date: string | null;
          notes: string | null;
          organization_id: string;
          property_id: string | null;
          sent_at: string | null;
          status: string | null;
          subtotal: number | null;
          tax_amount: number | null;
          tax_rate: number | null;
          terms: string | null;
          total: number | null;
          updated_at: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string | null;
          customer_id: string;
          discount_amount?: number | null;
          estimate_number: string;
          expires_at?: string | null;
          id?: string;
          issue_date?: string | null;
          notes?: string | null;
          organization_id: string;
          property_id?: string | null;
          sent_at?: string | null;
          status?: string | null;
          subtotal?: number | null;
          tax_amount?: number | null;
          tax_rate?: number | null;
          terms?: string | null;
          total?: number | null;
          updated_at?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string | null;
          customer_id?: string;
          discount_amount?: number | null;
          estimate_number?: string;
          expires_at?: string | null;
          id?: string;
          issue_date?: string | null;
          notes?: string | null;
          organization_id?: string;
          property_id?: string | null;
          sent_at?: string | null;
          status?: string | null;
          subtotal?: number | null;
          tax_amount?: number | null;
          tax_rate?: number | null;
          terms?: string | null;
          total?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      expense_categories: {
        Row: { created_at: string | null; description: string | null; id: string; name: string; organization_id: string };
        Insert: { created_at?: string | null; description?: string | null; id?: string; name: string; organization_id: string };
        Update: { created_at?: string | null; description?: string | null; id?: string; name?: string; organization_id?: string };
        Relationships: [];
      };
      expenses: {
        Row: { amount: number; category_id: string | null; created_at: string | null; description: string | null; expense_date: string | null; id: string; job_id: string | null; organization_id: string; payment_method: string | null; receipt_url: string | null; tax_deductible: boolean | null; vendor: string | null };
        Insert: { amount: number; category_id?: string | null; created_at?: string | null; description?: string | null; expense_date?: string | null; id?: string; job_id?: string | null; organization_id: string; payment_method?: string | null; receipt_url?: string | null; tax_deductible?: boolean | null; vendor?: string | null };
        Update: { amount?: number; category_id?: string | null; created_at?: string | null; description?: string | null; expense_date?: string | null; id?: string; job_id?: string | null; organization_id?: string; payment_method?: string | null; receipt_url?: string | null; tax_deductible?: boolean | null; vendor?: string | null };
        Relationships: [];
      };
      google_drive_connections: {
        Row: { organization_id: string; refresh_token: string; access_token: string | null; access_token_expires_at: string | null; drive_folder_id: string | null; invoices_folder_id: string | null; estimates_folder_id: string | null; photos_folder_id: string | null; receipts_folder_id: string | null; scopes: string[] | null; connected_email: string | null; connected_at: string | null; updated_at: string | null; calendar_id: string | null; calendar_name: string | null };
        Insert: { organization_id: string; refresh_token: string; access_token?: string | null; access_token_expires_at?: string | null; drive_folder_id?: string | null; invoices_folder_id?: string | null; estimates_folder_id?: string | null; photos_folder_id?: string | null; receipts_folder_id?: string | null; scopes?: string[] | null; connected_email?: string | null; connected_at?: string | null; updated_at?: string | null; calendar_id?: string | null; calendar_name?: string | null };
        Update: { organization_id?: string; refresh_token?: string; access_token?: string | null; access_token_expires_at?: string | null; drive_folder_id?: string | null; invoices_folder_id?: string | null; estimates_folder_id?: string | null; photos_folder_id?: string | null; receipts_folder_id?: string | null; scopes?: string[] | null; connected_email?: string | null; connected_at?: string | null; updated_at?: string | null; calendar_id?: string | null; calendar_name?: string | null };
        Relationships: [];
      };
      invoice_line_items: {
        Row: { description: string; id: string; invoice_id: string; quantity: number | null; service_id: string | null; sort_order: number | null; total: number; unit_price: number };
        Insert: { description: string; id?: string; invoice_id: string; quantity?: number | null; service_id?: string | null; sort_order?: number | null; total?: number; unit_price?: number };
        Update: { description?: string; id?: string; invoice_id?: string; quantity?: number | null; service_id?: string | null; sort_order?: number | null; total?: number; unit_price?: number };
        Relationships: [];
      };
      invoices: {
        Row: { amount_paid: number | null; balance_due: number | null; created_at: string | null; customer_id: string; discount_amount: number | null; due_date: string | null; estimate_id: string | null; id: string; invoice_number: string; issue_date: string | null; job_id: string | null; notes: string | null; organization_id: string; paid_at: string | null; sent_at: string | null; status: string | null; stripe_payment_link: string | null; subtotal: number | null; tax_amount: number | null; tax_rate: number | null; terms: string | null; total: number | null; updated_at: string | null };
        Insert: { amount_paid?: number | null; balance_due?: number | null; created_at?: string | null; customer_id: string; discount_amount?: number | null; due_date?: string | null; estimate_id?: string | null; id?: string; invoice_number: string; issue_date?: string | null; job_id?: string | null; notes?: string | null; organization_id: string; paid_at?: string | null; sent_at?: string | null; status?: string | null; stripe_payment_link?: string | null; subtotal?: number | null; tax_amount?: number | null; tax_rate?: number | null; terms?: string | null; total?: number | null; updated_at?: string | null };
        Update: { amount_paid?: number | null; balance_due?: number | null; created_at?: string | null; customer_id?: string; discount_amount?: number | null; due_date?: string | null; estimate_id?: string | null; id?: string; invoice_number?: string; issue_date?: string | null; job_id?: string | null; notes?: string | null; organization_id?: string; paid_at?: string | null; sent_at?: string | null; status?: string | null; stripe_payment_link?: string | null; subtotal?: number | null; tax_amount?: number | null; tax_rate?: number | null; terms?: string | null; total?: number | null; updated_at?: string | null };
        Relationships: [];
      };
      job_assignments: {
        Row: { job_id: string; role: string | null; user_id: string };
        Insert: { job_id: string; role?: string | null; user_id: string };
        Update: { job_id?: string; role?: string | null; user_id?: string };
        Relationships: [];
      };
      jobs: {
        Row: { actual_end: string | null; actual_start: string | null; after_photos: string[] | null; before_photos: string[] | null; created_at: string | null; customer_id: string; description: string | null; estimate_id: string | null; id: string; job_number: string | null; notes: string | null; organization_id: string; property_id: string | null; scheduled_end: string | null; scheduled_start: string | null; status: string | null; title: string; total_amount: number | null; updated_at: string | null };
        Insert: { actual_end?: string | null; actual_start?: string | null; after_photos?: string[] | null; before_photos?: string[] | null; created_at?: string | null; customer_id: string; description?: string | null; estimate_id?: string | null; id?: string; job_number?: string | null; notes?: string | null; organization_id: string; property_id?: string | null; scheduled_end?: string | null; scheduled_start?: string | null; status?: string | null; title: string; total_amount?: number | null; updated_at?: string | null };
        Update: { actual_end?: string | null; actual_start?: string | null; after_photos?: string[] | null; before_photos?: string[] | null; created_at?: string | null; customer_id?: string; description?: string | null; estimate_id?: string | null; id?: string; job_number?: string | null; notes?: string | null; organization_id?: string; property_id?: string | null; scheduled_end?: string | null; scheduled_start?: string | null; status?: string | null; title?: string; total_amount?: number | null; updated_at?: string | null };
        Relationships: [];
      };
      lead_sources: {
        Row: { active: boolean | null; cost_per_month: number | null; created_at: string | null; id: string; name: string; organization_id: string };
        Insert: { active?: boolean | null; cost_per_month?: number | null; created_at?: string | null; id?: string; name: string; organization_id: string };
        Update: { active?: boolean | null; cost_per_month?: number | null; created_at?: string | null; id?: string; name?: string; organization_id?: string };
        Relationships: [];
      };
      leads: {
        Row: { address: string | null; contacted_at: string | null; converted_to_customer_id: string | null; created_at: string | null; email: string | null; estimated_value: number | null; first_name: string | null; id: string; last_name: string | null; notes: string | null; organization_id: string; phone: string | null; source_id: string | null; status: string | null; updated_at: string | null };
        Insert: { address?: string | null; contacted_at?: string | null; converted_to_customer_id?: string | null; created_at?: string | null; email?: string | null; estimated_value?: number | null; first_name?: string | null; id?: string; last_name?: string | null; notes?: string | null; organization_id: string; phone?: string | null; source_id?: string | null; status?: string | null; updated_at?: string | null };
        Update: { address?: string | null; contacted_at?: string | null; converted_to_customer_id?: string | null; created_at?: string | null; email?: string | null; estimated_value?: number | null; first_name?: string | null; id?: string; last_name?: string | null; notes?: string | null; organization_id?: string; phone?: string | null; source_id?: string | null; status?: string | null; updated_at?: string | null };
        Relationships: [];
      };
      measurements: {
        Row: { area_sqft: number | null; center_lat: number | null; center_lng: number | null; created_at: string | null; estimate_id: string | null; id: string; job_id: string | null; label: string | null; material: string | null; notes: string | null; organization_id: string; perimeter_ft: number | null; polygon: Json; property_id: string | null; service_id: string | null };
        Insert: { area_sqft?: number | null; center_lat?: number | null; center_lng?: number | null; created_at?: string | null; estimate_id?: string | null; id?: string; job_id?: string | null; label?: string | null; material?: string | null; notes?: string | null; organization_id: string; perimeter_ft?: number | null; polygon: Json; property_id?: string | null; service_id?: string | null };
        Update: { area_sqft?: number | null; center_lat?: number | null; center_lng?: number | null; created_at?: string | null; estimate_id?: string | null; id?: string; job_id?: string | null; label?: string | null; material?: string | null; notes?: string | null; organization_id?: string; perimeter_ft?: number | null; polygon?: Json; property_id?: string | null; service_id?: string | null };
        Relationships: [];
      };
      organization_members: {
        Row: { created_at: string | null; organization_id: string; role: string; user_id: string };
        Insert: { created_at?: string | null; organization_id: string; role?: string; user_id: string };
        Update: { created_at?: string | null; organization_id?: string; role?: string; user_id?: string };
        Relationships: [];
      };
      org_messaging_credentials: {
        Row: { organization_id: string; resend_api_key: string | null; resend_from: string | null; telnyx_api_key: string | null; telnyx_from_number: string | null; messaging_addon_enabled: boolean | null; messaging_mode: string | null; created_at: string | null; updated_at: string | null };
        Insert: { organization_id: string; resend_api_key?: string | null; resend_from?: string | null; telnyx_api_key?: string | null; telnyx_from_number?: string | null; messaging_addon_enabled?: boolean | null; messaging_mode?: string | null; created_at?: string | null; updated_at?: string | null };
        Update: { organization_id?: string; resend_api_key?: string | null; resend_from?: string | null; telnyx_api_key?: string | null; telnyx_from_number?: string | null; messaging_addon_enabled?: boolean | null; messaging_mode?: string | null; created_at?: string | null; updated_at?: string | null };
        Relationships: [];
      };
      organizations: {
        Row: { address_line1: string | null; address_line2: string | null; city: string | null; country: string | null; created_at: string | null; currency: string | null; email: string | null; estimate_prefix: string | null; id: string; invoice_prefix: string | null; logo_url: string | null; name: string; next_estimate_number: number | null; next_invoice_number: number | null; phone: string | null; postal_code: string | null; state: string | null; stripe_account_id: string | null; tax_rate: number | null; updated_at: string | null; website: string | null };
        Insert: { address_line1?: string | null; address_line2?: string | null; city?: string | null; country?: string | null; created_at?: string | null; currency?: string | null; email?: string | null; estimate_prefix?: string | null; id?: string; invoice_prefix?: string | null; logo_url?: string | null; name: string; next_estimate_number?: number | null; next_invoice_number?: number | null; phone?: string | null; postal_code?: string | null; state?: string | null; stripe_account_id?: string | null; tax_rate?: number | null; updated_at?: string | null; website?: string | null };
        Update: { address_line1?: string | null; address_line2?: string | null; city?: string | null; country?: string | null; created_at?: string | null; currency?: string | null; email?: string | null; estimate_prefix?: string | null; id?: string; invoice_prefix?: string | null; logo_url?: string | null; name?: string; next_estimate_number?: number | null; next_invoice_number?: number | null; phone?: string | null; postal_code?: string | null; state?: string | null; stripe_account_id?: string | null; tax_rate?: number | null; updated_at?: string | null; website?: string | null };
        Relationships: [];
      };
      payments: {
        Row: { amount: number; created_at: string | null; customer_id: string | null; id: string; invoice_id: string | null; notes: string | null; organization_id: string; payment_date: string | null; payment_method: string | null; reference_number: string | null; stripe_payment_intent_id: string | null };
        Insert: { amount: number; created_at?: string | null; customer_id?: string | null; id?: string; invoice_id?: string | null; notes?: string | null; organization_id: string; payment_date?: string | null; payment_method?: string | null; reference_number?: string | null; stripe_payment_intent_id?: string | null };
        Update: { amount?: number; created_at?: string | null; customer_id?: string | null; id?: string; invoice_id?: string | null; notes?: string | null; organization_id?: string; payment_date?: string | null; payment_method?: string | null; reference_number?: string | null; stripe_payment_intent_id?: string | null };
        Relationships: [];
      };
      profiles: {
        Row: { avatar_url: string | null; created_at: string | null; default_organization_id: string | null; full_name: string | null; id: string; phone: string | null; updated_at: string | null };
        Insert: { avatar_url?: string | null; created_at?: string | null; default_organization_id?: string | null; full_name?: string | null; id: string; phone?: string | null; updated_at?: string | null };
        Update: { avatar_url?: string | null; created_at?: string | null; default_organization_id?: string | null; full_name?: string | null; id?: string; phone?: string | null; updated_at?: string | null };
        Relationships: [];
      };
      properties: {
        Row: { address_line1: string; address_line2: string | null; city: string | null; country: string | null; created_at: string | null; customer_id: string; gate_code: string | null; id: string; latitude: number | null; longitude: number | null; nickname: string | null; notes: string | null; organization_id: string; postal_code: string | null; square_footage: number | null; state: string | null; stories: number | null; updated_at: string | null };
        Insert: { address_line1: string; address_line2?: string | null; city?: string | null; country?: string | null; created_at?: string | null; customer_id: string; gate_code?: string | null; id?: string; latitude?: number | null; longitude?: number | null; nickname?: string | null; notes?: string | null; organization_id: string; postal_code?: string | null; square_footage?: number | null; state?: string | null; stories?: number | null; updated_at?: string | null };
        Update: { address_line1?: string; address_line2?: string | null; city?: string | null; country?: string | null; created_at?: string | null; customer_id?: string; gate_code?: string | null; id?: string; latitude?: number | null; longitude?: number | null; nickname?: string | null; notes?: string | null; organization_id?: string; postal_code?: string | null; square_footage?: number | null; state?: string | null; stories?: number | null; updated_at?: string | null };
        Relationships: [];
      };
      receipt_log: {
        Row: { customer_id: string | null; email_to: string | null; id: string; invoice_id: string | null; organization_id: string; payment_id: string | null; provider: string | null; provider_id: string | null; sent_at: string | null; status: string | null };
        Insert: { customer_id?: string | null; email_to?: string | null; id?: string; invoice_id?: string | null; organization_id: string; payment_id?: string | null; provider?: string | null; provider_id?: string | null; sent_at?: string | null; status?: string | null };
        Update: { customer_id?: string | null; email_to?: string | null; id?: string; invoice_id?: string | null; organization_id?: string; payment_id?: string | null; provider?: string | null; provider_id?: string | null; sent_at?: string | null; status?: string | null };
        Relationships: [];
      };
      services: {
        Row: { active: boolean | null; category: string | null; created_at: string | null; default_price: number | null; description: string | null; id: string; name: string; organization_id: string; pricing_unit: string | null };
        Insert: { active?: boolean | null; category?: string | null; created_at?: string | null; default_price?: number | null; description?: string | null; id?: string; name: string; organization_id: string; pricing_unit?: string | null };
        Update: { active?: boolean | null; category?: string | null; created_at?: string | null; default_price?: number | null; description?: string | null; id?: string; name?: string; organization_id?: string; pricing_unit?: string | null };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { is_org_member: { Args: { org_id: string }; Returns: boolean } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
