-- Allow users to delete their own profile (GDPR Article 17, App Store requirement).
CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE
  USING (auth.uid() = id);
