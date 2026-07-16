# ── Main Menu ──────────────────────────────────────────────
welcome = Привіт, { $name }! 👋
welcome-back = З поверненням, { $name }! 👋
main-menu-text = Головне меню — обери розділ:

btn-catalog = 🛍 Каталог
btn-pickup = 🏪 Самовивіз
btn-inpost = 📦 Доставка InPost
btn-profile = 👤 Профіль
btn-cart = 🛒 Кошик ({ $count })
btn-cart-empty = 🛒 Кошик

# ── Profile ────────────────────────────────────────────────
profile-text =
    👤 <b>Профіль</b>

    Ім'я: { $name }
    В боті з: { $date }
    Мова: { $lang }

btn-orders-history = 📋 Історія замовлень
btn-change-language = 🌐 Змінити мову
btn-support = 💬 Підтримка
btn-back = ◀️ Назад

language-changed = ✅ Мову змінено на Українську
language-choose = Обери мову:

btn-lang-ru = 🇷🇺 Русский
btn-lang-pl = 🇵🇱 Polski
btn-lang-uk = 🇺🇦 Українська

orders-history-empty = У тебе ще немає замовлень.
orders-history-header = 📋 <b>Історія замовлень:</b>
order-item-line =
    #{$id} — {$date}
    {$items} | {$total} zł | {$status}

order-status-new = 🆕 Нове
order-status-confirmed = ✅ Підтверджено
order-status-ready = 📦 Готово
order-status-completed = ✔️ Виконано
order-status-cancelled = ❌ Скасовано

# ── Catalog / Cities / Locations ───────────────────────────
choose-city = Обери місто:
choose-location = Точки у <b>{ $city }</b>:
btn-contact-manager = 📞 Зв'язатися з менеджером міста

location-info =
    🏪 <b>{ $name }</b>
    📍 { $address }
    { $description }

    📦 Залишок: <b>{ $stock } шт.</b>
    ⏱ Остання продаж: <b>{ $last_sold }</b>

btn-browse-products = 🛍 Переглянути товари
btn-contact-curator = 📞 Зв'язатися з куратором
btn-never = ніколи

choose-category = Обери категорію:
btn-all-products = Всі товари

product-card =
    <b>{ $name }</b>
    { $description }

    💰 Ціна: <b>{ $price } zł</b>

choose-variant = Обери смак / колір:
btn-add-to-cart = 🛒 В кошик
added-to-cart = ✅ <b>{ $name }</b> додано до кошика!

page-nav = Сторінка { $page } / { $total }
btn-prev = ◀️
btn-next = ▶️

# ── Cart ───────────────────────────────────────────────────
cart-empty = Кошик порожній. Додай товари з каталогу!
cart-header = 🛒 <b>Кошик:</b>
cart-line = { $name } × { $qty } = { $price } zł
cart-total = <b>Разом: { $total } zł</b>

btn-clear-cart = 🗑 Очистити кошик
btn-checkout = ✅ Оформити замовлення
btn-remove-item = ✖ Видалити

cart-cleared = Кошик очищено.

# ── Checkout / Order FSM ───────────────────────────────────
choose-delivery-type = Як хочеш отримати замовлення?
btn-pickup-delivery = 🏪 Самовивіз
btn-inpost-delivery = 📦 Доставка InPost

enter-name = Введи своє <b>Ім'я</b>:
enter-phone = Введи <b>номер телефону</b> (напр. +48 500 123 456):
enter-email = Введи <b>email</b>:
enter-address = Введи <b>адресу доставки</b> (вулиця, будинок, квартира, місто):

invalid-phone = ❌ Невірний формат номера. Спробуй ще раз:
invalid-email = ❌ Невірний email. Спробуй ще раз:

choose-date = Обери <b>дату</b>:
choose-time = Обери <b>час</b>:

order-summary =
    📋 <b>Зведення замовлення #{$id}</b>

    { $items }

    🚚 Доставка: <b>{ $delivery_cost } zł</b>
    💰 Разом: <b>{ $total } zł</b>

    📅 Дата: { $date }
    📍 { $delivery_info }
    👤 { $customer_name } | { $phone }
    📧 { $email }

btn-add-comment = ✏️ Додати коментар
btn-confirm-order = ✅ Підтвердити замовлення
enter-comment = Напиши коментар до замовлення (або /skip щоб пропустити):

choose-payment = Обери спосіб оплати:
btn-pay-cash = 💵 Готівка
btn-pay-blik = 📱 Blik
btn-pay-monobank = 🇺🇦 Monobank (UA карта)

order-placed =
    ✅ <b>Замовлення #{ $id } прийнято!</b>

    Ми зв'яжемося з тобою для підтвердження.
    Дякуємо за покупку! 🎉

# ── Admin notifications ────────────────────────────────────
admin-new-order =
    🆕 <b>Нове замовлення #{ $id }</b>

    👤 { $name } | { $phone }
    📧 { $email }
    🚚 { $delivery_type }
    📅 { $date }
    💰 { $total } zł | { $payment }

    { $items }

    { $comment }

delivery-type-pickup = Самовивіз
delivery-type-inpost = Доставка InPost
