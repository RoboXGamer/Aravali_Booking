import { internalMutation } from "./_generated/server";

const movies = [
  {
    title: "Max, Min and Meowzaki",
    description:
      "Max and Min are about to break up. They argue endlessly over dividing their possessions, including their cat, Meowzaki, named after their favorite artist, Hayao Miyazaki. Max's father, Ramesh, who lost his wife and has since been struggling with insomnia, meets the charming therapist Dhaara. Meanwhile, Max's grandfather, Sridhar, secretly enjoys drinking with his new friend Jennifer at the nursing home.",
    durationMinutes: 138,
  },
  {
    title: "Uttar Da Puttar",
    description:
      'A physics professor obsessed with Vastu and astrology believes every problem has a planetary solution. As he relentlessly pursues the perfect home and the "ideal" life, unexpected twists force him to question whether destiny is shaped by the stars or the choices we make.',
    durationMinutes: 103,
  },
  {
    title: "The India Story",
    description:
      "The India Story dives deep into the high-stakes world of pesticide company scandals. It offers a compelling, dramatic look at the controversial issues and powerful interests involved in corporate malfeasance that affects the nation.",
    durationMinutes: 140,
  },
  {
    title: "Carry On Jatta 4",
    description:
      "Amid laughter, emotions, and unexpected twists, the Dhillon family embarks on a journey that strengthens their bonds and heals old wounds. Serving as a heartfelt tribute to the legendary Jaswinder Bhalla, the film celebrates family, love, and the values that keep generations connected.",
    durationMinutes: 142,
  },
  {
    title: "Baby Do Die Do",
    description:
      "Baby Do Die Do is a crime comedy thriller that follows the enigmatic Baby KarMarKar, India's first desi hitwoman. Set against the backdrop of Mumbai's underbelly, the film blends crime, mystery, action, and dark humour, offering an unpredictable cinematic experience.",
    durationMinutes: 125,
  },
  {
    title: "Moana",
    description:
      "Moana, a village chieftain's daughter, goes on a mission to return the heart of the island goddess, Te Fiti, but she must first seek the help of Maui, a demigod who is missing.",
    durationMinutes: 107,
  },
  {
    title: "Toy Story 5",
    description:
      "In Toy Story 5, the toys face a new kind of challenge as children's attention shifts from traditional playthings to modern technology. When Buzz, Woody, Jessie, and the gang find themselves competing with smart devices and digital distractions, they must confront what it truly means to be a toy in a rapidly changing world.",
    durationMinutes: 102,
  },
] as const;

function normalizeTitle(title: string) {
  return title.trim().toLocaleLowerCase();
}

export const seedMovies = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingMovies = await ctx.db.query("movies").collect();
    const moviesByTitle = new Map(
      existingMovies.map((movie) => [normalizeTitle(movie.title), movie]),
    );
    let inserted = 0;
    let updated = 0;

    for (const movie of movies) {
      const values = {
        ...movie,
        certificate: "U" as const,
        language: "Not specified",
      };
      const existing = moviesByTitle.get(normalizeTitle(movie.title));
      if (existing) {
        await ctx.db.patch("movies", existing._id, values);
        updated += 1;
      } else {
        await ctx.db.insert("movies", values);
        inserted += 1;
      }
    }

    return { inserted, updated, total: movies.length };
  },
});
