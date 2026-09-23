import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { findOrCreateGoogleUser } from "../services/authService.js";

export const googleAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

if (googleAuthConfigured) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL ?? "https://api.blinkcare.website/api/auth/google/callback",
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error("Google account did not provide an email"));
      const user = await findOrCreateGoogleUser({
        providerUserId: profile.id,
        email,
        displayName: profile.displayName,
      });
      return done(null, user);
    } catch (error) {
      return done(error as Error);
    }
  }));
}

export default passport;
