require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── MONGOOSE SCHEMAS ─────────────────────────────────────

const cashSchema = new mongoose.Schema({
  date: String,
  mon: String,
  note: String,
  type: String, // IN, OUT, BANK
  amt: Number,
  hand: Number,
  fwd: Number
}, { timestamps: true });

const serviceSchema = new mongoose.Schema({
  name: String,
  cat: String,
  mon: String,
  amt: Number,
  notes: String
}, { timestamps: true });

const customSupplySchema = new mongoose.Schema({
  name: { type: String, unique: true }
});

const supplyOrderSchema = new mongoose.Schema({
  mon: { type: String, unique: true },
  orders: mongoose.Schema.Types.Mixed // stores { itemName: { chk, qty } }
}, { timestamps: true });

const supplyLogSchema = new mongoose.Schema({
  item: String,
  qty: String,
  mon: String,
  date: String
}, { timestamps: true });

const CashEntry = mongoose.model('CashEntry', cashSchema);
const ServiceEntry = mongoose.model('ServiceEntry', serviceSchema);
const CustomSupply = mongoose.model('CustomSupply', customSupplySchema);
const SupplyOrder = mongoose.model('SupplyOrder', supplyOrderSchema);
const SupplyLog = mongoose.model('SupplyLog', supplyLogSchema);

// ─── API ROUTES ───────────────────────────────────────────

// Get all data at once (for frontend hydration)
app.get('/api/all', async (req, res) => {
  try {
    const [cash, svcs, customSupDocs, supOrderDocs, supplyLogs] = await Promise.all([
      CashEntry.find().sort({ createdAt: -1 }),
      ServiceEntry.find().sort({ createdAt: -1 }),
      CustomSupply.find(),
      SupplyOrder.find(),
      SupplyLog.find().sort({ createdAt: -1 })
    ]);

    const customSup = customSupDocs.map(d => d.name);
    const supOrders = {};
    supOrderDocs.forEach(d => {
      supOrders[d.mon] = d.orders;
    });

    res.json({ cash, svcs, customSup, supOrders, supplyLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cash Entries
app.post('/api/cash', async (req, res) => {
  try {
    const entry = await CashEntry.create(req.body);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cash/:id', async (req, res) => {
  try {
    await CashEntry.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Services
app.post('/api/svcs', async (req, res) => {
  try {
    const entry = await ServiceEntry.create(req.body);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/svcs/:id', async (req, res) => {
  try {
    await ServiceEntry.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Custom Supplies
app.post('/api/custom-supplies', async (req, res) => {
  try {
    const { name } = req.body;
    const entry = await CustomSupply.findOneAndUpdate(
      { name }, 
      { name }, 
      { upsert: true, new: true }
    );
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supply Orders (Planner)
app.post('/api/supply-orders', async (req, res) => {
  try {
    const { mon, orders } = req.body;
    const entry = await SupplyOrder.findOneAndUpdate(
      { mon },
      { orders },
      { upsert: true, new: true }
    );
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supply Logs (History)
app.post('/api/supply-log/bulk', async (req, res) => {
  try {
    const logs = await SupplyLog.insertMany(req.body); // Expects array of logs
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/supply-log/:id', async (req, res) => {
  try {
    await SupplyLog.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── START SERVER ─────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
  });
