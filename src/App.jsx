import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { defaultProducts, categoryIcons, money, read, write } from "./data";
import { firestoreEnabled, getCollection, getDocument, upsertDocument, updateDocument, deleteDocument } from "./firestore.js";
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "./firebase.js";

// Recover the original catalog when an older/corrupted local cache contains only
// some products. Keep admin-created products and all edits from the saved cache.
const getProducts = () => {
    const stored = read("rpProducts", null);
    if (!Array.isArray(stored) || stored.length === 0) return defaultProducts;
    const normalized = stored.map(p => {
        const fresh = defaultProducts.find(d => String(d.id) === String(p.id));
        // Always repair images for built-in products using the configured real product-photo URLs.
        // Keep image URLs for custom/admin-created products that are not in the default catalog.
        return fresh ? { ...fresh, ...p, img: fresh.img } : { ...p, img: p.img || FALLBACK_PARTS_PHOTO };
    });
    // Only auto-repair a severely incomplete cache; don't resurrect products
    // intentionally removed from a mostly complete admin-managed catalog.
    if (normalized.length >= defaultProducts.length - 2) return normalized;
    const existing = new Set(normalized.map(p => String(p.id)));
    return [...defaultProducts.filter(p => !existing.has(String(p.id))), ...normalized];
};
const getUser = () => read("rpUser", null);
const getOrders = () => read("rpOrders", []);
const getCart = () => read("rpCart", []);
const FALLBACK_PARTS_PHOTO = "https://egamotomarket.com/uploads/p/b/motosiklet-yedek-parca-rehberi-orijinal-oem-ve-yan-sanayi-parcalar-arasindaki-farklar_1.png?v=1743089077";
const BACKEND_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

async function backendAction(path, options = {}) {
    try {
        const response = await fetch(`${BACKEND_URL}${path}`, {
            headers: { "Content-Type": "application/json", ...(options.headers || {}) },
            ...options
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || `Backend returned ${response.status}`);
        return data;
    } catch (error) {
        console.error("[BACKEND ACTION ERROR]", path, error);
        return null;
    }
}


function Layout({ children, setAuth, authMode }) {
    const [user, setUser] = useState(getUser()); const [cart, setCart] = useState(getCart()); const [online, setOnline] = useState(navigator.onLine); const nav = useNavigate(); const location = useLocation(); const isLanding = location.pathname === "/";
    useEffect(() => { const sync = () => { setUser(getUser()); setCart(getCart()) }; const onOnline = () => setOnline(true); const onOffline = () => setOnline(false); window.addEventListener("riderpro:sync", sync); window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline); return () => { window.removeEventListener("riderpro:sync", sync); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline) } }, []);
    const logout = () => { localStorage.removeItem("rpUser"); setUser(null); window.dispatchEvent(new Event("riderpro:sync")); nav("/") };
    return <><header className="rp-header"><div className="container-fluid px-3 px-lg-4"><div className="row align-items-center g-2 py-2">
        <Link className="brand col-auto" to="/">🏍️ <span>Rider<span>Pro</span></span></Link>
        {!isLanding && <div className="col-12 col-lg"><div className="searchbar"><span>⌕</span><input id="globalSearch" placeholder="Search motor parts, accessories and brands..." onKeyDown={e => e.key === "Enter" && nav("/shop?q=" + encodeURIComponent(e.currentTarget.value))} /><button onClick={() => nav("/shop?q=" + encodeURIComponent(document.getElementById("globalSearch")?.value || ""))}>Search</button></div></div>}
        <div className="col-auto nav-actions d-flex align-items-center gap-2">{isLanding ? (user ? <button className="landing-header-cta" onClick={() => nav(user.role === "admin" || user.role === "staff" ? "/admin" : "/account")}>{user.role === "admin" || user.role === "staff" ? "Open Dashboard" : "My Account"} <span>↗</span></button> : <button className="landing-header-cta" onClick={() => setAuth("login")}>Login <span>↗</span></button>) : <>{user ? <button className="account-btn" onClick={() => nav("/account")}>👤 {user.firstName} ▾</button> : <button className="login-top" onClick={() => setAuth("login")}>Login</button>}<Link className="cart-btn" to="/cart">🛒<b>{cart.reduce((a, x) => a + x.qty, 0)}</b></Link></>}</div>
    </div></div></header>{!isLanding && <><div className={"offline-banner " + (online ? "online" : "offline")}>{online ? "🟢 Online — RiderPro is connected" : "🟠 Offline mode — cached pages and saved account/cart data are still available"}</div><nav className="subnav"><div className="container-fluid subnav-inner"><span>⚡ Flash Deals</span><span>🏷️ Vouchers</span><span>🚚 Free Shipping</span><span>🛡️ RiderPro Guarantee</span><span>💬 24/7 Support</span></div></nav></>}
        {children}<footer> <b>RiderPro</b> • Motor Parts Marketplace <span>© 2026</span> • <Link to="/settings">Settings</Link> • </footer>
        <AuthModal mode={authMode} setAuth={setAuth} /></>
}

function AuthModal({ mode, setAuth }) {
    const [show, setShow] = useState(false);
    const [tab, setTab] = useState("login");
    const [error, setError] = useState("");
    const nav = useNavigate();

    useEffect(() => {
        if (mode) { setTab(mode); setShow(true); setError(""); }
    }, [mode]);

    const close = () => { setShow(false); setAuth(null); };

    const finishGoogleLogin = async (cred) => {
        const parts = (cred.user.displayName || "RiderPro User").trim().split(/\s+/);
        let profile = null;
        try {
            profile = (await getDocument("user", cred.user.uid)) || (await getDocument("users", cred.user.uid));
        } catch (readErr) {
            console.warn("Could not read Firestore profile:", readErr);
        }
        const u = {
            id: cred.user.uid,
            firstName: profile?.firstName || parts[0] || "User",
            lastName: profile?.lastName || parts.slice(1).join(" "),
            email: cred.user.email || "",
            phone: profile?.phone || cred.user.phoneNumber || "",
            birthday: profile?.birthday || "",
            gender: profile?.gender || "",
            address: profile?.address || "",
            role: profile?.role || profile?.user || "user",
            user: profile?.user || profile?.role || "user",
            status: profile?.status || "active",
            photoURL: cred.user.photoURL || ""
        };
        if (!profile) {
            try {
                await upsertDocument("user", cred.user.uid, {
                    id: cred.user.uid, firstName: u.firstName, lastName: u.lastName,
                    email: u.email, phone: u.phone, birthday: u.birthday, gender: u.gender,
                    address: u.address, role: "user", user: "user", status: "active", provider: "google",
                    photoURL: u.photoURL
                });
            } catch (writeErr) {
                // Never make a successful Google authentication look like a failed login.
                // The user remains signed in; the profile can be synced after Firestore rules are published.
                console.warn("Google profile Firestore save failed:", writeErr);
            }
        }
        localStorage.setItem("rpUser", JSON.stringify(u));
        window.dispatchEvent(new Event("riderpro:sync"));
        close();
        nav(u.role === "admin" || u.role === "staff" ? "/admin" : "/shop");
    };

    useEffect(() => {
        let alive = true;
        if (!auth) return () => { alive = false };
        const pending = sessionStorage.getItem("riderpro_google_redirect") === "1";
        if (pending) setShow(true);
        getRedirectResult(auth).then(async (result) => {
            sessionStorage.removeItem("riderpro_google_redirect");
            if (!alive || !result?.user) return;
            try { await finishGoogleLogin(result); }
            catch (err) { if (alive) setError(err?.message || "Google sign-in could not finish."); }
        }).catch((err) => {
            sessionStorage.removeItem("riderpro_google_redirect");
            if (alive && err) {
                setShow(true);
                const code = err?.code || "";
                setError(firebaseAuthMessage(err));
            }
        });
        return () => { alive = false };
    }, []);

    const googleLogin = async () => {
        setError("");
        if (!auth) {
            setError("Firebase is not configured. Check your .env.local Firebase settings.");
            return;
        }
        try {
            // Try a normal popup first. If the browser blocks it, automatically
            // switch to redirect so the user can still sign in with Google.
            const result = await signInWithPopup(auth, googleProvider);
            await finishGoogleLogin(result);
        } catch (err) {
            console.error("Google sign-in:", err);
            const code = err?.code || "";
            if (["auth/popup-blocked", "auth/cancelled-popup-request"].includes(code)) {
                try {
                    sessionStorage.setItem("riderpro_google_redirect", "1");
                    await signInWithRedirect(auth, googleProvider);
                    return;
                } catch (redirectErr) {
                    sessionStorage.removeItem("riderpro_google_redirect");
                    setError(firebaseAuthMessage(redirectErr));
                    return;
                }
            }
            setError(firebaseAuthMessage(err));
        }
    };

    function firebaseAuthMessage(err) {
        const code = err?.code || "";
        if (code === "auth/unauthorized-domain") return "Google login is not allowed on this address. In Firebase Console, open Authentication → Settings → Authorized domains and add localhost.";
        if (code === "auth/operation-not-allowed") return "Google sign-in is disabled. Enable Google in Firebase Console → Authentication → Sign-in method.";
        if (code === "auth/network-request-failed") return "Firebase could not connect. Check your internet connection and Firebase project settings.";
        if (code === "auth/invalid-api-key") return "The Firebase API key is invalid. Check firebase.js or .env.local.";
        if (code === "auth/api-key-not-valid") return "The Firebase API key is not valid for this project. Check your Firebase Web App configuration.";
        if (code === "auth/popup-closed-by-user") return "Google sign-in was cancelled. Click Continue with Google again.";
        return err?.message || "Google sign-in failed. Please try again.";
    }

    const login = async e => {
        e.preventDefault();
        setError("");
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") || "").trim().toLowerCase();
        const pass = String(fd.get("password") || "");

        try {
            if (auth) {
                const cred = await signInWithEmailAndPassword(auth, email, pass);
                const profile = (await getDocument("user", cred.user.uid)) || (await getDocument("users", cred.user.uid));
                const u = {
                    id: cred.user.uid,
                    firstName: profile?.firstName || cred.user.displayName?.split(" ")[0] || "User",
                    lastName: profile?.lastName || cred.user.displayName?.split(" ").slice(1).join(" ") || "",
                    email: cred.user.email || email,
                    phone: profile?.phone || "",
                    birthday: profile?.birthday || "",
                    gender: profile?.gender || "",
                    address: profile?.address || "",
                    role: profile?.role || profile?.user || "user",
                    status: profile?.status || "active"
                };
                localStorage.setItem("rpUser", JSON.stringify(u));
                window.dispatchEvent(new Event("riderpro:sync"));
                close();
                nav(u.role === "admin" || u.role === "staff" ? "/admin" : "/");
                return;
            }

            // Local fallback only when Firebase is not configured.
            const u = read("rpUsers", []).find(x => x.email === email && x.password === pass);
            if (!u) throw new Error("Incorrect email or password.");
            localStorage.setItem("rpUser", JSON.stringify(u));
            window.dispatchEvent(new Event("riderpro:sync"));
            close();
            nav("/shop");
        } catch (err) {
            console.error("RiderPro login error:", err);
            setError(err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password"
                ? "Incorrect email or password."
                : (err?.message || "Login failed. Please try again."));
        }
    };

    const register = async e => {
        e.preventDefault();
        setError("");
        const fd = new FormData(e.currentTarget);
        const pass = String(fd.get("password") || "");
        const confirm = String(fd.get("confirm") || "");
        const terms = fd.get("terms");

        if (pass !== confirm) return setError("Passwords do not match. Please make sure both passwords are identical.");
        if (pass.length < 8) return setError("Password must be at least 8 characters.");
        if (!terms) return setError("Please accept the Terms & Conditions.");

        const firstName = String(fd.get("firstName") || "").trim();
        const lastName = String(fd.get("lastName") || "").trim();
        const email = String(fd.get("email") || "").trim().toLowerCase();
        const phone = String(fd.get("phone") || "").trim();
        const birthday = String(fd.get("birthday") || "");
        const gender = String(fd.get("gender") || "Prefer not to say");

        try {
            if (auth) {
                const cred = await createUserWithEmailAndPassword(auth, email, pass);
                const u = {
                    id: cred.user.uid,
                    firstName, lastName, email, phone, birthday, gender,
                    address: "",
                    role: "user",
                    user: "user",
                    status: "active"
                };
                try { await upsertDocument("user", cred.user.uid, u); } catch (profileErr) { console.warn("Profile save:", profileErr); }
                localStorage.setItem("rpUser", JSON.stringify(u));
                window.dispatchEvent(new Event("riderpro:sync"));
                close();
                nav("/shop");
                return;
            }

            // Local fallback when Firebase is not configured.
            const users = read("rpUsers", []);
            if (users.some(x => x.email === email)) return setError("Email is already registered.");
            const u = {
                id: Date.now(), firstName, lastName, email, phone,
                password: pass, birthday, gender, createdAt: new Date().toLocaleDateString(),
                address: "", role: "user", user: "user", status: "active"
            };
            users.push(u);
            write("rpUsers", users);
            localStorage.setItem("rpUser", JSON.stringify(u));
            window.dispatchEvent(new Event("riderpro:sync"));
            close();
            nav("/shop");
        } catch (err) {
            console.error("RiderPro registration error:", err);
            if (err?.code === "auth/email-already-in-use") setError("Email is already registered.");
            else setError(err?.message || "Account creation failed.");
        }
    };

    if (!show) return null;
    return <div className="modal-backdrop-custom"><div className="sheet auth-sheet"><button className="close" onClick={close}>×</button><div className="auth-brand">🏍️ <b>Rider<span>Pro</span></b></div><h2>{tab === "login" ? "Welcome back!" : "Create your RiderPro account"}</h2><p className="auth-sub">Sign in to manage your orders, vouchers and profile.</p>{error && <div className="alert alert-danger py-2 small">{error}</div>}
        {tab === "login" ? <form onSubmit={login}><Field label="Email Address" name="email" type="email" required placeholder="you@example.com" /><Field label="Password" name="password" type="password" required placeholder="Enter your password" /><div className="auth-row"><label className="check"><input type="checkbox" name="remember" /> Remember me</label><button type="button" className="link-btn" onClick={() => setError("Password reset needs a backend/email service.")}>Forgot password?</button></div><button className="checkout-btn">Login</button><div className="or-divider"><span>OR</span></div><button type="button" className="google-btn" onClick={googleLogin}><span className="google-icon">G</span><span>Continue with Google</span></button><p className="switch">New to RiderPro? <button type="button" className="link-btn" onClick={() => { setTab("register"); setError("") }}>Create account</button></p></form>
            : <form onSubmit={register}><div className="form-grid"><Field label="First Name" name="firstName" required placeholder="Juan" /><Field label="Last Name" name="lastName" required placeholder="Dela Cruz" /></div><Field label="Email Address" name="email" type="email" required placeholder="you@example.com" /><Field label="Mobile Number" name="phone" required pattern="^09\d{9}$" title="Use 11 digits starting with 09" placeholder="09XXXXXXXXX" /><div className="form-grid"><Field label="Birthday" name="birthday" type="date" required /><label>Gender<select name="gender" defaultValue="Prefer not to say"><option>Prefer not to say</option><option>Male</option><option>Female</option></select></label></div><div className="form-grid"><PasswordField label="Password" name="password" /><PasswordField label="Confirm Password" name="confirm" match /></div><label className="check"><input type="checkbox" name="terms" /> I agree to RiderPro Terms, Privacy Policy and community guidelines.</label><button className="checkout-btn">Create Account</button><p className="switch">Already have an account? <button type="button" className="link-btn" onClick={() => { setTab("login"); setError("") }}>Login</button></p></form>}</div></div>
}

function Field({ label, name, type = "text", ...props }) { return <label>{label}<input name={name} type={type} {...props} /></label> }
function PasswordField({ label, name, match }) { const [show, setShow] = useState(false); return <label>{label}<div className="password-wrap"><input name={name} type={show ? "text" : "password"} minLength="8" required placeholder={match ? "Repeat password" : "Minimum 8 characters"} /><button type="button" onClick={() => setShow(v => !v)}>{show ? "Hide" : "Show"}</button></div></label> }

function Landing({ setAuth }) {
    const nav = useNavigate();
    const featured = getProducts().slice(0, 8);
    return <main className="landing-page">
        <section className="pro-landing-hero">
            <div className="pro-hero-copy">
                <span className="hero-kicker">RIDERPRO MOTOR PARTS</span>
                <h1>Keep your ride ready for the road.</h1>
                <p>Real motorcycle parts for everyday maintenance, repairs and upgrades. Browse the catalog, check availability and order in a few clicks.</p>
                <div className="hero-actions">
                    <button className="landing-primary" onClick={() => nav("/shop")}>Browse Parts</button>
                    <button className="landing-secondary" onClick={() => setAuth("login")}>Sign in to order <span aria-hidden="true">↗</span></button>
                </div>
                <div className="hero-points"><span>✓ Parts for everyday maintenance</span><span>✓ Clear prices in PHP</span><span>✓ Order tracking</span></div>
            </div>
            <div className="pro-hero-visual">
                <img src="https://images.tcdn.com.br/img/img_prod/826370/180_disco_c_caliper_de_freio_dianteiro_gp7_cg_150_09_15_169757_1_589ccf7655fdb5d4fb6cc1681c931767.jpg" alt="Motorcycle disc brake and caliper product photo" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_PARTS_PHOTO; }} />
                <div className="hero-photo-caption"><b>Parts you can recognize</b><span>Brakes • Filters • Chains • Suspension</span></div>
            </div>
        </section>

        <section className="trust-row">
            <div><span className="trust-icon">01</span><div><b>Shop by part</b><small>Find the component you need</small></div></div>
            <div><span className="trust-icon">02</span><div><b>Check stock</b><small>See available pieces before ordering</small></div></div>
            <div><span className="trust-icon">03</span><div><b>Place your order</b><small>Simple checkout and order history</small></div></div>
        </section>

        <section className="landing-catalog">
            <div className="section-title"><div><span className="eyebrow">POPULAR NOW</span><h2>Parts riders actually look for</h2><p>Practical components across brakes, engine, drivetrain and suspension.</p></div><button className="plain-link" onClick={() => nav("/shop")}>View catalog →</button></div>
            <div className="product-grid">{featured.map(p => <ProductCard key={p.id} p={p} add={() => nav("/shop")} />)}</div>
        </section>

        <section className="landing-story">
            <div><span className="eyebrow">BUILT FOR RIDERS</span><h2>A cleaner way to shop for motorcycle parts.</h2><p>RiderPro keeps the important details close: product photo, category, price, stock and your order history. No clutter—just the parts and information you need.</p><button className="landing-secondary dark-btn" onClick={() => nav("/shop")}>Explore RiderPro</button></div>
            <div className="story-image"><img src="https://mundimotos.com/cdn/shop/files/S56111C34J40H000_600x.png?v=1754728619" alt="Motorcycle handlebar product photo" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_PARTS_PHOTO; }} /></div>
        </section>
    </main>
}

function Shop({ setAuth }) {
    const loc = useLocation(); const params = new URLSearchParams(loc.search); const [products, setProducts] = useState(getProducts()); const [cat, setCat] = useState("All"); const [sort, setSort] = useState("popular"); const q = (params.get("q") || "").toLowerCase();
    useEffect(() => {
        let active = true;
        setProducts(getProducts());
        if (firestoreEnabled()) getCollection("products").then(rows => { if (active && rows.length) { write("rpProducts", rows); setProducts(rows); } }).catch(console.error);
        return () => { active = false };
    }, [loc.search]);
    const normalizedProducts = products.map(p => ({ ...p, cat: p.cat || p.category || "Accessories", name: p.name || "Unnamed Product", price: Number(p.price || 0), old: Number(p.old || p.price || 0), stock: Number(p.stock || 0) }));
    const cats = ["All", ...new Set(normalizedProducts.map(p => p.cat))];
    const list = useMemo(() => { let a = normalizedProducts.filter(p => (cat === "All" || p.cat === cat) && (p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q))); if (sort === "low") a.sort((x, y) => x.price - y.price); if (sort === "high") a.sort((x, y) => y.price - x.price); return a }, [normalizedProducts, cat, sort, q]);
    const add = id => { const p = products.find(x => x.id === id), cart = getCart(), x = cart.find(a => a.id === id); if (!p || p.stock < 1) return; if (x) { if (x.qty >= p.stock) return alert("Maximum available stock reached"); x.qty++ } else cart.push({ ...p, qty: 1 }); write("rpCart", cart); window.dispatchEvent(new Event("riderpro:sync")) };
    return <main><section className="market-hero container-fluid px-3 px-lg-4"><div className="hero-main"><div><span className="pill">RIDERPRO MOTOR MARKET</span><h1>Everything your ride needs.</h1><p>Shop practical motorcycle parts and maintenance essentials with clear pricing and stock information.</p><a className="shop-now" href="#products">Shop Now →</a></div><div className="hero-bike"><img src="https://mundimotos.com/cdn/shop/files/S56111C34J40H000_600x.png?v=1754728619" alt="Motorcycle handlebar product photo" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_PARTS_PHOTO; }} /></div></div><div className="hero-side"><div className="deal-card"><small>LIMITED DEAL</small><strong>Up to 40% OFF</strong><span>Selected parts today</span><a href="#products">Shop deals →</a></div><div className="deal-card dark"><small>RIDER ESSENTIALS</small><strong>Gear up & ride</strong><span>Helmet • Gloves • Accessories</span><a href="#products">Explore →</a></div></div></section>
        <section className="quick-cats container-fluid px-3 px-lg-4"><div className="section-title"><h2>Categories</h2><a href="#products">See All ›</a></div><div className="category-row">{cats.map(x => <button key={x} className={"category " + (x === cat ? "active" : "")} onClick={() => setCat(x)}><span className="cat-icon">{categoryIcons[x] || "🏍️"}</span><b>{x}</b></button>)}</div></section>
        <section id="products" className="products-section container-fluid px-3 px-lg-4"><div className="section-title"><div><h2>Flash Sale</h2><p>Popular parts at rider-friendly prices</p></div><span className="sale-badge">SALE</span></div><div className="toolbar"><div>{list.length} products found</div><select value={sort} onChange={e => setSort(e.target.value)}><option value="popular">Sort: Popular</option><option value="low">Price: Low to High</option><option value="high">Price: High to Low</option></select></div><div className="product-grid">{list.map(p => <ProductCard key={p.id} p={p} add={add} />)}</div>{!list.length && <div className="empty-state">No products found.</div>}</section><Orders /></main>
}

function ProductCard({ p, add }) { const nav = useNavigate(); return <article className="product-card" onClick={() => nav("/product/" + p.id)}><div className="product-pic"><span className="discount">-{Math.round((1 - p.price / p.old) * 100)}%</span><button className="heart" onClick={e => { e.stopPropagation(); alert("Added to wishlist ❤️") }}>♡</button><img src={p.img || FALLBACK_PARTS_PHOTO} alt={p.name} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_PARTS_PHOTO; }} /></div><div className="product-info"><div className="product-name">{p.name}</div><div className="rating">★★★★★ <span>{(4.6 + (p.id % 4) / 10).toFixed(1)} • {p.sold} sold</span></div><div><span className="price">{money(p.price)}</span> <span className="oldprice">{money(p.old)}</span></div><div className="sold">{p.stock} pieces available</div><button className="add-btn" disabled={p.stock < 1} onClick={e => { e.stopPropagation(); add(p.id) }}>🛒 Add to Cart</button></div></article> }

function Orders() { const [orders, setOrders] = useState(getOrders()); useEffect(() => { const s = () => setOrders(getOrders()); window.addEventListener("riderpro:sync", s); return () => window.removeEventListener("riderpro:sync", s) }, []); return <section id="orders" className="orders-section container-fluid px-3 px-lg-4"><div className="section-title"><div><h2>My Orders</h2><p>Track your recent purchases</p></div></div>{orders.length ? orders.slice(0, 10).map(x => <div className="order" key={x.id}><div className="order-main"><div className="order-icon">{x.items?.[0]?.img ? <img src={x.items[0].img || FALLBACK_PARTS_PHOTO} alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_PARTS_PHOTO; }} /> : <span>{x.items?.[0]?.icon || "📦"}</span>}</div><div><b>{x.id} — {x.name}</b><div className="muted">{x.date} • {x.payment} • {(x.items || []).map(i => i.name + " × " + i.qty).join(", ")}</div><strong>{money(x.total)}</strong></div></div><span className="status">{x.status}</span></div>) : <div className="order"><div><b>No orders yet</b><div className="muted">Your orders will appear here after checkout.</div></div></div>}</section> }

function Cart() {
    const nav = useNavigate(); const [cart, setCart] = useState(getCart()); const sync = () => setCart(getCart()); useEffect(() => { window.addEventListener("riderpro:sync", sync); return () => window.removeEventListener("riderpro:sync", sync) }, []); const total = cart.reduce((a, x) => a + x.price * x.qty, 0);
    const change = (id, d) => { const c = getCart(), x = c.find(a => a.id === id), p = getProducts().find(a => a.id === id); if (!x) return; x.qty += d; if (x.qty <= 0) write("rpCart", c.filter(a => a.id !== id)); else { x.qty = Math.min(x.qty, p?.stock || x.qty); write("rpCart", c) } window.dispatchEvent(new Event("riderpro:sync")) };
    return <main className="page-wrap"><div className="sheet-static cart-static"><h2>🛒 My Cart</h2>{cart.length ? cart.map(x => <div className="cart-line" key={x.id}><img src={x.img || FALLBACK_PARTS_PHOTO} className="cart-img" alt={x.name} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_PARTS_PHOTO; }} /><div className="grow"><b>{x.name}</b><div className="muted">{money(x.price)} each</div></div><div className="qty"><button onClick={() => change(x.id, -1)}>−</button><b>{x.qty}</b><button onClick={() => change(x.id, 1)}>+</button></div><b>{money(x.price * x.qty)}</b></div>) : <div className="empty-state">Your cart is empty. <Link to="/">Continue shopping</Link></div>}<div className="checkout-total"><span>Total</span><b>{money(total)}</b></div><button className="checkout-btn" disabled={!cart.length} onClick={() => nav("/checkout")}>Checkout</button></div></main>
}

function Checkout() {
    const [cart] = useState(getCart());
    const [done, setDone] = useState(false);
    const nav = useNavigate();
    const total = cart.reduce((a, x) => a + x.price * x.qty, 0);
    const user = getUser();

    const submit = async e => {
        e.preventDefault();
        if (!cart.length) return;
        const fd = new FormData(e.currentTarget);
        const newOrder = {
            id: "RP-" + Date.now().toString().slice(-7),
            userId: user?.id || null,
            name: String(fd.get("name") || ""),
            phone: String(fd.get("phone") || ""),
            address: String(fd.get("address") || ""),
            payment: String(fd.get("payment") || "Cash on Delivery"),
            total,
            items: cart.map(x => ({ id: x.id, name: x.name, qty: x.qty, price: x.price, icon: x.icon, img: x.img })),
            status: "Pending",
            date: new Date().toLocaleString()
        };

        try {
            const response = await fetch(`${BACKEND_URL}/api/orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newOrder)
            });
            const raw = await response.text();
            let result = {};
            try { result = raw ? JSON.parse(raw) : {}; }
            catch { throw new Error(`Backend returned HTTP ${response.status} with invalid JSON.`); }

            if (!response.ok || result.success !== true) {
                throw new Error(result.message || `Backend returned HTTP ${response.status}`);
            }

            console.log("✓ ORDER POST SUCCESS:", newOrder.id, result);

            const orders = getOrders();
            orders.unshift(newOrder);
            write("rpOrders", orders);
            if (firestoreEnabled()) upsertDocument("orders", newOrder.id, newOrder).catch(console.error);

            const ps = getProducts();
            ps.forEach(p => { const x = cart.find(c => c.id === p.id); if (x) p.stock = Math.max(0, p.stock - x.qty); });
            write("rpProducts", ps);
            if (firestoreEnabled()) Promise.all(ps.map(p => upsertDocument("products", p.id, p))).catch(console.error);
            write("rpCart", []);
            window.dispatchEvent(new Event("riderpro:sync"));
            setDone(true);
        } catch (err) {
            console.error("✗ ORDER POST FAILED:", err);
            alert("Hindi na-save ang order sa Express backend. Patakbuhin ang npm run backend.\n\n" + err.message);
        }
    };

    if (!user) return <main className="page-wrap"><div className="success-card"><h2>Login required</h2><p>Please login before checkout so your order can be saved to your account.</p><button className="checkout-btn" onClick={() => nav("/")}>Back to Shop</button></div></main>;
    if (done) return <main className="page-wrap"><div className="success-card"><div className="success-icon">✓</div><h2>Order placed successfully!</h2><p>Your order has been saved and is now Pending.</p><button className="checkout-btn" onClick={() => nav("/#orders")}>View My Orders</button></div></main>;
    return <main className="page-wrap"><div className="sheet-static"><h2>Checkout</h2><form onSubmit={submit}><div className="form-grid"><Field label="Full Name" name="name" defaultValue={user ? `${user.firstName} ${user.lastName}` : ""} required placeholder="Juan Dela Cruz" /><Field label="Mobile Number" name="phone" defaultValue={user?.phone || ""} required placeholder="09XXXXXXXXX" /></div><label>Delivery Address<textarea name="address" defaultValue={user?.address || ""} required placeholder="House no., street, barangay, city" /></label><label>Payment Method<select name="payment"><option>Cash on Delivery</option><option>GCash</option><option>Maya</option></select></label><div className="checkout-total"><span>Order Total</span><b>{money(total)}</b></div><button className="checkout-btn" disabled={!cart.length}>Place Order</button></form></div></main>;
}

function ProductDetail() { const id = Number(useLocation().pathname.split("/").pop()), p = getProducts().find(x => x.id === id), [qty, setQty] = useState(1); const nav = useNavigate(); if (!p) return <main className="page-wrap"><div className="empty-state">Product not found.</div></main>; const add = () => { const c = getCart(), x = c.find(a => a.id === id); if (x) x.qty = Math.min(p.stock, x.qty + qty); else c.push({ ...p, qty }); write("rpCart", c); window.dispatchEvent(new Event("riderpro:sync")); nav("/cart") }; return <main className="page-wrap"><div className="sheet-static product-detail-static"><div className="detail-image"><img src={p.img || FALLBACK_PARTS_PHOTO} alt={p.name} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_PARTS_PHOTO; }} /></div><div><div className="pill">RIDERPRO VERIFIED</div><h2>{p.name}</h2><div><b className="detail-price">{money(p.price)}</b> <del>{money(p.old)}</del></div><p>★★★★★ <span className="muted">4.9 • Genuine product • Secure checkout</span></p><p className="muted">{p.stock} pieces available</p><label>Quantity<input type="number" min="1" max={p.stock} value={qty} onChange={e => setQty(Math.max(1, Math.min(p.stock, Number(e.target.value) || 1)))} /></label><button className="checkout-btn" onClick={add} disabled={!p.stock}>Add to Cart</button></div></div></main> }

function Account() { const user = getUser(), nav = useNavigate(); if (!user) return <main className="page-wrap"><div className="sheet-static text-center"><h2>Login required</h2><p>Please login to view your account.</p></div></main>; return <main className="page-wrap"><div className="sheet-static account-static"><div className="profile-head"><div className="avatar">👤</div><div><h2>{user.firstName} {user.lastName}</h2><p>{user.email}</p></div></div><div className="account-menu">{["📦 My Purchases", "🎟️ My Vouchers", "📍 My Addresses", "💳 Payment Methods"].map(x => <button key={x} onClick={() => alert(x + " opened")}>{x}<span>›</span></button>)}<button onClick={() => nav("/settings")}>⚙️ Account Settings <span>›</span></button></div><button className="logout-btn" onClick={() => { localStorage.removeItem("rpUser"); window.dispatchEvent(new Event("riderpro:sync")); nav("/") }}>Log Out</button></div></main> }

function Settings() { const [notify, setNotify] = useState(localStorage.getItem("notifySetting") !== "0"), [orders, setOrders] = useState(localStorage.getItem("orderSetting") !== "0"), [offers, setOffers] = useState(localStorage.getItem("offerSetting") !== "0"); const save = (k, v, set) => { set(v); localStorage.setItem(k, v ? "1" : "0") }; return <main className="page-wrap"><div className="sheet-static"><h2>⚙️ Settings</h2><p className="muted">Customize your RiderPro marketplace experience.</p><Setting title="🔔 Push Notifications" desc="Get updates about orders and promotions" value={notify} onChange={v => save("notifySetting", v, setNotify)} /><Setting title="📦 Order Updates" desc="Shipping and delivery notifications" value={orders} onChange={v => save("orderSetting", v, setOrders)} /><Setting title="🎯 Personalized Offers" desc="Show deals based on your interests" value={offers} onChange={v => save("offerSetting", v, setOffers)} /><div className="setting"><span>🌐 Language<small>Choose your preferred language</small></span><select><option>English</option><option>Filipino</option></select></div><div className="setting"><span>💰 Currency<small>Prices shown in</small></span><select><option>PHP ₱</option></select></div></div></main> }
function Setting({ title, desc, value, onChange }) { return <div className="setting"><span>{title}<small>{desc}</small></span><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} /></div> }

function Admin() {
    const [logged, setLogged] = useState(false);
    const [checking, setChecking] = useState(true);
    const [products, setProducts] = useState(getProducts());
    const [orders, setOrders] = useState(getOrders());
    const [q, setQ] = useState("");
    const [section, setSection] = useState("overview");

    useEffect(() => {
        let alive = true;
        const load = async () => {
            if (auth) {
                try {
                    const current = auth.currentUser;
                    if (!current) { if (alive) setLogged(false); return; }
                    const profile = (await getDocument("user", current.uid)) || (await getDocument("users", current.uid));
                    const role = profile?.role || profile?.user;
                    if (role !== "admin" && role !== "staff") { if (alive) setLogged(false); return; }
                    if (alive) setLogged(true);
                } catch (e) { console.error("Admin auth check:", e); if (alive) setLogged(false); }
                finally { if (alive) setChecking(false); }
                return;
            }
            if (alive) { setLogged(localStorage.getItem("rpAdmin") === "1"); setChecking(false); }
        };
        load();
        const unsubscribe = auth ? auth.onAuthStateChanged?.(() => load()) : null;
        return () => { alive = false; if (typeof unsubscribe === "function") unsubscribe(); };
    }, []);

    useEffect(() => {
        if (!logged || !firestoreEnabled()) return;
        Promise.all([getCollection("products"), getCollection("orders")]).then(([ps, os]) => {
            if (ps.length) { write("rpProducts", ps); setProducts(ps); }
            if (os.length) { write("rpOrders", os); setOrders(os); }
        }).catch(e => console.error("Admin Firestore load:", e));
    }, [logged]);

    const saveProducts = async (nextProducts, action = "UPDATE", changedProduct = null) => {
        setProducts(nextProducts);
        write("rpProducts", nextProducts);
        if (firestoreEnabled()) {
            try {
                if (action === "ADD" && changedProduct) await upsertDocument("products", changedProduct.id, changedProduct);
                else if (action === "UPDATE" && changedProduct) await upsertDocument("products", changedProduct.id, changedProduct);
                else await Promise.all(nextProducts.map(x => upsertDocument("products", x.id, x)));
            } catch (e) { console.error("Firestore product save:", e); }
        }
        if (action === "ADD" && changedProduct) {
            await backendAction("/api/products", { method: "POST", body: JSON.stringify(changedProduct) });
        } else if (action === "UPDATE" && changedProduct) {
            await backendAction(`/api/products/${changedProduct.id}`, { method: "PUT", body: JSON.stringify(changedProduct) });
        }
        window.dispatchEvent(new Event("riderpro:sync"));
    };

    const login = async e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const emailOrUser = String(f.get("user") || "").trim();
        const pass = String(f.get("pass") || "");
        if (auth) {
            try {
                const cred = await signInWithEmailAndPassword(auth, emailOrUser, pass);
                const profile = (await getDocument("user", cred.user.uid)) || (await getDocument("users", cred.user.uid));
                const role = profile?.role || profile?.user;
                if (role !== "admin" && role !== "staff") { await signOut(auth); alert("This account is not an admin/staff account."); return; }
                localStorage.setItem("rpUser", JSON.stringify({ id: cred.user.uid, firstName: profile?.firstName || "Admin", lastName: profile?.lastName || "", email: cred.user.email || emailOrUser, role, status: profile?.status || "active" }));
                localStorage.setItem("rpAdmin", "1"); setLogged(true); window.dispatchEvent(new Event("riderpro:sync"));
            } catch (err) { console.error("Admin login:", err); alert(err?.message || "Admin login failed."); }
            return;
        }
        alert("Admin sign-in is unavailable until Firebase Authentication is configured. Please configure Firebase and assign the account the admin or staff role.");
    };

    const logoutAdmin = async () => {
        try { if (auth) await signOut(auth); } catch (e) { console.error(e); }
        localStorage.removeItem("rpAdmin"); localStorage.removeItem("rpUser"); setLogged(false);
    };

    if (checking) return <main className="page-wrap"><div className="sheet-static"><h2>Checking admin access...</h2></div></main>;
    if (!logged) return <main className="admin-login-page"><form className="loginbox admin-login-card" onSubmit={login}>
        <div className="adminlogo">RP</div><div className="admin-eyebrow">RIDERPRO / ADMIN</div><h1>Control Center</h1>
        <p>Manage inventory and orders from one workspace.</p>
        <input name="user" type={auth ? "email" : "text"} placeholder={auth ? "Admin email" : "Username"} required />
        <input name="pass" type="password" placeholder="Password" required />
        <button className="checkout-btn w-100">Sign in to dashboard</button>
        <Link to="/shop" className="d-block mt-3 text-danger small">← Back to shop</Link>
    </form></main>;

    const filtered = products.filter(x => (x.name + " " + (x.cat || x.category || "")).toLowerCase().includes(q.toLowerCase()));
    const sales = orders.filter(x => x.status !== "Cancelled").reduce((a, x) => a + Number(x.total || 0), 0);
    const pending = orders.filter(x => x.status === "Pending").length;
    const lowStock = products.filter(x => Number(x.stock) <= 5).length;

    const updateOrder = async (o, status) => {
        const n = orders.map(x => x.id === o.id ? { ...x, status } : x);
        if (firestoreEnabled()) {
            try { await updateDocument("orders", o.id, { status }); }
            catch (e) { console.error("Firestore order update:", e); alert("Order update failed in Firestore."); return; }
        }
        await backendAction(`/api/orders/${encodeURIComponent(o.id)}`, {
            method: "PUT",
            body: JSON.stringify({ ...o, status })
        });
        setOrders(n); write("rpOrders", n);
        window.dispatchEvent(new Event("riderpro:sync"));
    };

    return <main className="admin-shell">
        <aside className="admin-sidebar">
            <div className="admin-brand"><span>RP</span><div><b>RiderPro</b><small>Admin Portal</small></div></div>
            <div className="admin-nav-label">WORKSPACE</div>
            <button className={section === "overview" ? "active" : ""} onClick={() => setSection("overview")}>▦ <span>Dashboard</span></button>
            <button className={section === "inventory" ? "active" : ""} onClick={() => setSection("inventory")}>◫ <span>Inventory</span></button>
            <button className={section === "orders" ? "active" : ""} onClick={() => setSection("orders")}>▤ <span>Orders</span>{pending > 0 && <em>{pending}</em>}</button>
            <div className="admin-nav-label">STORE</div>
            <Link to="/shop">↗ <span>View storefront</span></Link>
            <button onClick={logoutAdmin}>↪ <span>Sign out</span></button>
        </aside>
        <section className="admin-main">
            <header className="admin-topbar"><div><small>RIDERPRO / ADMIN</small><h1>{section === "overview" ? "Dashboard" : section === "inventory" ? "Inventory" : "Orders"}</h1></div><div className="admin-user"><span>●</span><div><b>Admin</b><small>Control Center</small></div></div></header>

            <div className="admin-content">
                <div className="admin-stat-grid">
                    <div className="admin-stat"><span className="stat-mark">P</span><div><small>Catalog items</small><b>{products.length}</b><em>Products listed</em></div></div>
                    <div className="admin-stat"><span className="stat-mark">S</span><div><small>Total sales</small><b>{money(sales)}</b><em>Non-cancelled orders</em></div></div>
                    <div className="admin-stat"><span className="stat-mark">O</span><div><small>Orders</small><b>{orders.length}</b><em>{pending} pending</em></div></div>
                    <div className={"admin-stat " + (lowStock ? "attention" : "")}><span className="stat-mark">!</span><div><small>Low stock</small><b>{lowStock}</b><em>5 or fewer pieces</em></div></div>
                </div>

                {section === "overview" && <div className="admin-overview-grid">
                    <section className="admin-panel"><div className="panel-head"><div><small>RECENT ACTIVITY</small><h3>Latest orders</h3></div><button onClick={() => setSection("orders")}>View all →</button></div>
                        {orders.slice(0, 5).map(o => <div className="admin-order-row" key={o.id}><span className="mini-avatar">#{String(o.id).slice(-2)}</span><div className="grow"><b>{o.name || "Customer"}</b><small>{o.id} · {o.date}</small></div><strong>{money(o.total)}</strong><span className={"status-dot " + String(o.status).toLowerCase()}>{o.status}</span></div>)}
                        {!orders.length && <div className="admin-empty">No orders yet. New checkout orders will appear here.</div>}
                    </section>
                    <section className="admin-panel"><div className="panel-head"><div><small>STOCK WATCH</small><h3>Inventory alerts</h3></div><button onClick={() => setSection("inventory")}>Manage →</button></div>
                        {products.filter(p => Number(p.stock) <= 8).slice(0, 5).map(p => <div className="stock-row" key={p.id}><img src={p.img || FALLBACK_PARTS_PHOTO} alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_PARTS_PHOTO; }} /><div className="grow"><b>{p.name}</b><small>{p.cat || p.category}</small></div><strong>{p.stock}<small>left</small></strong></div>)}
                        {!lowStock && <div className="admin-empty">Inventory is comfortably stocked.</div>}
                    </section>
                </div>}

                {(section === "inventory" || section === "overview") && <section className="admin-panel inventory-panel">
                    <div className="panel-head inventory-head"><div><small>PRODUCT CATALOG</small><h3>Inventory</h3></div><div className="inventory-tools"><input placeholder="Search products..." value={q} onChange={e => setQ(e.target.value)} /><button className="admin-add" onClick={async () => {
    const name = prompt("Product name");
    if (!name) return;
    const priceText = prompt("Price", "0");
    const stockText = prompt("Stock", "0");
    const np = { id: Date.now(), name: name.trim(), cat: "Accessories", price: Number(priceText || 0), old: 0, stock: Number(stockText || 0), icon: "🏍️", sold: 0, img: FALLBACK_PARTS_PHOTO };
    await saveProducts([np, ...products], "ADD", np);
}}>+ Add Product</button></div></div>
                    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>PRICE</th><th>STOCK</th><th>ACTIONS</th></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td><div className="table-product"><img src={p.img || FALLBACK_PARTS_PHOTO} alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_PARTS_PHOTO; }} /><div><b>{p.name}</b><small>ID #{p.id}</small></div></div></td><td>{p.cat || p.category}</td><td><b>{money(p.price)}</b></td><td><span className={Number(p.stock) <= 5 ? "stock-low" : "stock-ok"}>{p.stock}</span></td><td>
    <button className="table-action" onClick={async () => {
        const name = prompt("Product name", p.name);
        if (name === null) return;
        const price = prompt("Price", p.price);
        if (price === null) return;
        const stock = prompt("Stock", p.stock);
        if (stock === null) return;
        const updated = { ...p, name: name.trim() || p.name, price: Number(price || 0), stock: Number(stock || 0) };
        await saveProducts(products.map(x => x.id === p.id ? updated : x), "UPDATE", updated);
    }}>Edit</button>
    <button className="table-action danger" onClick={async () => {
        if (!confirm(`Delete "${p.name}"?`)) return;
        if (firestoreEnabled()) {
            try { await deleteDocument("products", p.id); }
            catch (e) { console.error("Firestore product delete:", e); alert("Delete failed in Firestore. Check your Firestore rules."); return; }
        }
        await backendAction(`/api/products/${p.id}`, { method: "DELETE" });
        const n = products.filter(x => x.id !== p.id);
        setProducts(n); write("rpProducts", n);
        window.dispatchEvent(new Event("riderpro:sync"));
    }}>Delete</button>
</td></tr>)}</tbody></table></div>
                </section>}

                {section === "orders" && <section className="admin-panel inventory-panel">
                    <div className="panel-head"><div><small>SALES MANAGEMENT</small><h3>Customer orders</h3></div></div>
                    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>TOTAL</th><th>PAYMENT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{orders.length ? orders.map(o => <tr key={o.id}><td><b>{o.id}</b><small>{o.date}</small></td><td><b>{o.name || "Customer"}</b><small>{o.phone || "—"}</small></td><td><b>{money(o.total)}</b></td><td>{o.payment || "—"}</td><td><select className="status-select" value={o.status} onChange={e => updateOrder(o, e.target.value)}><option>Pending</option><option>Processing</option><option>Shipped</option><option>Completed</option><option>Cancelled</option></select></td><td><button className="table-action danger" onClick={async () => {
    if (!confirm(`Delete order ${o.id}?`)) return;
    if (firestoreEnabled()) {
        try { await deleteDocument("orders", o.id); }
        catch (e) { console.error("Firestore order delete:", e); alert("Delete failed in Firestore."); return; }
    }
    await backendAction(`/api/orders/${encodeURIComponent(o.id)}`, { method: "DELETE" });
    const n = orders.filter(x => x.id !== o.id);
    setOrders(n); write("rpOrders", n);
    window.dispatchEvent(new Event("riderpro:sync"));
}}>Delete</button></td></tr>) : <tr><td colSpan="6" className="admin-empty">No orders yet.</td></tr>}</tbody></table></div>
                </section>}
            </div>
        </section>
    </main>
}

function Stat({ label, value }) { return <div><small>{label}</small><b>{value}</b></div> }

export default function App() { const [auth, setAuth] = useState(null); return <Layout setAuth={setAuth} authMode={auth}><Routes><Route path="/" element={<Landing setAuth={setAuth} />} /><Route path="/shop" element={<Shop setAuth={setAuth} />} /><Route path="/cart" element={<Cart />} /><Route path="/checkout" element={<Checkout />} /><Route path="/product/:id" element={<ProductDetail />} /><Route path="/account" element={<Account />} /><Route path="/settings" element={<Settings />} /><Route path="/admin" element={<Admin />} /></Routes></Layout> }
