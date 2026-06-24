export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      entries: {
        Row: {
          created_at: string;
          end_at: string | null;
          id: string;
          location: string;
          note: string;
          start_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          end_at?: string | null;
          id?: string;
          location?: string;
          note?: string;
          start_at: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          end_at?: string | null;
          id?: string;
          location?: string;
          note?: string;
          start_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database["public"];

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"];
