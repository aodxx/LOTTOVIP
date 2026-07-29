const { createClient } = window.supabase;
const config = window.LOTTOVIP_CONFIG;
window.lottovipSupabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

window.LOTTOVIP_AUTH = {
  async signIn(email, password) {
    return window.lottovipSupabase.auth.signInWithPassword({ email, password });
  },
  async signUp(email, password, displayName) {
    return window.lottovipSupabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: config.siteUrl,
        data: { display_name: displayName || email.split("@")[0] }
      }
    });
  },
  async signOut() {
    return window.lottovipSupabase.auth.signOut();
  },
  async getSession() {
    return window.lottovipSupabase.auth.getSession();
  }
};

