from .base import *  # noqa: F403
from .base import LOGGING, env

DEBUG = env.bool("DEBUG", default=True)
LOGGING["handlers"]["console"]["formatter"] = env("LOG_FORMAT", default="console")
