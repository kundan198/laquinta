const serverless = require('serverless-http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ─── MONGOOSE SCHEMAS (Copied from server.js) ─────────────
const cashSchema = new mongoose.Schema({
  date: String, mon: String, note: String, type: String, amt: Number, hand: Number, fwd: Number
}, { timestamps: true });

const serviceSchema = new mongoose.Schema({
  name: String, cat: String, mon: String, amt: Number, notes: String
}, { timestamps: true });

const customSupplySchema = new mongoose.Schema({ name: { type: String, unique: true } });

const supplyOrderSchema = new mongoose.Schema({
  mon: { type: String, unique: true }, orders: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const CashEntry = mongoose.models.CashEntry || mongoose.model('CashEntry', cashSchema);
const ServiceEntry = mongoose.models.ServiceEntry || mongoose.model('ServiceEntry', serviceSchema);
const CustomSupply = mongoose.models.CustomSupply || mongoose.model('CustomSupply', customSupplySchema);
const SupplyOrder = mongoose.models.SupplyOrder || mongoose.model('SupplyOrder', supplyOrderSchema);

// ─── DATABASE CONNECTION ──────────────────────────────────
let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  await mongoose.connect(process.env.MONGODB_URI);
  cachedDb = mongoose.connection;
  return cachedDb;
}

// ─── MIDDLEWARE TO CONNECT DB ─────────────────────────────
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

// ─── API ROUTES ───────────────────────────────────────────
app.get('/api/all', async (req, res) => {
  try {
    const [cash, svcs, customSupDocs, supOrderDocs] = await Promise.all([
      CashEntry.find().sort({ createdAt: -1 }),
      ServiceEntry.find().sort({ createdAt: -1 }),
      CustomSupply.find(),
      SupplyOrder.find()
    ]);
    const customSup = customSupDocs.map(d => d.name);
    const supOrders = {};
    supOrderDocs.forEach(d => { supOrders[d.mon] = d.orders; });
    res.json({ cash, svcs, customSup, supOrders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/cash', async (req, res) => {
  try { const entry = await CashEntry.create(req.body); res.json(entry); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/cash/:id', async (req, res) => {
  try { await CashEntry.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/svcs', async (req, res) => {
  try { const entry = await ServiceEntry.create(req.body); res.json(entry); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/svcs/:id', async (req, res) => {
  try { await ServiceEntry.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/custom-supplies', async (req, res) => {
  try {
    const { name } = req.body;
    const entry = await CustomSupply.findOneAndUpdate({ name }, { name }, { upsert: true, new: true });
    res.json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/supply-orders', async (req, res) => {
  try {
    const { mon, orders } = req.body;
    const entry = await SupplyOrder.findOneAndUpdate({ mon }, { orders }, { upsert: true, new: true });
    res.json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports.handler = serverless(app);
