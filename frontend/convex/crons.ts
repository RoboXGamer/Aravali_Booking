import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("expire seat holds and close polls", { minutes: 1 }, internal.maintenance.runMinuteTasks, {});

export default crons;
