export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      bulk_inquiries: {
        Row: {
          anrede: string | null;
          bemerkungen: string | null;
          created_at: string;
          druckverfahren: string | null;
          email: string;
          filiale: string | null;
          firma: string | null;
          id: string;
          motiv_path: string | null;
          nachname: string | null;
          qualitaet: string | null;
          status: string;
          stueckzahl: string | null;
          telefon: string | null;
          textil_art: string | null;
          vorname: string | null;
        };
        ComputedFields: never;
        Insert: {
          anrede?: string | null;
          bemerkungen?: string | null;
          created_at?: string;
          druckverfahren?: string | null;
          email: string;
          filiale?: string | null;
          firma?: string | null;
          id?: string;
          motiv_path?: string | null;
          nachname?: string | null;
          qualitaet?: string | null;
          status?: string;
          stueckzahl?: string | null;
          telefon?: string | null;
          textil_art?: string | null;
          vorname?: string | null;
        };
        Update: {
          anrede?: string | null;
          bemerkungen?: string | null;
          created_at?: string;
          druckverfahren?: string | null;
          email?: string;
          filiale?: string | null;
          firma?: string | null;
          id?: string;
          motiv_path?: string | null;
          nachname?: string | null;
          qualitaet?: string | null;
          status?: string;
          stueckzahl?: string | null;
          telefon?: string | null;
          textil_art?: string | null;
          vorname?: string | null;
        };
        Relationships: [];
      };
      checkout_carts: {
        Row: {
          created_at: string;
          customer: NonNullable<Json>;
          items: NonNullable<Json>;
          payment_intent_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          customer: NonNullable<Json>;
          items: NonNullable<Json>;
          payment_intent_id: string;
        };
        Update: {
          created_at?: string;
          customer?: NonNullable<Json>;
          items?: NonNullable<Json>;
          payment_intent_id?: string;
        };
        Relationships: [];
      };
      colors: {
        Row: {
          created_at: string;
          hex: string;
          id: string;
          name: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          hex: string;
          id?: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          hex?: string;
          id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          created_at: string;
          email: string;
          handled: boolean;
          id: string;
          message: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          handled?: boolean;
          id?: string;
          message: string;
          name: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          handled?: boolean;
          id?: string;
          message?: string;
          name?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          kind: string;
          max_uses: number | null;
          min_order: number;
          used_count: number;
          valid_from: string | null;
          valid_until: string | null;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          kind: string;
          max_uses?: number | null;
          min_order?: number;
          used_count?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          value: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          max_uses?: number | null;
          min_order?: number;
          used_count?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          invoice_number: string;
          issued_at: string;
          order_id: string;
        };
        ComputedFields: never;
        Insert: {
          invoice_number: string;
          issued_at?: string;
          order_id: string;
        };
        Update: {
          invoice_number?: string;
          issued_at?: string;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_subscribers: {
        Row: {
          confirm_token: string;
          confirmation_sent_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          email: string;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          confirm_token?: string;
          confirmation_sent_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          email: string;
          id?: string;
        };
        Update: {
          confirm_token?: string;
          confirmation_sent_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          design_data: Json | null;
          design_render_paths: string[] | null;
          id: string;
          order_id: string;
          product_id: string | null;
          qty: number;
          size_id: string | null;
          unit_price: number;
          variant_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          design_data?: Json | null;
          design_render_paths?: string[] | null;
          id?: string;
          order_id: string;
          product_id?: string | null;
          qty: number;
          size_id?: string | null;
          unit_price: number;
          variant_id?: string | null;
        };
        Update: {
          design_data?: Json | null;
          design_render_paths?: string[] | null;
          id?: string;
          order_id?: string;
          product_id?: string | null;
          qty?: number;
          size_id?: string | null;
          unit_price?: number;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_size_id_fkey";
            columns: ["size_id"];
            isOneToOne: false;
            referencedRelation: "sizes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          coupon_code: string | null;
          created_at: string;
          customer_address: Json | null;
          customer_email: string | null;
          customer_name: string | null;
          discount_amount: number;
          email_sent: boolean;
          id: string;
          shipped_at: string | null;
          shipping_amount: number | null;
          status: string;
          stripe_payment_intent_id: string | null;
          total: number | null;
          tracking_number: string | null;
          volume_discount_amount: number;
        };
        ComputedFields: never;
        Insert: {
          coupon_code?: string | null;
          created_at?: string;
          customer_address?: Json | null;
          customer_email?: string | null;
          customer_name?: string | null;
          discount_amount?: number;
          email_sent?: boolean;
          id?: string;
          shipped_at?: string | null;
          shipping_amount?: number | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          total?: number | null;
          tracking_number?: string | null;
          volume_discount_amount?: number;
        };
        Update: {
          coupon_code?: string | null;
          created_at?: string;
          customer_address?: Json | null;
          customer_email?: string | null;
          customer_name?: string | null;
          discount_amount?: number;
          email_sent?: boolean;
          id?: string;
          shipped_at?: string | null;
          shipping_amount?: number | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          total?: number | null;
          tracking_number?: string | null;
          volume_discount_amount?: number;
        };
        Relationships: [];
      };
      print_zones: {
        Row: {
          height: number;
          id: string;
          label: string | null;
          product_id: string;
          sort_order: number;
          view: string;
          width: number;
          x: number;
          y: number;
        };
        ComputedFields: never;
        Insert: {
          height: number;
          id?: string;
          label?: string | null;
          product_id: string;
          sort_order?: number;
          view: string;
          width: number;
          x: number;
          y: number;
        };
        Update: {
          height?: number;
          id?: string;
          label?: string | null;
          product_id?: string;
          sort_order?: number;
          view?: string;
          width?: number;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "print_zones_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_sizes: {
        Row: {
          product_id: string;
          size_id: string;
        };
        ComputedFields: never;
        Insert: {
          product_id: string;
          size_id: string;
        };
        Update: {
          product_id?: string;
          size_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_sizes_size_id_fkey";
            columns: ["size_id"];
            isOneToOne: false;
            referencedRelation: "sizes";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          base_price: number;
          category: string | null;
          created_at: string;
          description: string | null;
          design_element_price: number;
          excluded_from_volume_discount: boolean;
          id: string;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          base_price?: number;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          design_element_price?: number;
          excluded_from_volume_discount?: boolean;
          id?: string;
          name: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          base_price?: number;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          design_element_price?: number;
          excluded_from_volume_discount?: boolean;
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          approved: boolean;
          created_at: string;
          id: string;
          name: string;
          product_id: string;
          rating: number;
          text: string;
        };
        ComputedFields: never;
        Insert: {
          approved?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          product_id: string;
          rating: number;
          text: string;
        };
        Update: {
          approved?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          product_id?: string;
          rating?: number;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          design_element_price: number;
          free_shipping_threshold: number;
          id: number;
          order_email: string | null;
          shipping_flat: number;
          updated_at: string;
          vat_rate: number;
        };
        ComputedFields: never;
        Insert: {
          design_element_price?: number;
          free_shipping_threshold?: number;
          id?: number;
          order_email?: string | null;
          shipping_flat?: number;
          updated_at?: string;
          vat_rate?: number;
        };
        Update: {
          design_element_price?: number;
          free_shipping_threshold?: number;
          id?: number;
          order_email?: string | null;
          shipping_flat?: number;
          updated_at?: string;
          vat_rate?: number;
        };
        Relationships: [];
      };
      sizes: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      variant_images: {
        Row: {
          id: string;
          sort_order: number;
          storage_path: string;
          variant_id: string;
          view: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          sort_order?: number;
          storage_path: string;
          variant_id: string;
          view: string;
        };
        Update: {
          id?: string;
          sort_order?: number;
          storage_path?: string;
          variant_id?: string;
          view?: string;
        };
        Relationships: [
          {
            foreignKeyName: "variant_images_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "variants";
            referencedColumns: ["id"];
          },
        ];
      };
      variant_size_availability: {
        Row: {
          available: boolean;
          size_id: string;
          stock: number;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          available?: boolean;
          size_id: string;
          stock?: number;
          variant_id: string;
        };
        Update: {
          available?: boolean;
          size_id?: string;
          stock?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "variant_size_availability_size_id_fkey";
            columns: ["size_id"];
            isOneToOne: false;
            referencedRelation: "sizes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "variant_size_availability_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "variants";
            referencedColumns: ["id"];
          },
        ];
      };
      variants: {
        Row: {
          color_id: string;
          created_at: string;
          hex: string | null;
          id: string;
          product_id: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          color_id: string;
          created_at?: string;
          hex?: string | null;
          id?: string;
          product_id: string;
          sort_order?: number;
        };
        Update: {
          color_id?: string;
          created_at?: string;
          hex?: string | null;
          id?: string;
          product_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "variants_color_id_fkey";
            columns: ["color_id"];
            isOneToOne: false;
            referencedRelation: "colors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      volume_discounts: {
        Row: {
          discount_percent: number;
          id: string;
          min_qty: number;
        };
        ComputedFields: never;
        Insert: {
          discount_percent: number;
          id?: string;
          min_qty: number;
        };
        Update: {
          discount_percent?: number;
          id?: string;
          min_qty?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      issue_invoice: {
        Args: { p_order_id: string };
        Returns: {
          invoice_number: string;
          issued_at: string;
          order_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "invoices";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_order_refunded: { Args: { p_order_id: string }; Returns: boolean };
      place_order: {
        Args: { p_coupon_id: string; p_items: Json; p_order: Json };
        Returns: Json;
      };
      shop_config: { Args: Record<PropertyKey, never>; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
