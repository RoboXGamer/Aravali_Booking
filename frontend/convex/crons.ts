import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("expire seat holds and close polls", { minutes: 1 }, internal.maintenance.runMinuteTasks, {});
crons.interval("recover Razorpay payments and refunds", { minutes: 1 }, internal.paymentState.recovery, {});

export default crons;
