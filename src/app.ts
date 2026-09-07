import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AnalyticsRoute } from "./app/module/analytics/analytics.route";
import { AssignmentRoutes } from "./app/module/assignment/assignment.route";
import { AuthRoute } from "./app/module/auth/auth.route";
import { BidRoutes } from "./app/module/bid/bid.route";
import { EscrowRoute } from "./app/module/escrow/escrow.route";
import { ExpertRoute } from "./app/module/expert/expert.route";
import { PaymentRoute } from "./app/module/payment/payment.route";
import { ReviewRoute } from "./app/module/review/review.route";
import { StudentRoute } from "./app/module/student/student.route";

const app: Application = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/v1/auth", AuthRoute);
app.use("/api/v1/expert", ExpertRoute);
app.use("/api/v1/assignment", AssignmentRoutes);
app.use("/api/v1/bid", BidRoutes);
app.use("/api/v1/payment", PaymentRoute);
app.use("/api/v1/escrow", EscrowRoute);
app.use("/api/v1/review", ReviewRoute);
app.use("/api/v1/student", StudentRoute);
app.use("/api/v1/analytics", AnalyticsRoute);

// Health Check
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Hello Assignment Bridge V1.0!" });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
