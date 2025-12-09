import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 3030;
const app = express();

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
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
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Connections
    const database = client.db(process.env.DB_NAME);
    const usersCollection = database.collection("users");
    const scholarshipsCollection = database.collection("scholarships");
    const appsCollection = database.collection("applications");
    const reviewsCollection = database.collection("reviews");

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

    // GET all scholarships
    app.get("/scholarships", async (req, res) => {
      const result = await scholarshipsCollection.find().toArray();
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
