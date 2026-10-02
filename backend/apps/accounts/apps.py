from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = "apps.accounts"
    label = "accounts"

    def ready(self) -> None:
        import common.schema  # noqa: F401  (registers the OpenAPI auth extension)
