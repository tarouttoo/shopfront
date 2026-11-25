
/* Shared cart, order & card payment for Alter Energo */
(function (window) {
  const WEB3FORMS_KEY = "WEB3FORMS-KEY-STRIPPED";
  const WEB3FORMS_URL = "https://api.web3forms.com/submit";
  const CART_KEY = "ae_cart";
  const CART_OPEN_KEY = "ae_cart_reopen";

  const PAYMENT_CONFIG = {
    yoomoneyReceiver: "",
    paymentUrl: "",
    targetPrefix: "Заказ Альтер Энерго"
  };

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("ae-cart-changed", { detail: cart }));
  }

  function formatPrice(value) {
    if (value == null || value === "" || String(value).toLowerCase() === "по запросу") return "По запросу";
    const num = Number(String(value).replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(num)) return num.toLocaleString("ru-RU") + " ₽";
    return String(value);
  }
  function priceNumber(value) {
    const num = Number(String(value || "").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(num) ? num : null;
  }
  function isValidEmail(value) {
    const v = String(value || '').trim();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }
  function isValidPhone(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    // запрет букв и лишних символов, кроме + ( ) - пробел
    if (/[^\d\s\+\-\(\)]/.test(raw)) return false;
    // не больше одного плюса и только в начале
    if ((raw.match(/\+/g) || []).length > 1) return false;
    if (raw.includes('+') && raw.trim()[0] !== '+') return false;

    const digits = raw.replace(/\D/g, '');
    // РФ: 11 цифр, начинается с 7 или 8
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
      // вторая цифра кода оператора/города не 0/1/2 в типичных мобильных — не режем жёстко
      return true;
    }
    // 10 цифр без кода страны (9XXXXXXXXX)
    if (digits.length === 10 && digits[0] === '9') return true;
    return false;
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function cartTotals(cart) {
    let total = 0;
    let hasRequest = false;
    cart.forEach(i => {
      const n = priceNumber(i.price);
      if (n == null) hasRequest = true;
      else total += n * (i.qty || 1);
    });
    return { total, hasRequest };
  }

  function addToCart(product) {
    const cart = loadCart();
    const existing = cart.find(i => String(i.id) === String(product.id));
    if (existing) existing.qty += 1;
    else cart.push({
      id: product.id,
      name: product.name || product.model || product.series || "Товар",
      price: product.price || "по запросу",
      sku: product.sku || "",
      qty: 1
    });
    saveCart(cart);
    return cart;
  }

  function removeFromCart(id) {
    const cart = loadCart().filter(i => String(i.id) !== String(id));
    saveCart(cart);
    return cart;
  }

  async function sendViaWeb3Forms(fields) {
    const messageParts = [];
    if (fields.clientType) messageParts.push("Тип клиента: " + fields.clientType);
    if (fields.company) messageParts.push("Компания: " + fields.company);
    if (fields.inn) messageParts.push("ИНН: " + fields.inn);
    if (fields.payment) messageParts.push("Оплата: " + fields.payment);
    if (fields.comment) messageParts.push("Комментарий: " + fields.comment);
    if (fields.items) messageParts.push("Состав заказа:\n" + fields.items);
    if (fields.message) messageParts.push(fields.message);
    if (fields.service) messageParts.push("Услуга: " + fields.service);

    const payload = {
      access_key: WEB3FORMS_KEY,
      subject: fields.subject || fields._subject || "Заявка с сайта Альтер Энерго",
      from_name: "Сайт Альтер Энерго",
      name: fields.name || "",
      phone: fields.phone || "",
      email: fields.email || "Не указан",
      message: messageParts.filter(Boolean).join("\n") || "Без сообщения",
      agreement: "Да"
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(WEB3FORMS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || ("HTTP " + res.status));
    return data;
  }

  function startCardPayment(amount, orderLabel) {
    if (PAYMENT_CONFIG.paymentUrl) {
      window.open(PAYMENT_CONFIG.paymentUrl, "_blank");
      return { ok: true, mode: "link" };
    }
    if (PAYMENT_CONFIG.yoomoneyReceiver && amount > 0) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://yoomoney.ru/quickpay/confirm";
      form.target = "_blank";
      form.style.display = "none";
      const fields = {
        receiver: PAYMENT_CONFIG.yoomoneyReceiver,
        "quickpay-form": "shop",
        targets: (PAYMENT_CONFIG.targetPrefix || "Заказ") + (orderLabel ? (" — " + orderLabel) : ""),
        paymentType: "AC",
        sum: String(amount)
      };
      Object.keys(fields).forEach(key => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = fields[key];
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      setTimeout(() => form.remove(), 1000);
      return { ok: true, mode: "yoomoney" };
    }
    return { ok: false, mode: "none" };
  }

  function openPrivacyModal() {
    let modal = document.getElementById("ae-privacy-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "ae-privacy-modal";
      modal.innerHTML = `
        <div class="ae-privacy-backdrop" data-close="1"></div>
        <div class="ae-privacy-sheet" role="dialog" aria-modal="true" aria-label="Политика конфиденциальности">
          <div class="ae-privacy-head">
            <strong>Политика конфиденциальности</strong>
            <button type="button" class="ae-privacy-x" data-close="1" aria-label="Закрыть">×</button>
          </div>
          <div class="ae-privacy-body">
            <p>Нажимая «Согласен», вы даёте согласие ООО ИТЦ «Альтер Энерго» на обработку персональных данных (ФИО, телефон, email, реквизиты компании), указанных в заявке, в целях связи с вами и исполнения заказа.</p>
            <p>Данные не передаются третьим лицам, за исключением случаев, предусмотренных законом, и используются только для обработки обращения.</p>
            <p>Вы можете отозвать согласие, направив запрос на <a href="mailto:ae38@list.ru">ae38@list.ru</a>.</p>
            <p><a href="privacy.html" id="ae-privacy-full">Открыть полную политику на отдельной странице</a></p>
          </div>
          <div class="ae-privacy-foot">
            <button type="button" class="ae-btn ae-btn-primary" data-close="1">Вернуться к оформлению</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => {
        if (e.target && e.target.getAttribute("data-close")) closePrivacyModal();
      });
      const full = modal.querySelector("#ae-privacy-full");
      if (full) {
        full.addEventListener("click", (e) => {
          e.preventDefault();
          try { sessionStorage.setItem(CART_OPEN_KEY, "1"); } catch (err) {}
          window.location.href = "privacy.html?from=cart";
        });
      }
    }
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closePrivacyModal() {
    const modal = document.getElementById("ae-privacy-modal");
    if (modal) modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  function ensureCartDom() {
    if (document.getElementById("cartDrawer")) return;
    const style = document.createElement("style");
    style.textContent = `
      .ae-cart-drawer{position:fixed;top:0;right:-420px;width:400px;max-width:100%;height:100vh;background:#fff;box-shadow:-8px 0 30px rgba(0,0,0,.12);z-index:200;transition:right .3s;display:flex;flex-direction:column}
      .ae-cart-drawer.open{right:0}
      .ae-cart-header{padding:18px 20px;border-bottom:1px solid #e8ecf1;display:flex;justify-content:space-between;align-items:center}
      .ae-cart-header h2{font-size:1.2rem;margin:0}
      .ae-cart-close{background:none;border:none;font-size:22px;cursor:pointer;color:#5a5a7a}
      .ae-cart-items{flex:1;overflow:auto;padding:16px 20px}
      .ae-cart-item{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #e8ecf1}
      .ae-cart-item h4{font-size:.95rem;margin:0 0 4px}
      .ae-cart-item .meta{font-size:.85rem;color:#5a5a7a}
      .ae-cart-footer{padding:16px 18px;border-top:1px solid #e8ecf1;max-height:70vh;overflow-x:hidden;overflow-y:auto}
      .ae-cart-total{display:flex;justify-content:space-between;font-weight:700;margin-bottom:12px}
      .ae-cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:150;opacity:0;visibility:hidden;transition:all .3s}
      .ae-cart-overlay.open{opacity:1;visibility:visible}
      .ae-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 14px;border-radius:10px;font-weight:600;font-size:14px;border:none;cursor:pointer}
      .ae-btn-primary{background:#0d47a1;color:#fff;width:100%}
      .ae-btn-outline{background:transparent;border:1px solid #0d47a1;color:#0d47a1}
      .ae-order-panel input,.ae-order-panel textarea,.ae-order-panel select{width:100%;margin-bottom:8px;padding:10px 12px;border:1px solid #d0d5dd;border-radius:8px;font:inherit;box-sizing:border-box}
      .ae-order-panel textarea{min-height:64px;resize:vertical}
      .ae-order-panel a{color:#0d47a1;text-decoration:underline;white-space:normal}
      .ae-agree{display:flex;gap:10px;align-items:flex-start;font-size:.82rem;color:#5a5a7a;margin:0 0 12px 0;line-height:1.45;width:100%;box-sizing:border-box}
      .ae-agree input[type="checkbox"]{margin:2px 0 0 0;flex:0 0 18px;width:18px;height:18px;accent-color:#0d47a1}
      .ae-agree span{flex:1 1 auto;min-width:0;white-space:normal;word-break:normal;overflow-wrap:anywhere}
      .ae-agree a{color:#0d47a1;text-decoration:underline;white-space:normal}
      .ae-type{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
      .ae-type label{display:flex;align-items:center;gap:8px;border:1px solid #d0d5dd;border-radius:10px;padding:10px 12px;cursor:pointer;font-size:.88rem;font-weight:600;color:#1a1a2e}
      .ae-type input{margin:0}
      .ae-type label.active{border-color:#0d47a1;background:#f3f7ff;color:#0d47a1}
      .ae-pay-hint{font-size:.78rem;color:#5a5a7a;line-height:1.35;margin:-4px 0 10px}
      .ae-field-label{font-size:.75rem;font-weight:600;color:#5a5a7a;margin:0 0 4px}
      .scroll-top{position:fixed;right:20px;bottom:24px;z-index:1100;width:46px;height:46px;border-radius:50%;border:none;cursor:pointer;background:#0d47a1;color:#fff;box-shadow:0 6px 18px rgba(13,71,161,.25);display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;transform:translateY(12px);transition:all .25s}
      .scroll-top.show{opacity:1;visibility:visible;transform:translateY(0)}
      .scroll-top:hover{background:#002171}
      #ae-privacy-modal{position:fixed;inset:0;z-index:300;display:none;align-items:center;justify-content:center;padding:16px}
      #ae-privacy-modal.open{display:flex}
      .ae-privacy-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45)}
      .ae-privacy-sheet{position:relative;background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.2)}
      .ae-privacy-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid #e8ecf1}
      .ae-privacy-x{border:none;background:none;font-size:22px;cursor:pointer;color:#5a5a7a}
      .ae-privacy-body{padding:16px 18px;overflow:auto;color:#5a5a7a;font-size:.92rem;line-height:1.55}
      .ae-privacy-body p{margin:0 0 12px}
      .ae-privacy-foot{padding:14px 18px;border-top:1px solid #e8ecf1}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "ae-cart-overlay";
    overlay.id = "cartOverlay";
    const drawer = document.createElement("div");
    drawer.className = "ae-cart-drawer";
    drawer.id = "cartDrawer";
    drawer.innerHTML = `
      <div class="ae-cart-header">
        <h2>Корзина</h2>
        <button class="ae-cart-close" id="closeCart" type="button">×</button>
      </div>
      <div class="ae-cart-items" id="cartItems"></div>
      <div class="ae-cart-footer">
        <div class="ae-cart-total"><span>Итого</span><span id="cartTotal">0 ₽</span></div>
        <button class="ae-btn ae-btn-primary" id="checkoutBtn" type="button">Оформить заказ</button>
      </div>`;
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    let scrollBtn = document.getElementById("scrollTop");
    if (!scrollBtn) {
      scrollBtn = document.createElement("button");
      scrollBtn.type = "button";
      scrollBtn.className = "scroll-top";
      scrollBtn.id = "scrollTop";
      scrollBtn.title = "Наверх";
      scrollBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 14 12 8 18 14"/></svg>';
      document.body.appendChild(scrollBtn);
    }
    if (scrollBtn && !scrollBtn.dataset.aeBound) {
      scrollBtn.dataset.aeBound = "1";
      const syncScrollBtn = () => {
        if (window.scrollY > 300) scrollBtn.classList.add("show");
        else scrollBtn.classList.remove("show");
      };
      window.addEventListener("scroll", syncScrollBtn, { passive: true });
      scrollBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
      syncScrollBtn();
    }

    document.getElementById("closeCart").addEventListener("click", closeCart);
    overlay.addEventListener("click", closeCart);
    document.getElementById("checkoutBtn").addEventListener("click", toggleOrderPanel);
  }

  function openCart() {
    ensureCartDom();
    renderCart();
    document.getElementById("cartDrawer").classList.add("open");
    document.getElementById("cartOverlay").classList.add("open");
  }
  function closeCart() {
    const d = document.getElementById("cartDrawer");
    const o = document.getElementById("cartOverlay");
    if (d) d.classList.remove("open");
    if (o) o.classList.remove("open");
  }

  function renderCart() {
    ensureCartDom();
    const cart = loadCart();
    document.querySelectorAll("#cartCount, .cart-count").forEach(el => {
      el.textContent = cart.reduce((s, i) => s + i.qty, 0);
    });
    const itemsEl = document.getElementById("cartItems");
    const totalEl = document.getElementById("cartTotal");
    if (!itemsEl || !totalEl) return;
    if (!cart.length) {
      itemsEl.innerHTML = '<p style="color:#5a5a7a;">Корзина пуста</p>';
      totalEl.textContent = "0 ₽";
      return;
    }
    const { total, hasRequest } = cartTotals(cart);
    itemsEl.innerHTML = cart.map(i => {
      return `<div class="ae-cart-item"><div><h4>${escapeHtml(i.name)}</h4>
        <div class="meta">${i.sku ? escapeHtml(i.sku) + " · " : ""}${formatPrice(i.price)} · ${i.qty} шт.</div></div>
        <button type="button" class="ae-btn ae-btn-outline" data-remove="${escapeHtml(i.id)}">Удалить</button></div>`;
    }).join("");
    totalEl.textContent = hasRequest && total === 0 ? "По запросу" :
      (total.toLocaleString("ru-RU") + " ₽" + (hasRequest ? " + позиции по запросу" : ""));
    itemsEl.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", () => { removeFromCart(btn.getAttribute("data-remove")); renderCart(); });
    });
  }

  function toggleOrderPanel() {
    const cart = loadCart();
    if (!cart.length) return;
    const footer = document.querySelector(".ae-cart-footer");
    let panel = footer.querySelector(".ae-order-panel");
    if (panel) { panel.remove(); return; }

    const { total, hasRequest } = cartTotals(cart);
    const canCard = total > 0 && !hasRequest;

    panel = document.createElement("div");
    panel.className = "ae-order-panel";
    panel.style.cssText = "margin-top:12px;padding-top:12px;border-top:1px solid #e8ecf1;";
    panel.innerHTML = `
      <div style="font-weight:700;margin-bottom:12px;font-size:.95rem;">Оформление заказа</div>

      <div class="ae-field-label">Тип покупателя</div>
      <div class="ae-type" id="order-type">
        <label class="active"><input type="radio" name="client-type" value="Физлицо" checked> Физлицо</label>
        <label><input type="radio" name="client-type" value="Юрлицо"> Юрлицо</label>
      </div>

      <div class="ae-field-label" id="label-name">ФИО *</div>
      <input id="order-name" placeholder="Иванов Иван Иванович">

      <div id="legal-fields" style="display:none;">
        <div class="ae-field-label">Название организации *</div>
        <input id="order-company" placeholder='ООО «Компания»'>
        <div class="ae-field-label">ИНН</div>
        <input id="order-inn" placeholder="1234567890" inputmode="numeric">
      </div>

      <div class="ae-field-label">Телефон *</div>
      <input id="order-phone" placeholder="+7 900 123-45-67" inputmode="tel" autocomplete="tel">
      <div class="ae-field-label">Email</div>
      <input id="order-email" placeholder="mail@example.com">

      <div class="ae-field-label">Способ оплаты</div>
      <select id="order-pay">
        <option value="Счёт для юрлица (безнал)">Счёт (безнал)</option>
        <option value="Оплата картой">Банковская карта</option>
        <option value="По согласованию с менеджером">По согласованию</option>
      </select>
      <div class="ae-pay-hint" id="order-pay-hint">
        ${canCard
          ? "При оплате картой после заявки откроется безопасная страница оплаты."
          : "Есть позиции «по запросу» — ссылку на оплату картой отправит менеджер после подтверждения суммы."}
      </div>

      <div class="ae-field-label">Комментарий</div>
      <textarea id="order-comment" placeholder="Пожелания к заказу"></textarea>

      <label class="ae-agree" for="order-agree">
        <input id="order-agree" type="checkbox">
        <span>Согласен с <a href="#" id="order-privacy-link">политикой конфиденциальности</a></span>
      </label>

      <button type="button" class="ae-btn ae-btn-primary" id="order-send">Подтвердить заказ</button>
      <div id="order-msg" style="display:none;margin-top:10px;font-size:.88rem;font-weight:600;"></div>`;
    footer.appendChild(panel);

    // type switch
    const typeBox = panel.querySelector("#order-type");
    const legalFields = panel.querySelector("#legal-fields");
    const labelName = panel.querySelector("#label-name");
    const nameInput = panel.querySelector("#order-name");
    typeBox.querySelectorAll("label").forEach(lab => {
      lab.addEventListener("click", () => {
        typeBox.querySelectorAll("label").forEach(l => l.classList.remove("active"));
        lab.classList.add("active");
        const isLegal = lab.querySelector("input").value === "Юрлицо";
        legalFields.style.display = isLegal ? "block" : "none";
        labelName.textContent = isLegal ? "Контактное лицо *" : "ФИО *";
        nameInput.placeholder = isLegal ? "ФИО менеджера" : "Иванов Иван Иванович";
        const pay = panel.querySelector("#order-pay");
        if (isLegal && pay.value === "Оплата картой") {
          /* ok */
        }
      });
    });

    // privacy modal, stay in checkout
    const phoneInput = panel.querySelector("#order-phone");
    if (phoneInput) {
      phoneInput.addEventListener("input", function() {
        // убираем буквы сразу
        this.value = this.value.replace(/[^\d\s\+\-\(\)]/g, "");
      });
    }

    panel.querySelector("#order-privacy-link").addEventListener("click", (e) => {
      e.preventDefault();
      openPrivacyModal();
    });

    const paySelect = panel.querySelector("#order-pay");
    const payHint = panel.querySelector("#order-pay-hint");
    paySelect.addEventListener("change", () => {
      if (paySelect.value === "Оплата картой") {
        payHint.textContent = canCard
          ? "После подтверждения заказа откроется страница оплаты картой."
          : "Сумма не зафиксирована. Заявку примем, менеджер пришлёт ссылку на оплату.";
      } else if (paySelect.value.indexOf("Счёт") === 0) {
        payHint.textContent = "Выставим счёт для безналичной оплаты.";
      } else {
        payHint.textContent = "Менеджер свяжется и согласует оплату.";
      }
    });

    panel.querySelector("#order-send").addEventListener("click", async () => {
      const clientType = (panel.querySelector('input[name="client-type"]:checked') || {}).value || "Физлицо";
      const name = panel.querySelector("#order-name").value.trim();
      const company = (panel.querySelector("#order-company") || {}).value ? panel.querySelector("#order-company").value.trim() : "";
      const inn = (panel.querySelector("#order-inn") || {}).value ? panel.querySelector("#order-inn").value.trim() : "";
      const phone = panel.querySelector("#order-phone").value.trim();
      const email = panel.querySelector("#order-email").value.trim();
      const pay = panel.querySelector("#order-pay").value;
      const comment = panel.querySelector("#order-comment").value.trim();
      const agree = panel.querySelector("#order-agree").checked;
      const msg = panel.querySelector("#order-msg");
      const btn = panel.querySelector("#order-send");
      const errors = [];
      if (!name) errors.push(clientType === "Юрлицо" ? "контактное лицо" : "ФИО");
      if (clientType === "Юрлицо" && !company) errors.push("название организации");
      if (!phone && !email) {
        errors.push("телефон или email");
      } else {
        if (phone && !isValidPhone(phone)) errors.push("корректный телефон (+7… или 8…, 10–11 цифр)");
        if (email && !isValidEmail(email)) errors.push("корректный email");
        if (!phone && email && !isValidEmail(email)) errors.push("корректный email");
        if (!email && phone && !isValidPhone(phone)) errors.push("корректный телефон");
      }
      if (!agree) errors.push("согласие с политикой");
      if (errors.length) {
        msg.style.display = "block"; msg.style.color = "#c62828";
        msg.textContent = "Проверьте: " + errors.join("; ");
        return;
      }
      const itemsText = loadCart().map(i =>
        (i.sku ? i.sku + " — " : "") + i.name + " × " + i.qty + " (" + formatPrice(i.price) + ")"
      ).join("\n");

      btn.disabled = true;
      btn.textContent = "Отправка...";
      msg.style.display = "block";
      msg.style.color = "#5a5a7a";
      msg.textContent = "Отправляем заказ...";

      try {
        await sendViaWeb3Forms({
          subject: "Заказ с сайта Альтер Энерго",
          clientType: clientType,
          name: name,
          company: company || "—",
          inn: inn || "—",
          phone: phone || "—",
          email: email || "Не указан",
          payment: pay,
          comment: comment || "—",
          items: itemsText
        });

        let payNote = "";
        if (pay === "Оплата картой") {
          if (canCard) {
            const started = startCardPayment(total, name);
            payNote = started.ok
              ? " Открыта страница оплаты картой."
              : " Ссылку на оплату пришлёт менеджер.";
          } else {
            payNote = " Ссылку на оплату картой отправит менеджер после подтверждения.";
          }
        }

        msg.style.color = "#2e7d32";
        msg.textContent = "Заявка отправлена менеджеру. Мы свяжемся с вами для подтверждения." + payNote;
        saveCart([]);
        renderCart();
        btn.textContent = "Заявка принята";
      } catch (e) {
        console.error(e);
        msg.style.color = "#c62828";
        msg.textContent = "Не удалось отправить. Попробуйте ещё раз или позвоните нам.";
        btn.disabled = false;
        btn.textContent = "Подтвердить заказ";
      }
    });
  }

  async function sendContactForm(payload) {
    return sendViaWeb3Forms(Object.assign({
      subject: "Заявка с сайта Альтер Энерго"
    }, payload));
  }

  window.AECart = {
    loadCart, saveCart, addToCart, removeFromCart,
    openCart, closeCart, renderCart, ensureCartDom,
    formatPrice, priceNumber, escapeHtml, sendContactForm,
    PAYMENT_CONFIG, openPrivacyModal
  };

  document.addEventListener("DOMContentLoaded", () => {
    ensureCartDom();
    renderCart();
    document.querySelectorAll("#openCart, .open-cart").forEach(btn => {
      btn.addEventListener("click", (e) => { e.preventDefault(); openCart(); });
    });
    // вернуться в корзину после чтения полной политики
    try {
      if (sessionStorage.getItem(CART_OPEN_KEY) === "1") {
        sessionStorage.removeItem(CART_OPEN_KEY);
        setTimeout(() => {
          openCart();
          const btn = document.getElementById("checkoutBtn");
          if (btn) btn.click();
        }, 200);
      }
    } catch (e) {}
  });
})(window);
