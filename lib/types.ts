export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  tech_stack: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Loop {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Like {
  user_id: string;
  loop_id: string;
  created_at: string;
}

export interface Bookmark {
  user_id: string;
  loop_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: "like" | "comment" | "follow" | "comment_like" | "mention";
  loop_id: string | null;
  comment_id: string | null;
  message_id?: string | null;
  is_read: boolean;
  created_at: string;
  actor?: Profile;
}

export interface CommentLike {
  user_id: string;
  comment_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  loop_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;

  content: string | null;

  image_url: string | null;
  is_read: boolean;
  created_at: string;
  recipient_encrypted?: string | null;
  recipient_nonce?: string | null;
  sender_encrypted?: string | null;
  sender_nonce?: string | null;
  sender_public_key?: string | null;
}

export interface LoopWithDetails extends Loop {
  profiles: Profile;
  likes: { user_id: string }[];
  bookmarks: { user_id: string }[];
  comments: { id: string }[];
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      };
      loops: {
        Row: Loop;
        Insert: Partial<Loop>;
        Update: Partial<Loop>;
      };
      follows: {
        Row: Follow;
        Insert: Follow;
        Update: Follow;
      };
      likes: {
        Row: Like;
        Insert: Like;
        Update: Like;
      };
      comment_likes: {
        Row: CommentLike;
        Insert: CommentLike;
        Update: CommentLike;
      };
      bookmarks: {
        Row: Bookmark;
        Insert: Bookmark;
        Update: Bookmark;
      };
      comments: {
        Row: Comment;
        Insert: Partial<Comment>;
        Update: Partial<Comment>;
      };
      messages: {
        Row: Message;
        Insert: Partial<Message>;
        Update: Partial<Message>;
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification>;
        Update: Partial<Notification>;
      };
    };
  };
}
