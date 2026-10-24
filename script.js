const AUTH_KEY = "clothcare-token";
const USER_KEY = "clothcare-user";

const token = () => localStorage.getItem(AUTH_KEY);
const currentUser = () => JSON.parse(localStorage.getItem(USER_KEY) || "null");

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("match")) return "approved";
    if (normalized.includes("complete")) return "completed";
    return "pending";
}

async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const currentToken = token();
    if (currentToken && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${currentToken}`);
    }
    if (!(options.body instanceof FormData) && !headers.has("Content-Type") && options.body) {
        headers.set("Content-Type", "application/json");
    }

    const query = new URLSearchParams();
    if (currentToken && !path.includes("register") && !path.includes("login")) {
        query.set("token", currentToken);
    }
    const url = `${path}${query.toString() ? `${path.includes("?") ? "&" : "?"}${query.toString()}` : ""}`;

    let response;
    try {
        response = await fetch(url, { ...options, headers, body: options.body ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined });
    } catch (networkError) {
        throw new Error("Unable to reach the server. Please check your connection and try again.");
    }

    // Guard: only parse JSON when the server actually sent JSON.
    // Any other content-type (e.g. HTML from a 404 page or a proxy error)
    // must NOT be passed to JSON.parse — that is the source of the
    // "Unexpected token '<'" error reported by users.
    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.includes("application/json")) {
        // Non-JSON body — the API route is unreachable or misconfigured.
        if (!response.ok) {
            throw new Error(
                `Server error (HTTP ${response.status}). The API is unavailable — ` +
                "make sure the backend is running or the deployment is configured correctly."
            );
        }
        // Unexpected success with a non-JSON body (shouldn't happen in normal operation).
        return {};
    }

    const text = await response.text();
    let payload = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch (_) {
        throw new Error("The server returned an unexpected response. Please try again later.");
    }

    if (!response.ok) {
        throw new Error(payload.error || "Something went wrong. Please try again.");
    }
    return payload;
}

function logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "login.html";
}

const registerForm = document.querySelector(".register-form");
if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const password = document.querySelector("#register-password").value;
        const confirm = document.querySelector("#confirm-password").value;
        if (password !== confirm) {
            return alert("Your passwords do not match yet.");
        }

        const payload = {
            name: document.querySelector("#register-name").value,
            email: document.querySelector("#register-email").value,
            phone: document.querySelector("#register-phone").value,
            password,
        };

        try {
            const response = await apiRequest("/api/register", { method: "POST", body: payload });
            alert(`${response.message} Please log in to continue.`);
            window.location.href = "login.html";
        } catch (error) {
            alert(error.message);
        }
    });
}

const loginForm = document.querySelector(".login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.querySelector("#login-email").value.trim();
        const password = document.querySelector("#login-password").value;

        try {
            const response = await apiRequest("/api/login", { method: "POST", body: { email, password } });
            localStorage.setItem(AUTH_KEY, response.token);
            localStorage.setItem(USER_KEY, JSON.stringify(response.user));
            const redirect = response.user.email === "admin@clothcare.org" ? "admin.html" : "donations.html";
            alert(response.message);
            window.location.href = redirect;
        } catch (error) {
            alert(error.message);
        }
    });
}

const donationForm = document.querySelector(".donation-form");
if (donationForm) {
    donationForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const checkedMethod = document.querySelector('input[name="method"]:checked');
        const notesField = document.querySelector("#description") || document.querySelector("#notes");
        const addressField = document.querySelector("#address");

        const payload = {
            donorName: document.querySelector("#name")?.value || "",
            email: document.querySelector("#email")?.value || "",
            phone: document.querySelector("#phone")?.value || "",
            type: document.querySelector("#clothing-type")?.value || "",
            quantity: Number(document.querySelector("#quantity")?.value || 0),
            condition: document.querySelector("#condition")?.value || "",
            method: checkedMethod ? (checkedMethod.value === "pickup" ? "Pickup" : "Drop-off") : "Pickup",
            notes: [notesField?.value || "", addressField?.value ? `Location: ${addressField.value}` : ""].filter(Boolean).join(" | "),
        };

        if (!payload.type || !payload.quantity || !payload.condition || !payload.donorName || !payload.email || !payload.phone) {
            return alert("Please complete all required donation fields.");
        }

        try {
            await apiRequest("/api/donations", { method: "POST", body: payload });
            alert("Your donation is on the way. Thank you for passing it on.");
            window.location.href = "donations.html";
        } catch (error) {
            alert(error.message);
        }
    });
}

const donationList = document.querySelector(".donation-list");
if (donationList) {
    const totalPieces = document.querySelector("#total-pieces");
    const totalDonations = document.querySelector("#total-donations");

    async function loadDonations() {
        try {
            const response = await apiRequest("/api/donations");
            const items = response.donations || [];
            const total = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            if (totalPieces) totalPieces.textContent = String(total || 0);
            if (totalDonations) totalDonations.textContent = String(items.length || 0);

            donationList.innerHTML = "<h2>Recent activity</h2>";
            if (!items.length) {
                donationList.innerHTML += '<div class="empty-state">No donations yet. Start your first donation today.</div>';
                return;
            }

            items.slice(0, 6).forEach((item) => {
                const card = document.createElement("div");
                card.className = "donation-card";
                card.innerHTML = `
                    <div class="donation-info">
                        <span class="donation-id">#${item.id}</span>
                        <h3>${item.type}</h3>
                        <p>${item.quantity} pieces &middot; ${formatDate(item.date)}</p>
                    </div>
                    <span class="donation-status ${statusClass(item.status)}">${item.status}</span>
                `;
                donationList.appendChild(card);
            });
        } catch (error) {
            donationList.innerHTML = `<h2>Recent activity</h2><div class="empty-state">${error.message}</div>`;
        }
    }

    loadDonations();
}

const logoutButton = document.querySelector(".logout-btn");
if (logoutButton) {
    logoutButton.addEventListener("click", logout);
}

const adminPanel = document.querySelector("#admin-panel");
const adminLoginCard = document.querySelector("#admin-login-card");

if (adminPanel || adminLoginCard) {
    async function loadAdminDashboard() {
        const currentTokenValue = token();
        if (!currentTokenValue) {
            if (adminLoginCard) adminLoginCard.classList.remove("hidden");
            if (adminPanel) adminPanel.classList.add("hidden");
            return;
        }

        try {
            const response = await apiRequest("/api/admin");
            if (adminLoginCard) adminLoginCard.classList.add("hidden");
            if (adminPanel) adminPanel.classList.remove("hidden");

            const totalPieces = document.querySelector("#admin-total-pieces");
            const pending = document.querySelector("#admin-pending");
            const matched = document.querySelector("#admin-matched");
            const partners = document.querySelector("#admin-partners");
            if (totalPieces) totalPieces.textContent = response.stats.totalPieces;
            if (pending) pending.textContent = response.stats.pending;
            if (matched) matched.textContent = response.stats.matched;
            if (partners) partners.textContent = response.stats.partners;

            const tableBody = document.querySelector("#admin-table-body");
            if (tableBody) {
                tableBody.innerHTML = "";
                if (!response.donations.length) {
                    tableBody.innerHTML = '<tr><td colspan="6">No donations yet.</td></tr>';
                    return;
                }

                response.donations.forEach((item) => {
                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td>#${item.id}</td>
                        <td>${item.donorName}</td>
                        <td>${item.type}</td>
                        <td>${item.quantity}</td>
                        <td><span class="table-status ${statusClass(item.status)}">${item.status}</span></td>
                        <td>
                            <div class="table-actions">
                                <button class="status-btn" data-id="${item.id}" data-status="Matched" type="button">Match</button>
                                <button class="status-btn" data-id="${item.id}" data-status="Completed" type="button">Complete</button>
                            </div>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });

                document.querySelectorAll(".status-btn").forEach((button) => {
                    button.addEventListener("click", async () => {
                        const id = button.dataset.id;
                        const status = button.dataset.status;
                        try {
                            await apiRequest("/api/admin", {
                                method: "PUT",
                                body: { donationId: id, status },
                            });
                            alert(`Donation ${id} marked as ${status}.`);
                            loadAdminDashboard();
                        } catch (error) {
                            alert(error.message);
                        }
                    });
                });
            }
        } catch (error) {
            if (adminLoginCard) adminLoginCard.classList.remove("hidden");
            if (adminPanel) adminPanel.classList.add("hidden");
            alert(error.message);
        }
    }

    const adminLoginForm = document.querySelector(".admin-login-form");
    if (adminLoginForm) {
        adminLoginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const email = document.querySelector("#admin-email").value.trim();
            const password = document.querySelector("#admin-password").value;
            try {
                const response = await apiRequest("/api/login", { method: "POST", body: { email, password } });
                localStorage.setItem(AUTH_KEY, response.token);
                localStorage.setItem(USER_KEY, JSON.stringify(response.user));
                loadAdminDashboard();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    document.querySelector(".logout-btn")?.addEventListener("click", logout);
    loadAdminDashboard();
}
