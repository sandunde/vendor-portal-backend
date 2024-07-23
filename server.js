import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const port = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("MongoDB connected..."))
    .catch((err) => console.log(err));

const itemSchema = new mongoose.Schema({
    sku: String,
    name: String,
    qty: Number,
    description: String,
    price: Number,
    images: [String],
    starred: { type: Boolean, default: false },
});

const Item = mongoose.model("Item", itemSchema);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

app.get("/items", async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get("/items/:id", async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }
        res.json(item);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post("/items", upload.array("images", 5), async (req, res) => {
    const { sku, name, qty, description, price, starred } = req.body;
    const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    
    const item = new Item({
        sku,
        name,
        qty,
        description,
        price,
        images,
        starred: starred || false,
    });

    try {
        const newItem = await item.save();
        res.status(201).json(newItem);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.put("/update-items/:id", upload.array("images", 5), async (req, res) => {
    const { id } = req.params;
    const { sku, name, qty, description, price, existingImages, starred } = req.body;

    const updateData = {
        sku,
        name,
        qty,
        description,
        price,
        starred: starred || false,
    };

    if (req.files && req.files.length > 0) {
        updateData.images = req.files.map(file => `/uploads/${file.filename}`);
    } else if (existingImages) {
        updateData.images = JSON.parse(existingImages);
    }

    try {
        const updatedItem = await Item.findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedItem) {
            return res.status(404).json({ message: "Item not found" });
        }
        res.json(updatedItem);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.delete("/delete-items/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const item = await Item.findByIdAndDelete(id);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }
        if (item.images && item.images.length > 0) {
            item.images.forEach(imagePath => {
                const fullImagePath = path.join(__dirname, imagePath);
                fs.unlink(fullImagePath, (err) => {
                    if (err) {
                        console.error("Error deleting image file", err);
                    }
                });
            });
        }
        res.json({ message: "Item deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});
