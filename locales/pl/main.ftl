# ── Main Menu ──────────────────────────────────────────────
welcome = Cześć, { $name }! 👋
welcome-back = Witaj z powrotem, { $name }! 👋
main-menu-text = Menu główne — wybierz sekcję:

btn-catalog = 🛍 Katalog
btn-pickup = 🏪 Odbiór osobisty
btn-inpost = 📦 Dostawa InPost
btn-profile = 👤 Profil
btn-cart = 🛒 Koszyk ({ $count })
btn-cart-empty = 🛒 Koszyk

# ── Profile ────────────────────────────────────────────────
profile-text =
    👤 <b>Profil</b>

    Imię: { $name }
    W bocie od: { $date }
    Język: { $lang }

btn-orders-history = 📋 Historia zamówień
btn-change-language = 🌐 Zmień język
btn-support = 💬 Wsparcie
btn-back = ◀️ Wstecz

language-changed = ✅ Język zmieniony na Polski
language-choose = Wybierz język:

btn-lang-ru = 🇷🇺 Русский
btn-lang-pl = 🇵🇱 Polski
btn-lang-uk = 🇺🇦 Українська

orders-history-empty = Nie masz jeszcze żadnych zamówień.
orders-history-header = 📋 <b>Historia zamówień:</b>
order-item-line =
    #{$id} — {$date}
    {$items} | {$total} zł | {$status}

order-status-new = 🆕 Nowe
order-status-confirmed = ✅ Potwierdzone
order-status-ready = 📦 Gotowe
order-status-completed = ✔️ Zrealizowane
order-status-cancelled = ❌ Anulowane

# ── Catalog / Cities / Locations ───────────────────────────
choose-city = Wybierz miasto:
choose-location = Punkty w <b>{ $city }</b>:
btn-contact-manager = 📞 Kontakt z menedżerem miasta

location-info =
    🏪 <b>{ $name }</b>
    📍 { $address }
    { $description }

    📦 Stan magazynowy: <b>{ $stock } szt.</b>
    ⏱ Ostatnia sprzedaż: <b>{ $last_sold }</b>

btn-browse-products = 🛍 Przeglądaj produkty
btn-contact-curator = 📞 Kontakt z kuratorem
btn-never = nigdy

choose-category = Wybierz kategorię:
btn-all-products = Wszystkie produkty

product-card =
    <b>{ $name }</b>
    { $description }

    💰 Cena: <b>{ $price } zł</b>

choose-variant = Wybierz smak / kolor:
btn-add-to-cart = 🛒 Do koszyka
added-to-cart = ✅ <b>{ $name }</b> dodano do koszyka!

page-nav = Strona { $page } / { $total }
btn-prev = ◀️
btn-next = ▶️

# ── Cart ───────────────────────────────────────────────────
cart-empty = Koszyk jest pusty. Dodaj produkty z katalogu!
cart-header = 🛒 <b>Koszyk:</b>
cart-line = { $name } × { $qty } = { $price } zł
cart-total = <b>Łącznie: { $total } zł</b>

btn-clear-cart = 🗑 Wyczyść koszyk
btn-checkout = ✅ Złóż zamówienie
btn-remove-item = ✖ Usuń

cart-cleared = Koszyk wyczyszczony.

# ── Checkout / Order FSM ───────────────────────────────────
choose-delivery-type = Jak chcesz otrzymać zamówienie?
btn-pickup-delivery = 🏪 Odbiór osobisty
btn-inpost-delivery = 📦 Dostawa InPost

enter-name = Podaj swoje <b>Imię</b>:
enter-phone = Podaj <b>numer telefonu</b> (np. +48 500 123 456):
enter-email = Podaj <b>e-mail</b>:
enter-address = Podaj <b>adres dostawy</b> (ulica, numer, mieszkanie, miasto):

invalid-phone = ❌ Nieprawidłowy format numeru. Spróbuj ponownie:
invalid-email = ❌ Nieprawidłowy e-mail. Spróbuj ponownie:

choose-date = Wybierz <b>datę</b>:
choose-time = Wybierz <b>godzinę</b>:

order-summary =
    📋 <b>Podsumowanie zamówienia #{$id}</b>

    { $items }

    🚚 Dostawa: <b>{ $delivery_cost } zł</b>
    💰 Razem: <b>{ $total } zł</b>

    📅 Data: { $date }
    📍 { $delivery_info }
    👤 { $customer_name } | { $phone }
    📧 { $email }

btn-add-comment = ✏️ Dodaj komentarz
btn-confirm-order = ✅ Potwierdź zamówienie
enter-comment = Napisz komentarz do zamówienia (lub /skip aby pominąć):

choose-payment = Wybierz metodę płatności:
btn-pay-cash = 💵 Gotówka
btn-pay-blik = 📱 Blik
btn-pay-monobank = 🇺🇦 Monobank (karta UA)

order-placed =
    ✅ <b>Zamówienie #{ $id } przyjęte!</b>

    Skontaktujemy się z Tobą w celu potwierdzenia.
    Dziękujemy za zakup! 🎉

# ── Admin notifications ────────────────────────────────────
admin-new-order =
    🆕 <b>Nowe zamówienie #{ $id }</b>

    👤 { $name } | { $phone }
    📧 { $email }
    🚚 { $delivery_type }
    📅 { $date }
    💰 { $total } zł | { $payment }

    { $items }

    { $comment }

delivery-type-pickup = Odbiór osobisty
delivery-type-inpost = Dostawa InPost
