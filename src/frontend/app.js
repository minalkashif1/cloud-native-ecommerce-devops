// ShopCloud Microservices Simulation Engine (app.js)

// Seed Default Databases
const DEFAULT_PRODUCTS = [
    { id: "prod-1", name: "Cloud Container Engine", desc: "Fully managed Kubernetes cluster with auto-scaling capabilities.", price: 99, inventory: 15, category: "Cloud Services", icon: "📦" },
    { id: "prod-2", name: "DevOps CI/CD Automator", desc: "Automated Jenkins and GitHub Actions deployment pipeline agent.", price: 49, inventory: 8, category: "DevOps Tools", icon: "🚀" },
    { id: "prod-3", name: "Load Balancer Pro", desc: "High-performance HTTP(S) load balancer with TLS termination.", price: 29, inventory: 40, category: "Cloud Services", icon: "⚖️" },
    { id: "prod-4", name: "RabbitMQ Managed Broker", desc: "Reliable, high-throughput message queue cluster.", price: 59, inventory: 5, category: "Messaging", icon: "🐇" },
    { id: "prod-5", name: "JWT Shield Security Service", desc: "Distributed OAuth2/OIDC token provider and authentication proxy.", price: 19, inventory: 100, category: "Security", icon: "🛡️" }
];

function initDB() {
    if (!localStorage.getItem("sc_users")) {
        localStorage.setItem("sc_users", JSON.stringify([]));
    }
    if (!localStorage.getItem("sc_products")) {
        localStorage.setItem("sc_products", JSON.stringify(DEFAULT_PRODUCTS));
    }
    if (!localStorage.getItem("sc_orders")) {
        localStorage.setItem("sc_orders", JSON.stringify([]));
    }
    if (!localStorage.getItem("sc_notifications")) {
        localStorage.setItem("sc_notifications", JSON.stringify([]));
    }
    if (!localStorage.getItem("sc_cart")) {
        localStorage.setItem("sc_cart", JSON.stringify([]));
    }
}

initDB();

// --- STATE GETTERS & SETTERS ---
const getDB = (key) => JSON.parse(localStorage.getItem(key)) || [];
const setDB = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// --- USER SERVICE (Auth & Session) ---
const UserService = {
    register: (name, email, password) => {
        const users = getDB("sc_users");
        if (users.some(u => u.email === email)) {
            return { success: false, message: "User with this email already exists." };
        }
        
        const newUser = {
            id: 'user_' + Math.random().toString(36).substr(2, 9),
            name,
            email,
            password, // Stored in plain text for demo simulation simplicity
            role: "customer",
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        setDB("sc_users", users);
        
        // Trigger RabbitMQ/Notification event
        NotificationService.sendMQMessage("user.created", { userId: newUser.id, email: newUser.email, name: newUser.name });
        
        return { success: true, message: "Registration successful! You can now log in." };
    },
    
    login: (email, password) => {
        const users = getDB("sc_users");
        const user = users.find(u => u.email === email && u.password === password);
        
        if (!user) {
            return { success: false, message: "Invalid email or password." };
        }
        
        // Generate Mock JWT Token
        const header = { alg: "HS256", typ: "JWT" };
        const payload = {
            sub: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600 // Valid for 1 hr
        };
        
        const token = UserService.createMockJWT(header, payload);
        
        localStorage.setItem("sc_session_user", JSON.stringify(user));
        localStorage.setItem("sc_session_token", token);
        
        // Notification service alert
        NotificationService.pushLocalToast("Welcome back!", `Logged in as ${user.name}`, "success");
        
        return { success: true, user, token };
    },
    
    logout: () => {
        localStorage.removeItem("sc_session_user");
        localStorage.removeItem("sc_session_token");
        NotificationService.pushLocalToast("Logged Out", "You have been securely logged out.", "info");
        setTimeout(() => window.location.href = "index.html", 800);
    },
    
    getCurrentUser: () => JSON.parse(localStorage.getItem("sc_session_user")) || null,
    getToken: () => localStorage.getItem("sc_session_token") || null,
    
    createMockJWT: (header, payload) => {
        const b64Url = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
        const encodedHeader = b64Url(header);
        const encodedPayload = b64Url(payload);
        const dummySignature = "mock_signature_of_shopcloud_microservices_platform_jwt_token_auth";
        const encodedSignature = btoa(dummySignature).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
        return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
    },
    
    decodeMockJWT: (token) => {
        if (!token) return null;
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            const b64Decode = (str) => {
                let padding = str.replace(/-/g, "+").replace(/_/g, "/");
                while (padding.length % 4) padding += '=';
                return JSON.parse(atob(padding));
            };
            
            return {
                header: b64Decode(parts[0]),
                payload: b64Decode(parts[1]),
                signature: atob(parts[2].replace(/-/g, "+").replace(/_/g, "/"))
            };
        } catch (e) {
            console.error("JWT decoding failed", e);
            return null;
        }
    }
};

// --- PRODUCT SERVICE (Catalog & CRUD) ---
const ProductService = {
    getAll: () => getDB("sc_products"),
    
    getById: (id) => getDB("sc_products").find(p => p.id === id),
    
    save: (productData) => {
        const products = getDB("sc_products");
        if (productData.id) {
            // Edit
            const index = products.findIndex(p => p.id === productData.id);
            if (index !== -1) {
                products[index] = { ...products[index], ...productData };
                setDB("sc_products", products);
                return { success: true, message: "Product updated successfully!" };
            }
            return { success: false, message: "Product not found." };
        } else {
            // Create
            const newProduct = {
                id: 'prod_' + Math.random().toString(36).substr(2, 9),
                ...productData,
                price: Number(productData.price),
                inventory: Number(productData.inventory)
            };
            products.push(newProduct);
            setDB("sc_products", products);
            return { success: true, message: "Product added successfully!" };
        }
    },
    
    delete: (id) => {
        const products = getDB("sc_products");
        const filtered = products.filter(p => p.id !== id);
        if (filtered.length === products.length) {
            return { success: false, message: "Product not found." };
        }
        setDB("sc_products", filtered);
        return { success: true, message: "Product deleted successfully." };
    },
    
    updateInventory: (id, quantityDiff) => {
        const products = getDB("sc_products");
        const index = products.findIndex(p => p.id === id);
        if (index !== -1) {
            const updatedStock = products[index].inventory + quantityDiff;
            if (updatedStock < 0) return { success: false, message: "Insufficient inventory." };
            products[index].inventory = updatedStock;
            setDB("sc_products", products);
            return { success: true, newStock: updatedStock };
        }
        return { success: false, message: "Product not found." };
    }
};

// --- SHOPPING CART ---
const CartService = {
    get: () => getDB("sc_cart"),
    
    add: (productId) => {
        const cart = getDB("sc_cart");
        const product = ProductService.getById(productId);
        if (!product || product.inventory <= 0) {
            NotificationService.pushLocalToast("Out of Stock", "Sorry, this item is out of stock.", "warning");
            return;
        }
        
        const cartIndex = cart.findIndex(item => item.id === productId);
        if (cartIndex !== -1) {
            if (cart[cartIndex].quantity >= product.inventory) {
                NotificationService.pushLocalToast("Max Reached", "No more items in stock.", "warning");
                return;
            }
            cart[cartIndex].quantity += 1;
        } else {
            cart.push({ id: productId, quantity: 1, name: product.name, price: product.price, icon: product.icon });
        }
        setDB("sc_cart", cart);
        NotificationService.pushLocalToast("Cart Updated", `${product.name} added to cart.`, "success");
        // Dispatch custom event to refresh nav UI if any
        window.dispatchEvent(new Event("cartUpdated"));
    },
    
    remove: (productId) => {
        let cart = getDB("sc_cart");
        cart = cart.filter(item => item.id !== productId);
        setDB("sc_cart", cart);
        NotificationService.pushLocalToast("Item Removed", "Product removed from cart.", "info");
        window.dispatchEvent(new Event("cartUpdated"));
    },
    
    changeQty: (productId, delta) => {
        const cart = getDB("sc_cart");
        const item = cart.find(i => i.id === productId);
        if (!item) return;
        
        const product = ProductService.getById(productId);
        const newQty = item.quantity + delta;
        
        if (newQty <= 0) {
            CartService.remove(productId);
            return;
        }
        
        if (newQty > product.inventory) {
            NotificationService.pushLocalToast("Max Reached", "No more items in stock.", "warning");
            return;
        }
        
        item.quantity = newQty;
        setDB("sc_cart", cart);
        window.dispatchEvent(new Event("cartUpdated"));
    },
    
    clear: () => {
        setDB("sc_cart", []);
        window.dispatchEvent(new Event("cartUpdated"));
    },
    
    getTotal: () => {
        return getDB("sc_cart").reduce((total, item) => total + (item.price * item.quantity), 0);
    }
};

// --- ORDER SERVICE & SAGA PATTERN ---
const OrderService = {
    getAll: () => getDB("sc_orders"),
    
    processCheckout: async (onStepProgress) => {
        const cart = CartService.get();
        const user = UserService.getCurrentUser();
        const token = UserService.getToken();
        
        if (cart.length === 0) {
            return { success: false, message: "Cart is empty." };
        }
        
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        try {
            // STEP 1: Verify Session & JWT Auth
            onStepProgress("auth", "active", "Verifying JWT credentials with User Service...");
            await delay(1200);
            
            if (!user || !token) {
                onStepProgress("auth", "failed", "Unauthorized: Valid JWT session not found.");
                return { success: false, errorStep: "auth", message: "Checkout failed: Please login first." };
            }
            
            const decoded = UserService.decodeMockJWT(token);
            if (!decoded || decoded.payload.email !== user.email) {
                onStepProgress("auth", "failed", "Unauthorized: JWT verification signature failed.");
                return { success: false, errorStep: "auth", message: "Checkout failed: Authentication expired." };
            }
            onStepProgress("auth", "completed", "Token successfully verified (JWT Decoded OK).");
            
            // STEP 2: Check Inventory
            onStepProgress("inventory", "active", "Querying Product Service for inventory availability...");
            await delay(1200);
            
            for (const item of cart) {
                const prod = ProductService.getById(item.id);
                if (!prod || prod.inventory < item.quantity) {
                    onStepProgress("inventory", "failed", `Insufficient stock for product: ${item.name}`);
                    return { success: false, errorStep: "inventory", message: `Checkout failed: ${item.name} is out of stock.` };
                }
            }
            onStepProgress("inventory", "completed", "Inventory verification success (All items in stock).");
            
            // STEP 3: Process Payment (Simulate Gateway Transaction)
            onStepProgress("payment", "active", "Forwarding transaction payload to Payment Service...");
            await delay(1500);
            
            // Simulate 95% payment success rate
            const paymentSuccess = Math.random() < 0.95;
            if (!paymentSuccess) {
                onStepProgress("payment", "failed", "Transaction declined by Payment processor (Insufficient funds simulation).");
                return { success: false, errorStep: "payment", message: "Checkout failed: Payment declined." };
            }
            onStepProgress("payment", "completed", "Payment captured successfully.");
            
            // STEP 4: Persist Order Database
            onStepProgress("order", "active", "Registering transaction log in Order Service database...");
            await delay(1200);
            
            // Deduct Stock
            for (const item of cart) {
                ProductService.updateInventory(item.id, -item.quantity);
            }
            
            const orders = getDB("sc_orders");
            const newOrder = {
                id: 'ord_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                userId: user.id,
                userName: user.name,
                userEmail: user.email,
                items: cart,
                total: CartService.getTotal(),
                status: "Paid",
                createdAt: new Date().toISOString()
            };
            
            orders.push(newOrder);
            setDB("sc_orders", orders);
            onStepProgress("order", "completed", `Order ${newOrder.id} persisted in DB.`);
            
            // STEP 5: Trigger Notification
            onStepProgress("notification", "active", "Publishing order.placed event to RabbitMQ message exchange...");
            await delay(1200);
            
            // Trigger rabbitmq event
            NotificationService.sendMQMessage("order.placed", {
                orderId: newOrder.id,
                userEmail: newOrder.userEmail,
                userName: newOrder.userName,
                total: newOrder.total,
                itemsCount: newOrder.items.length
            });
            
            onStepProgress("notification", "completed", "Event dispatched to queue. Broker confirmed.");
            
            // Clear cart
            CartService.clear();
            
            return { success: true, order: newOrder };
            
        } catch (e) {
            console.error("Saga transaction interrupted", e);
            return { success: false, message: "Checkout interrupted due to network error simulation." };
        }
    },
    
    advanceOrderStatus: (orderId) => {
        const orders = getDB("sc_orders");
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
            const currentStatus = orders[idx].status;
            let nextStatus = currentStatus;
            
            if (currentStatus === "Paid") nextStatus = "Processing";
            else if (currentStatus === "Processing") nextStatus = "Shipped";
            else if (currentStatus === "Shipped") nextStatus = "Delivered";
            
            if (nextStatus !== currentStatus) {
                orders[idx].status = nextStatus;
                setDB("sc_orders", orders);
                
                NotificationService.sendMQMessage("order.status_updated", {
                    orderId: orderId,
                    userEmail: orders[idx].userEmail,
                    status: nextStatus
                });
                
                NotificationService.pushLocalToast("Order Updated", `Order ${orderId} status changed to ${nextStatus}`, "info");
                return true;
            }
        }
        return false;
    }
};

// --- NOTIFICATION SERVICE & MQ DASHBOARD ---
const NotificationService = {
    getAll: () => getDB("sc_notifications"),
    
    pushLocalToast: (title, message, type = "info") => {
        const container = document.getElementById("toast-container") || createToastContainer();
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let icon = "🔔";
        if (type === "success") icon = "✅";
        else if (type === "warning") icon = "⚠️";
        else if (type === "error") icon = "❌";
        
        toast.innerHTML = `
            <div style="font-size: 1.25rem;">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Remove toast after 4s
        setTimeout(() => {
            toast.style.animation = "toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards";
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    
    sendMQMessage: (routingKey, payload) => {
        // 1. Log notification in DB
        const notifications = getDB("sc_notifications");
        let title = "System Notification";
        let body = "";
        let targetQueue = "default-queue";
        
        if (routingKey === "user.created") {
            title = "👤 New User Registered";
            body = `Account created for ${payload.name} (${payload.email}). Welcome email sent.`;
            targetQueue = "user-queue";
        } else if (routingKey === "order.placed") {
            title = "🧾 Order Confirmation";
            body = `Order ${payload.orderId} received from ${payload.userName}. Total: $${payload.total}. Confirmation mail queued.`;
            targetQueue = "order-queue";
        } else if (routingKey === "order.status_updated") {
            title = "🚚 Shipping Update";
            body = `Order ${payload.orderId} status changed to ${payload.status}. notification dispatched.`;
            targetQueue = "order-queue";
        }
        
        const newNotif = {
            id: 'notif_' + Math.random().toString(36).substr(2, 9),
            title,
            body,
            routingKey,
            queue: targetQueue,
            timestamp: new Date().toISOString(),
            status: "delivered"
        };
        
        notifications.unshift(newNotif);
        setDB("sc_notifications", notifications);
        
        // Push in-app alert/toast
        NotificationService.pushLocalToast(title, body, "success");
        
        // 2. Trigger Animated RabbitMQ Flow UI if page is loaded
        NotificationService.animateRabbitMQ(routingKey, targetQueue, payload);
    },
    
    animateRabbitMQ: (routingKey, queueName, payload) => {
        // Find diagram container on screen
        const diagram = document.getElementById("mq-diagram");
        if (!diagram) return; // Not on notifications page
        
        // Activate Producers and Exchange
        const producerNode = document.getElementById("mq-producer");
        const exchangeNode = document.getElementById("mq-exchange");
        const queueNode = document.getElementById(`mq-q-${queueName === 'user-queue' ? 'user' : 'order'}`);
        const consumerNode = document.getElementById(`mq-c-${queueName === 'user-queue' ? 'user' : 'order'}`);
        
        if (!producerNode || !exchangeNode || !queueNode || !consumerNode) return;
        
        // Phase 1: Create bubble moving from Producer to Exchange
        producerNode.classList.add("active");
        
        const bubble = document.createElement("div");
        bubble.className = "mq-message-bubble flow-to-exchange";
        diagram.appendChild(bubble);
        
        setTimeout(() => {
            // Exchange receives it
            producerNode.classList.remove("active");
            exchangeNode.classList.add("active");
            
            // Phase 2: Bubble moves from Exchange to Queue
            bubble.className = `mq-message-bubble ${queueName === 'user-queue' ? 'flow-to-queue-user' : 'flow-to-queue-order'}`;
            
            setTimeout(() => {
                // Queue receives it
                exchangeNode.classList.remove("active");
                queueNode.classList.add("active");
                
                // Add message count badge or increment queue count in UI
                const countBadge = queueNode.querySelector(".badge");
                if (countBadge) {
                    const currentCount = parseInt(countBadge.textContent) || 0;
                    countBadge.textContent = currentCount + 1;
                    countBadge.className = "badge badge-amber";
                }
                
                // Phase 3: Consumer consumes from Queue
                setTimeout(() => {
                    bubble.className = `mq-message-bubble ${queueName === 'user-queue' ? 'flow-to-consumer-user' : 'flow-to-consumer-order'}`;
                    
                    setTimeout(() => {
                        // Consumer processes it
                        queueNode.classList.remove("active");
                        consumerNode.classList.add("active");
                        
                        const countBadge = queueNode.querySelector(".badge");
                        if (countBadge) {
                            const currentCount = parseInt(countBadge.textContent) || 0;
                            if (currentCount > 0) countBadge.textContent = currentCount - 1;
                            if (parseInt(countBadge.textContent) === 0) {
                                countBadge.className = "badge badge-green";
                                countBadge.textContent = "Idle";
                            }
                        }
                        
                        // Clean up
                        bubble.remove();
                        
                        // Append actual message to list if on screen
                        renderNotificationLogs();
                        
                        setTimeout(() => {
                            consumerNode.classList.remove("active");
                        }, 1000);
                        
                    }, 1200);
                }, 1000);
                
            }, 1500);
        }, 1200);
    }
};

function createToastContainer() {
    const container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
    return container;
}

// Global Nav setup
function updateNavProfile() {
    const navUl = document.querySelector("nav ul");
    if (!navUl) return;
    
    // Check if session exists
    const user = UserService.getCurrentUser();
    
    // Find or create profile element
    let profileLi = document.getElementById("nav-profile-item");
    if (user) {
        if (!profileLi) {
            profileLi = document.createElement("li");
            profileLi.id = "nav-profile-item";
            navUl.appendChild(profileLi);
        }
        
        const firstLetter = user.name ? user.name.charAt(0).toUpperCase() : "U";
        profileLi.innerHTML = `
            <div class="user-nav-profile">
                <div class="user-nav-avatar">${firstLetter}</div>
                <span style="color: var(--text-primary); font-weight: 500;">${user.name.split(" ")[0]}</span>
                <button onclick="UserService.logout()" class="btn btn-secondary btn-small" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Logout</button>
            </div>
        `;
        
        // Change login link text to Profile and point to user.html
        const loginLink = Array.from(document.querySelectorAll("nav ul li a")).find(a => a.href.includes("user.html"));
        if (loginLink) {
            loginLink.textContent = "Profile";
        }
    } else {
        if (profileLi) profileLi.remove();
        const loginLink = Array.from(document.querySelectorAll("nav ul li a")).find(a => a.href.includes("user.html"));
        if (loginLink) {
            loginLink.textContent = "Login";
        }
    }
}

// Set Active Link in Header
function setActiveNavLink() {
    const path = window.location.pathname;
    const page = path.split("/").pop();
    
    const links = document.querySelectorAll("nav ul li a");
    links.forEach(link => {
        const linkPage = link.getAttribute("href");
        if (page === linkPage || (page === "" && linkPage === "index.html")) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    updateNavProfile();
    setActiveNavLink();
});
