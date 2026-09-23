ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO public USING ((auth.uid() = id));

CREATE POLICY "Loops are viewable by everyone" ON public.loops FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own loops" ON public.loops FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own loops" ON public.loops FOR DELETE TO public USING ((auth.uid() = user_id));

CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own follows" ON public.follows FOR INSERT TO public WITH CHECK ((auth.uid() = follower_id));
CREATE POLICY "Users can delete their own follows" ON public.follows FOR DELETE TO public USING ((auth.uid() = follower_id));

CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own likes" ON public.likes FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own likes" ON public.likes FOR DELETE TO public USING ((auth.uid() = user_id));

CREATE POLICY "Messages are viewable by sender or receiver" ON public.messages FOR SELECT TO public USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));
CREATE POLICY "Users can insert messages they send" ON public.messages FOR INSERT TO public WITH CHECK ((auth.uid() = sender_id));
CREATE POLICY "Users can update messages they receive" ON public.messages FOR UPDATE TO public USING ((auth.uid() = receiver_id));
CREATE POLICY "Users can delete their own messages" ON public.messages FOR DELETE TO public USING ((auth.uid() = sender_id));

CREATE POLICY "Users can view their own key backup" ON public.key_backups FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own key backup" ON public.key_backups FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own key backup" ON public.key_backups FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own key backup" ON public.key_backups FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can manage their own key backup" ON public.key_backups FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own comments" ON public.comments FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own comments" ON public.comments FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE TO public USING ((auth.uid() = user_id));

CREATE POLICY "Comment likes are visible to everyone" ON public.comment_likes FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own comment likes" ON public.comment_likes FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own comment likes" ON public.comment_likes FOR DELETE TO public USING ((auth.uid() = user_id));

CREATE POLICY "Bookmarks are private to the user" ON public.bookmarks FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own bookmarks" ON public.bookmarks FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own bookmarks" ON public.bookmarks FOR DELETE TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO public USING ((auth.uid() = recipient_id));
CREATE POLICY "Users can insert notifications where they are the actor" ON public.notifications FOR INSERT TO public WITH CHECK ((auth.uid() = actor_id));
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO public USING ((auth.uid() = recipient_id));
CREATE POLICY "Users can delete their notifications" ON public.notifications FOR DELETE TO public USING (((auth.uid() = recipient_id) OR (auth.uid() = actor_id)));