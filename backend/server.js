const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server/health checks and local development.
    if (!origin || allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin is not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "5mb" }));

app.use((req, res, next) => {
  const started = Date.now();
  console.log(`\n[REQUEST] ${req.method} ${req.originalUrl}`);
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const safe = { ...(req.body || {}) };
    delete safe.password; delete safe.confirm;
    console.log("[BODY]", JSON.stringify(safe));
  }
  res.on("finish", () => console.log(`[RESPONSE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now()-started}ms)`));
  next();
});

app.get("/", (req,res) => res.json({ok:true, service:"RiderPro Express Backend"}));
app.get("/api/health", (req,res) => res.json({ok:true, service:"RiderPro Express Backend", port:PORT}));

app.post("/api/orders", (req,res) => {
  const order=req.body||{};
  if(!order.id || !order.name || !Array.isArray(order.items) || !order.items.length){
    console.error("[ORDER] REJECTED: id/name/items missing");
    return res.status(400).json({success:false,message:"Order id, customer name and at least one item are required."});
  }
  console.log("============================================");
  console.log("[ORDER] SUCCESS - ORDER RECEIVED BY EXPRESS");
  console.log("Order ID:",order.id); console.log("Customer:",order.name); console.log("Phone:",order.phone||"-");
  console.log("Address:",order.address||"-"); console.log("Payment:",order.payment||"-");
  console.log("Total:",`PHP ${Number(order.total||0).toFixed(2)}`);
  console.log("Items:",order.items.map(i=>`${i.name} x${i.qty}`).join(", "));
  console.log("============================================");
  return res.status(201).json({success:true,message:"Order received by Express backend.",order});
});



function logAction(action, entity, data = {}) {
  console.log("============================================");
  console.log(`[${entity.toUpperCase()}] ${action}`);
  Object.entries(data).forEach(([key, value]) => console.log(`${key}:`, value));
  console.log("============================================");
}

app.post("/api/products", (req,res)=>{
  const product = req.body || {};
  if (!product.id || !product.name) return res.status(400).json({success:false,message:"Product id and name are required."});
  logAction("ADD SUCCESS", "PRODUCT", {
    "ID": product.id,
    "Name": product.name,
    "Price": Number(product.price || 0),
    "Stock": Number(product.stock || 0)
  });
  res.status(201).json({success:true,data:product});
});

app.put("/api/products/:id", (req,res)=>{
  const product = req.body || {};
  logAction("EDIT/UPDATE SUCCESS", "PRODUCT", {
    "ID": req.params.id,
    "Name": product.name || "-",
    "Price": Number(product.price || 0),
    "Stock": Number(product.stock || 0)
  });
  res.json({success:true,data:{...product,id:product.id ?? Number(req.params.id)}});
});

app.delete("/api/products/:id", (req,res)=>{
  logAction("DELETE SUCCESS", "PRODUCT", {"ID": req.params.id});
  res.json({success:true,message:"Product deleted.",id:req.params.id});
});

app.put("/api/orders/:id", (req,res)=>{
  const order = req.body || {};
  logAction("UPDATE SUCCESS", "ORDER", {
    "ID": req.params.id,
    "Customer": order.name || "-",
    "Status": order.status || "-"
  });
  res.json({success:true,data:{...order,id:order.id ?? req.params.id}});
});

app.delete("/api/orders/:id", (req,res)=>{
  logAction("DELETE SUCCESS", "ORDER", {"ID": req.params.id});
  res.json({success:true,message:"Order deleted.",id:req.params.id});
});

app.post("/api/users",(req,res)=>{const safe={...(req.body||{})};delete safe.password;delete safe.confirm;console.log("[USER] SUCCESS",safe.email||"(no email)");res.status(201).json({success:true,data:safe});});
app.post("/api/auth/login",(req,res)=>{console.log("[LOGIN] SUCCESS",req.body?.email||"(no email)");res.json({success:true});});
app.post("/api/forms",(req,res)=>{console.log("[FORM] SUCCESS",JSON.stringify(req.body||{}));res.status(201).json({success:true,data:req.body});});
app.use((req,res)=>{console.error(`[ROUTE ERROR] ${req.method} ${req.originalUrl} -> 404`);res.status(404).json({success:false,message:`Route not found: ${req.method} ${req.originalUrl}`});});

const server=app.listen(PORT,"0.0.0.0",()=>{console.log("============================================");console.log("RIDERPRO EXPRESS BACKEND READY");console.log(`Backend: listening on port ${PORT}`);console.log(`Health:  listening on port ${PORT}/api/health`);console.log("POST logging: ON");console.log("Waiting for requests...");console.log("============================================");});
server.on("error",err=>{console.error("[EXPRESS STARTUP ERROR]",err.message);if(err.code==="EADDRINUSE")console.error(`Port ${PORT} is already in use. Close the old Node/Express process, then run npm run backend again.`);process.exit(1);});
