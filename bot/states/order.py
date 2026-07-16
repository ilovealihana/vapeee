from aiogram.fsm.state import State, StatesGroup


class OrderFSM(StatesGroup):
    SELECT_DELIVERY_TYPE = State()
    ENTER_NAME = State()
    ENTER_PHONE = State()
    ENTER_EMAIL = State()
    ENTER_ADDRESS = State()       # InPost only
    SELECT_DATE = State()
    SELECT_TIME = State()
    CONFIRM_SUMMARY = State()
    ENTER_COMMENT = State()
    SELECT_PAYMENT = State()
