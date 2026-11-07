import passport from "passport";
import { Strategy as GitHubStrategy, type Profile } from "passport-github2";
import { env, githubEnabled } from "./env.js";
import { upsertGithubUser } from "../services/auth.service.js";

/** Registers the GitHub strategy when credentials are configured. Sessions are JWT-based, not passport sessions. */
export function configurePassport() {
  if (!githubEnabled) return;
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackURL: `${env.API_ORIGIN}/api/v1/auth/github/callback`,
        scope: ["user:email"],
      },
      (_access: string, _refresh: string, profile: Profile, done: (err: unknown, user?: unknown) => void) => {
        upsertGithubUser({
          id: profile.id,
          email: profile.emails?.[0]?.value ?? null,
          displayName: profile.displayName ?? null,
          username: profile.username ?? null,
          avatarUrl: profile.photos?.[0]?.value ?? null,
        })
          .then((user) => done(null, user))
          .catch((err) => done(err));
      },
    ),
  );
}
