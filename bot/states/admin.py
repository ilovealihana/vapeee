from aiogram.fsm.state import State, StatesGroup


class AdminProductFSM(StatesGroup):
    ENTER_NAME_RU = State()
    ENTER_NAME_PL = State()
    ENTER_NAME_UK = State()
    ENTER_PRICE = State()
    ENTER_DESCRIPTION_RU = State()
    ENTER_PHOTO = State()
    SELECT_CATEGORY = State()


class AdminVariantFSM(StatesGroup):
    SELECT_PRODUCT = State()
    ENTER_NAME_RU = State()
    ENTER_NAME_PL = State()
    ENTER_NAME_UK = State()
    ENTER_PRICE_OVERRIDE = State()


class AdminLocationFSM(StatesGroup):
    SELECT_CITY = State()
    ENTER_NAME = State()
    ENTER_ADDRESS = State()
    ENTER_DESCRIPTION = State()
    ENTER_CURATOR = State()


class AdminCityFSM(StatesGroup):
    ENTER_NAME = State()
    ENTER_SLUG = State()


class AdminStockFSM(StatesGroup):
    SELECT_LOCATION = State()
    SELECT_VARIANT = State()
    ENTER_QUANTITY = State()


class AdminOrderFSM(StatesGroup):
    SELECT_ORDER = State()
    SELECT_STATUS = State()
