import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Stripe from "stripe";
dotenv.config();

const port = process.env.PORT || 3030;
const app = express();

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://scholarstream-b12a11-nahiyan.netlify.app",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden" });
    req.decoded = decoded;
    next();
  });
};

const stripe = new Stripe(process.env.STRIPE_SK);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_ACCESS}@cluster0.bfqzn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    // Connections
    const database = client.db(process.env.DB_NAME);
    const usersCollection = database.collection("users");
    const scholarshipsCollection = database.collection("scholarships");
    const appsCollection = database.collection("applications");
    const reviewsCollection = database.collection("reviews");
    const paymentsCollection = database.collection("payments");

    // jwt
    // CREATE JWT
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "None",
          maxAge: 60 * 60 * 1000,
        })
        .send({ success: true });
    });
    // Delete JWT
    app.post("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // payment
    app.post("/create-payment-intent", async (req, res) => {
      const { amount, scholarshipId } = req.body;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // convert to cents
        currency: "usd",
        metadata: { scholarshipId },
      });

      res.send({ clientSecret: paymentIntent.client_secret });
    });
    // Save Payment Info
    app.post("/payments", async (req, res) => {
      try {
        const { scholarshipId, amount, transactionId, email } = req.body;

        if (!scholarshipId || !amount || !transactionId || !email) {
          return res.status(400).send({ message: "Missing payment fields" });
        }

        const paymentData = {
          scholarshipId,
          amount,
          transactionId,
          email,
          paidAt: new Date(),
          status: "completed",
        };

        const result = await paymentsCollection.insertOne(paymentData);

        res.send({
          success: true,
          message: "Payment saved successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error while saving payment" });
      }
    });

    // GET All Users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // GET Single User by Email
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });
    // CREATE New User
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const exists = await usersCollection.findOne({ email: newUser.email });

      if (exists) {
        return res.status(409).send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });
    // Update user role
    app.put("/users/:userId/role", async (req, res) => {
      try {
        const { userId } = req.params;
        const { role } = req.body;

        // Validate role
        const validRoles = ["Student", "Moderator"];
        if (!validRoles.includes(role)) {
          return res.status(400).send({ message: "Invalid role value" });
        }

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ success: true, message: "Role updated successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });
    // Assign moderator
    app.put("/users/assign/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const { moderatorFor } = req.body;

        const result = await usersCollection.updateOne(
          { email },
          { $set: { moderatorFor } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ success: true, message: "Moderator assigned successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });
    // DELETE user
    app.delete("/users/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid user ID" });
        }

        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ success: true, deleted: result.deletedCount });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error deleting user" });
      }
    });

    // GET all scholarships
    app.get("/scholarships", async (req, res) => {
      const { search, category } = req.query;

      let query = {};

      // search filter (name, university)
      if (search) {
        query.$or = [
          { scholarshipName: { $regex: search, $options: "i" } },
          { universityName: { $regex: search, $options: "i" } },
          { universityCountry: { $regex: search, $options: "i" } },
        ];
      }

      // category filter
      if (category) {
        query.scholarshipCategory = category;
      }

      const result = await scholarshipsCollection.find(query).toArray();
      res.send(result);
    });
    // GET home scholarships
    app.get("/home/scholarships", async (req, res) => {
      const result = await scholarshipsCollection.find({}).limit(6).toArray();
      res.send(result);
    });
    // GET admin scholarships
    app.get("/scholarships/:admin", verifyToken, async (req, res) => {
      const adminEmail = req.params.admin;

      const result = await scholarshipsCollection
        .find({ postedUserEmail: adminEmail })
        .toArray();
      res.send(result);
    });
    // POST scholarships
    app.post("/scholarships", async (req, res) => {
      const data = req.body;
      const result = await scholarshipsCollection.insertOne(data);
      res.send(result);
    });
    // DELETE scholarships
    app.delete("/scholarships/delete/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        // Optional: verify that the user deleting this scholarship is the owner/admin
        const scholarship = await scholarshipsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!scholarship)
          return res.status(404).send({ message: "Scholarship not found" });

        const result = await scholarshipsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount > 0) {
          res.send({ success: true, deletedCount: result.deletedCount });
        } else {
          res.status(400).send({ success: false, message: "Delete failed" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // GET admin scholarship data
    app.get("/scholarship/data/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await scholarshipsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({ message: "No scholarship found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });
    // UPDATE admin scholarship data
    app.put("/scholarship/update/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const data = req.body;

        const result = await scholarshipsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: data }
        );

        if (result.modifiedCount === 0) {
          return res.status(400).send({ message: "No changes made" });
        }

        res.send({ success: true, message: "Updated successfully" });
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });

    // GET reviews filtered by scholarshipId
    app.get("/reviews", async (req, res) => {
      try {
        const scholarshipId = req.query.scholarshipId;

        let query = {};

        if (scholarshipId) {
          query.scholarshipId = scholarshipId;
        }

        const result = await reviewsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // CREATE Application
    app.post("/applications", async (req, res) => {
      try {
        const {
          scholar,
          scholarshipId,
          scholarshipName,
          universityName,
          fees,
          applicant,
          appliedDate,
          status,
          payment,
        } = req.body;

        // Validation
        if (
          !scholar ||
          !scholarshipId ||
          !scholarshipName ||
          !universityName ||
          !fees ||
          !applicant
        ) {
          return res.status(400).send({ message: "Missing fields" });
        }

        const newApplication = {
          scholar,
          scholarshipId,
          scholarshipName,
          universityName,
          fees,
          applicant,
          appliedDate: appliedDate || new Date(),
          status: status || "pending",
          payment: payment,
        };

        const result = await appsCollection.insertOne(newApplication);

        res.send({
          success: true,
          message: "Application submitted successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ message: "Server error while saving application" });
      }
    });
    // GET: user's all applications
    app.get("/applications/user", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ message: "Email query required" });
        }

        const result = await appsCollection
          .find({ applicant: email })
          .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error loading applications" });
      }
    });
    app.delete("/applications/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const appDoc = await appsCollection.findOne({ _id: new ObjectId(id) });

        if (!appDoc)
          return res.status(404).send({ message: "Application not found" });

        if (appDoc.applicationStatus !== "pending") {
          return res
            .status(403)
            .send({ message: "Only pending applications can be deleted" });
        }

        const result = await appsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({ success: true, deleted: result.deletedCount });
      } catch (error) {
        res.status(500).send({ message: "Server error deleting application" });
      }
    });

    // GET: statistics
    app.get("/home/stats", async (req, res) => {
      try {
        const usersCount = await usersCollection.countDocuments();
        const appsCount = await appsCollection.countDocuments();
        const scholarshipsCount = await scholarshipsCollection.countDocuments();

        res.send({
          users: usersCount,
          applications: appsCount,
          scholarships: scholarshipsCount,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({
          users: 0,
          applications: 0,
          scholarships: 0,
        });
      }
    });

    // GET all applications (Moderator)
    app.get("/applications/:email", async (req, res) => {
      const { email } = req.params;
      try {
        const apps = await appsCollection
          .find({ "scholar.postedUserEmail": email })
          .toArray(); // optionally filter by moderator's assigned universities
        res.send(apps);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error fetching applications" });
      }
    });

    // UPDATE application status
    app.put("/applications/:id/status", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = [
          "pending",
          "processing",
          "completed",
          "rejected",
        ];
        if (!validStatuses.includes(status)) {
          return res.status(400).send({ message: "Invalid status value" });
        }

        const result = await appsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Application not found" });
        }

        res.send({ success: true, message: "Status updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error updating status" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("ScholarStream server");
});

app.listen(port, () => {
  console.log(`ScholarStream server listening on port ${port}`);
});
