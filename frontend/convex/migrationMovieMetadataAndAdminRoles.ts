import { internalMutation } from "./_generated/server";

export const applyMovieMetadataAndAdminRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const movies = await ctx.db.query("movies").collect();
    let moviesUpdated = 0;
    for (const movie of movies) {
      if (movie.certificate && movie.language) continue;
      await ctx.db.patch("movies", movie._id, {
        certificate: movie.certificate ?? "U",
        language: movie.language ?? "Not specified",
      });
      moviesUpdated += 1;
    }

    const admins = await ctx.db.query("adminUsers").collect();
    let adminsUpdated = 0;
    for (const admin of admins) {
      if (admin.role) continue;
      await ctx.db.patch("adminUsers", admin._id, { role: "super_admin" });
      adminsUpdated += 1;
    }

    return { moviesUpdated, adminsUpdated };
  },
});
