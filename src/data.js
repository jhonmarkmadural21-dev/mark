// Product catalog images use real motorcycle-parts product photographs.
// Keep local SVGs in public/images/products as fallbacks if a host is unavailable.
export const realImages = {
    // Real product photos served from the original product-image hosts.
    // If a host blocks hotlinking or moves a file, the UI falls back to local artwork.
    brake: "https://images.tcdn.com.br/img/img_prod/826370/180_disco_c_caliper_de_freio_dianteiro_gp7_cg_150_09_15_169757_1_589ccf7655fdb5d4fb6cc1681c931767.jpg",
    airFilter: "https://cdn.zyrosite.com/cdn-ecommerce/store_01JJ0086B7X3W8CNEZHPB7Q385/assets/1745502569163-49200l290000_filtroairebenellitnt150.png",
    headlight: "https://bikerkart.com/cdn/shop/products/1-scaled-1.jpg?v=1704009434&width=1445",
    chain: "https://egamotomarket.com/uploads/p/b/motosiklet-yedek-parca-rehberi-orijinal-oem-ve-yan-sanayi-parcalar-arasindaki-farklar_1.png?v=1743089077",
    sprocket: "https://images.tcdn.com.br/img/img_prod/983748/kit_relacao_para_moto_biz_125_ate_2011_coxim_pastilha_traseira_filtro_de_ar_disco_embreagem_3261_1_2af0f57d781b4c0174147b7f659946fd.jpg",
    shock: "https://io.convertiez.com.br/m/sbsmotos/shop/products/images/4407732/large/amortecedor-traseiro-prolink-scud-fazer-150_1607.jpg",
    handlebar: "https://mundimotos.com/cdn/shop/files/S56111C34J40H000_600x.png?v=1754728619",
    oilFilter: "https://unomindakart.com/uploaded_files/productImages/OF2117SP/DSC_2756.png",
    mirror: "https://bikeexperts.in/cdn/shop/files/DSC-686-2.png?v=1753528370&width=1096",
    pads: "https://nicheindustries.com/cdn/shop/files/15mis_k-pad-0271_4_1024x.jpg?v=1776609344",
    shop: "https://egamotomarket.com/uploads/p/b/motosiklet-yedek-parca-rehberi-orijinal-oem-ve-yan-sanayi-parcalar-arasindaki-farklar_1.png?v=1743089077"
};

export const defaultProducts = [
    { id: 1, name: "Brembo Style Disc Brake", cat: "Brakes", price: 1850, old: 2200, stock: 12, icon: "🛞", sold: 128, img: realImages.brake },
    { id: 2, name: "Performance Air Filter", cat: "Engine", price: 650, old: 800, stock: 25, icon: "🔧", sold: 96, img: realImages.airFilter },
    { id: 3, name: "LED Headlight 12V", cat: "Electrical", price: 990, old: 1250, stock: 18, icon: "💡", sold: 74, img: realImages.headlight },
    { id: 4, name: "Motorcycle Chain Set", cat: "Drivetrain", price: 1250, old: 1500, stock: 9, icon: "⛓️", sold: 155, img: realImages.chain },
    { id: 5, name: "Racing Handlebar", cat: "Accessories", price: 780, old: 950, stock: 15, icon: "🏍️", sold: 63, img: realImages.handlebar },
    { id: 6, name: "Rear Shock Absorber", cat: "Suspension", price: 2100, old: 2500, stock: 6, icon: "⚙️", sold: 41, img: realImages.shock },
    { id: 7, name: "Universal Side Mirror", cat: "Accessories", price: 420, old: 550, stock: 30, icon: "🪞", sold: 201, img: realImages.mirror },
    { id: 8, name: "Motorcycle Oil Filter", cat: "Engine", price: 520, old: 650, stock: 40, icon: "🛢️", sold: 319, img: realImages.oilFilter },
    { id: 9, name: "Motorcycle Sprocket", cat: "Drivetrain", price: 480, old: 620, stock: 22, icon: "⚙️", sold: 88, img: realImages.sprocket },
    { id: 10, name: "Heavy Duty Brake Pads", cat: "Brakes", price: 560, old: 700, stock: 17, icon: "🧱", sold: 134, img: realImages.pads }
];
export const categoryIcons = { All: "🏍️", Engine: "🔧", Brakes: "🛞", Electrical: "💡", Drivetrain: "⛓️", Accessories: "🪖", Suspension: "⚙️" };
export const money = n => "₱" + Number(n || 0).toLocaleString("en-PH");
export function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
export function write(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
