# ── Main Menu ──────────────────────────────────────────────
welcome = Привет, { $name }! 👋
welcome-back = С возвращением, { $name }! 👋
main-menu-text = Главное меню — выбери раздел:

btn-catalog = 🛍 Каталог
btn-pickup = 🏪 Самовывоз
btn-inpost = 📦 InPost доставка
btn-profile = 👤 Профиль
btn-cart = 🛒 Корзина ({ $count })
btn-cart-empty = 🛒 Корзина

# ── Profile ────────────────────────────────────────────────
profile-text =
    👤 <b>Профиль</b>

    Имя: { $name }
    В боте с: { $date }
    Язык: { $lang }

btn-orders-history = 📋 История заказов
btn-change-language = 🌐 Изменить язык
btn-support = 💬 Поддержка
btn-back = ◀️ Назад

language-changed = ✅ Язык изменён на Русский
language-choose = Выбери язык:

btn-lang-ru = 🇷🇺 Русский
btn-lang-pl = 🇵🇱 Polski
btn-lang-uk = 🇺🇦 Українська

orders-history-empty = У тебя ещё нет заказов.
orders-history-header = 📋 <b>История заказов:</b>
order-item-line =
    #{$id} — {$date}
    {$items} | {$total} zł | {$status}

order-status-new = 🆕 Новый
order-status-confirmed = ✅ Подтверждён
order-status-ready = 📦 Готов
order-status-completed = ✔️ Выполнен
order-status-cancelled = ❌ Отменён

# ── Catalog / Cities / Locations ───────────────────────────
choose-city = Выбери город:
choose-location = Точки во <b>{ $city }</b>:
btn-contact-manager = 📞 Связаться с менеджером города

location-info =
    🏪 <b>{ $name }</b>
    📍 { $address }
    { $description }

    📦 Остаток: <b>{ $stock } шт.</b>
    ⏱ Последняя продажа: <b>{ $last_sold }</b>

btn-browse-products = 🛍 Смотреть товары
btn-contact-curator = 📞 Связаться с куратором
btn-never = никогда

choose-category = Выбери категорию:
btn-all-products = Все товары

product-card =
    <b>{ $name }</b>
    { $description }

    💰 Цена: <b>{ $price } zł</b>

choose-variant = Выбери вкус / цвет:
btn-add-to-cart = 🛒 В корзину
added-to-cart = ✅ <b>{ $name }</b> добавлен в корзину!

page-nav = Страница { $page } / { $total }
btn-prev = ◀️
btn-next = ▶️

# ── Cart ───────────────────────────────────────────────────
cart-empty = Корзина пуста. Добавь товары через каталог!
cart-header = 🛒 <b>Корзина:</b>
cart-line = { $name } × { $qty } = { $price } zł
cart-total = <b>Итого: { $total } zł</b>

btn-clear-cart = 🗑 Очистить корзину
btn-checkout = ✅ Оформить заказ
btn-remove-item = ✖ Удалить

cart-cleared = Корзина очищена.

# ── Checkout / Order FSM ───────────────────────────────────
choose-delivery-type = Как хочешь получить заказ?
btn-pickup-delivery = 🏪 Самовывоз
btn-inpost-delivery = 📦 InPost доставка

enter-name = Введи своё <b>Имя</b>:
enter-phone = Введи <b>номер телефона</b> (напр. +48 500 123 456):
enter-email = Введи <b>email</b>:
enter-address = Введи <b>адрес доставки</b> (улица, дом, квартира, город):

invalid-phone = ❌ Неверный формат номера. Попробуй ещё раз:
invalid-email = ❌ Неверный email. Попробуй ещё раз:

choose-date = Выбери <b>дату</b>:
choose-time = Выбери <b>время</b>:

order-summary =
    📋 <b>Сводка заказа #{$id}</b>

    { $items }

    🚚 Доставка: <b>{ $delivery_cost } zł</b>
    💰 Итого: <b>{ $total } zł</b>

    📅 Дата: { $date }
    📍 { $delivery_info }
    👤 { $customer_name } | { $phone }
    📧 { $email }

btn-add-comment = ✏️ Добавить комментарий
btn-confirm-order = ✅ Подтвердить заказ
enter-comment = Напиши комментарий к заказу (или /skip чтобы пропустить):

choose-payment = Выбери способ оплаты:
btn-pay-cash = 💵 Наличные
btn-pay-blik = 📱 Blik
btn-pay-monobank = 🇺🇦 Monobank (UA карта)

order-placed =
    ✅ <b>Заказ #{ $id } принят!</b>

    Мы свяжемся с тобой для подтверждения.
    Спасибо за покупку! 🎉

# ── Admin notifications ────────────────────────────────────
admin-new-order =
    🆕 <b>Новый заказ #{ $id }</b>

    👤 { $name } | { $phone }
    📧 { $email }
    🚚 { $delivery_type }
    📅 { $date }
    💰 { $total } zł | { $payment }

    { $items }

    { $comment }

delivery-type-pickup = Самовывоз
delivery-type-inpost = InPost доставка
