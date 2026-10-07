from peewee import CharField, Model


class User(Model):
    email = CharField(unique=True)
    # The phone number is the account's login identifier: required and unique.
    phone = CharField(unique=True, null=False)
