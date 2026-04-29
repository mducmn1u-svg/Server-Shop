import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import admin from "firebase-admin";

const app = express();

app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Firebase Admin
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ error: "Not admin" });
    }

    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, name: "Xyz Prime API" });
});

// Admin login bằng pass server
app.post("/api/admin/login", async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Missing password" });
  }

  const ok = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);

  if (!ok) {
    return res.status(401).json({ error: "Wrong password" });
  }

  const token = jwt.sign(
    {
      role: "admin",
      type: "server-admin"
    },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({ token });
});

// Check token
app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({
    ok: true,
    admin: req.admin
  });
});

// Add product
app.post("/api/admin/products", requireAdmin, async (req, res) => {
  const {
    name,
    price,
    description,
    shortDescription,
    imageUrl,
    categoryId,
    stockCount = 0,
    active = true,
    featured = false
  } = req.body;

  if (!name || typeof price !== "number") {
    return res.status(400).json({ error: "Invalid product" });
  }

  const ref = await db.collection("products").add({
    name,
    slug: name.toLowerCase().trim().replace(/\s+/g, "-"),
    price,
    description: description || "",
    shortDescription: shortDescription || "",
    imageUrl: imageUrl || "",
    categoryId: categoryId || "",
    stockCount,
    soldCount: 0,
    active,
    featured,
    deleted: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  res.json({ ok: true, id: ref.id });
});

// Update product
app.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;

  await db.collection("products").doc(id).update({
    ...req.body,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  res.json({ ok: true });
});

// Soft delete product
app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;

  await db.collection("products").doc(id).update({
    active: false,
    deleted: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  res.json({ ok: true });
});

// Approve deposit
app.post("/api/admin/deposits/:id/approve", requireAdmin, async (req, res) => {
  const depositId = req.params.id;

  await db.runTransaction(async (tx) => {
    const depRef = db.collection("depositRequests").doc(depositId);
    const depSnap = await tx.get(depRef);

    if (!depSnap.exists) throw new Error("Deposit not found");

    const dep = depSnap.data();

    if (dep.status !== "pending") {
      throw new Error("Deposit already processed");
    }

    const userRef = db.collection("users").doc(dep.userId);
    const userSnap = await tx.get(userRef);
    const user = userSnap.data();

    const before = user.balance || 0;
    const after = before + dep.amount;

    tx.update(userRef, {
      balance: after,
      totalDeposited: admin.firestore.FieldValue.increment(dep.amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    tx.update(depRef, {
      status: "success",
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    tx.set(db.collection("transactions").doc(), {
      userId: dep.userId,
      type: "deposit",
      amount: dep.amount,
      balanceBefore: before,
      balanceAfter: after,
      status: "success",
      refId: depositId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  res.json({ ok: true });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Xyz Prime API running on port ${port}`);
});
